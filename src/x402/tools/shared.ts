/**
 * Shared utilities for x402 tools
 * @description Common helpers, singleton state, and types used across all tool categories
 * @author nirholas
 * @license Apache-2.0
 */

import { X402Client } from "../sdk/client.js"
import { loadLegacyX402Config, SUPPORTED_CHAINS } from "../config.js"
import type { X402Chain } from "../sdk/types.js"
import type { LegacyX402Config, X402Config } from "../config.js"

// Re-export types for convenience
export type { X402Chain }

// Re-export config utilities
export { SUPPORTED_CHAINS }

// Type aliases for the config objects
export type LegacyConfig = LegacyX402Config
export type FullConfig = X402Config

// Singleton client instance
let x402Client: X402Client | null = null

/**
 * Get or create x402 client
 */
export function getClient(): X402Client {
  if (!x402Client) {
    const config = loadLegacyX402Config()
    if (!config.privateKey) {
      throw new Error("X402_PRIVATE_KEY not configured. Set the environment variable to enable payments.")
    }
    x402Client = new X402Client({
      chain: config.chain,
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
      enableGasless: config.enableGasless,
      facilitatorUrl: config.facilitatorUrl,
      debug: config.debug,
    })
  }
  return x402Client
}

/**
 * Get explorer URL for a chain
 */
export function getExplorerUrl(chain: X402Chain): string {
  const explorers: Partial<Record<X402Chain, string>> = {
    arbitrum: "https://arbiscan.io",
    "arbitrum-sepolia": "https://sepolia.arbiscan.io",
    base: "https://basescan.org",
    "base-sepolia": "https://sepolia.basescan.org",
    ethereum: "https://etherscan.io",
    polygon: "https://polygonscan.com",
    optimism: "https://optimistic.etherscan.io",
    bsc: "https://bscscan.com",
  }
  return explorers[chain] || "https://arbiscan.io"
}
