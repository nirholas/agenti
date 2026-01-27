/**
 * Arbitrum X402 Adapter
 * 
 * Specialized adapter for X402 payments on Arbitrum with:
 * - Sperax USD ($USDs) auto-yield stablecoin support
 * - EIP-3009 payment authorizations (gasless transfers)
 * - Layer-2 optimized transactions
 * - Arbitrum Sepolia testnet support
 * 
 * @see https://github.com/hummusonrails/x402-demo-arbitrum
 * @since December 1, 2025
 */

import { Address, createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { X402Chain, X402Token, PaymentRequest, PaymentTransaction } from './types';

/**
 * Sperax USD Contract Address (Mainnet)
 * Auto-yield stablecoin on Arbitrum
 */
export const SPERAX_USD_ADDRESS: Address = '0xd74f5255d557944cf7dd0e45ff521520002d5748';

/**
 * EIP-3009 Transfer Authorization Signature
 */
export interface EIP3009Authorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: string;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

/**
 * Arbitrum X402 Adapter Configuration
 */
export interface ArbitrumX402Config {
  /** Network (mainnet or sepolia) */
  network: 'mainnet' | 'sepolia';
  
  /** RPC URL (optional, uses default if not provided) */
  rpcUrl?: string;
  
  /** Private key for signing transactions */
  privateKey?: `0x${string}`;
  
  /** Enable EIP-3009 gasless transfers */
  enableGasless?: boolean;
  
  /** Facilitator URL for payment verification */
  facilitatorUrl?: string;
  
  /** Quote service URL */
  quoteServiceUrl?: string;
}

/**
 * Token configurations for Arbitrum
 */
export const ARBITRUM_TOKENS: Record<string, { address: Address; decimals: number; name: string }> = {
  'USDs': {
    address: SPERAX_USD_ADDRESS,
    decimals: 18,
    name: 'Sperax USD',
  },
  'USDC': {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address, // Arbitrum mainnet USDC
    decimals: 6,
    name: 'USD Coin',
  },
  'USDT': {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address, // Arbitrum mainnet USDT
    decimals: 6,
    name: 'Tether USD',
  },
  'DAI': {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as Address, // Arbitrum mainnet DAI
    decimals: 18,
    name: 'Dai Stablecoin',
  },
};

/**
 * Arbitrum Sepolia test token addresses
 */
export const ARBITRUM_SEPOLIA_TOKENS: Record<string, Address> = {
  'TestUSDC': '0x...' as Address, // Deploy with pnpm x402:deploy
  'TestWETH': '0x...' as Address, // Deploy with pnpm x402:deploy
  'TestUSDs': '0x...' as Address, // Custom test USDs deployment
};

/**
 * EIP-712 Domain for EIP-3009
 */
export const EIP3009_DOMAIN = {
  name: 'USD Coin', // Or 'Sperax USD' for USDs
  version: '1',
  chainId: 42161, // Arbitrum mainnet
  verifyingContract: SPERAX_USD_ADDRESS,
};

/**
 * EIP-712 Types for Transfer With Authorization
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/**
 * Arbitrum X402 Adapter
 */
export class ArbitrumX402Adapter {
  private publicClient;
  private walletClient;
  private account;
  private config: Required<ArbitrumX402Config>;

  constructor(config: ArbitrumX402Config) {
    const chain = config.network === 'mainnet' ? arbitrum : arbitrumSepolia;
    const rpcUrl = config.rpcUrl || (config.network === 'mainnet' 
      ? 'https://arb1.arbitrum.io/rpc'
      : 'https://sepolia-rollup.arbitrum.io/rpc');

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    if (config.privateKey) {
      this.account = privateKeyToAccount(config.privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      });
    }

    this.config = {
      network: config.network,
      rpcUrl,
      privateKey: config.privateKey || '0x',
      enableGasless: config.enableGasless ?? true,
      facilitatorUrl: config.facilitatorUrl || 'http://localhost:3002',
      quoteServiceUrl: config.quoteServiceUrl || 'http://localhost:3001',
    };
  }

  /**
   * Create EIP-3009 payment authorization signature
   * Enables gasless token transfers
   */
  async createPaymentAuthorization(
    request: PaymentRequest,
    fromAddress: Address,
    privateKey: `0x${string}`
  ): Promise<EIP3009Authorization> {
    const tokenConfig = ARBITRUM_TOKENS[request.token] || ARBITRUM_TOKENS['USDs'];
    const value = parseUnits(request.price, tokenConfig.decimals);
    const validAfter = BigInt(Math.floor(Date.now() / 1000));
    const validBefore = BigInt(request.deadline || (Math.floor(Date.now() / 1000) + 300)); // 5 min default
    const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`;

    const domain = {
      ...EIP3009_DOMAIN,
      chainId: this.config.network === 'mainnet' ? 42161 : 421614,
      verifyingContract: tokenConfig.address,
      name: tokenConfig.name,
    };

    const account = privateKeyToAccount(privateKey);

    // Sign EIP-712 message
    const signature = await account.signTypedData({
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: fromAddress,
        to: request.recipient,
        value,
        validAfter,
        validBefore,
        nonce,
      },
    });

    // Split signature into v, r, s components
    const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(signature.slice(130, 132), 16);

    return {
      from: fromAddress,
      to: request.recipient,
      value,
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
    };
  }

  /**
   * Execute payment with EIP-3009 (gasless)
   */
  async executeGaslessPayment(
    request: PaymentRequest,
    authorization: EIP3009Authorization
  ): Promise<PaymentTransaction> {
    const tokenConfig = ARBITRUM_TOKENS[request.token] || ARBITRUM_TOKENS['USDs'];

    // Call transferWithAuthorization on the token contract
    const hash = await this.walletClient.writeContract({
      address: tokenConfig.address,
      abi: [
        {
          name: 'transferWithAuthorization',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
            { name: 'v', type: 'uint8' },
            { name: 'r', type: 'bytes32' },
            { name: 's', type: 'bytes32' },
          ],
          outputs: [],
        },
      ],
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from,
        authorization.to,
        authorization.value,
        authorization.validAfter,
        authorization.validBefore,
        authorization.nonce,
        authorization.v,
        authorization.r,
        authorization.s,
      ],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      chainId: this.config.network === 'mainnet' ? 42161 : 421614,
      from: authorization.from,
      to: authorization.to,
      value: authorization.value.toString(),
      tokenAddress: tokenConfig.address,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      blockNumber: Number(receipt.blockNumber),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Execute standard ERC-20 transfer payment
   */
  async executeStandardPayment(request: PaymentRequest): Promise<PaymentTransaction> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized. Provide privateKey in config.');
    }

    const tokenConfig = ARBITRUM_TOKENS[request.token] || ARBITRUM_TOKENS['USDs'];
    const value = parseUnits(request.price, tokenConfig.decimals);

    const hash = await this.walletClient.writeContract({
      address: tokenConfig.address,
      abi: [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'transfer',
      args: [request.recipient, value],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      chainId: this.config.network === 'mainnet' ? 42161 : 421614,
      from: this.account.address,
      to: request.recipient,
      value: value.toString(),
      tokenAddress: tokenConfig.address,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      blockNumber: Number(receipt.blockNumber),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Verify payment through facilitator
   */
  async verifyPayment(authorization: EIP3009Authorization): Promise<boolean> {
    const response = await fetch(`${this.config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 1,
        scheme: 'exact',
        network: this.config.network === 'mainnet' ? 'arbitrum' : 'arbitrum-sepolia',
        payload: authorization,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment verification failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.verified === true;
  }

  /**
   * Get USDs balance with auto-yield
   */
  async getUSdsBalance(address: Address): Promise<{ balance: string; formattedBalance: string }> {
    const balance = await this.publicClient.readContract({
      address: SPERAX_USD_ADDRESS,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [address],
    });

    return {
      balance: balance.toString(),
      formattedBalance: formatUnits(balance, 18),
    };
  }

  /**
   * Get accumulated yield for USDs holder
   */
  async getUSdsYield(address: Address): Promise<string> {
    // USDs automatically rebases, so yield is reflected in balance
    // This would query historical balance to calculate yield
    const currentBalance = await this.getUSdsBalance(address);
    // TODO: Implement historical balance tracking for yield calculation
    return '0'; // Placeholder
  }

  /**
   * Create X402 payment request for Arbitrum
   */
  createPaymentRequest(params: {
    price: string;
    recipient: Address;
    token?: X402Token;
    description?: string;
  }): PaymentRequest {
    return {
      price: params.price,
      token: params.token || 'USDs',
      chain: this.config.network === 'mainnet' ? 'arbitrum' : 'arbitrum-sepolia',
      recipient: params.recipient,
      deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      description: params.description || 'X402 payment on Arbitrum',
    };
  }

  /**
   * Get network info
   */
  getNetworkInfo() {
    return {
      chain: this.config.network === 'mainnet' ? 'arbitrum' : 'arbitrum-sepolia',
      chainId: this.config.network === 'mainnet' ? 42161 : 421614,
      rpcUrl: this.config.rpcUrl,
      explorerUrl: this.config.network === 'mainnet' 
        ? 'https://arbiscan.io'
        : 'https://sepolia.arbiscan.io',
    };
  }
}

/**
 * Create Arbitrum X402 adapter instance
 */
export function createArbitrumAdapter(config: ArbitrumX402Config): ArbitrumX402Adapter {
  return new ArbitrumX402Adapter(config);
}

/**
 * Helper: Check if token supports EIP-3009
 */
export function supportsEIP3009(token: X402Token): boolean {
  return ['USDC', 'USDs'].includes(token);
}

/**
 * Helper: Get token info for Arbitrum
 */
export function getArbitrumTokenInfo(token: X402Token) {
  return ARBITRUM_TOKENS[token] || null;
}
