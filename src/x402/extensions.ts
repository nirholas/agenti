/**
 * x402 Extensions Integration
 * @description Integrates @x402/extensions for advanced payment features
 * @author nirholas
 * @license Apache-2.0
 *
 * Provides access to:
 * - SIWX (Sign-In-With-X): Wallet-based authentication for EVM and Solana
 * - EIP-2612 Permit2: Gasless token approval extension
 * - Offer-Receipt: Signed offer/receipt flow for payment negotiation
 * - Payment Identifier: Tracking extension for payment correlation
 */

import {
  createSIWXExtension,
  createPermit2Extension,
  createOfferReceiptExtension,
  createPaymentIdentifierExtension,
  type SIWXExtension,
  type Permit2Extension,
  type OfferReceiptExtension,
  type PaymentIdentifierExtension,
} from "@x402/extensions"
import Logger from "@/utils/logger.js"

// ============================================================================
// Types
// ============================================================================

export interface X402ExtensionsConfig {
  /** Enable SIWX wallet authentication */
  enableSIWX?: boolean
  /** Enable gasless Permit2 approvals */
  enablePermit2?: boolean
  /** Enable offer-receipt negotiation */
  enableOfferReceipt?: boolean
  /** Enable payment identifier tracking */
  enablePaymentIdentifier?: boolean
  /** SIWX domain for authentication */
  siwxDomain?: string
  /** SIWX statement shown to user */
  siwxStatement?: string
}

export interface X402Extensions {
  siwx?: SIWXExtension
  permit2?: Permit2Extension
  offerReceipt?: OfferReceiptExtension
  paymentIdentifier?: PaymentIdentifierExtension
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
 * - Permit2: Gasless ERC20 approvals via EIP-2612 signatures
 * - Offer-Receipt: Structured payment negotiation with signed offers/receipts
 * - Payment Identifier: Correlate payments across systems with unique IDs
 */
export function initializeExtensions(config: X402ExtensionsConfig = {}): X402Extensions {
  const extensions: X402Extensions = { active: [] }

  // SIWX - Sign-In-With-X wallet authentication
  if (config.enableSIWX !== false) {
    try {
      extensions.siwx = createSIWXExtension({
        domain: config.siwxDomain || "agenti.app",
        statement: config.siwxStatement || "Sign in to Agenti MCP Server",
      })
      extensions.active.push("siwx")
      Logger.debug("x402/extensions: SIWX authentication enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize SIWX:", error)
    }
  }

  // Permit2 - Gasless token approvals
  if (config.enablePermit2 !== false) {
    try {
      extensions.permit2 = createPermit2Extension()
      extensions.active.push("permit2")
      Logger.debug("x402/extensions: Permit2 gasless approvals enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize Permit2:", error)
    }
  }

  // Offer-Receipt - Payment negotiation flow
  if (config.enableOfferReceipt) {
    try {
      extensions.offerReceipt = createOfferReceiptExtension()
      extensions.active.push("offer-receipt")
      Logger.debug("x402/extensions: Offer-receipt negotiation enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize Offer-Receipt:", error)
    }
  }

  // Payment Identifier - Payment tracking
  if (config.enablePaymentIdentifier !== false) {
    try {
      extensions.paymentIdentifier = createPaymentIdentifierExtension()
      extensions.active.push("payment-identifier")
      Logger.debug("x402/extensions: Payment identifier tracking enabled")
    } catch (error) {
      Logger.warn("x402/extensions: Failed to initialize Payment Identifier:", error)
    }
  }

  Logger.info(`x402/extensions: ${extensions.active.length} extensions active: [${extensions.active.join(", ")}]`)
  return extensions
}

/**
 * Load extensions config from environment variables
 *
 * Environment Variables:
 * - X402_ENABLE_SIWX: Enable SIWX authentication (default: true)
 * - X402_ENABLE_PERMIT2: Enable Permit2 gasless approvals (default: true)
 * - X402_ENABLE_OFFER_RECEIPT: Enable offer-receipt flow (default: false)
 * - X402_ENABLE_PAYMENT_ID: Enable payment identifier tracking (default: true)
 * - X402_SIWX_DOMAIN: Domain for SIWX authentication
 * - X402_SIWX_STATEMENT: Statement shown during SIWX signing
 */
export function loadExtensionsConfig(): X402ExtensionsConfig {
  return {
    enableSIWX: process.env.X402_ENABLE_SIWX !== "false",
    enablePermit2: process.env.X402_ENABLE_PERMIT2 !== "false",
    enableOfferReceipt: process.env.X402_ENABLE_OFFER_RECEIPT === "true",
    enablePaymentIdentifier: process.env.X402_ENABLE_PAYMENT_ID !== "false",
    siwxDomain: process.env.X402_SIWX_DOMAIN,
    siwxStatement: process.env.X402_SIWX_STATEMENT,
  }
}
