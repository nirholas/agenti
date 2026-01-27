/**
 * Premium Tier System - Add paid tiers to free services
 * 
 * Provides utilities for creating premium tiers, pricing strategies,
 * and paywalls for existing services.
 * 
 * @example
 * ```typescript
 * import { createPremiumTier, PricingStrategy, PaywallBuilder } from "@nirholas/x402-ecosystem/premium";
 * 
 * // Define tiers
 * const tiers = createPremiumTier({
 *   free: { 
 *     rateLimit: 100, 
 *     features: ["basic"] 
 *   },
 *   basic: { 
 *     price: "9.99", 
 *     period: "monthly",
 *     features: ["basic", "priority-support"] 
 *   },
 *   premium: { 
 *     price: "0.01",  // Per request
 *     features: ["all", "real-time", "api-access"],
 *   },
 * });
 * 
 * // Create paywall
 * const paywall = new PaywallBuilder()
 *   .forEndpoint("/api/premium/*")
 *   .withPrice("0.001")
 *   .withRateLimit(1000)
 *   .build();
 * ```
 */

import type { Address } from "./types.js";

/**
 * Premium tier definition
 */
export interface PremiumTier {
  name: string;
  price?: string;
  period?: "per-request" | "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  features: string[];
  rateLimit?: number;
  ratePeriod?: "minute" | "hour" | "day";
  priority?: number;
}

/**
 * Tier configuration input
 */
export type TierConfig = {
  [tierName: string]: {
    price?: string;
    period?: "per-request" | "hourly" | "daily" | "weekly" | "monthly" | "yearly";
    features: string[];
    rateLimit?: number;
    ratePeriod?: "minute" | "hour" | "day";
  };
};

/**
 * Paywall configuration
 */
export interface PaywallConfig {
  endpoint: string | string[];
  price: string;
  token?: "USDC" | "USDs";
  recipient: Address;
  rateLimit?: number;
  ratePeriod?: "minute" | "hour" | "day";
  bypassHeader?: string;
  description?: string;
}

/**
 * Pricing context for dynamic pricing
 */
export interface PricingContext {
  endpoint?: string;
  method?: string;
  userId?: string;
  timestamp?: number;
  requestCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Pricing strategy function type
 */
export type PricingStrategyFn = (context: PricingContext) => string;

/**
 * PricingStrategy - Pre-built pricing strategies
 */
export const PricingStrategy = {
  /**
   * Fixed price for all requests
   */
  fixed: (price: string): PricingStrategyFn => {
    return () => price;
  },
  
  /**
   * Tiered pricing based on request count
   */
  tiered: (tiers: Array<{ maxRequests: number; price: string }>): PricingStrategyFn => {
    // Sort by maxRequests ascending
    const sortedTiers = [...tiers].sort((a, b) => a.maxRequests - b.maxRequests);
    
    return (context: PricingContext) => {
      const requestCount = context.requestCount ?? 0;
      
      for (const tier of sortedTiers) {
        if (requestCount < tier.maxRequests) {
          return tier.price;
        }
      }
      
      // Return last tier price if over all limits
      return sortedTiers[sortedTiers.length - 1]?.price ?? "0";
    };
  },
  
  /**
   * Time-based pricing (e.g., surge pricing)
   */
  timeBased: (options: {
    basePrice: string;
    peakPrice: string;
    peakHours: number[]; // 0-23
  }): PricingStrategyFn => {
    return (context: PricingContext) => {
      const hour = new Date(context.timestamp ?? Date.now()).getHours();
      return options.peakHours.includes(hour) ? options.peakPrice : options.basePrice;
    };
  },
  
  /**
   * Resource-based pricing
   */
  resourceBased: (options: {
    basePrice: string;
    multipliers: Record<string, number>;
  }): PricingStrategyFn => {
    return (context: PricingContext) => {
      const basePrice = parseFloat(options.basePrice);
      let multiplier = 1;
      
      // Apply multipliers from metadata
      if (context.metadata) {
        for (const [key, value] of Object.entries(context.metadata)) {
          if (options.multipliers[key] && value) {
            multiplier *= options.multipliers[key];
          }
        }
      }
      
      return (basePrice * multiplier).toFixed(6);
    };
  },
  
  /**
   * Combine multiple strategies
   */
  composite: (...strategies: PricingStrategyFn[]): PricingStrategyFn => {
    return (context: PricingContext) => {
      let totalPrice = 0;
      for (const strategy of strategies) {
        totalPrice += parseFloat(strategy(context));
      }
      return totalPrice.toFixed(6);
    };
  },
};

/**
 * Create premium tiers from configuration
 */
export function createPremiumTier(config: TierConfig): PremiumTier[] {
  return Object.entries(config).map(([name, tierConfig], index) => ({
    name,
    price: tierConfig.price,
    period: tierConfig.period ?? (tierConfig.price ? "per-request" : undefined),
    features: tierConfig.features,
    rateLimit: tierConfig.rateLimit,
    ratePeriod: tierConfig.ratePeriod ?? "day",
    priority: index,
  }));
}

/**
 * PaywallBuilder - Fluent API for building paywalls
 */
export class PaywallBuilder {
  private config: Partial<PaywallConfig> = {};
  private pricingStrategy?: PricingStrategyFn;
  
  /**
   * Set the endpoint(s) to protect
   */
  forEndpoint(endpoint: string | string[]): this {
    this.config.endpoint = endpoint;
    return this;
  }
  
  /**
   * Set a fixed price
   */
  withPrice(price: string): this {
    this.config.price = price;
    this.pricingStrategy = PricingStrategy.fixed(price);
    return this;
  }
  
  /**
   * Set a custom pricing strategy
   */
  withPricingStrategy(strategy: PricingStrategyFn): this {
    this.pricingStrategy = strategy;
    return this;
  }
  
  /**
   * Set the payment token
   */
  withToken(token: "USDC" | "USDs"): this {
    this.config.token = token;
    return this;
  }
  
  /**
   * Set the payment recipient
   */
  withRecipient(address: Address): this {
    this.config.recipient = address;
    return this;
  }
  
  /**
   * Set rate limit
   */
  withRateLimit(limit: number, period: "minute" | "hour" | "day" = "day"): this {
    this.config.rateLimit = limit;
    this.config.ratePeriod = period;
    return this;
  }
  
  /**
   * Set bypass header for admin access
   */
  withBypassHeader(header: string): this {
    this.config.bypassHeader = header;
    return this;
  }
  
  /**
   * Set description for the paywall
   */
  withDescription(description: string): this {
    this.config.description = description;
    return this;
  }
  
  /**
   * Build the paywall configuration
   */
  build(): PaywallConfig & { getPriceForContext: PricingStrategyFn } {
    if (!this.config.endpoint) {
      throw new Error("Endpoint is required");
    }
    
    if (!this.config.recipient) {
      throw new Error("Recipient address is required");
    }
    
    const finalConfig: PaywallConfig = {
      endpoint: this.config.endpoint,
      price: this.config.price ?? "0.001",
      token: this.config.token ?? "USDC",
      recipient: this.config.recipient,
      rateLimit: this.config.rateLimit,
      ratePeriod: this.config.ratePeriod,
      bypassHeader: this.config.bypassHeader,
      description: this.config.description,
    };
    
    return {
      ...finalConfig,
      getPriceForContext: this.pricingStrategy ?? PricingStrategy.fixed(finalConfig.price),
    };
  }
}

/**
 * Tier comparator - check if a tier grants access to a feature
 */
export function tierHasFeature(tier: PremiumTier, feature: string): boolean {
  return tier.features.includes(feature) || tier.features.includes("all");
}

/**
 * Get the best tier for a budget
 */
export function getBestTierForBudget(
  tiers: PremiumTier[],
  budget: string
): PremiumTier | undefined {
  const budgetNum = parseFloat(budget);
  
  // Filter tiers within budget and sort by priority (higher is better)
  const affordable = tiers
    .filter(tier => !tier.price || parseFloat(tier.price) <= budgetNum)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  
  return affordable[0];
}

/**
 * Calculate subscription cost
 */
export function calculateSubscriptionCost(
  tier: PremiumTier,
  duration: { value: number; unit: "day" | "week" | "month" | "year" }
): string {
  if (!tier.price || tier.period === "per-request") {
    return "0"; // Free tier or per-request
  }
  
  const pricePerPeriod = parseFloat(tier.price);
  let periodsInDuration = 1;
  
  // Calculate how many tier periods fit in the duration
  const daysInDuration = {
    day: duration.value,
    week: duration.value * 7,
    month: duration.value * 30,
    year: duration.value * 365,
  }[duration.unit];
  
  const daysPerTierPeriod = {
    hourly: 1 / 24,
    daily: 1,
    weekly: 7,
    monthly: 30,
    yearly: 365,
  }[tier.period ?? "monthly"];
  
  periodsInDuration = Math.ceil(daysInDuration / daysPerTierPeriod);
  
  return (pricePerPeriod * periodsInDuration).toFixed(2);
}
