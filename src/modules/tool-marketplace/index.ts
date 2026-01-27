/**
 * Tool Marketplace Module
 * @description Decentralized marketplace for paid AI tools using x402 payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * This module provides:
 * - Tool registration with pricing and revenue splits
 * - Tool discovery with filters (price, category, rating)
 * - Usage tracking and analytics
 * - Creator earnings dashboard
 * - Subscription management
 * 
 * @example
 * ```typescript
 * import { registerToolMarketplace } from "@/modules/tool-marketplace"
 * 
 * // Register with MCP server
 * registerToolMarketplace(server)
 * 
 * // Or use the registry directly
 * import { toolRegistry } from "@/modules/tool-marketplace"
 * 
 * const tool = await toolRegistry.registerTool({
 *   name: "weather-premium",
 *   displayName: "Premium Weather API",
 *   description: "Real-time weather with hourly forecasts",
 *   endpoint: "https://weather.example.com/api",
 *   category: "data",
 *   pricing: {
 *     model: "per-call",
 *     basePrice: "0.001",
 *     acceptedTokens: ["USDs"],
 *     supportedChains: ["arbitrum"],
 *   },
 *   owner: "0x...",
 *   revenueSplit: [
 *     { address: "0x...", percent: 80, label: "creator" },
 *     { address: "0x...", percent: 20, label: "platform" },
 *   ],
 * })
 * ```
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerToolMarketplaceTools } from "./tools.js"
import { registerToolMarketplacePrompts } from "./prompts.js"
import Logger from "@/utils/logger.js"

// Export types
export type {
  RevenueSplit,
  PricingModel,
  SubscriptionTier,
  TieredPricing,
  ToolPricing,
  ToolCategory,
  ToolStatus,
  ToolMetadata,
  RegisterToolInput,
  RegisteredTool,
  ToolDiscoveryFilter,
  ToolUsageRecord,
  ToolRevenue,
  CreatorAnalytics,
  SubscriptionStatus,
  MarketplaceStats,
  MarketplaceEventType,
  MarketplaceEvent,
  PayoutConfig,
} from "./types.js"

// Export registry
export { toolRegistry, ToolRegistryService } from "./registry.js"

// Export client
export {
  MarketplaceClient,
  createMarketplaceClient,
  type CallToolOptions,
  type CallToolResult,
} from "./client.js"

// Export revenue splitter
export {
  revenueSplitter,
  RevenueSplitterService,
  type PayoutRecord,
  type PendingPayout,
  type RevenueDistribution,
} from "./revenue.js"

/**
 * Register tool marketplace module with the MCP server
 * Provides tools for discovering, registering, and using paid AI tools
 */
export function registerToolMarketplace(server: McpServer): void {
  registerToolMarketplaceTools(server)
  registerToolMarketplacePrompts(server)
  Logger.info("Tool Marketplace module registered")
}
