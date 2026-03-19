/**
 * x402 Extensions Integration
 * @description Integrates @x402/extensions for advanced payment features
 * @author nirholas
 * @license Apache-2.0
 *
 * Provides access to:
 * - SIWX (Sign-In-With-X): Wallet-based authentication for EVM and Solana
 * - Offer-Receipt: Signed offer/receipt flow for payment negotiation
 * - Payment Identifier: Tracking extension for payment correlation
 * - EIP-2612 Gas Sponsoring: Gasless token approval extension
 */

import {
  // SIWX
  declareSIWxExtension,
  type SIWxExtension,
  type DeclareSIWxOptions,
  // Offer-Receipt
  createOfferReceiptExtension,
  declareOfferReceiptExtension,
  type OfferReceiptDeclaration,
  // Payment Identifier
  declarePaymentIdentifierExtension,
  type PaymentIdentifierExtension,
  // EIP-2612 Gas Sponsoring
  EIP2612_GAS_SPONSORING,
} from "@x402/extensions"
import Logger from "@/utils/logger.js"

// ============================================================================
// Types
// ============================================================================

export interface X402ExtensionsConfig {
  /** Enable SIWX wallet authentication */
  enableSIWX?: boolean
  /** Enable offer-receipt negotiation */
  enableOfferReceipt?: boolean
  /** Enable payment identifier tracking */
  enablePaymentIdentifier?: boolean
  /** Enable EIP-2612 gasless approvals */
  enableEip2612?: boolean
  /** SIWX domain for authentication */
  siwxDomain?: string
  /** SIWX statement shown to user */
  siwxStatement?: string
}

export interface X402Extensions {
  siwx?: SIWxExtension
  offerReceipt?: OfferReceiptDeclaration
  paymentIdentifier?: PaymentIdentifierExtension
  eip2612GasSponsoring?: typeof EIP2612_GAS_SPONSORING
  /** List of active extension names */
  active: string[]
}

// ============================================================================
// Extension Factory
// ============================================================================

/**
 * Initialize x402 extensions based on configuration
 *
 * Extensions add capabilities to the x402 payment flow:
 * - SIWX: Authenticate users via wallet signatures (EVM + Solana)
 * - Offer-Receipt: Structured payment negotiation with signed offers/receipts
 * - Payment Identifier: Correlate payments across systems with unique IDs
 * - EIP-2612: Gasless ERC20 approvals via permit signatures
 */
export function initializeExtensions(config: X402ExtensionsConfig = {}): X402Extensions {
  const extensions: X402Extensions = { active: [] }

  // SIWX - Sign-In-With-X wallet authentication
  if (config.enableSIWX !== false) {
    try {
      extensions.siwx = declareSIWxExtension({
        domain: config.siwxDomain || "agenti.app",
        statement: config.siwxStatement || "Sign in to Agenti MCP Server",
      } as DeclareSIWxOptions)
      extensions.active.push("siwx")
      Logger.debug("x402/extensions: SIWX authentication enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize SIWX:", error)
    }
  }

  // Offer-Receipt - Payment negotiation flow
  if (config.enableOfferReceipt) {
    try {
      extensions.offerReceipt = declareOfferReceiptExtension()
      extensions.active.push("offer-receipt")
      Logger.debug("x402/extensions: Offer-receipt negotiation enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize Offer-Receipt:", error)
    }
  }

  // Payment Identifier - Payment tracking
  if (config.enablePaymentIdentifier !== false) {
    try {
      extensions.paymentIdentifier = declarePaymentIdentifierExtension()
      extensions.active.push("payment-identifier")
      Logger.debug("x402/extensions: Payment identifier tracking enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize Payment Identifier:", error)
    }
  }

  // EIP-2612 Gas Sponsoring
  if (config.enableEip2612 !== false) {
    try {
      extensions.eip2612GasSponsoring = EIP2612_GAS_SPONSORING
      extensions.active.push("eip2612-gas-sponsoring")
      Logger.debug("x402/extensions: EIP-2612 gas sponsoring enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize EIP-2612:", error)
    }
  }

  Logger.info(`x402/extensions: ${extensions.active.length} extensions active: [${extensions.active.join(", ")}]`)
  return extensions
}

/**
 * Load extensions config from environment variables
 */
export function loadExtensionsConfig(): X402ExtensionsConfig {
  return {
    enableSIWX: process.env.X402_ENABLE_SIWX !== "false",
    enableOfferReceipt: process.env.X402_ENABLE_OFFER_RECEIPT === "true",
    enablePaymentIdentifier: process.env.X402_ENABLE_PAYMENT_ID !== "false",
    enableEip2612: process.env.X402_ENABLE_EIP2612 !== "false",
    siwxDomain: process.env.X402_SIWX_DOMAIN,
    siwxStatement: process.env.X402_SIWX_STATEMENT,
  }
}
