/**
 * @fileoverview CLI Type Definitions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Address } from 'viem';

/**
 * Supported networks
 */
export type Network = 'arbitrum' | 'arbitrum-sepolia';

/**
 * Supported tokens
 */
export type Token = 'USDs' | 'USDC' | 'USDT' | 'DAI';

/**
 * CLI Configuration stored in ~/.x402/config.json
 */
export interface CLIConfig {
  /** Current network */
  network: Network;
  
  /** Default wallet address */
  walletAddress?: string;
  
  /** Default token for payments */
  defaultToken: Token;
  
  /** RPC URL override */
  rpcUrl?: string;
  
  /** Facilitator URL */
  facilitatorUrl: string;
  
  /** Auto-approve payments under this amount */
  autoApproveUnder?: string;
  
  /** Enable gasless transactions */
  gaslessEnabled: boolean;
  
  /** Last used timestamp */
  lastUsed?: number;
}

/**
 * Transaction record for history
 */
export interface TransactionRecord {
  hash: string;
  type: 'payment' | 'tool_call' | 'transfer';
  amount: string;
  token: Token;
  recipient: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  network: Network;
  toolName?: string;
  description?: string;
}

/**
 * Tool registration info
 */
export interface ToolInfo {
  name: string;
  description: string;
  price: string;
  token: Token;
  owner: string;
  calls: number;
  revenue: string;
  createdAt: number;
}

/**
 * Balance info
 */
export interface BalanceInfo {
  token: Token;
  balance: string;
  balanceFormatted: string;
  usdValue?: string;
}

/**
 * Yield info for USDs
 */
export interface YieldInfo {
  totalEarned: string;
  currentAPY: string;
  monthlyEarnings: string;
  lastRebase: number;
}

/**
 * Payment options
 */
export interface PaymentOptions {
  recipient: string;
  amount: string;
  token?: Token;
  gasless?: boolean;
  memo?: string;
}

/**
 * Command context passed to handlers
 */
export interface CommandContext {
  config: CLIConfig;
  verbose?: boolean;
}
