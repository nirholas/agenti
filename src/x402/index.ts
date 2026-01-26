/**
 * x402 Payment Protocol Integration
 * @description Main entry point for x402 payments in Universal Crypto MCP
 * @author nirholas
 * @license Apache-2.0
 * 
 * x402 enables AI agents to make and receive cryptocurrency payments.
 * Based on HTTP 402 Payment Required standard with Sperax USDs stablecoin.
 * 
 * @example
 * ```typescript
 * import { registerX402 } from "@/x402/index.js"
 * 
 * // Register x402 tools with MCP server
 * registerX402(server)
 * ```
 * 
 * @example Environment Variables
 * ```bash
 * X402_PRIVATE_KEY=0x...      # Required for payments
 * X402_CHAIN=arbitrum         # Default chain
 * X402_MAX_PAYMENT=1.00       # Max payment per request
 * X402_ENABLE_GASLESS=true    # Enable gasless payments
 * ```
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerX402Tools } from "./tools.js"
import { loadX402Config, isX402Configured, validateX402Config, SUPPORTED_CHAINS } from "./config.js"
import Logger from "@/utils/logger.js"

// Re-export SDK components for advanced usage
export { X402Client } from "./sdk/client.js"
export { fetchWith402Handling, HTTP402Handler } from "./sdk/http/handler.js"
export { createPaymentGate, createDynamicPaymentGate } from "./sdk/http/middleware.js"
export { YieldTracker } from "./sdk/yield/tracker.js"

// Re-export types
export type {
  X402ClientConfig,
  X402Chain,
  X402Token,
  PaymentResult,
  HTTP402Response,
  YieldInfo,
} from "./sdk/types.js"

// Re-export config utilities
export { loadX402Config, isX402Configured, validateX402Config, SUPPORTED_CHAINS }

/**
 * Register all x402 payment tools with an MCP server
 * 
 * Tools registered:
 * - x402_pay_request: Make HTTP requests with automatic 402 payment
 * - x402_balance: Check wallet balance
 * - x402_send: Send direct payment
 * - x402_estimate: Estimate payment cost for a URL
 * - x402_networks: List supported networks
 * - x402_address: Get wallet address
 * - x402_yield: Get USDs yield information
 */
export function registerX402(server: McpServer): void {
  const config = loadX402Config()
  
  Logger.info("x402: Initializing payment protocol...")
  Logger.info(`x402: Chain: ${config.chain}`)
  Logger.info(`x402: Wallet configured: ${isX402Configured()}`)
  Logger.info(`x402: Max payment: $${config.maxPaymentPerRequest}`)
  Logger.info(`x402: Gasless enabled: ${config.enableGasless}`)
  
  registerX402Tools(server)
  
  Logger.info("x402: Payment protocol ready 💰")
}

/**
 * Quick check if x402 is available and configured
 */
export function x402Status(): {
  available: boolean
  configured: boolean
  chain: string
  maxPayment: string
} {
  const config = loadX402Config()
  return {
    available: true,
    configured: isX402Configured(),
    chain: config.chain,
    maxPayment: config.maxPaymentPerRequest,
  }
}
