/**
 * x402 Payment Configuration
 * @description Configuration for x402 payment protocol integration
 * @author nirholas
 * @license Apache-2.0
 */

import type { X402Chain } from "./sdk/types.js"

/**
 * x402 configuration from environment variables
 */
export interface X402Config {
  /** EVM private key for payments (required for making payments) */
  privateKey?: `0x${string}`
  /** Default chain for payments */
  chain: X402Chain
  /** Custom RPC URL (optional) */
  rpcUrl?: string
  /** Enable gasless payments via EIP-3009 */
  enableGasless: boolean
  /** Facilitator URL for gasless payments */
  facilitatorUrl?: string
  /** Maximum payment allowed per request (in USD) */
  maxPaymentPerRequest: string
  /** Debug mode */
  debug: boolean
}

/**
 * Load x402 configuration from environment variables
 */
export function loadX402Config(): X402Config {
  const privateKey = process.env.X402_PRIVATE_KEY as `0x${string}` | undefined
  const chain = (process.env.X402_CHAIN || "arbitrum") as X402Chain
  const rpcUrl = process.env.X402_RPC_URL
  const enableGasless = process.env.X402_ENABLE_GASLESS !== "false"
  const facilitatorUrl = process.env.X402_FACILITATOR_URL
  const maxPaymentPerRequest = process.env.X402_MAX_PAYMENT || "1.00"
  const debug = process.env.X402_DEBUG === "true"

  return {
    privateKey,
    chain,
    rpcUrl,
    enableGasless,
    facilitatorUrl,
    maxPaymentPerRequest,
    debug,
  }
}

/**
 * Supported chains with their CAIP-2 identifiers
 */
export const SUPPORTED_CHAINS: Record<X402Chain, { caip2: string; name: string; testnet: boolean }> = {
  arbitrum: { caip2: "eip155:42161", name: "Arbitrum One", testnet: false },
  "arbitrum-sepolia": { caip2: "eip155:421614", name: "Arbitrum Sepolia", testnet: true },
  base: { caip2: "eip155:8453", name: "Base", testnet: false },
  ethereum: { caip2: "eip155:1", name: "Ethereum", testnet: false },
  polygon: { caip2: "eip155:137", name: "Polygon", testnet: false },
  optimism: { caip2: "eip155:10", name: "Optimism", testnet: false },
  bsc: { caip2: "eip155:56", name: "BNB Chain", testnet: false },
}

/**
 * Check if x402 is configured (has private key)
 */
export function isX402Configured(): boolean {
  return !!process.env.X402_PRIVATE_KEY
}

/**
 * Validate x402 configuration
 */
export function validateX402Config(config: X402Config): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.privateKey) {
    errors.push("X402_PRIVATE_KEY is not set - payment features will be disabled")
  } else if (!config.privateKey.startsWith("0x") || config.privateKey.length !== 66) {
    errors.push("X402_PRIVATE_KEY must be a valid 32-byte hex string starting with 0x")
  }

  if (!SUPPORTED_CHAINS[config.chain]) {
    errors.push(`X402_CHAIN "${config.chain}" is not supported`)
  }

  const maxPayment = parseFloat(config.maxPaymentPerRequest)
  if (isNaN(maxPayment) || maxPayment <= 0) {
    errors.push("X402_MAX_PAYMENT must be a positive number")
  }

  return {
    valid: errors.length === 0 || errors.every(e => e.includes("disabled")),
    errors,
  }
}
