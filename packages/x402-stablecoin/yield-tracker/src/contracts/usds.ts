/**
 * USDs Contract Interface
 * 
 * Provides interface to interact with the Sperax USDs contract on Arbitrum.
 * USDs is an auto-yield stablecoin that uses a rebasing mechanism.
 * 
 * Contract: 0xD74f5255D557944cf7Dd0E45FF521520002D5748 (Arbitrum)
 */

import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
  formatUnits,
  parseUnits,
} from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import type { CreditBalance, USdsContractState } from '../types.js';

/**
 * USDs contract address on Arbitrum
 */
export const USDS_ADDRESS: Address = '0xD74f5255D557944cf7Dd0E45FF521520002D5748';

/**
 * USDs Vault address on Arbitrum
 */
export const USDS_VAULT_ADDRESS: Address = '0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988';

/**
 * USDs contract ABI (relevant functions only)
 */
export const USDS_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'rebasingCreditsPerToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'rebasingCreditsPerTokenHighres',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nonRebasingSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'rebasingCredits',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'creditBalanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'uint256' },
    ],
  },
  {
    name: 'isNonRebasingAccount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Events
  {
    name: 'TotalSupplyUpdatedHighres',
    type: 'event',
    inputs: [
      { name: 'totalSupply', type: 'uint256', indexed: false },
      { name: 'rebasingCredits', type: 'uint256', indexed: false },
      { name: 'rebasingCreditsPerToken', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * USDs Contract Client
 */
export class USdsContract {
  private client: PublicClient;
  private address: Address;

  constructor(rpcUrl: string, network: 'mainnet' | 'sepolia' = 'mainnet') {
    const chain = network === 'mainnet' ? arbitrum : arbitrumSepolia;
    
    this.client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    
    this.address = USDS_ADDRESS;
  }

  /**
   * Get the underlying viem client
   */
  getClient(): PublicClient {
    return this.client;
  }

  /**
   * Get USDs balance for an address
   */
  async getBalance(address: Address): Promise<string> {
    const balance = await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    return formatUnits(balance, 18);
  }

  /**
   * Get raw balance in wei
   */
  async getBalanceRaw(address: Address): Promise<bigint> {
    return await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
  }

  /**
   * Get total supply of USDs
   */
  async getTotalSupply(): Promise<string> {
    const supply = await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'totalSupply',
    });

    return formatUnits(supply, 18);
  }

  /**
   * Get current rebasing credits per token
   * This value decreases as yield is distributed (increasing balances)
   */
  async getCreditsPerToken(): Promise<string> {
    const creditsPerToken = await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'rebasingCreditsPerToken',
    });

    return creditsPerToken.toString();
  }

  /**
   * Get high-resolution credits per token (more precise)
   */
  async getCreditsPerTokenHighres(): Promise<string> {
    try {
      const creditsPerToken = await this.client.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'rebasingCreditsPerTokenHighres',
      });
      return creditsPerToken.toString();
    } catch {
      // Fallback to regular if highres not available
      return this.getCreditsPerToken();
    }
  }

  /**
   * Get non-rebasing supply (contracts that haven't opted in)
   */
  async getNonRebasingSupply(): Promise<string> {
    const supply = await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'nonRebasingSupply',
    });

    return formatUnits(supply, 18);
  }

  /**
   * Get rebasing credits total
   */
  async getRebasingCredits(): Promise<string> {
    const credits = await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'rebasingCredits',
    });

    return credits.toString();
  }

  /**
   * Get credit balance for an address
   * Returns [credits, creditsPerToken] at time of last update
   */
  async getCreditBalance(address: Address): Promise<CreditBalance> {
    const [credits, creditsPerToken] = await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'creditBalanceOf',
      args: [address],
    });

    // Calculate balance from credits
    // balance = credits / creditsPerToken
    const balance = creditsPerToken > 0n 
      ? (credits * BigInt(10 ** 18)) / creditsPerToken 
      : 0n;

    return {
      credits: credits.toString(),
      creditsPerToken: creditsPerToken.toString(),
      balance: formatUnits(balance, 18),
    };
  }

  /**
   * Check if an address is a non-rebasing account
   */
  async isNonRebasingAccount(address: Address): Promise<boolean> {
    return await this.client.readContract({
      address: this.address,
      abi: USDS_ABI,
      functionName: 'isNonRebasingAccount',
      args: [address],
    });
  }

  /**
   * Get complete USDs contract state
   */
  async getContractState(): Promise<USdsContractState> {
    const [totalSupply, nonRebasingSupply, creditsPerToken, rebasingCredits] = await Promise.all([
      this.client.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'totalSupply',
      }),
      this.client.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'nonRebasingSupply',
      }),
      this.client.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'rebasingCreditsPerToken',
      }),
      this.client.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'rebasingCredits',
      }),
    ]);

    const rebasingSupply = totalSupply - nonRebasingSupply;

    return {
      totalSupply: formatUnits(totalSupply, 18),
      nonRebasingSupply: formatUnits(nonRebasingSupply, 18),
      rebasingSupply: formatUnits(rebasingSupply, 18),
      creditsPerToken: creditsPerToken.toString(),
      rebasingCredits: rebasingCredits.toString(),
    };
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<bigint> {
    return await this.client.getBlockNumber();
  }

  /**
   * Get block timestamp
   */
  async getBlockTimestamp(blockNumber?: bigint): Promise<number> {
    const block = await this.client.getBlock({
      blockNumber: blockNumber,
    });
    return Number(block.timestamp);
  }

  /**
   * Watch for TotalSupplyUpdatedHighres events (rebase events)
   */
  watchRebaseEvents(
    onEvent: (log: {
      totalSupply: bigint;
      rebasingCredits: bigint;
      rebasingCreditsPerToken: bigint;
      blockNumber: bigint;
      transactionHash: string;
    }) => void
  ) {
    return this.client.watchContractEvent({
      address: this.address,
      abi: USDS_ABI,
      eventName: 'TotalSupplyUpdatedHighres',
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args.totalSupply !== undefined) {
            onEvent({
              totalSupply: log.args.totalSupply,
              rebasingCredits: log.args.rebasingCredits!,
              rebasingCreditsPerToken: log.args.rebasingCreditsPerToken!,
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
            });
          }
        }
      },
    });
  }

  /**
   * Get past rebase events
   */
  async getPastRebaseEvents(fromBlock: bigint, toBlock?: bigint) {
    const logs = await this.client.getContractEvents({
      address: this.address,
      abi: USDS_ABI,
      eventName: 'TotalSupplyUpdatedHighres',
      fromBlock,
      toBlock,
    });

    return logs.map((log) => ({
      totalSupply: log.args.totalSupply!,
      rebasingCredits: log.args.rebasingCredits!,
      rebasingCreditsPerToken: log.args.rebasingCreditsPerToken!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    }));
  }

  /**
   * Calculate yield based on credits per token change
   * When creditsPerToken decreases, balances increase (yield distributed)
   */
  calculateYieldFromCreditsChange(
    initialCredits: string,
    initialCreditsPerToken: string,
    currentCreditsPerToken: string
  ): { currentBalance: string; yield: string; yieldPercentage: string } {
    const credits = BigInt(initialCredits);
    const initialCPT = BigInt(initialCreditsPerToken);
    const currentCPT = BigInt(currentCreditsPerToken);

    if (initialCPT === 0n || currentCPT === 0n) {
      return { currentBalance: '0', yield: '0', yieldPercentage: '0' };
    }

    // Initial balance = credits / initialCreditsPerToken
    const initialBalance = (credits * BigInt(10 ** 18)) / initialCPT;
    
    // Current balance = credits / currentCreditsPerToken
    const currentBalance = (credits * BigInt(10 ** 18)) / currentCPT;
    
    // Yield = current - initial
    const yieldAmount = currentBalance - initialBalance;
    
    // Yield percentage = (yield / initial) * 100
    const yieldPercentage = initialBalance > 0n
      ? (yieldAmount * 10000n) / initialBalance // basis points
      : 0n;

    return {
      currentBalance: formatUnits(currentBalance, 18),
      yield: formatUnits(yieldAmount, 18),
      yieldPercentage: (Number(yieldPercentage) / 100).toFixed(4),
    };
  }
}

/**
 * Create USDs contract instance
 */
export function createUSdsContract(
  rpcUrl: string,
  network: 'mainnet' | 'sepolia' = 'mainnet'
): USdsContract {
  return new USdsContract(rpcUrl, network);
}
