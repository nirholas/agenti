/**
 * @fileoverview API client implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * X402 Payment Client
 * 
 * Core client for X402 payment protocol implementation
 * Handles payment requests, transaction execution, and verification
 * 
 * @example
 * ```typescript
 * const client = new X402Client({
 *   chain: 'base',
 *   privateKey: process.env.PRIVATE_KEY
 * });
 * 
 * // Parse 402 response
 * const paymentDetails = client.parsePaymentRequest(response);
 * 
 * // Execute payment
 * const tx = await client.executePayment(paymentDetails);
 * 
 * // Verify payment
 * const verified = await client.verifyPayment(tx.hash, paymentDetails);
 * ```
 * 
 * @since November 30, 2025
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
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, bsc, mainnet, polygon, arbitrum, optimism } from 'viem/chains';
import {
  X402ClientOptions,
  PaymentRequest,
  PaymentTransaction,
  PaymentVerification,
  HTTP402Response,
  X402Error,
  X402ErrorCode,
  X402Chain,
  X402Token,
  TOKEN_DECIMALS,
  CHAIN_IDS,
  PaymentEventListener,
  PaymentEvent,
} from './types';

/**
 * Chain configuration mapping
 */
const CHAINS = {
  base,
  bsc,
  ethereum: mainnet,
  polygon,
  arbitrum,
  optimism,
};

/**
 * Default RPC URLs for X402 supported chains
 */
const DEFAULT_RPC_URLS: Record<X402Chain, string> = {
  base: 'https://mainnet.base.org',
  bsc: 'https://bsc-dataseed.binance.org',
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
};

/**
 * ERC-20 token addresses per chain
 */
const TOKEN_ADDRESSES: Record<X402Chain, Record<X402Token, Address>> = {
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    ETH: '0x0000000000000000000000000000000000000000', // Native
    BNB: '0x0000000000000000000000000000000000000000',
    MATIC: '0x0000000000000000000000000000000000000000',
  },
  bsc: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    DAI: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    BNB: '0x0000000000000000000000000000000000000000', // Native
    MATIC: '0xCC42724C6683B7E57334c4E856f4c9965ED682bD',
  },
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    ETH: '0x0000000000000000000000000000000000000000', // Native
    BNB: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
    MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    ETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    BNB: '0x3BA4c387f786bFEE076A58914F5Bd38d668B42c3',
    MATIC: '0x0000000000000000000000000000000000000000', // Native
  },
  arbitrum: {
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    ETH: '0x0000000000000000000000000000000000000000', // Native
    BNB: '0x0000000000000000000000000000000000000000',
    MATIC: '0x0000000000000000000000000000000000000000',
  },
  optimism: {
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    ETH: '0x0000000000000000000000000000000000000000', // Native
    BNB: '0x0000000000000000000000000000000000000000',
    MATIC: '0x0000000000000000000000000000000000000000',
  },
};

/**
 * ERC-20 ABI (minimal for transfer)
 */
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * X402 Payment Client
 */
export class X402Client {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private chain: X402Chain;
  private listeners: Set<PaymentEventListener> = new Set();

  constructor(private options: X402ClientOptions) {
    this.chain = options.chain;

    // Validate chain
    if (!CHAINS[this.chain]) {
      throw new X402Error(
        `Chain "${this.chain}" not supported for X402 payments`,
        X402ErrorCode.UNSUPPORTED_CHAIN
      );
    }

    // Initialize public client
    const rpcUrl = options.rpcUrl || DEFAULT_RPC_URLS[this.chain];
    this.publicClient = createPublicClient({
      chain: CHAINS[this.chain],
      transport: http(rpcUrl, {
        timeout: options.timeout || 30_000,
      }),
    });

    // Initialize wallet client if private key provided
    if (options.privateKey) {
      const account = privateKeyToAccount(options.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain: CHAINS[this.chain],
        transport: http(rpcUrl),
      });
    } else if (options.provider) {
      this.walletClient = options.provider;
    }
  }

  /**
   * Parse HTTP 402 response to extract payment details
   */
  parsePaymentRequest(response: HTTP402Response): PaymentRequest {
    if (response.status !== 402) {
      throw new X402Error(
        'Response is not a 402 Payment Required',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    const authHeader = response.headers['www-authenticate'];
    if (!authHeader || !authHeader.startsWith('X402 ')) {
      throw new X402Error(
        'Invalid X402 payment request: missing authentication header',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    // Parse authentication header
    // Format: X402 price="0.001 USDC" chain="base" recipient="0x123..."
    const params: Record<string, string> = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    
    while ((match = regex.exec(authHeader)) !== null) {
      params[match[1]] = match[2];
    }

    // Extract price and token
    const priceMatch = params.price?.match(/^([\d.]+)\s+(\w+)$/);
    if (!priceMatch) {
      throw new X402Error(
        'Invalid price format in payment request',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    const [, price, token] = priceMatch;

    // Validate payment details
    this.validatePaymentDetails({
      price,
      token: token as X402Token,
      chain: params.chain as X402Chain,
      recipient: params.recipient as Address,
      reference: params.reference,
      deadline: params.deadline ? parseInt(params.deadline) : undefined,
      toolName: params.tool,
      description: params.description || response.message,
    });

    return {
      price,
      token: token as X402Token,
      chain: params.chain as X402Chain,
      recipient: params.recipient as Address,
      reference: params.reference,
      deadline: params.deadline ? parseInt(params.deadline) : undefined,
      toolName: params.tool,
      description: params.description || response.message,
    };
  }

  /**
   * Validate payment details
   */
  validatePaymentDetails(details: PaymentRequest): void {
    // Validate price
    const priceNum = parseFloat(details.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      throw new X402Error(
        'Payment amount must be positive',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    // Validate token
    if (!TOKEN_DECIMALS[details.token]) {
      throw new X402Error(
        `Unsupported token: ${details.token}`,
        X402ErrorCode.UNSUPPORTED_TOKEN
      );
    }

    // Validate chain
    if (!CHAINS[details.chain]) {
      throw new X402Error(
        `Unsupported chain: ${details.chain}`,
        X402ErrorCode.UNSUPPORTED_CHAIN
      );
    }

    // Validate recipient address
    if (!details.recipient || !/^0x[a-fA-F0-9]{40}$/.test(details.recipient)) {
      throw new X402Error(
        'Invalid recipient address',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    // Check deadline
    if (details.deadline && details.deadline < Date.now() / 1000) {
      throw new X402Error(
        'Payment deadline has passed',
        X402ErrorCode.PAYMENT_TIMEOUT
      );
    }
  }

  /**
   * Execute payment transaction
   */
  async executePayment(
    details: PaymentRequest,
    signer?: WalletClient
  ): Promise<PaymentTransaction> {
    const client = signer || this.walletClient;
    
    if (!client || !client.account) {
      throw new X402Error(
        'Wallet client not initialized. Provide privateKey or signer.',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    // Emit payment requested event
    await this.emitEvent({
      type: 'payment_requested',
      data: details,
    });

    try {
      // Check balance
      const balance = await this.getBalance(
        client.account.address,
        details.token
      );
      
      const amount = parseUnits(details.price, TOKEN_DECIMALS[details.token]);
      
      if (balance < amount) {
        throw new X402Error(
          `Insufficient ${details.token} balance`,
          X402ErrorCode.INSUFFICIENT_BALANCE,
          { balance: formatUnits(balance, TOKEN_DECIMALS[details.token]), required: details.price }
        );
      }

      let hash: Hash;

      // Execute payment
      if (this.isNativeToken(details.token, details.chain)) {
        // Native token transfer
        hash = await client.sendTransaction({
          to: details.recipient,
          value: amount,
        });
      } else {
        // ERC-20 transfer
        const tokenAddress = this.getTokenAddress(details.token, details.chain);
        
        hash = await client.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [details.recipient, amount],
        });
      }

      const transaction: PaymentTransaction = {
        hash,
        chainId: CHAIN_IDS[details.chain],
        from: client.account.address,
        to: details.recipient,
        value: details.price,
        tokenAddress: this.isNativeToken(details.token, details.chain)
          ? undefined
          : this.getTokenAddress(details.token, details.chain),
        status: 'pending',
      };

      // Emit payment approved event
      await this.emitEvent({
        type: 'payment_approved',
        data: transaction,
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      transaction.status = receipt.status === 'success' ? 'confirmed' : 'failed';
      transaction.blockNumber = Number(receipt.blockNumber);
      transaction.gasUsed = receipt.gasUsed.toString();

      if (transaction.status === 'confirmed') {
        await this.emitEvent({
          type: 'payment_confirmed',
          data: transaction,
        });
      } else {
        throw new X402Error(
          'Transaction failed',
          X402ErrorCode.TRANSACTION_FAILED,
          { receipt }
        );
      }

      return transaction;
    } catch (error: any) {
      // Emit payment failed event
      await this.emitEvent({
        type: 'payment_failed',
        data: { error: error.message },
      });

      if (error instanceof X402Error) {
        throw error;
      }

      // Handle specific errors
      if (error.message?.includes('underpriced')) {
        throw new X402Error(
          'Transaction underpriced. Retry with higher gas.',
          X402ErrorCode.TRANSACTION_FAILED,
          { originalError: error }
        );
      }

      throw new X402Error(
        `Payment execution failed: ${error.message}`,
        X402ErrorCode.TRANSACTION_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Execute payment with automatic retry on failure
   */
  async executePaymentWithFallback(
    details: PaymentRequest,
    maxRetries: number = 3
  ): Promise<PaymentTransaction & { usedFallback: boolean }> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await this.executePayment(details);
        return { ...tx, usedFallback: attempt > 1 };
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new X402Error(
      `Payment failed after ${maxRetries} attempts: ${lastError?.message}`,
      X402ErrorCode.TRANSACTION_FAILED,
      { lastError }
    );
  }

  /**
   * Verify payment transaction on-chain
   */
  async verifyPayment(
    txHash: Hash,
    expectedDetails: Partial<PaymentRequest>
  ): Promise<PaymentVerification> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash,
      });

      if (!receipt) {
        throw new X402Error(
          'Transaction not found',
          X402ErrorCode.VERIFICATION_FAILED
        );
      }

      if (receipt.status === 'reverted') {
        return {
          verified: false,
          error: 'Transaction reverted',
          verifiedAt: Date.now(),
        };
      }

      const tx = await this.publicClient.getTransaction({
        hash: txHash,
      });

      if (!tx) {
        throw new X402Error(
          'Transaction still pending',
          X402ErrorCode.VERIFICATION_FAILED
        );
      }

      // Verify recipient
      if (expectedDetails.recipient && tx.to !== expectedDetails.recipient) {
        return {
          verified: false,
          error: `Payment sent to wrong recipient. Expected: ${expectedDetails.recipient}, Got: ${tx.to}`,
          verifiedAt: Date.now(),
        };
      }

      const transaction: PaymentTransaction = {
        hash: txHash,
        chainId: Number(tx.chainId),
        from: tx.from,
        to: tx.to!,
        value: formatUnits(tx.value, 18), // Adjust based on token
        status: 'confirmed',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
      };

      return {
        verified: true,
        transaction,
        verifiedAt: Date.now(),
      };
    } catch (error: any) {
      if (error instanceof X402Error) {
        throw error;
      }

      throw new X402Error(
        `Payment verification failed: ${error.message}`,
        X402ErrorCode.VERIFICATION_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Get token balance for an address
   */
  async getBalance(address: Address, token: X402Token): Promise<bigint> {
    if (this.isNativeToken(token, this.chain)) {
      return await this.publicClient.getBalance({ address });
    }

    const tokenAddress = this.getTokenAddress(token, this.chain);
    
    return await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;
  }

  /**
   * Check if token is native (ETH, BNB, MATIC)
   */
  private isNativeToken(token: X402Token, chain: X402Chain): boolean {
    return (
      (token === 'ETH' && (chain === 'base' || chain === 'ethereum' || chain === 'arbitrum' || chain === 'optimism')) ||
      (token === 'BNB' && chain === 'bsc') ||
      (token === 'MATIC' && chain === 'polygon')
    );
  }

  /**
   * Get token contract address for chain
   */
  private getTokenAddress(token: X402Token, chain: X402Chain): Address {
    const address = TOKEN_ADDRESSES[chain]?.[token];
    
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      throw new X402Error(
        `Token ${token} not available on ${chain}`,
        X402ErrorCode.UNSUPPORTED_TOKEN
      );
    }

    return address;
  }

  /**
   * Add payment event listener
   */
  on(listener: PaymentEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove payment event listener
   */
  off(listener: PaymentEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit payment event to all listeners
   */
  private async emitEvent(event: PaymentEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error('Payment event listener error:', error);
      }
    }
  }
}
