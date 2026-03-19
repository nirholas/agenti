import type { Address, Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import type { PaymentEvent } from "../mcp/client/index.ts"
import { OWNABLE_VALIDATOR } from "../smart-account/index.ts"
import {
  createWalletFromConfig,
  type Authorization,
  type PaymentContext,
  type PaymentStatus,
  type SmartAccountWalletConfig,
  type WalletConfig,
  type X402Treasurer,
  type X402Wallet,
} from "../x402/index.ts"
import { ApiClient } from "./client.ts"

/** Default Ampersend API URL */
const DEFAULT_API_URL = "https://api.ampersend.ai"

/** Default chain ID (Base mainnet) */
const DEFAULT_CHAIN_ID = 8453

/**
 * Simplified configuration for quick setup with smart accounts.
 * This is the recommended way to configure the treasurer for most use cases.
 *
 * @example
 * ```typescript
 * const treasurer = createAmpersendTreasurer({
 *   smartAccountAddress: "0x...",
 *   sessionKeyPrivateKey: "0x...",
 * })
 * ```
 */
export interface SimpleAmpersendTreasurerConfig {
  /** Smart account address */
  smartAccountAddress: Address
  /** Session key private key for signing */
  sessionKeyPrivateKey: Hex
  /** Ampersend API URL (defaults to production) */
  apiUrl?: string
  /** Chain ID (defaults to Base mainnet 8453) */
  chainId?: number
}

/**
 * Full configuration for advanced use cases with complete wallet control.
 * Use this when you need EOA wallets or custom authentication settings.
 */
export interface FullAmpersendTreasurerConfig {
  /** Base URL of the Ampersend API server */
  apiUrl: string
  /** Wallet configuration (EOA or Smart Account) */
  walletConfig: WalletConfig
  /** Optional authentication configuration */
  authConfig?: {
    /** SIWE domain for authentication */
    domain?: string
    /** SIWE statement for authentication */
    statement?: string
  }
}

/**
 * Configuration for the Ampersend treasurer.
 * Can be either simplified (recommended) or full configuration.
 */
export type AmpersendTreasurerConfig = SimpleAmpersendTreasurerConfig | FullAmpersendTreasurerConfig

/**
 * Type guard to check if config is the simplified format
 */
function isSimpleConfig(config: AmpersendTreasurerConfig): config is SimpleAmpersendTreasurerConfig {
  return "smartAccountAddress" in config && "sessionKeyPrivateKey" in config && !("walletConfig" in config)
}

/**
 * AmpersendTreasurer - Ampersend API-based payment authorization with X402Treasurer pattern
 *
 * This treasurer:
 * 1. Authenticates with the Ampersend API using SIWE
 * 2. Requests payment authorization from the API before creating payments
 * 3. Creates payments only when authorized by the API
 * 4. Reports payment lifecycle events back to the API for tracking
 *
 * @example
 * ```typescript
 * const treasurer = createAmpersendTreasurer({
 *   apiUrl: "https://api.example.com",
 *   walletConfig: { type: "eoa", privateKey: "0x..." }
 * })
 * await initializeProxyServer({ transport, treasurer })
 * ```
 */
export class AmpersendTreasurer implements X402Treasurer {
  constructor(
    private apiClient: ApiClient,
    private wallet: X402Wallet,
  ) {}

  /**
   * Requests payment authorization from API before creating payment.
   * Only creates payment if API authorizes it.
   */
  async onPaymentRequired(requirements: Array<any>, context?: PaymentContext): Promise<Authorization | null> {
    try {
      // Authorize payment with API
      const response = await this.apiClient.authorizePayment(requirements as any, context)

      // Check if any requirements were authorized
      if (response.authorized.requirements.length === 0) {
        // Log rejection reasons for debugging
        const reasons = response.rejected.map((r) => `${r.requirement.resource}: ${r.reason}`).join(", ")
        console.log(`[AmpersendTreasurer] No requirements authorized. Reasons: ${reasons || "None provided"}`)
        return null // Decline
      }

      // Use recommended requirement (or first if recommended is null)
      const recommendedIndex = response.authorized.recommended ?? 0
      const authorizedReq = response.authorized.requirements[recommendedIndex]

      if (!authorizedReq) {
        throw new Error("Recommended requirement index out of bounds")
      }

      // Create payment with wallet using the authorized requirement
      // Note: Type assertion needed because ampersend PaymentRequirements uses string for network,
      // while x402 PaymentRequirements uses specific network literals. Runtime compatible.
      const payment = await this.wallet.createPayment(authorizedReq.requirement as any)

      return {
        payment,
        authorizationId: crypto.randomUUID(),
      }
    } catch (error) {
      console.error("[AmpersendTreasurer] Payment authorization failed:", error)
      return null
    }
  }

  /**
   * Reports payment status updates back to API for tracking.
   * Logs errors but doesn't fail on tracking errors.
   */
  async onStatus(status: PaymentStatus, authorization: Authorization, _context?: PaymentContext): Promise<void> {
    try {
      // Map status to event type for API
      const event = this.mapStatusToEvent(status)
      await this.apiClient.reportPaymentEvent(authorization.authorizationId, authorization.payment, event)
    } catch (error) {
      // Log but don't fail on event tracking errors
      console.error(`[AmpersendTreasurer] Failed to report status ${status}:`, error)
    }
  }

  /**
   * Maps X402 PaymentStatus to legacy PaymentEvent for API compatibility
   */
  private mapStatusToEvent(status: PaymentStatus): PaymentEvent {
    switch (status) {
      case "sending":
        return { type: "sending" }
      case "accepted":
        return { type: "accepted" }
      case "rejected":
        return { type: "rejected", reason: "Payment rejected by server" }
      case "declined":
        return { type: "rejected", reason: "Payment declined by treasurer" }
      case "error":
        return { type: "error", reason: "Payment processing error" }
    }
  }
}

/**
 * Creates an Ampersend treasurer that consults the Ampersend API before making payments.
 *
 * This treasurer:
 * 1. Authenticates with the Ampersend API using SIWE
 * 2. Requests payment authorization from the API
 * 3. Creates payments only when authorized
 * 4. Reports payment lifecycle events back to the API
 *
 * @example Simple setup (recommended):
 * ```typescript
 * const treasurer = createAmpersendTreasurer({
 *   smartAccountAddress: "0x...",
 *   sessionKeyPrivateKey: "0x...",
 * })
 * ```
 *
 * @example Full control:
 * ```typescript
 * const treasurer = createAmpersendTreasurer({
 *   apiUrl: "https://api.ampersend.ai",
 *   walletConfig: { type: "eoa", privateKey: "0x..." }
 * })
 * ```
 *
 * @param config - Configuration for the Ampersend treasurer
 * @returns An X402Treasurer implementation
 */
export function createAmpersendTreasurer(config: AmpersendTreasurerConfig): X402Treasurer {
  if (isSimpleConfig(config)) {
    // Simple config - build wallet config automatically
    const walletConfig: SmartAccountWalletConfig = {
      type: "smart-account",
      smartAccountAddress: config.smartAccountAddress,
      sessionKeyPrivateKey: config.sessionKeyPrivateKey,
      chainId: config.chainId ?? DEFAULT_CHAIN_ID,
      validatorAddress: OWNABLE_VALIDATOR,
    }

    const apiClient = new ApiClient({
      baseUrl: config.apiUrl ?? DEFAULT_API_URL,
      sessionKeyPrivateKey: config.sessionKeyPrivateKey,
      agentAddress: config.smartAccountAddress,
      timeout: 30000,
    })

    const wallet = createWalletFromConfig(walletConfig)
    return new AmpersendTreasurer(apiClient, wallet)
  }

  // Full config - existing behavior
  const { apiUrl, authConfig, walletConfig } = config

  // Determine which private key to use for API authentication
  const authPrivateKey = walletConfig.type === "eoa" ? walletConfig.privateKey : walletConfig.sessionKeyPrivateKey

  // Derive agent address from wallet config
  const agentAddress =
    walletConfig.type === "smart-account"
      ? walletConfig.smartAccountAddress
      : privateKeyToAccount(walletConfig.privateKey).address

  // Create API client
  const apiClient = new ApiClient({
    baseUrl: apiUrl,
    sessionKeyPrivateKey: authPrivateKey,
    agentAddress,
    timeout: 30000,
    ...authConfig,
  })

  // Create wallet from configuration
  const wallet = createWalletFromConfig(walletConfig)

  return new AmpersendTreasurer(apiClient, wallet)
}
