/**
 * Tool Marketplace - Decentralized marketplace for AI tools using x402
 * 
 * Enables tool creators to register paid tools and AI agents to discover
 * and pay for premium tool access.
 * 
 * @example
 * ```typescript
 * import { ToolMarketplace, createToolListing } from "@nirholas/x402-ecosystem/marketplace";
 * 
 * const marketplace = new ToolMarketplace();
 * 
 * // Register a tool
 * const listing = await marketplace.registerTool({
 *   name: "weather-premium",
 *   description: "Real-time weather with hourly forecasts",
 *   endpoint: "https://weather.example.com/api",
 *   price: "0.001",
 *   revenueSplit: [
 *     { address: "0x...", percentage: 80 },  // Creator
 *     { address: "0x...", percentage: 20 },  // Platform
 *   ],
 * });
 * 
 * // Discover tools
 * const tools = await marketplace.discoverTools({ maxPrice: "0.01" });
 * ```
 */

import type { 
  Address, 
  MarketplaceTool, 
  RevenueSplitConfig,
} from "./types.js";
import { TOOL_CATEGORIES, type ToolCategory } from "./constants.js";

/**
 * Tool listing configuration
 */
export interface ToolListing {
  id?: string;
  name: string;
  description: string;
  endpoint: string;
  price: string;
  token?: "USDC" | "USDs";
  category?: ToolCategory;
  owner: Address;
  revenueSplit?: RevenueSplitConfig[];
  metadata?: Record<string, unknown>;
}

/**
 * Tool pricing configuration
 */
export interface ToolPricing {
  type: "per-request" | "subscription" | "tiered";
  basePrice: string;
  subscriptionPeriod?: "daily" | "weekly" | "monthly";
  tiers?: Array<{
    name: string;
    maxRequests: number;
    pricePerRequest: string;
  }>;
}

/**
 * Revenue split configuration
 */
export interface RevenueSplit {
  address: Address;
  percentage: number;
  label?: string;
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  registryUrl?: string;
  chain?: string;
  platformFeePercent?: number;
  platformAddress?: Address;
}

/**
 * Tool discovery filters
 */
export interface ToolDiscoveryFilters {
  maxPrice?: string;
  minPrice?: string;
  category?: ToolCategory;
  search?: string;
  owner?: Address;
  sortBy?: "price" | "rating" | "usage" | "newest";
  limit?: number;
}

/**
 * ToolRegistry - Manages tool registrations
 */
export class ToolRegistry {
  private tools: Map<string, MarketplaceTool> = new Map();
  private readonly config: Required<MarketplaceConfig>;
  
  constructor(config: MarketplaceConfig = {}) {
    this.config = {
      registryUrl: config.registryUrl ?? "https://registry.nirholas.dev",
      chain: config.chain ?? "eip155:42161",
      platformFeePercent: config.platformFeePercent ?? 5, // 5% platform fee
      platformAddress: config.platformAddress ?? "0x0000000000000000000000000000000000000000" as Address,
    };
  }
  
  /** Generate a unique tool ID */
  private generateId(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const timestamp = Date.now().toString(36);
    return `${slug}-${timestamp}`;
  }
  
  /** Register a new tool */
  async registerTool(listing: ToolListing): Promise<MarketplaceTool> {
    const id = listing.id ?? this.generateId(listing.name);
    
    // Validate revenue split adds up to 100%
    const revenueSplit = listing.revenueSplit ?? [
      { address: listing.owner, percentage: 100 - this.config.platformFeePercent },
      { address: this.config.platformAddress, percentage: this.config.platformFeePercent },
    ];
    
    const totalPercent = revenueSplit.reduce((sum, split) => sum + split.percentage, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new Error(`Revenue split must add up to 100%, got ${totalPercent}%`);
    }
    
    const tool: MarketplaceTool = {
      id,
      name: listing.name,
      description: listing.description,
      endpoint: listing.endpoint,
      price: listing.price,
      token: listing.token ?? "USDC",
      owner: listing.owner,
      category: listing.category ?? "Other",
      rating: 0,
      usageCount: 0,
      revenueSplit,
    };
    
    this.tools.set(id, tool);
    return tool;
  }
  
  /** Get a tool by ID */
  getTool(id: string): MarketplaceTool | undefined {
    return this.tools.get(id);
  }
  
  /** Update a tool listing */
  async updateTool(id: string, updates: Partial<ToolListing>): Promise<MarketplaceTool | undefined> {
    const tool = this.tools.get(id);
    if (!tool) return undefined;
    
    const updated: MarketplaceTool = {
      ...tool,
      ...updates,
      id: tool.id, // ID cannot be changed
      owner: tool.owner, // Owner cannot be changed
    };
    
    this.tools.set(id, updated);
    return updated;
  }
  
  /** Remove a tool */
  async removeTool(id: string, owner: Address): Promise<boolean> {
    const tool = this.tools.get(id);
    if (!tool || tool.owner !== owner) return false;
    
    this.tools.delete(id);
    return true;
  }
  
  /** Search tools */
  searchTools(filters: ToolDiscoveryFilters = {}): MarketplaceTool[] {
    let results = Array.from(this.tools.values());
    
    // Apply filters
    if (filters.maxPrice) {
      const maxPrice = parseFloat(filters.maxPrice);
      results = results.filter(t => parseFloat(t.price) <= maxPrice);
    }
    
    if (filters.minPrice) {
      const minPrice = parseFloat(filters.minPrice);
      results = results.filter(t => parseFloat(t.price) >= minPrice);
    }
    
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }
    
    if (filters.owner) {
      results = results.filter(t => t.owner === filters.owner);
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(t => 
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
    }
    
    // Sort
    switch (filters.sortBy) {
      case "price":
        results.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case "rating":
        results.sort((a, b) => b.rating - a.rating);
        break;
      case "usage":
        results.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case "newest":
        // Already in insertion order
        results.reverse();
        break;
    }
    
    // Limit results
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }
  
  /** Get all tools */
  getAllTools(): MarketplaceTool[] {
    return Array.from(this.tools.values());
  }
  
  /** Record tool usage (for analytics) */
  recordUsage(toolId: string): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.usageCount++;
      this.tools.set(toolId, tool);
    }
  }
  
  /** Update tool rating */
  updateRating(toolId: string, rating: number): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      // Simple average for now
      tool.rating = (tool.rating + rating) / 2;
      this.tools.set(toolId, tool);
    }
  }
}

/**
 * ToolMarketplace - Full marketplace with discovery and payment integration
 */
export class ToolMarketplace {
  private readonly registry: ToolRegistry;
  private readonly config: Required<MarketplaceConfig>;
  
  constructor(config: MarketplaceConfig = {}) {
    this.config = {
      registryUrl: config.registryUrl ?? "https://registry.nirholas.dev",
      chain: config.chain ?? "eip155:42161",
      platformFeePercent: config.platformFeePercent ?? 5,
      platformAddress: config.platformAddress ?? "0x0000000000000000000000000000000000000000" as Address,
    };
    this.registry = new ToolRegistry(config);
  }
  
  /** Register a new tool in the marketplace */
  async registerTool(listing: ToolListing): Promise<MarketplaceTool> {
    return this.registry.registerTool(listing);
  }
  
  /** Discover tools with filters */
  async discoverTools(filters?: ToolDiscoveryFilters): Promise<MarketplaceTool[]> {
    return this.registry.searchTools(filters);
  }
  
  /** Get tool details */
  async getToolDetails(toolId: string): Promise<MarketplaceTool | undefined> {
    return this.registry.getTool(toolId);
  }
  
  /** Get featured tools (highest rated) */
  async getFeaturedTools(limit = 10): Promise<MarketplaceTool[]> {
    return this.registry.searchTools({
      sortBy: "rating",
      limit,
    });
  }
  
  /** Get popular tools (most used) */
  async getPopularTools(limit = 10): Promise<MarketplaceTool[]> {
    return this.registry.searchTools({
      sortBy: "usage",
      limit,
    });
  }
  
  /** Get tools by category */
  async getToolsByCategory(category: ToolCategory, limit?: number): Promise<MarketplaceTool[]> {
    return this.registry.searchTools({
      category,
      limit,
    });
  }
  
  /** Get available categories */
  getCategories(): readonly ToolCategory[] {
    return TOOL_CATEGORIES;
  }
  
  /** Calculate revenue distribution for a payment */
  calculateRevenueSplit(tool: MarketplaceTool, paymentAmount: string): Array<{
    address: Address;
    amount: string;
    label?: string;
  }> {
    const total = parseFloat(paymentAmount);
    return tool.revenueSplit.map(split => ({
      address: split.address,
      amount: ((total * split.percentage) / 100).toFixed(6),
      label: split.label,
    }));
  }
}

/**
 * Helper to create a tool listing with defaults
 */
export function createToolListing(
  name: string,
  endpoint: string,
  price: string,
  owner: Address,
  options?: Partial<ToolListing>
): ToolListing {
  return {
    name,
    endpoint,
    price,
    owner,
    description: options?.description ?? `${name} API`,
    token: options?.token ?? "USDC",
    category: options?.category ?? "Other",
    revenueSplit: options?.revenueSplit,
    metadata: options?.metadata,
  };
}
