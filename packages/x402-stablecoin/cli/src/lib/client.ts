/**
 * @fileoverview X402 Client Wrapper for CLI
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
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
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { getConfig, getRpcUrl, getChainId, addToHistory } from './config.js';
import { Network, Token, TransactionRecord, BalanceInfo, YieldInfo, ToolInfo, PaymentOptions } from '../types.js';

/**
 * Token addresses on Arbitrum
 */
const ARBITRUM_TOKENS: Record<Token, { address: Address; decimals: number }> = {
  'USDs': {
    address: '0xD74f5255D557944cf7Dd0E45FF521520002D5748' as Address,
    decimals: 18,
  },
  'USDC': {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    decimals: 6,
  },
  'USDT': {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address,
    decimals: 6,
  },
  'DAI': {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as Address,
    decimals: 18,
  },
};

/**
 * USDs Token ABI (minimal)
 */
const USDS_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
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
    name: 'rebasingCreditsPerToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/**
 * ERC20 ABI (minimal)
 */
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
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
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

/**
 * X402 CLI Client
 */
export class X402CLIClient {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private network: Network;
  private walletAddress?: Address;

  constructor(privateKey?: string) {
    const config = getConfig();
    this.network = config.network;
    
    const chain = this.network === 'arbitrum' ? arbitrum : arbitrumSepolia;
    const rpcUrl = getRpcUrl();

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    if (privateKey) {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      this.walletAddress = account.address;
      this.walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });
    } else if (config.walletAddress) {
      this.walletAddress = config.walletAddress as Address;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): Address | undefined {
    return this.walletAddress;
  }

  /**
   * Get token balance
   */
  async getBalance(token: Token, address?: string): Promise<BalanceInfo> {
    const targetAddress = (address || this.walletAddress) as Address;
    if (!targetAddress) {
      throw new Error('No wallet address configured');
    }

    const tokenConfig = ARBITRUM_TOKENS[token];
    if (!tokenConfig) {
      throw new Error(`Unsupported token: ${token}`);
    }

    try {
      const balance = await this.publicClient.readContract({
        address: tokenConfig.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [targetAddress],
      }) as bigint;

      const formatted = formatUnits(balance, tokenConfig.decimals);

      return {
        token,
        balance: balance.toString(),
        balanceFormatted: parseFloat(formatted).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        }),
      };
    } catch (error) {
      throw new Error(`Failed to fetch ${token} balance: ${(error as Error).message}`);
    }
  }

  /**
   * Get all token balances
   */
  async getAllBalances(address?: string): Promise<BalanceInfo[]> {
    const tokens: Token[] = ['USDs', 'USDC', 'USDT', 'DAI'];
    const balances: BalanceInfo[] = [];

    for (const token of tokens) {
      try {
        const balance = await this.getBalance(token, address);
        if (parseFloat(balance.balance) > 0) {
          balances.push(balance);
        }
      } catch {
        // Skip tokens with errors
      }
    }

    // Always include USDs even if 0
    if (!balances.find(b => b.token === 'USDs')) {
      balances.unshift({
        token: 'USDs',
        balance: '0',
        balanceFormatted: '0.00',
      });
    }

    return balances;
  }

  /**
   * Get USDs yield information
   */
  async getYieldInfo(address?: string): Promise<YieldInfo> {
    // Note: This is a simplified implementation
    // Real yield calculation would track rebase history
    const targetAddress = (address || this.walletAddress) as Address;
    if (!targetAddress) {
      throw new Error('No wallet address configured');
    }

    try {
      // Get current rebase credits per token
      const creditsPerToken = await this.publicClient.readContract({
        address: ARBITRUM_TOKENS['USDs'].address,
        abi: USDS_ABI,
        functionName: 'rebasingCreditsPerToken',
      }) as bigint;

      // Calculate estimated APY (simplified)
      // Real implementation would track historical data
      const estimatedAPY = '4.5%';
      const balance = await this.getBalance('USDs', address);
      const balanceNum = parseFloat(balance.balance) / 1e18;
      const monthlyEstimate = (balanceNum * 0.045 / 12).toFixed(2);

      return {
        totalEarned: '0.00', // Would need historical tracking
        currentAPY: estimatedAPY,
        monthlyEarnings: monthlyEstimate,
        lastRebase: Date.now() - Math.floor(Math.random() * 3600000), // Simulated
      };
    } catch (error) {
      throw new Error(`Failed to fetch yield info: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a payment
   */
  async pay(options: PaymentOptions): Promise<TransactionRecord> {
    if (!this.walletClient) {
      throw new Error('Wallet not configured. Run "x402 init" first.');
    }

    const token = options.token || 'USDs';
    const tokenConfig = ARBITRUM_TOKENS[token];
    if (!tokenConfig) {
      throw new Error(`Unsupported token: ${token}`);
    }

    const recipient = options.recipient as Address;
    const amount = parseUnits(options.amount, tokenConfig.decimals);

    try {
      let hash: Hash;

      if (options.gasless && token === 'USDs') {
        // TODO: Implement EIP-3009 gasless transfer
        // For now, fall back to regular transfer
        hash = await this.walletClient.writeContract({
          address: tokenConfig.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipient, amount],
        });
      } else {
        hash = await this.walletClient.writeContract({
          address: tokenConfig.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipient, amount],
        });
      }

      const txRecord: TransactionRecord = {
        hash,
        type: 'payment',
        amount: options.amount,
        token,
        recipient: options.recipient,
        timestamp: Date.now(),
        status: 'pending',
        network: this.network,
        description: options.memo,
      };

      addToHistory(txRecord);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      txRecord.status = receipt.status === 'success' ? 'confirmed' : 'failed';

      return txRecord;
    } catch (error) {
      throw new Error(`Payment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(hash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: hash as Hash,
      });
      
      return receipt.status === 'success' ? 'confirmed' : 'failed';
    } catch {
      return 'pending';
    }
  }

  /**
   * Get network name for display
   */
  getNetworkName(): string {
    return this.network === 'arbitrum' ? 'Arbitrum Mainnet' : 'Arbitrum Sepolia';
  }

  /**
   * List registered tools (mock implementation)
   */
  async listTools(): Promise<ToolInfo[]> {
    // This would integrate with your tool registry
    // For now, return mock data
    return [
      {
        name: 'advanced_analytics',
        description: 'ML-powered portfolio analytics',
        price: '0.25',
        token: 'USDs',
        owner: this.walletAddress || '0x...',
        calls: 42,
        revenue: '10.50',
        createdAt: Date.now() - 86400000 * 7,
      },
      {
        name: 'price_prediction',
        description: 'AI price prediction model',
        price: '0.10',
        token: 'USDs',
        owner: this.walletAddress || '0x...',
        calls: 156,
        revenue: '15.60',
        createdAt: Date.now() - 86400000 * 14,
      },
    ];
  }

  /**
   * Call a tool (mock implementation)
   */
  async callTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<{ result: any; txHash?: string }> {
    // This would integrate with your X402 tool system
    // For now, return mock data
    return {
      result: { message: `Tool ${toolName} executed successfully`, args },
      txHash: '0x' + '1'.repeat(64),
    };
  }

  /**
   * Register a tool (mock implementation)
   */
  async registerTool(name: string, price: string): Promise<ToolInfo> {
    // This would integrate with your tool registry
    return {
      name,
      description: 'User registered tool',
      price,
      token: 'USDs',
      owner: this.walletAddress || '0x...',
      calls: 0,
      revenue: '0',
      createdAt: Date.now(),
    };
  }
}

/**
 * Create a new client instance
 */
export function createClient(privateKey?: string): X402CLIClient {
  return new X402CLIClient(privateKey);
}
