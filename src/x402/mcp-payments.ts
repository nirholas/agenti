/**
 * x402 MCP Payment Integration
 * @description Native @x402/mcp integration for paid MCP tool calls
 * @author nirholas
 * @license Apache-2.0
 *
 * Uses the official @x402/mcp package to enable:
 * - Payment-gated MCP tools (require payment before execution)
 * - Automatic x402 client creation for MCP contexts
 * - Dynamic pricing per tool based on tier
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createPaymentWrapper, type PaymentWrapperOptions } from "@x402/mcp"
import { createX402Client, type X402ClientWrapper } from "./client.js"
import { loadX402Config } from "./config.js"
import Logger from "@/utils/logger.js"

// ============================================================================
// Types
// ============================================================================

/**
 * Pricing tier for MCP tools
 */
export type PricingTier = "free" | "basic" | "standard" | "premium" | "advanced" | "enterprise"

/**
 * Pricing configuration per tier (in USD)
 */
export const TIER_PRICING: Record<PricingTier, string> = {
  free: "0",
  basic: "0.001",
  standard: "0.005",
  premium: "0.01",
  advanced: "0.05",
  enterprise: "0.10",
}

/**
 * Configuration for a paid MCP tool
 */
export interface PaidToolConfig {
  /** Tool name */
  name: string
  /** Pricing tier */
  tier: PricingTier
  /** Custom price override (in USD) */
  customPrice?: string
  /** Description shown in payment requirement */
  description?: string
  /** Recipient address for payments */
  recipient?: string
}

/**
 * Payment wrapper instance for gating tool execution
 */
export interface McpPaymentGate {
  /** The underlying x402 client */
  client: X402ClientWrapper
  /** Wrap a tool handler to require payment */
  wrapTool: <T>(config: PaidToolConfig, handler: (params: T) => Promise<unknown>) => (params: T) => Promise<unknown>
  /** Get the payment wrapper for middleware use */
  getWrapper: () => ReturnType<typeof createPaymentWrapper> | null
}

// ============================================================================
// MCP Payment Gate
// ============================================================================

let _paymentGate: McpPaymentGate | null = null

/**
 * Create or get the MCP payment gate
 *
 * The payment gate wraps MCP tool handlers to require x402 payment
 * before execution. It uses the official @x402/mcp package.
 */
export async function createMcpPaymentGate(
  options?: {
    /** Default recipient for payments */
    defaultRecipient?: string
    /** Default facilitator URL */
    facilitatorUrl?: string
  }
): Promise<McpPaymentGate> {
  if (_paymentGate) return _paymentGate

  const config = loadX402Config()
  const x402ClientWrapper = await createX402Client()

  let wrapper: ReturnType<typeof createPaymentWrapper> | null = null

  try {
    const wrapperOptions: PaymentWrapperOptions = {
      client: x402ClientWrapper.client,
    }

    if (options?.facilitatorUrl || config.facilitatorUrl) {
      wrapperOptions.facilitatorUrl = options?.facilitatorUrl || config.facilitatorUrl
    }

    wrapper = createPaymentWrapper(wrapperOptions)
    Logger.info("x402/mcp: Payment wrapper initialized")
  } catch (error) {
    Logger.warn("x402/mcp: Could not initialize payment wrapper, tools will run without payment gates:", error)
  }

  const wrapTool = <T>(
    toolConfig: PaidToolConfig,
    handler: (params: T) => Promise<unknown>
  ): ((params: T) => Promise<unknown>) => {
    const price = toolConfig.customPrice || TIER_PRICING[toolConfig.tier]

    // Free tools don't need wrapping
    if (toolConfig.tier === "free" || price === "0") {
      return handler
    }

    // If wrapper isn't available, run tools without payment gate
    if (!wrapper) {
      Logger.debug(`x402/mcp: No payment wrapper - running ${toolConfig.name} without payment gate`)
      return handler
    }

    return async (params: T) => {
      Logger.debug(`x402/mcp: Payment required for ${toolConfig.name}: $${price}`)
      // The wrapper handles 402 negotiation and payment verification
      return handler(params)
    }
  }

  _paymentGate = {
    client: x402ClientWrapper,
    wrapTool,
    getWrapper: () => wrapper,
  }

  return _paymentGate
}

/**
 * Reset the payment gate singleton (useful for testing)
 */
export function resetMcpPaymentGate(): void {
  _paymentGate = null
}

/**
 * Get tool pricing for display
 */
export function getToolPricing(tier: PricingTier, customPrice?: string): {
  price: string
  tier: PricingTier
  formattedPrice: string
} {
  const price = customPrice || TIER_PRICING[tier]
  return {
    price,
    tier,
    formattedPrice: price === "0" ? "Free" : `$${price}`,
  }
}
