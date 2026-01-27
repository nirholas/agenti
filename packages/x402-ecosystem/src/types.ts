/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | universal-crypto-mcp
 *  ID: 1493
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Shared type definitions for x402-ecosystem
 */

// Ethereum address type
export type Address = `0x${string}`;

// Transaction hash type
export type Hash = `0x${string}`;

// Chain ID type
export type ChainId = number;

// CAIP-2 chain identifier
export type Caip2ChainId = `eip155:${number}` | `solana:${string}`;

/**
 * Payment result from x402 transaction
 */
export interface PaymentResult {
  success: boolean;
  txHash?: Hash;
  amount: string;
  token: string;
  recipient: Address;
  chain: Caip2ChainId;
  timestamp: number;
  error?: string;
}

/**
 * Service definition for paid APIs
 */
export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  pricing: ServicePricing;
  owner: Address;
}

/**
 * Pricing configuration for a service
 */
export interface ServicePricing {
// @nichxbt
  type: "per-request" | "subscription" | "tiered";
  amount: string; // USD amount as string
  token: "USDC" | "USDs";
  period?: "hourly" | "daily" | "weekly" | "monthly"; // For subscriptions
  tiers?: PricingTier[]; // For tiered pricing
}

/**
 * Pricing tier for tiered services
 */
export interface PricingTier {
  name: string;
  maxRequests: number;
  pricePerRequest: string;
}

/**
 * Balance information
 */
export interface BalanceInfo {
  usdc: string;
  usds: string;
  native: string;
  chain: Caip2ChainId;
  address: Address;
}

/**
 * Yield information for USDs holdings
 */
export interface YieldInfo {
  balance: string;
  pendingYield: string;
  totalEarned: string;
  apy: string;
  lastUpdate: number;
}

/**
 * Payment history entry
 */
export interface PaymentHistoryEntry {
  id: string;
  type: "sent" | "received";
  amount: string;
  token: string;
  counterparty: Address;
  service?: string;
  txHash: Hash;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  privateKey?: `0x${string}`;
  chain?: Caip2ChainId;
  maxDailySpend?: string;
  maxPaymentPerRequest?: string;
  approvedServices?: string[];
  enableYield?: boolean;
}

/**
 * Marketplace tool entry
 */
export interface MarketplaceTool {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  price: string;
  token: "USDC" | "USDs";
  owner: Address;
  category: string;
  rating: number;
  usageCount: number;
  revenueSplit: RevenueSplitConfig[];
}

/**
 * Revenue split configuration
 */
export interface RevenueSplitConfig {
  address: Address;
  percentage: number; // 0-100
  label?: string;
}


/* universal-crypto-mcp © nirholas */