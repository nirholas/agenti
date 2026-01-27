/**
 * @nirholas/x402-ecosystem
 * 
 * Shared x402 payment utilities for the nirholas ecosystem.
 * Enables AI agents to pay for services and receive payments.
 * 
 * @example Quick Start - Making Payments
 * ```typescript
 * import { PayableAgent, createPaymentClient } from "@nirholas/x402-ecosystem";
 * 
 * // Create a payment-capable agent
 * const agent = new PayableAgent({
 *   privateKey: process.env.X402_PRIVATE_KEY,
 *   maxDailySpend: "10.00", // Max $10/day
 * });
 * 
 * // Make a paid API request
 * const data = await agent.payForService("https://api.example.com/premium");
 * ```
 * 
 * @example Quick Start - Receiving Payments
 * ```typescript
 * import { createPremiumTier, PricingStrategy } from "@nirholas/x402-ecosystem/premium";
 * 
 * // Define premium tiers
 * const tiers = createPremiumTier({
 *   free: { rateLimit: 100, features: ["basic"] },
 *   premium: { 
 *     price: "0.01", // $0.01/request
 *     features: ["advanced", "priority"],
 *   },
 * });
 * ```
 * 
 * @author nich
 * @license Apache-2.0
 */

// Core exports
export {
  PayableAgent,
  AgentWallet,
  createAgentWallet,
  type PayableAgentConfig,
  type AgentWalletConfig,
  type PaymentCapabilities,
} from "./agent.js";

export {
  ToolMarketplace,
  ToolRegistry,
  createToolListing,
  type ToolListing,
  type ToolPricing,
  type MarketplaceConfig,
  type RevenueSplit,
} from "./marketplace.js";

export {
  createPremiumTier,
  PricingStrategy,
  PaywallBuilder,
  type PremiumTier,
  type TierConfig,
  type PaywallConfig,
} from "./premium.js";

export {
  YieldingWallet,
  YieldProjector,
  createYieldReport,
  type YieldConfig,
  type YieldProjection,
  type YieldReport,
} from "./yield.js";

// Utility types and constants
export type { Address, Hash, ChainId } from "./types.js";

export {
  SUPPORTED_NETWORKS,
  USDC_ADDRESSES,
  USDS_ADDRESS,
  DEFAULT_FACILITATOR_URL,
} from "./constants.js";

// MCP Integration helpers
export { registerX402Ecosystem } from "./mcp.js";
