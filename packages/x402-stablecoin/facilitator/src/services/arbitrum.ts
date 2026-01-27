/**
 * Arbitrum Blockchain Client Service
 * 
 * Handles all blockchain interactions for the facilitator
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
} from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Network, TokenConfig } from '../types.js';
import { logger } from '../middleware/logger.js';

/**
 * Token configurations
 */
export const TOKEN_CONFIGS: Record<string, TokenConfig> = {
  USDs: {
    address: '0xD74f5255D557944cf7Dd0E45FF521520002D5748' as Address,
    decimals: 18,
    name: 'Sperax USD',
    supportsEIP3009: true,
  },
  USDC: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    decimals: 6,
    name: 'USD Coin',
    supportsEIP3009: true,
  },
  USDT: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address,
    decimals: 6,
    name: 'Tether USD',
    supportsEIP3009: false,
  },
  DAI: {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as Address,
    decimals: 18,
    name: 'Dai Stablecoin',
    supportsEIP3009: false,
  },
};

/**
 * Standard ERC-20 ABI subset
 */
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
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
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * EIP-3009 Transfer With Authorization ABI
 */
const TRANSFER_WITH_AUTHORIZATION_ABI = [
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
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Arbitrum Blockchain Client
 */
export class ArbitrumClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;
  private account: PrivateKeyAccount | null = null;
  private network: Network;
  private chainId: number;

  constructor(network: Network, rpcUrl: string, privateKey?: `0x${string}`) {
    this.network = network;
    const chain = network === 'arbitrum' ? arbitrum : arbitrumSepolia;
    this.chainId = chain.id;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    if (privateKey) {
      this.account = privateKeyToAccount(privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      });
    }

    logger.info(`ArbitrumClient initialized for ${network}`, {
      chainId: this.chainId,
      hasWallet: !!this.walletClient,
    });
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<bigint> {
    return this.publicClient.getBlockNumber();
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: `0x${string}`): Promise<TransactionReceipt | null> {
    try {
      return await this.publicClient.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      logger.debug(`Transaction receipt not found: ${txHash}`);
      return null;
    }
  }

  /**
   * Wait for transaction receipt with timeout
   */
  async waitForTransaction(
    txHash: `0x${string}`,
    confirmations = 1,
    timeout = 60000
  ): Promise<TransactionReceipt> {
    return this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations,
      timeout,
    });
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenSymbol: string, address: Address): Promise<{
    balance: bigint;
    formatted: string;
  }> {
    const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
    if (!tokenConfig) {
      throw new Error(`Unknown token: ${tokenSymbol}`);
    }

    const balance = await this.publicClient.readContract({
      address: tokenConfig.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    return {
      balance,
      formatted: formatUnits(balance, tokenConfig.decimals),
    };
  }

  /**
   * Verify a token transfer transaction
   */
  async verifyTransfer(
    txHash: `0x${string}`,
    expectedRecipient: Address,
    expectedAmount: string,
    tokenSymbol: string
  ): Promise<{
    verified: boolean;
    blockNumber?: number;
    confirmations?: number;
    error?: string;
  }> {
    try {
      const receipt = await this.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { verified: false, error: 'Transaction not found' };
      }

      if (receipt.status !== 'success') {
        return { verified: false, error: 'Transaction failed' };
      }

      const tokenConfig = TOKEN_CONFIGS[tokenSymbol];
      if (!tokenConfig) {
        return { verified: false, error: `Unknown token: ${tokenSymbol}` };
      }

      // Check transaction logs for Transfer event
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const expectedValue = parseUnits(expectedAmount, tokenConfig.decimals);
      
      const transferLog = receipt.logs.find((log: { address: string; topics: readonly string[]; data: string }) => {
        if (log.address.toLowerCase() !== tokenConfig.address.toLowerCase()) {
          return false;
        }
        if (log.topics[0] !== transferEventSignature) {
          return false;
        }
        // topics[2] is the 'to' address (padded to 32 bytes)
        const toAddress = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
        if (toAddress !== expectedRecipient.toLowerCase()) {
          return false;
        }
        // data contains the value
        const value = BigInt(log.data);
        return value >= expectedValue;
      });

      if (!transferLog) {
        return { verified: false, error: 'Transfer not found in transaction' };
      }

      const currentBlock = await this.getBlockNumber();
      const confirmations = Number(currentBlock - receipt.blockNumber);

      return {
        verified: true,
        blockNumber: Number(receipt.blockNumber),
        confirmations,
      };
    } catch (error) {
      logger.error('Error verifying transfer', { error, txHash });
      return { verified: false, error: String(error) };
    }
  }

  /**
   * Execute EIP-3009 transferWithAuthorization
   */
  async executeTransferWithAuthorization(params: {
    tokenAddress: Address;
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
    v: number;
    r: `0x${string}`;
    s: `0x${string}`;
  }): Promise<{
    success: boolean;
    txHash?: `0x${string}`;
    gasUsed?: string;
    error?: string;
  }> {
    if (!this.walletClient || !this.account) {
      return { success: false, error: 'Wallet not configured for settlements' };
    }

    try {
      // Check if authorization has already been used
      const isUsed = await this.publicClient.readContract({
        address: params.tokenAddress,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'authorizationState',
        args: [params.from, params.nonce],
      });

      if (isUsed) {
        return { success: false, error: 'Authorization already used' };
      }

      // Execute the transfer
      const hash = await this.walletClient.writeContract({
        address: params.tokenAddress,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          params.from,
          params.to,
          params.value,
          params.validAfter,
          params.validBefore,
          params.nonce,
          params.v,
          params.r,
          params.s,
        ],
      });

      logger.info('TransferWithAuthorization submitted', { hash });

      // Wait for confirmation
      const receipt = await this.waitForTransaction(hash);

      return {
        success: receipt.status === 'success',
        txHash: hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.error('Error executing transferWithAuthorization', { error });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get chain info
   */
  getChainInfo() {
    return {
      network: this.network,
      chainId: this.chainId,
      explorerUrl: this.network === 'arbitrum'
        ? 'https://arbiscan.io'
        : 'https://sepolia.arbiscan.io',
    };
  }

  /**
   * Get token config
   */
  getTokenConfig(symbol: string): TokenConfig | undefined {
    return TOKEN_CONFIGS[symbol];
  }
}

/**
 * Create ArbitrumClient instance
 */
export function createArbitrumClient(
  network: Network,
  rpcUrl: string,
  privateKey?: `0x${string}`
): ArbitrumClient {
  return new ArbitrumClient(network, rpcUrl, privateKey);
}
