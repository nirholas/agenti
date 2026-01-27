/**
 * YieldingWallet - Wallet that auto-converts to USDs for passive yield
 * 
 * Sperax USDs automatically earns ~5% APY through protocol rebasing.
 * This module provides tools for yield tracking, projection, and reporting.
 * 
 * @example
 * ```typescript
 * import { YieldingWallet, YieldProjector, createYieldReport } from "@nirholas/x402-ecosystem/yield";
 * 
 * const wallet = new YieldingWallet({
 *   privateKey: process.env.X402_PRIVATE_KEY,
 *   autoConvert: true, // Auto-convert USDC to USDs
 * });
 * 
 * // Check current yield
 * const yieldInfo = await wallet.getYieldInfo();
 * console.log(`Pending yield: $${yieldInfo.pendingYield}`);
 * 
 * // Project future yield
 * const projection = YieldProjector.project(yieldInfo.balance, { months: 12 });
 * console.log(`Projected yearly earnings: $${projection.totalYield}`);
 * ```
 */

import { createPublicClient, http, formatUnits } from "viem";
import { arbitrum } from "viem/chains";
import type { Address, YieldInfo } from "./types.js";
import { USDS_ADDRESS, USDS_APY } from "./constants.js";

/**
 * Yield configuration
 */
export interface YieldConfig {
  /** Private key for wallet operations */
  privateKey?: `0x${string}`;
  /** Wallet address to track (if no private key) */
  address?: Address;
  /** Auto-convert USDC payments to USDs */
  autoConvert?: boolean;
  /** Minimum balance to auto-convert (in USDC) */
  autoConvertThreshold?: string;
  /** RPC URL for Arbitrum */
  rpcUrl?: string;
}

/**
 * Yield projection result
 */
export interface YieldProjection {
  initialBalance: string;
  projectedBalance: string;
  totalYield: string;
  apy: number;
  durationDays: number;
  dailyYield: string;
  monthlyYield: string;
  yearlyYield: string;
}

/**
 * Yield report
 */
export interface YieldReport {
  address: Address;
  generatedAt: number;
  period: {
    start: number;
    end: number;
    days: number;
  };
  balances: {
    start: string;
    end: string;
    average: string;
  };
  yield: {
    total: string;
    realized: string;
    unrealized: string;
    apy: number;
  };
  transactions: Array<{
    type: "deposit" | "withdrawal" | "yield";
    amount: string;
    timestamp: number;
    txHash?: string;
  }>;
}

/**
 * YieldingWallet - Wallet optimized for USDs yield
 */
export class YieldingWallet {
  private readonly config: Required<YieldConfig>;
  private readonly publicClient;
  private yieldHistory: Array<{ balance: string; timestamp: number }> = [];
  
  constructor(config: YieldConfig) {
    this.config = {
      privateKey: config.privateKey,
      address: config.address ?? ("0x" as Address),
      autoConvert: config.autoConvert ?? false,
      autoConvertThreshold: config.autoConvertThreshold ?? "10.00",
      rpcUrl: config.rpcUrl ?? "https://arb1.arbitrum.io/rpc",
    };
    
    this.publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(this.config.rpcUrl),
    });
  }
  
  /** Get wallet address */
  get address(): Address {
    return this.config.address;
  }
  
  /** Get current USDs balance */
  async getUsdsBalance(): Promise<string> {
    try {
      const balance = await this.publicClient.readContract({
        address: USDS_ADDRESS,
        abi: [{ 
          name: "balanceOf", 
          type: "function", 
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        }],
        functionName: "balanceOf",
        args: [this.config.address],
      }) as bigint;
      
      return formatUnits(balance, 18);
    } catch {
      return "0";
    }
  }
  
  /** Get yield information */
  async getYieldInfo(): Promise<YieldInfo> {
    const balance = await this.getUsdsBalance();
    const balanceNum = parseFloat(balance);
    
    // Calculate pending yield (simplified - in reality would need to track from last rebase)
    const dailyYield = balanceNum * (USDS_APY / 365);
    
    // Get historical total from yield history (simplified)
    const totalEarned = this.yieldHistory.reduce((sum, entry) => {
      return sum + parseFloat(entry.balance) * (USDS_APY / 365);
    }, 0);
    
    return {
      balance,
      pendingYield: dailyYield.toFixed(6),
      totalEarned: totalEarned.toFixed(6),
      apy: (USDS_APY * 100).toFixed(2),
      lastUpdate: Date.now(),
    };
  }
  
  /** Record balance for yield tracking */
  recordBalance(balance: string): void {
    this.yieldHistory.push({
      balance,
      timestamp: Date.now(),
    });
    
    // Keep last 365 days of history
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.yieldHistory = this.yieldHistory.filter(h => h.timestamp >= oneYearAgo);
  }
  
  /** Project yield for a given duration */
  projectYield(durationDays: number): YieldProjection {
    const balanceStr = this.yieldHistory[this.yieldHistory.length - 1]?.balance ?? "0";
    return YieldProjector.project(balanceStr, { days: durationDays });
  }
  
  /** Generate yield report */
  async generateReport(startDate: Date, endDate: Date): Promise<YieldReport> {
    const balance = await this.getUsdsBalance();
    
    // Filter history to date range
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const periodHistory = this.yieldHistory.filter(
      h => h.timestamp >= startTime && h.timestamp <= endTime
    );
    
    // Calculate averages and yields
    const avgBalance = periodHistory.length > 0
      ? periodHistory.reduce((sum, h) => sum + parseFloat(h.balance), 0) / periodHistory.length
      : parseFloat(balance);
    
    const days = (endTime - startTime) / (24 * 60 * 60 * 1000);
    const totalYield = avgBalance * (USDS_APY * days / 365);
    
    return {
      address: this.config.address,
      generatedAt: Date.now(),
      period: {
        start: startTime,
        end: endTime,
        days,
      },
      balances: {
        start: periodHistory[0]?.balance ?? balance,
        end: balance,
        average: avgBalance.toFixed(6),
      },
      yield: {
        total: totalYield.toFixed(6),
        realized: (totalYield * 0.9).toFixed(6), // Simplified
        unrealized: (totalYield * 0.1).toFixed(6),
        apy: USDS_APY * 100,
      },
      transactions: [], // Would need actual transaction tracking
    };
  }
}

/**
 * YieldProjector - Static methods for yield projections
 */
export const YieldProjector = {
  /**
   * Project yield for a given balance and duration
   */
  project(
    balance: string,
    duration: { days?: number; months?: number; years?: number }
  ): YieldProjection {
    const balanceNum = parseFloat(balance);
    
    // Calculate total days
    const days = (duration.days ?? 0) + 
                 (duration.months ?? 0) * 30 + 
                 (duration.years ?? 0) * 365;
    
    // Calculate yields
    const dailyRate = USDS_APY / 365;
    const dailyYield = balanceNum * dailyRate;
    const monthlyYield = balanceNum * (USDS_APY / 12);
    const yearlyYield = balanceNum * USDS_APY;
    
    // Compound calculation (simplified)
    const totalYield = balanceNum * (Math.pow(1 + dailyRate, days) - 1);
    const projectedBalance = balanceNum + totalYield;
    
    return {
      initialBalance: balance,
      projectedBalance: projectedBalance.toFixed(6),
      totalYield: totalYield.toFixed(6),
      apy: USDS_APY * 100,
      durationDays: days,
      dailyYield: dailyYield.toFixed(6),
      monthlyYield: monthlyYield.toFixed(6),
      yearlyYield: yearlyYield.toFixed(6),
    };
  },
  
  /**
   * Calculate required balance for a target monthly yield
   */
  balanceForMonthlyYield(targetMonthly: string): string {
    const target = parseFloat(targetMonthly);
    const required = target / (USDS_APY / 12);
    return required.toFixed(2);
  },
  
  /**
   * Calculate required balance for a target yearly yield
   */
  balanceForYearlyYield(targetYearly: string): string {
    const target = parseFloat(targetYearly);
    const required = target / USDS_APY;
    return required.toFixed(2);
  },
  
  /**
   * Compare yield with other investments
   */
  compareYield(
    balance: string,
    alternatives: Array<{ name: string; apy: number }>
  ): Array<{ name: string; apy: number; yearlyYield: string }> {
    const balanceNum = parseFloat(balance);
    
    return [
      { name: "Sperax USDs", apy: USDS_APY * 100, yearlyYield: (balanceNum * USDS_APY).toFixed(2) },
      ...alternatives.map(alt => ({
        name: alt.name,
        apy: alt.apy,
        yearlyYield: (balanceNum * (alt.apy / 100)).toFixed(2),
      })),
    ].sort((a, b) => parseFloat(b.yearlyYield) - parseFloat(a.yearlyYield));
  },
};

/**
 * Create a yield report from raw data
 */
export function createYieldReport(
  address: Address,
  balanceHistory: Array<{ balance: string; timestamp: number }>,
  startDate: Date,
  endDate: Date
): YieldReport {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  
  const periodHistory = balanceHistory.filter(
    h => h.timestamp >= startTime && h.timestamp <= endTime
  );
  
  const avgBalance = periodHistory.length > 0
    ? periodHistory.reduce((sum, h) => sum + parseFloat(h.balance), 0) / periodHistory.length
    : 0;
  
  const days = (endTime - startTime) / (24 * 60 * 60 * 1000);
  const totalYield = avgBalance * (USDS_APY * days / 365);
  
  return {
    address,
    generatedAt: Date.now(),
    period: {
      start: startTime,
      end: endTime,
      days,
    },
    balances: {
      start: periodHistory[0]?.balance ?? "0",
      end: periodHistory[periodHistory.length - 1]?.balance ?? "0",
      average: avgBalance.toFixed(6),
    },
    yield: {
      total: totalYield.toFixed(6),
      realized: (totalYield * 0.9).toFixed(6),
      unrealized: (totalYield * 0.1).toFixed(6),
      apy: USDS_APY * 100,
    },
    transactions: [],
  };
}
