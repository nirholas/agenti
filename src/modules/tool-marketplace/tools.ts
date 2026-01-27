/**
 * Tool Marketplace MCP Tools
 * @description MCP tools for the decentralized AI tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { toolRegistry, ToolRegistryService } from "./registry.js"
import type { Address } from "viem"
import Logger from "@/utils/logger.js"

/**
 * Revenue split schema
 */
const RevenueSplitSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  percent: z.number().min(0).max(100),
  label: z.string().optional(),
})

/**
 * Pricing schema
 */
const PricingSchema = z.object({
  model: z.enum(["per-call", "subscription", "tiered", "freemium"]),
  basePrice: z.string().optional(),
  freeCallsPerDay: z.number().optional(),
  acceptedTokens: z.array(z.enum(["USDs", "USDC", "ETH"])),
  supportedChains: z.array(z.string()),
})

/**
 * Register tool marketplace tools with MCP server
 */
export function registerToolMarketplaceTools(server: McpServer): void {
  // ============================================================================
  // Tool Registration Tools
  // ============================================================================

  server.tool(
    "marketplace_register_tool",
    "Register a new AI tool in the decentralized marketplace. " +
    "Define pricing, revenue splits, and make your tool discoverable to AI agents.",
    {
      name: z.string().min(3).max(50).describe("Unique tool identifier (e.g., 'weather-premium')"),
      displayName: z.string().max(100).describe("Human-readable display name"),
      description: z.string().max(500).describe("Tool description"),
      endpoint: z.string().url().describe("API endpoint URL"),
      category: z.enum(["data", "ai", "defi", "analytics", "social", "utilities", "notifications", "storage", "compute", "other"]).describe("Tool category"),
      price: z.string().describe("Price per call in USD (e.g., '0.001')"),
      acceptedTokens: z.array(z.enum(["USDs", "USDC", "ETH"])).default(["USDs"]).describe("Accepted payment tokens"),
      supportedChains: z.array(z.string()).default(["arbitrum"]).describe("Supported blockchain networks"),
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Tool owner wallet address"),
      revenueSplit: z.array(RevenueSplitSchema).describe("Revenue split configuration (must total 100%)"),
      docsUrl: z.string().url().optional().describe("Documentation URL"),
      tags: z.array(z.string()).optional().describe("Tags for discovery"),
    },
    async (params) => {
      try {
        const tool = await toolRegistry.registerTool({
          name: params.name,
          displayName: params.displayName,
          description: params.description,
          endpoint: params.endpoint,
          category: params.category,
          pricing: {
            model: "per-call",
            basePrice: params.price,
            acceptedTokens: params.acceptedTokens as any,
            supportedChains: params.supportedChains,
          },
          owner: params.ownerAddress as Address,
          revenueSplit: params.revenueSplit as any,
          docsUrl: params.docsUrl,
          tags: params.tags,
        })

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Tool "${params.displayName}" registered successfully!`,
              toolId: tool.toolId,
              name: tool.name,
              endpoint: tool.endpoint,
              price: params.price,
              status: tool.status,
              registeredAt: new Date(tool.registeredAt).toISOString(),
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Registration failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_update_tool",
    "Update an existing tool's settings (pricing, description, etc.). Only the tool owner can update.",
    {
      toolId: z.string().describe("The tool ID to update"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
      displayName: z.string().optional().describe("New display name"),
      description: z.string().optional().describe("New description"),
      price: z.string().optional().describe("New price per call"),
      docsUrl: z.string().url().optional().describe("New documentation URL"),
      tags: z.array(z.string()).optional().describe("New tags"),
    },
    async (params) => {
      try {
        const updates: any = {}
        if (params.displayName) updates.displayName = params.displayName
        if (params.description) updates.description = params.description
        if (params.docsUrl) updates.docsUrl = params.docsUrl
        if (params.tags) updates.tags = params.tags
        if (params.price) {
          const tool = await toolRegistry.getTool(params.toolId)
          if (tool) {
            updates.pricing = { ...tool.pricing, basePrice: params.price }
          }
        }

        const tool = await toolRegistry.updateTool(
          params.toolId,
          updates,
          params.callerAddress as Address
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Tool updated successfully",
              tool: {
                toolId: tool.toolId,
                name: tool.name,
                version: tool.metadata.version,
                updatedAt: new Date(tool.metadata.updatedAt).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Update failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_pause_tool",
    "Pause a tool to stop accepting new payments. Useful for maintenance.",
    {
      toolId: z.string().describe("The tool ID to pause"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
    },
    async (params) => {
      try {
        await toolRegistry.pauseTool(params.toolId, params.callerAddress as Address)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Tool ${params.toolId} has been paused`,
              status: "paused",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Pause failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_activate_tool",
    "Reactivate a paused tool to resume accepting payments.",
    {
      toolId: z.string().describe("The tool ID to activate"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
    },
    async (params) => {
      try {
        await toolRegistry.activateTool(params.toolId, params.callerAddress as Address)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Tool ${params.toolId} has been activated`,
              status: "active",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Activation failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Tool Discovery Tools
  // ============================================================================

  server.tool(
    "marketplace_discover_tools",
    "Discover paid AI tools in the marketplace. Filter by price, category, rating, and more.",
    {
      maxPrice: z.string().optional().describe("Maximum price per call in USD"),
      category: z.enum(["data", "ai", "defi", "analytics", "social", "utilities", "notifications", "storage", "compute", "other"]).optional().describe("Filter by category"),
      minRating: z.number().min(1).max(5).optional().describe("Minimum rating (1-5)"),
      query: z.string().optional().describe("Search query"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      chain: z.string().optional().describe("Filter by supported chain"),
      sortBy: z.enum(["price", "rating", "popularity", "newest"]).default("popularity").describe("Sort field"),
      sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
      limit: z.number().default(20).describe("Max results to return"),
    },
    async (params) => {
      try {
        const tools = await toolRegistry.discoverTools({
          maxPrice: params.maxPrice,
          category: params.category,
          minRating: params.minRating,
          query: params.query,
          tags: params.tags,
          chain: params.chain,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          limit: params.limit,
        })

        const results = tools.map(tool => ({
          toolId: tool.toolId,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          category: tool.category,
          price: tool.pricing.basePrice,
          endpoint: tool.endpoint,
          rating: tool.metadata.rating,
          totalCalls: tool.metadata.totalCalls,
          tags: tool.tags,
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: results.length,
              tools: results,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Discovery failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_get_tool",
    "Get detailed information about a specific tool.",
    {
      toolId: z.string().optional().describe("Tool ID"),
      name: z.string().optional().describe("Tool name"),
    },
    async (params) => {
      try {
        let tool = null
        if (params.toolId) {
          tool = await toolRegistry.getTool(params.toolId)
        } else if (params.name) {
          tool = await toolRegistry.getToolByName(params.name)
        } else {
          throw new Error("Either toolId or name is required")
        }

        if (!tool) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Tool not found",
              }, null, 2),
            }],
            isError: true,
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              tool: {
                toolId: tool.toolId,
                name: tool.name,
                displayName: tool.displayName,
                description: tool.description,
                endpoint: tool.endpoint,
                category: tool.category,
                status: tool.status,
                pricing: tool.pricing,
                owner: tool.owner,
                revenueSplit: tool.revenueSplit,
                docsUrl: tool.docsUrl,
                tags: tool.tags,
                metadata: tool.metadata,
                registeredAt: new Date(tool.registeredAt).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get tool",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Revenue & Analytics Tools
  // ============================================================================

  server.tool(
    "marketplace_tool_revenue",
    "Get revenue information for a tool including weekly/monthly stats and pending payouts.",
    {
      toolId: z.string().describe("Tool ID to check revenue for"),
    },
    async (params) => {
      try {
        const revenue = await toolRegistry.getToolRevenue(params.toolId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              revenue: {
                toolId: revenue.toolId,
                totalRevenue: `$${revenue.totalRevenue}`,
                weeklyRevenue: `$${revenue.weeklyRevenue}`,
                monthlyRevenue: `$${revenue.monthlyRevenue}`,
                pendingPayouts: revenue.pendingPayouts.map(p => ({
                  address: p.address,
                  amount: `$${p.amount}`,
                })),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get revenue",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_creator_analytics",
    "Get comprehensive analytics for a tool creator including all tools, revenue, and history.",
    {
      creatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Creator wallet address"),
    },
    async (params) => {
      try {
        const analytics = await toolRegistry.getCreatorAnalytics(params.creatorAddress as Address)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              analytics: {
                creatorAddress: analytics.creatorAddress,
                toolsOwned: analytics.toolsOwned,
                totalRevenue: `$${analytics.totalRevenue}`,
                totalCalls: analytics.totalCalls,
                avgRating: analytics.avgRating.toFixed(2),
                revenueByTool: analytics.revenueByTool.map(t => ({
                  ...t,
                  revenue: `$${t.revenue}`,
                })),
                weeklyRevenueHistory: analytics.weeklyRevenueHistory.map(w => ({
                  ...w,
                  revenue: `$${w.revenue}`,
                })),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get analytics",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_stats",
    "Get overall marketplace statistics including volume, tool counts, and top performers.",
    {},
    async () => {
      try {
        const stats = await toolRegistry.getMarketplaceStats()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              stats: {
                totalTools: stats.totalTools,
                activeTools: stats.activeTools,
                totalCreators: stats.totalCreators,
                totalVolume: `$${stats.totalVolume}`,
                volume24h: `$${stats.volume24h}`,
                volume7d: `$${stats.volume7d}`,
                totalCalls: stats.totalCalls,
                avgToolPrice: `$${stats.avgToolPrice}`,
                topCategory: stats.topCategory,
                topToolsByRevenue: stats.topToolsByRevenue.map(t => ({
                  ...t,
                  revenue: `$${t.revenue}`,
                })),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get stats",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Usage Tracking Tools
  // ============================================================================

  server.tool(
    "marketplace_usage_history",
    "Get usage history for a tool or user.",
    {
      toolId: z.string().optional().describe("Tool ID to get history for"),
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe("User address to get history for"),
      limit: z.number().default(50).describe("Max records to return"),
    },
    async (params) => {
      try {
        let usage
        if (params.toolId) {
          usage = await toolRegistry.getUsageHistory(params.toolId, params.limit)
        } else if (params.userAddress) {
          usage = await toolRegistry.getUserUsageHistory(params.userAddress as Address, params.limit)
        } else {
          throw new Error("Either toolId or userAddress is required")
        }

        const records = usage.map(u => ({
          id: u.id,
          toolId: u.toolId,
          timestamp: new Date(u.timestamp).toISOString(),
          amountPaid: `$${u.amountPaid}`,
          token: u.token,
          txHash: u.txHash,
          responseTime: `${u.responseTime}ms`,
          success: u.success,
          error: u.error,
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: records.length,
              usage: records,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get usage",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_recent_events",
    "Get recent marketplace events (registrations, payments, etc.).",
    {
      limit: z.number().default(50).describe("Max events to return"),
    },
    async (params) => {
      try {
        const events = await toolRegistry.getRecentEvents(params.limit)

        const formatted = events.map(e => ({
          type: e.type,
          timestamp: new Date(e.timestamp).toISOString(),
          toolId: e.toolId,
          userAddress: e.userAddress,
          amount: e.amount ? `$${e.amount}` : undefined,
          txHash: e.txHash,
          data: e.data,
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: formatted.length,
              events: formatted,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get events",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  Logger.info("Tool Marketplace MCP tools registered")
}
