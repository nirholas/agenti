/**
 * MCP Integration - Register x402 ecosystem tools with MCP server
 * 
 * Provides a single function to add all x402-ecosystem capabilities
 * to an MCP server, enabling AI agents to interact with the payment
 * ecosystem.
 * 
 * @example
 * ```typescript
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { registerX402Ecosystem } from "@nirholas/x402-ecosystem";
 * 
 * const server = new McpServer({ name: "my-server" });
 * 
 * // Register all x402 ecosystem tools
 * registerX402Ecosystem(server, {
 *   enableMarketplace: true,
 *   enableYield: true,
 * });
 * ```
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PayableAgent, createPayableAgentFromEnv } from "./agent.js";
import { ToolMarketplace, createToolListing } from "./marketplace.js";
import { PricingStrategy, PaywallBuilder, createPremiumTier } from "./premium.js";
import { YieldProjector } from "./yield.js";
import { SUPPORTED_NETWORKS, TOOL_CATEGORIES } from "./constants.js";
import type { Address } from "./types.js";

/**
 * Options for registering x402 ecosystem
 */
export interface RegisterX402EcosystemOptions {
  /** Enable marketplace tools */
  enableMarketplace?: boolean;
  /** Enable yield tracking tools */
  enableYield?: boolean;
  /** Enable premium tier tools */
  enablePremium?: boolean;
  /** Custom marketplace instance */
  marketplace?: ToolMarketplace;
  /** Custom agent instance */
  agent?: PayableAgent;
}

/**
 * Register all x402 ecosystem tools with an MCP server
 */
export function registerX402Ecosystem(
  server: McpServer,
  options: RegisterX402EcosystemOptions = {}
): void {
  const {
    enableMarketplace = true,
    enableYield = true,
    enablePremium = true,
    marketplace = new ToolMarketplace(),
    agent = createPayableAgentFromEnv(),
  } = options;
  
  // ============================================================
  // Core Agent Tools
  // ============================================================
  
  server.tool(
    "x402_ecosystem_status",
    "Check the status and capabilities of the x402 ecosystem payment system",
    {},
    async () => {
      const capabilities = agent.getCapabilities();
      const networks = Object.entries(SUPPORTED_NETWORKS);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            configured: agent.isConfigured,
            address: agent.address,
            capabilities,
            supportedNetworks: networks.map(([name, caip2]) => ({ name, caip2 })),
            features: {
              marketplace: enableMarketplace,
              yield: enableYield,
              premium: enablePremium,
            },
          }, null, 2),
        }],
      };
    }
  );
  
  server.tool(
    "x402_agent_capabilities",
    "Get detailed payment capabilities of the AI agent",
    {},
    async () => {
      const capabilities = agent.getCapabilities();
      const dailyStats = agent.getDailyStats();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ...capabilities,
            dailyStats,
            history: agent.getPaymentHistory().slice(-10), // Last 10 payments
          }, null, 2),
        }],
      };
    }
  );
  
  // ============================================================
  // Marketplace Tools
  // ============================================================
  
  if (enableMarketplace) {
    server.tool(
      "x402_marketplace_discover",
      "Discover paid AI tools in the x402 marketplace",
      {
        maxPrice: z.string().optional().describe("Maximum price filter (e.g., '0.01')"),
        category: z.enum(TOOL_CATEGORIES as [string, ...string[]]).optional().describe("Tool category"),
        search: z.string().optional().describe("Search query"),
        limit: z.number().optional().describe("Max results to return"),
      },
      async ({ maxPrice, category, search, limit }) => {
        const tools = await marketplace.discoverTools({
          maxPrice,
          category: category as typeof TOOL_CATEGORIES[number],
          search,
          limit,
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: tools.length,
              tools: tools.map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                price: `$${t.price} ${t.token}`,
                category: t.category,
                rating: t.rating,
                usage: t.usageCount,
              })),
            }, null, 2),
          }],
        };
      }
    );
    
    server.tool(
      "x402_marketplace_register",
      "Register a new tool in the x402 marketplace",
      {
        name: z.string().describe("Tool name"),
        description: z.string().describe("Tool description"),
        endpoint: z.string().url().describe("Tool API endpoint"),
        price: z.string().describe("Price per request in USD (e.g., '0.001')"),
        category: z.enum(TOOL_CATEGORIES as [string, ...string[]]).optional().describe("Tool category"),
        owner: z.string().describe("Owner wallet address"),
      },
      async ({ name, description, endpoint, price, category, owner }) => {
        const listing = createToolListing(name, endpoint, price, owner as Address, {
          description,
          category: category as typeof TOOL_CATEGORIES[number],
        });
        
        const tool = await marketplace.registerTool(listing);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              tool: {
                id: tool.id,
                name: tool.name,
                price: `$${tool.price} ${tool.token}`,
                endpoint: tool.endpoint,
              },
              message: "Tool registered successfully!",
            }, null, 2),
          }],
        };
      }
    );
    
    server.tool(
      "x402_marketplace_featured",
      "Get featured tools from the marketplace (highest rated)",
      {
        limit: z.number().optional().describe("Number of tools to return"),
      },
      async ({ limit }) => {
        const tools = await marketplace.getFeaturedTools(limit ?? 10);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              featured: tools.map(t => ({
                id: t.id,
                name: t.name,
                price: `$${t.price}`,
                rating: t.rating,
                description: t.description,
              })),
            }, null, 2),
          }],
        };
      }
    );
  }
  
  // ============================================================
  // Yield Tracking Tools
  // ============================================================
  
  if (enableYield) {
    server.tool(
      "x402_yield_project",
      "Project USDs yield earnings for a given balance and time period. " +
      "USDs is a yield-bearing stablecoin from Sperax with ~5% APY.",
      {
        balance: z.string().describe("Current USDs balance"),
        days: z.number().optional().describe("Number of days to project"),
        months: z.number().optional().describe("Number of months to project"),
        years: z.number().optional().describe("Number of years to project"),
      },
      async ({ balance, days, months, years }) => {
        const projection = YieldProjector.project(balance, {
          days: days ?? 0,
          months: months ?? 0,
          years: years ?? 0,
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              initial: `$${projection.initialBalance}`,
              projected: `$${projection.projectedBalance}`,
              yield: `$${projection.totalYield}`,
              apy: `${projection.apy}%`,
              duration: `${projection.durationDays} days`,
              breakdown: {
                daily: `$${projection.dailyYield}`,
                monthly: `$${projection.monthlyYield}`,
                yearly: `$${projection.yearlyYield}`,
              },
            }, null, 2),
          }],
        };
      }
    );
    
    server.tool(
      "x402_yield_required_balance",
      "Calculate how much USDs you need to hold to earn a target yield",
      {
        targetMonthly: z.string().optional().describe("Target monthly yield in USD"),
        targetYearly: z.string().optional().describe("Target yearly yield in USD"),
      },
      async ({ targetMonthly, targetYearly }) => {
        const result: Record<string, string> = {};
        
        if (targetMonthly) {
          result.forMonthlyYield = `$${YieldProjector.balanceForMonthlyYield(targetMonthly)} USDs`;
          result.targetMonthly = `$${targetMonthly}`;
        }
        
        if (targetYearly) {
          result.forYearlyYield = `$${YieldProjector.balanceForYearlyYield(targetYearly)} USDs`;
          result.targetYearly = `$${targetYearly}`;
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...result,
              note: "Based on current USDs APY of ~5%",
            }, null, 2),
          }],
        };
      }
    );
    
    server.tool(
      "x402_yield_compare",
      "Compare USDs yield with other DeFi yield opportunities",
      {
        balance: z.string().describe("Balance to compare"),
        alternatives: z.array(z.object({
          name: z.string(),
          apy: z.number(),
        })).optional().describe("Alternative yield sources to compare"),
      },
      async ({ balance, alternatives }) => {
        const defaultAlternatives = [
          { name: "USDC (Aave)", apy: 3.5 },
          { name: "DAI (Compound)", apy: 4.0 },
          { name: "FRAX (Convex)", apy: 6.0 },
        ];
        
        const comparison = YieldProjector.compareYield(
          balance,
          alternatives ?? defaultAlternatives
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              balance: `$${balance}`,
              comparison: comparison.map(c => ({
                protocol: c.name,
                apy: `${c.apy.toFixed(2)}%`,
                yearlyYield: `$${c.yearlyYield}`,
              })),
            }, null, 2),
          }],
        };
      }
    );
  }
  
  // ============================================================
  // Premium Tier Tools
  // ============================================================
  
  if (enablePremium) {
    server.tool(
      "x402_premium_create_tiers",
      "Create premium tier definitions for a service",
      {
        tiers: z.record(z.object({
          price: z.string().optional(),
          period: z.enum(["per-request", "hourly", "daily", "weekly", "monthly", "yearly"]).optional(),
          features: z.array(z.string()),
          rateLimit: z.number().optional(),
        })).describe("Tier configurations"),
      },
      async ({ tiers }) => {
        const premiumTiers = createPremiumTier(tiers);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              created: premiumTiers.length,
              tiers: premiumTiers.map(t => ({
                name: t.name,
                price: t.price ? `$${t.price}` : "Free",
                period: t.period ?? "unlimited",
                features: t.features,
                rateLimit: t.rateLimit,
              })),
            }, null, 2),
          }],
        };
      }
    );
    
    server.tool(
      "x402_premium_calculate_cost",
      "Calculate the cost of a premium subscription",
      {
        tierPrice: z.string().describe("Tier price"),
        tierPeriod: z.enum(["hourly", "daily", "weekly", "monthly", "yearly"]).describe("Tier period"),
        durationValue: z.number().describe("Duration value"),
        durationUnit: z.enum(["day", "week", "month", "year"]).describe("Duration unit"),
      },
      async ({ tierPrice, tierPeriod, durationValue, durationUnit }) => {
        const tier = {
          name: "custom",
          price: tierPrice,
          period: tierPeriod,
          features: [],
        };
        
        // Simplified calculation
        const daysInDuration = {
          day: durationValue,
          week: durationValue * 7,
          month: durationValue * 30,
          year: durationValue * 365,
        }[durationUnit];
        
        const daysPerTierPeriod = {
          hourly: 1 / 24,
          daily: 1,
          weekly: 7,
          monthly: 30,
          yearly: 365,
        }[tierPeriod];
        
        const periods = Math.ceil(daysInDuration / daysPerTierPeriod);
        const totalCost = parseFloat(tierPrice) * periods;
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              tierPrice: `$${tierPrice}/${tierPeriod}`,
              duration: `${durationValue} ${durationUnit}(s)`,
              periods,
              totalCost: `$${totalCost.toFixed(2)}`,
            }, null, 2),
          }],
        };
      }
    );
  }
}
