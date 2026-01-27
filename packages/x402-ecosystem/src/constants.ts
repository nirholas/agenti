/**
 * Constants for x402-ecosystem
 */

import type { Address, Caip2ChainId } from "./types.js";

/**
 * Supported networks with their CAIP-2 identifiers
 */
export const SUPPORTED_NETWORKS = {
  // EVM Mainnets
  "base": "eip155:8453",
  "ethereum": "eip155:1", 
  "arbitrum": "eip155:42161",
  "polygon": "eip155:137",
  "optimism": "eip155:10",
  "bsc": "eip155:56",
  
  // EVM Testnets
  "base-sepolia": "eip155:84532",
  "arbitrum-sepolia": "eip155:421614",
  "sepolia": "eip155:11155111",
  
  // Solana
  "solana": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "solana-devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
} as const satisfies Record<string, Caip2ChainId>;

/**
 * Network names
 */
export type NetworkName = keyof typeof SUPPORTED_NETWORKS;

/**
 * USDC contract addresses per chain
 */
export const USDC_ADDRESSES: Record<string, Address> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
  "eip155:1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
  "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
  "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon
  "eip155:10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
  "eip155:56": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // BSC
};

/**
 * Sperax USDs contract address (Arbitrum only)
 */
export const USDS_ADDRESS: Address = "0xD74f5255D557944cf7Dd0E45FF521520002D5748";

/**
 * Sperax SPA token address (Arbitrum)
 */
export const SPA_ADDRESS: Address = "0x5575552988A3A80504bBaeB1311674fCFd40aD4B";

/**
 * Default facilitator URL for x402 payments
 */
export const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";

/**
 * Self-hosted facilitator URL (nirholas)
 */
export const NIRHOLAS_FACILITATOR_URL = "https://facilitator.nirholas.dev";

/**
 * Default payment limits
 */
export const DEFAULT_LIMITS = {
  maxPaymentPerRequest: "1.00", // $1 max per request
  maxDailySpend: "100.00", // $100 max per day
  maxPendingPayments: 10,
} as const;

/**
 * Default token per chain
 */
export const DEFAULT_TOKENS: Record<string, "USDC" | "USDs"> = {
  "eip155:8453": "USDC", // Base uses USDC
  "eip155:42161": "USDs", // Arbitrum uses USDs (Sperax)
  "eip155:1": "USDC",
  "eip155:137": "USDC",
  "eip155:10": "USDC",
  "eip155:56": "USDC",
};

/**
 * USDs APY (approximate, check Sperax for current rate)
 */
export const USDS_APY = 0.05; // ~5% APY

/**
 * Tool marketplace categories
 */
export const TOOL_CATEGORIES = [
  "AI/ML",
  "Analytics",
  "Blockchain",
  "Data",
  "Finance",
  "Media",
  "News",
  "Social",
  "Weather",
  "Other",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
