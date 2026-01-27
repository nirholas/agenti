/**
 * USDs Yield Tracker Types
 * 
 * Type definitions for tracking auto-yield earnings from Sperax USDs payments.
 */

import type { Address } from 'viem';

/**
 * Tracked payment record
 */
export interface TrackedPayment {
  /** Unique payment ID */
  id: string;
  /** Address that received the payment */
  address: Address;
  /** Initial USDs amount received */
  initialAmount: string;
  /** Initial credits balance at time of payment */
  initialCredits: string;
  /** Credits per token at time of payment */
  initialCreditsPerToken: string;
  /** Transaction hash of the payment */
  txHash: string;
  /** Block number when payment was received */
  blockNumber: number;
  /** Timestamp when payment was received */
  timestamp: number;
  /** Optional description */
  description?: string;
  /** Whether the address is opted into rebasing */
  isRebasing: boolean;
}

/**
 * Yield information for an address
 */
export interface YieldInfo {
  /** Address being tracked */
  address: Address;
  /** Current USDs balance */
  currentBalance: string;
  /** Total initial deposits tracked */
  totalInitialDeposits: string;
  /** Total yield earned (current - initial) */
  totalYieldEarned: string;
  /** Yield as percentage of initial */
  yieldPercentage: string;
  /** Current APY estimate */
  currentAPY: string;
  /** Number of tracked payments */
  paymentCount: number;
  /** Whether rebasing is active for this address */
  isRebasing: boolean;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Historical yield data point
 */
export interface YieldHistoryPoint {
  /** Timestamp of this data point */
  timestamp: number;
  /** Balance at this time */
  balance: string;
  /** Credits per token at this time */
  creditsPerToken: string;
  /** Cumulative yield at this time */
  cumulativeYield: string;
  /** Block number */
  blockNumber: number;
}

/**
 * Yield history response
 */
export interface YieldHistory {
  address: Address;
  history: YieldHistoryPoint[];
  totalYieldEarned: string;
  firstTracked: number;
  lastTracked: number;
}

/**
 * Rebase event from USDs contract
 */
export interface RebaseEvent {
  /** Block number of the rebase */
  blockNumber: number;
  /** Transaction hash */
  txHash: string;
  /** Timestamp of the rebase */
  timestamp: number;
  /** Credits per token before rebase */
  previousCreditsPerToken: string;
  /** Credits per token after rebase */
  newCreditsPerToken: string;
  /** Rebase percentage (how much balances increased) */
  rebasePercentage: string;
  /** Estimated APY from this rebase (annualized) */
  estimatedAPY: string;
}

/**
 * Current APY information
 */
export interface APYInfo {
  /** Current estimated APY */
  currentAPY: string;
  /** 7-day average APY */
  weeklyAverageAPY: string;
  /** 30-day average APY */
  monthlyAverageAPY: string;
  /** Current credits per token */
  currentCreditsPerToken: string;
  /** Last rebase timestamp */
  lastRebaseTimestamp: number;
  /** Total rebases tracked */
  totalRebasesTracked: number;
}

/**
 * Track payment request
 */
export interface TrackPaymentRequest {
  /** Address to track */
  address: Address;
  /** Transaction hash of the payment */
  txHash: string;
  /** Amount of USDs received */
  amount: string;
  /** Optional description */
  description?: string;
}

/**
 * USDs contract state
 */
export interface USdsContractState {
  /** Total supply of USDs */
  totalSupply: string;
  /** Non-rebasing supply */
  nonRebasingSupply: string;
  /** Rebasing supply */
  rebasingSupply: string;
  /** Current credits per token */
  creditsPerToken: string;
  /** Rebasing credits */
  rebasingCredits: string;
}

/**
 * Yield tracker configuration
 */
export interface YieldTrackerConfig {
  /** Arbitrum RPC URL */
  rpcUrl: string;
  /** Port for the API server */
  port: number;
  /** Database file path */
  dbPath: string;
  /** Polling interval for rebase monitoring (ms) */
  pollInterval: number;
  /** Network (mainnet or sepolia) */
  network: 'mainnet' | 'sepolia';
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Credit balance info for an address
 */
export interface CreditBalance {
  /** User's credit balance */
  credits: string;
  /** Current credits per token */
  creditsPerToken: string;
  /** Calculated balance (credits / creditsPerToken) */
  balance: string;
}
