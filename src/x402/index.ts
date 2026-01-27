/**
 * x402 Payment Protocol Integration
 * @description Main entry point for x402 payments in Universal Crypto MCP
 * @author nirholas
 * @license Apache-2.0
 * 
 * x402 enables AI agents to make and receive cryptocurrency payments.
 * Supports both EVM chains (Base, Ethereum, etc.) and Solana via CAIP-2.
 * 
 * @example
 * ```typescript
 * import { registerX402, createX402Client } from "@/x402/index.js"
 * 
 * // Register x402 tools with MCP server
 * registerX402(server)
 * 
 * // Or use the client directly
 * const { client, wrapAxios } = await createX402Client()
 * const api = wrapAxios(axios.create())
 * ```
 * 
 * @example Environment Variables
 * ```bash
 * X402_EVM_PRIVATE_KEY=0x...     # EVM wallet private key
 * X402_SVM_PRIVATE_KEY=...       # Solana wallet private key (base58)
 * X402_CHAIN=base                # Default chain
 * X402_MAX_PAYMENT=1.00          # Max payment per request
 * X402_ENABLE_GASLESS=true       # Enable gasless payments (EVM)
 * ```
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerX402Tools } from "./tools.js"
import {
  loadX402Config,
  loadLegacyX402Config,
  isX402Configured,
  isEvmConfigured,
  isSvmConfigured,
  validateX402Config,
  getChainType,
  getCaip2FromChain,
  getChainFromCaip2,
  getTokenConfig,
  getUsdcAddress,
  SUPPORTED_CHAINS,
  EVM_CHAINS,
  SVM_CHAINS,
  type X402Config,
  type X402Network,
  type NetworkConfig,
  type TokenConfig,
} from "./config.js"
import Logger from "@/utils/logger.js"

// Re-export new x402 client utilities
export {
  createX402Client,
  createPaymentAxios,
  createPaymentFetch,
  getDefaultClient,
  resetDefaultClient,
  createEvmSigner,
  createSvmSigner,
  detectChainType,
  isEvmNetwork,
  isSvmNetwork,
  wrapAxiosWithPayment,
  wrapFetchWithPayment,
  x402Client,
  ExactEvmScheme,
  ExactSvmScheme,
  toClientEvmSigner,
  toClientSvmSigner,
  type CreateX402ClientOptions,
  type X402ClientWrapper,
  type ClientEvmSigner,
  type ClientSvmSigner,
} from "./client.js"

// Re-export legacy SDK components for backward compatibility
export { X402Client } from "./sdk/client.js"
export { fetchWith402Handling, HTTP402Handler } from "./sdk/http/handler.js"
export { createPaymentGate, createDynamicPaymentGate } from "./sdk/http/middleware.js"
export { YieldTracker } from "./sdk/yield/tracker.js"

// Re-export YieldingWallet for auto-yield payments
export { 
  YieldingWallet,
  type YieldingWalletConfig,
  type YieldProjection,
  type MonthlyYieldReport,
  type WalletBalances,
  type ConversionResult,
  type YieldReportEntry,
} from "./sdk/wallet/yielding-wallet.js"

// Re-export server-side components for receiving payments
export {
  // Middleware
  x402Paywall,
  x402DynamicPaywall,
  x402PaywallFastify,
  x402PaywallHono,
  x402PaywallKoa,
  x402ExtractPayment,
  x402TrackPayment,
  x402RateLimit,
  // Verification
  X402PaymentVerifier,
  InMemoryNonceStore,
  createVerifier,
  // Facilitator
  X402Facilitator,
  createCoinbaseFacilitator,
  createSelfHostedFacilitator,
  createFacilitatorFromEnv,
  // Pricing
  dynamicPrice,
  fixedPrice,
  tieredPrice,
  timeBasedPrice,
  resourceBasedPrice,
  compositePrice,
  // Analytics
  X402Analytics,
  createFileAnalytics,
  createMemoryAnalytics,
  // Config
  loadX402ServerConfig,
  isX402ServerConfigured,
  // MCP Tools
  registerX402ServerTools,
} from "./server/index.js"

// Re-export CLI utilities for developers
export * from "./utils/index.js"

// Re-export types
export type {
  X402ClientConfig,
  X402Chain,
  X402SvmChain,
  X402Token,
  PaymentResult,
  HTTP402Response,
  YieldInfo,
} from "./sdk/types.js"

// Re-export config utilities
export {
  loadX402Config,
  loadLegacyX402Config,
  isX402Configured,
  isEvmConfigured,
  isSvmConfigured,
  validateX402Config,
  getChainType,
  getCaip2FromChain,
  getChainFromCaip2,
  getTokenConfig,
  getUsdcAddress,
  SUPPORTED_CHAINS,
  EVM_CHAINS,
  SVM_CHAINS,
}
export type { X402Config, X402Network, NetworkConfig, TokenConfig }

// Re-export security utilities
export {
  validatePrivateKeyFormat,
  loadPrivateKeySecure,
  isKeySourceSecure,
  validateAndChecksumAddress,
  isChecksumValid,
  maskSensitiveData,
  sanitizeForLogging,
  logSecurityEvent,
  getSecurityEvents,
  isProductionEnvironment,
  requireMainnetOptIn,
  isTestnetOnly,
  registerExternalSigner,
  hasExternalSigner,
  getExternalSigner,
  generateSecureNonce,
  type SecurityEvent,
  type SecurityEventType,
  type ExternalSigner,
} from "./security.js"

// Re-export payment limits
export {
  DEFAULT_LIMITS,
  getPaymentLimits,
  setPaymentLimits,
  getDailySpending,
  recordPayment,
  getTodayPayments,
  validatePaymentLimits,
  isServiceApproved,
  approveService,
  removeService,
  getApprovedServices,
  setStrictAllowlistMode,
  isStrictAllowlistMode,
  addToPaymentHistory,
  updatePaymentStatus,
  getPaymentHistory,
  getPaymentStats,
  type PaymentLimits,
  type PaymentValidationResult,
} from "./limits.js"

// Re-export input validation
export {
  validateURL,
  getURLValidationOptions,
  validateAmount,
  validateAddress,
  validateToken,
  validateChain,
  sanitizeString,
  validateMemo,
  type URLValidationOptions,
  type URLValidationResult,
  type AmountValidationResult,
  type AddressValidationResult,
} from "./validation.js"

// Re-export verification utilities
export {
  isNonceUsed,
  markNonceUsed,
  getNonceStats,
  verifyPaymentProof,
  registerFacilitator,
  isTrustedFacilitator,
  getRegisteredFacilitators,
  verifyFacilitatorSignature,
  verifyAuthorizationTiming,
  isValidTxHash,
  generatePaymentId,
  storeReceipt,
  getReceipt,
  isPaymentVerified,
  type PaymentProof,
  type ProofVerificationResult,
  type EIP3009Authorization,
  type PaymentReceipt,
} from "./verification.js"

/**
 * Register all x402 payment tools with an MCP server
 * 
 * Tools registered (Client-side - making payments):
 * - x402_pay_request: Make HTTP requests with automatic 402 payment
 * - x402_balance: Check wallet balance
 * - x402_send: Send direct payment
 * - x402_estimate: Estimate payment cost for a URL
 * - x402_networks: List supported networks
 * - x402_address: Get wallet address
 * - x402_yield: Get USDs yield information
 * 
 * Tools registered (Server-side - receiving payments):
 * - x402_create_protected_endpoint: Define a new paywall
 * - x402_list_earnings: View revenue
 * - x402_withdraw_earnings: Withdraw funds
 * - x402_set_pricing: Configure prices
 * - x402_server_status: Check server configuration
 * - x402_export_analytics: Export payment data
 * - x402_list_endpoints: List protected endpoints
 */
export function registerX402(server: McpServer): void {
  const config = loadX402Config()
  const validation = validateX402Config(config)
  
  Logger.info("x402: Initializing payment protocol...")
  Logger.info(`x402: Default chain: ${config.defaultChain}`)
  Logger.info(`x402: EVM configured: ${isEvmConfigured()}`)
  Logger.info(`x402: SVM configured: ${isSvmConfigured()}`)
  Logger.info(`x402: Max payment: $${config.maxPaymentPerRequest}`)
  Logger.info(`x402: Gasless enabled: ${config.enableGasless}`)
  
  // Log any warnings
  for (const warning of validation.warnings) {
    Logger.warn(`x402: ${warning}`)
  }
  
  // Log any errors (but don't fail - payment features will be limited)
  for (const error of validation.errors) {
    Logger.error(`x402: ${error}`)
  }
  
  // Register client-side tools (making payments)
  registerX402Tools(server)
  
  // Register server-side tools (receiving payments)
  registerX402ServerTools(server)
  
  Logger.info("x402: Payment protocol ready 💰")
}

/**
 * Quick check if x402 is available and configured
 */
export function x402Status(): {
  available: boolean
  evmConfigured: boolean
  svmConfigured: boolean
  defaultChain: string
  maxPayment: string
  supportedChains: string[]
} {
  const config = loadX402Config()
  return {
    available: true,
    evmConfigured: isEvmConfigured(),
    svmConfigured: isSvmConfigured(),
    defaultChain: config.defaultChain,
    maxPayment: config.maxPaymentPerRequest,
    supportedChains: Object.keys(SUPPORTED_CHAINS),
  }
}
