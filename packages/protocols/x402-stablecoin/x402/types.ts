/**
 * @fileoverview Type definitions and interfaces
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * X402 Payment Protocol Types
 * 
 * Implements Coinbase's X402 protocol for AI agent payments
 * Based on HTTP 402 Payment Required standard
 * 
 * @see https://docs.cdp.coinbase.com/x402
 * @since November 30, 2025
 */

import { Address } from 'viem';

/**
 * Supported payment chains for X402
 */
export type X402Chain = 'base' | 'bsc' | 'ethereum' | 'polygon' | 'arbitrum' | 'arbitrum-sepolia' | 'optimism';

/**
 * Supported payment tokens
 */
export type X402Token = 'USDC' | 'USDT' | 'DAI' | 'ETH' | 'BNB' | 'MATIC' | 'USDs';

/**
 * Pricing tiers for tools
 */
export type PricingTier = 'free' | 'premium' | 'enterprise';

/**
 * Token decimals mapping
 */
export const TOKEN_DECIMALS: Record<X402Token, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  ETH: 18,
  BNB: 18,
  MATIC: 18,
  USDs: 18, // Sperax USD - auto-yield stablecoin on Arbitrum
};

/**
 * Chain IDs for X402 supported networks
 */
export const CHAIN_IDS: Record<X402Chain, number> = {
  base: 8453,
  bsc: 56,
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  'arbitrum-sepolia': 421614,
  optimism: 10,
};

/**
 * X402 configuration for LyraClient
 */
export interface X402Config {
  /** Enable X402 payments */
  enabled: boolean;
  
  /** Wallet address for payments */
  walletAddress: Address;
  
  /** Maximum payment per tool call (in USD) */
  maxPaymentPerTool: string;
  
  /** Default payment token */
  defaultToken?: X402Token;
  
  /** Default payment chain */
  defaultChain?: X402Chain;
  
  /** Auto-approve payments under this amount */
  autoApproveUnder?: string;
  
  /** Payment timeout in seconds */
  timeout?: number;
  
  /** RPC endpoint URL */
  rpcUrl?: string;
}

/**
 * Payment request details from 402 response
 */
export interface PaymentRequest {
  /** Price in token units */
  price: string;
  
  /** Payment token */
  token: X402Token;
  
  /** Payment chain */
  chain: X402Chain;
  
  /** Recipient address */
  recipient: Address;
  
  /** Optional payment reference/nonce */
  reference?: string;
  
  /** Payment deadline timestamp */
  deadline?: number;
  
  /** Tool name being paid for */
  toolName?: string;
  
  /** Human-readable description */
  description?: string;
}

/**
 * Payment transaction details
 */
export interface PaymentTransaction {
  /** Transaction hash */
  hash: string;
  
  /** Chain ID */
  chainId: number;
  
  /** Sender address */
  from: Address;
  
  /** Recipient address */
  to: Address;
  
  /** Amount in token units */
  value: string;
  
  /** Token address (for ERC-20) */
  tokenAddress?: Address;
  
  /** Gas used */
  gasUsed?: string;
  
  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed';
  
  /** Block number */
  blockNumber?: number;
  
  /** Timestamp */
  timestamp?: number;
}

/**
 * Payment verification result
 */
export interface PaymentVerification {
  /** Verification success */
  verified: boolean;
  
  /** Transaction details */
  transaction?: PaymentTransaction;
  
  /** Error message if verification failed */
  error?: string;
  
  /** Verification timestamp */
  verifiedAt: number;
}

/**
 * X402 tool pricing configuration
 */
export interface X402ToolPricing {
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** Price per call (in USD) */
  price: string;
  
  /** Payment token */
  currency: X402Token;
  
  /** Payment chain */
  chain: X402Chain;
  
  /** Pricing tier */
  tier: PricingTier;
  
  /** Payment recipient address */
  paymentRecipient: Address;
  
  /** Platform fee (0-1, default 0.20 = 20%) */
  platformFee?: number;
  
  /** Daily free call limit */
  freeCallsPerDay?: number;
  
  /** Rate limit per hour */
  rateLimitPerHour?: number;
}

/**
 * Revenue split configuration
 */
export interface RevenueSplit {
  /** Developer address */
  developer: Address;
  
  /** Developer share (0-1) */
  developerShare: number;
  
  /** Platform address */
  platform: Address;
  
  /** Platform share (0-1) */
  platformShare: number;
}

/**
 * Payment analytics
 */
export interface PaymentAnalytics {
  /** Total payments made */
  totalPayments: number;
  
  /** Total amount spent (in USD) */
  totalSpent: string;
  
  /** Payments by tool */
  byTool: Record<string, {
    count: number;
    totalSpent: string;
    avgCost: string;
  }>;
  
  /** Payments by chain */
  byChain: Record<X402Chain, {
    count: number;
    totalSpent: string;
  }>;
  
  /** Date range */
  dateRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Payment event types
 */
export type PaymentEvent =
  | { type: 'payment_requested'; data: PaymentRequest }
  | { type: 'payment_approved'; data: PaymentTransaction }
  | { type: 'payment_rejected'; data: { reason: string } }
  | { type: 'payment_confirmed'; data: PaymentTransaction }
  | { type: 'payment_failed'; data: { error: string; transaction?: PaymentTransaction } };

/**
 * Payment event listener
 */
export type PaymentEventListener = (event: PaymentEvent) => void | Promise<void>;

/**
 * X402 client options
 */
export interface X402ClientOptions {
  /** Payment chain */
  chain: X402Chain;
  
  /** RPC provider URL */
  rpcUrl?: string;
  
  /** Wallet private key (for signing) */
  privateKey?: string;
  
  /** Wallet provider (ethers/viem) */
  provider?: any;
  
  /** Enable fallback RPC */
  enableFallback?: boolean;
  
  /** Timeout in ms */
  timeout?: number;
}

/**
 * HTTP 402 response structure
 */
export interface HTTP402Response {
  /** Status code (must be 402) */
  status: 402;
  
  /** Headers containing payment info */
  headers: {
    'www-authenticate': string;
    'content-type'?: string;
  };
  
  /** Optional error message */
  message?: string;
}

/**
 * X402 error types
 */
export class X402Error extends Error {
  constructor(
    message: string,
    public code: X402ErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'X402Error';
  }
}

export enum X402ErrorCode {
  INVALID_PAYMENT_REQUEST = 'INVALID_PAYMENT_REQUEST',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  UNSUPPORTED_TOKEN = 'UNSUPPORTED_TOKEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}
