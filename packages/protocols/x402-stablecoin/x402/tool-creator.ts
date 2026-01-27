/**
 * @fileoverview tool-creator module implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * X402 Tool Creator
 * 
 * Helper functions to create monetized MCP tools with X402 payments
 * Handles pricing, revenue splits, rate limiting, and payment verification
 * 
 * @example
 * ```typescript
 * export const myTool = createX402Tool({
 *   name: 'advanced_analytics',
 *   description: 'ML-powered portfolio analytics',
 *   price: '0.25',
 *   currency: 'USDC',
 *   chain: 'base',
 *   handler: async (args) => {
 *     // Your logic
 *     return analysis;
 *   },
 *   paymentRecipient: '0x...',
 *   platformFee: 0.20
 * });
 * ```
 * 
 * @since November 30, 2025
 */

import { Address } from 'viem';
import {
  X402ToolPricing,
  RevenueSplit,
  PricingTier,
  HTTP402Response,
  X402Config,
} from './types';
import { X402Client } from './client';

/**
 * Platform wallet address for revenue splits
 * Configured via LYRA_PLATFORM_WALLET environment variable
 * Default is the Lyra treasury multisig on Base
 */
const PLATFORM_WALLET: Address = (process.env.LYRA_PLATFORM_WALLET as Address) || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

/**
 * Default platform fee (20%)
 */
const DEFAULT_PLATFORM_FEE = 0.20;

/**
 * Tool handler function type
 */
export type ToolHandler<TArgs = any, TResult = any> = (
  args: TArgs,
  context?: ToolContext
) => Promise<TResult> | TResult;

/**
 * Tool execution context
 */
export interface ToolContext {
  /** User who called the tool */
  user?: Address;
  
  /** Payment transaction hash if paid */
  paymentTxHash?: string;
  
  /** Tool execution metadata */
  metadata?: Record<string, any>;
}

/**
 * X402 tool definition
 */
export interface X402Tool<TArgs = any, TResult = any> extends X402ToolPricing {
  /** Tool handler function */
  handler: ToolHandler<TArgs, TResult>;
  
  /** Input schema (JSON Schema) */
  inputSchema?: any;
  
  /** Output schema (JSON Schema) */
  outputSchema?: any;
  
  /** Tool category */
  category?: string;
  
  /** Tags for discovery */
  tags?: string[];
}

/**
 * Tool usage statistics
 */
interface ToolUsageStats {
  totalCalls: number;
  paidCalls: number;
  freeCalls: number;
  totalRevenue: string;
  lastCalled?: Date;
}

/**
 * Rate limiter for tool calls
 */
class RateLimiter {
  private callCounts: Map<string, number[]> = new Map();

  isAllowed(userId: string, limit: number, windowMs: number = 3600000): boolean {
    const now = Date.now();
    const calls = this.callCounts.get(userId) || [];
    
    // Remove calls outside the time window
    const recentCalls = calls.filter(time => now - time < windowMs);
    
    if (recentCalls.length >= limit) {
      return false;
    }

    // Add current call
    recentCalls.push(now);
    this.callCounts.set(userId, recentCalls);
    
    return true;
  }

  reset(userId: string): void {
    this.callCounts.delete(userId);
  }
}

/**
 * Usage tracker for free tier limits
 */
class UsageTracker {
  private dailyCalls: Map<string, { date: string; count: number }> = new Map();

  canCallFree(userId: string, toolName: string, dailyLimit: number): boolean {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${toolName}`;
    const usage = this.dailyCalls.get(key);

    if (!usage || usage.date !== today) {
      // Reset for new day
      this.dailyCalls.set(key, { date: today, count: 0 });
      return true;
    }

    return usage.count < dailyLimit;
  }

  trackFreeCall(userId: string, toolName: string): void {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}:${toolName}`;
    const usage = this.dailyCalls.get(key) || { date: today, count: 0 };
    
    usage.count += 1;
    this.dailyCalls.set(key, usage);
  }
}

/**
 * Global rate limiter instance
 */
const rateLimiter = new RateLimiter();

/**
 * Global usage tracker instance
 */
const usageTracker = new UsageTracker();

/**
 * Tool usage statistics storage
 */
const usageStats = new Map<string, ToolUsageStats>();

/**
 * Create a monetized X402 tool
 */
export function createX402Tool<TArgs = any, TResult = any>(
  config: Omit<X402Tool<TArgs, TResult>, 'tier'> & { tier?: PricingTier }
): X402Tool<TArgs, TResult> {
  const platformFee = config.platformFee ?? DEFAULT_PLATFORM_FEE;
  const tier = config.tier ?? (parseFloat(config.price) === 0 ? 'free' : 'premium');

  // Validate platform fee
  if (platformFee < 0 || platformFee > 1) {
    throw new Error('Platform fee must be between 0 and 1');
  }

  // Validate price
  const priceNum = parseFloat(config.price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new Error('Price must be a non-negative number');
  }

  // Initialize usage stats
  usageStats.set(config.name, {
    totalCalls: 0,
    paidCalls: 0,
    freeCalls: 0,
    totalRevenue: '0',
  });

  return {
    ...config,
    tier,
    platformFee,
  };
}

/**
 * Execute X402 tool with payment handling
 */
export async function executeX402Tool<TArgs, TResult>(
  tool: X402Tool<TArgs, TResult>,
  args: TArgs,
  context?: ToolContext & { x402Config?: X402Config }
): Promise<TResult | HTTP402Response> {
  const stats = usageStats.get(tool.name);
  
  // Check if free tier is available
  if (tool.freeCallsPerDay && context?.user) {
    const canCallFree = usageTracker.canCallFree(
      context.user,
      tool.name,
      tool.freeCallsPerDay
    );

    if (canCallFree) {
      // Execute free call
      usageTracker.trackFreeCall(context.user, tool.name);
      
      if (stats) {
        stats.totalCalls += 1;
        stats.freeCalls += 1;
        stats.lastCalled = new Date();
      }

      return await tool.handler(args, context);
    }
  }

  // Check rate limit
  if (tool.rateLimitPerHour && context?.user) {
    const allowed = rateLimiter.isAllowed(
      context.user,
      tool.rateLimitPerHour,
      3600000
    );

    if (!allowed) {
      return {
        status: 402,
        headers: {
          'www-authenticate': `X402 error="rate_limit_exceeded" limit="${tool.rateLimitPerHour}/hour"`,
        },
        message: `Rate limit exceeded: ${tool.rateLimitPerHour} calls per hour`,
      } as HTTP402Response;
    }
  }

  // For free tools, execute directly
  if (tool.tier === 'free' || parseFloat(tool.price) === 0) {
    if (stats) {
      stats.totalCalls += 1;
      stats.freeCalls += 1;
      stats.lastCalled = new Date();
    }

    return await tool.handler(args, context);
  }

  // For paid tools, check if payment was provided
  if (!context?.paymentTxHash && !context?.x402Config?.enabled) {
    // Return 402 Payment Required
    const revenueSplit = calculateRevenueSplit(
      tool.paymentRecipient,
      tool.platformFee ?? DEFAULT_PLATFORM_FEE
    );

    return {
      status: 402,
      headers: {
        'www-authenticate': `X402 price="${tool.price} ${tool.currency}" chain="${tool.chain}" recipient="${revenueSplit.developer}" tool="${tool.name}" description="${tool.description}"`,
      },
      message: `Payment required: ${tool.price} ${tool.currency} on ${tool.chain}`,
    } as HTTP402Response;
  }

  // Verify payment if txHash provided
  if (context?.paymentTxHash) {
    try {
      const client = new X402Client({ chain: tool.chain });
      const verification = await client.verifyPayment(
        context.paymentTxHash as `0x${string}`,
        {
          price: tool.price,
          token: tool.currency,
          chain: tool.chain,
          recipient: tool.paymentRecipient,
        }
      );

      if (!verification.verified) {
        return {
          status: 402,
          headers: {
            'www-authenticate': `X402 error="payment_verification_failed" message="${verification.error}"`,
          },
          message: `Payment verification failed: ${verification.error}`,
        } as HTTP402Response;
      }

      // Payment verified, execute tool
      if (stats) {
        stats.totalCalls += 1;
        stats.paidCalls += 1;
        stats.totalRevenue = (
          parseFloat(stats.totalRevenue) + parseFloat(tool.price)
        ).toString();
        stats.lastCalled = new Date();
      }

      return await tool.handler(args, context);
    } catch (error: any) {
      return {
        status: 402,
        headers: {
          'www-authenticate': `X402 error="payment_verification_error" message="${error.message}"`,
        },
        message: `Payment verification error: ${error.message}`,
      } as HTTP402Response;
    }
  }

  // Auto-payment with x402Config
  if (context?.x402Config?.enabled) {
    try {
      const client = new X402Client({
        chain: tool.chain,
        privateKey: context.x402Config.walletAddress as any, // Simplified
      });

      // Check max payment limit
      const priceNum = parseFloat(tool.price);
      const maxPayment = parseFloat(context.x402Config.maxPaymentPerTool);
      
      if (priceNum > maxPayment) {
        return {
          status: 402,
          headers: {
            'www-authenticate': `X402 error="payment_exceeds_limit" max="${maxPayment}" requested="${tool.price}"`,
          },
          message: `Payment exceeds maximum allowed: ${tool.price} > ${maxPayment}`,
        } as HTTP402Response;
      }

      // Execute payment
      const tx = await client.executePayment({
        price: tool.price,
        token: tool.currency,
        chain: tool.chain,
        recipient: tool.paymentRecipient,
        toolName: tool.name,
        description: tool.description,
      });

      // Execute tool with payment context
      if (stats) {
        stats.totalCalls += 1;
        stats.paidCalls += 1;
        stats.totalRevenue = (
          parseFloat(stats.totalRevenue) + parseFloat(tool.price)
        ).toString();
        stats.lastCalled = new Date();
      }

      return await tool.handler(args, {
        ...context,
        paymentTxHash: tx.hash,
      });
    } catch (error: any) {
      return {
        status: 402,
        headers: {
          'www-authenticate': `X402 error="payment_failed" message="${error.message}"`,
        },
        message: `Payment failed: ${error.message}`,
      } as HTTP402Response;
    }
  }

  // Should not reach here
  return {
    status: 402,
    headers: {
      'www-authenticate': `X402 price="${tool.price} ${tool.currency}" chain="${tool.chain}"`,
    },
    message: 'Payment required',
  } as HTTP402Response;
}

/**
 * Calculate revenue split between developer and platform
 */
export function calculateRevenueSplit(
  developer: Address,
  platformFee: number = DEFAULT_PLATFORM_FEE
): RevenueSplit {
  const developerShare = 1 - platformFee;

  return {
    developer,
    developerShare,
    platform: PLATFORM_WALLET,
    platformShare: platformFee,
  };
}

/**
 * Get tool usage statistics
 */
export function getToolStats(toolName: string): ToolUsageStats | undefined {
  return usageStats.get(toolName);
}

/**
 * Get all tools statistics
 */
export function getAllToolsStats(): Record<string, ToolUsageStats> {
  return Object.fromEntries(usageStats.entries());
}

/**
 * Reset rate limiter for a user
 */
export function resetRateLimit(userId: string): void {
  rateLimiter.reset(userId);
}

/**
 * Create HTTP 402 response
 */
export function create402Response(
  tool: X402Tool,
  message?: string
): HTTP402Response {
  return {
    status: 402,
    headers: {
      'www-authenticate': `X402 price="${tool.price} ${tool.currency}" chain="${tool.chain}" recipient="${tool.paymentRecipient}" tool="${tool.name}"`,
    },
    message: message || `Payment required: ${tool.price} ${tool.currency}`,
  };
}

/**
 * Example: Create a free tool
 */
export const exampleFreeTool = createX402Tool({
  name: 'get_token_price',
  description: 'Get current token price from CoinGecko',
  price: '0',
  currency: 'USDC',
  chain: 'base',
  paymentRecipient: '0x0000000000000000000000000000000000000000',
  handler: async (args: { symbol: string }) => {
    // Implementation
    return { price: 42.50, symbol: args.symbol };
  },
  category: 'pricing',
  tags: ['free', 'defi', 'price'],
});

/**
 * Example: Create a premium tool
 */
export const examplePremiumTool = createX402Tool({
  name: 'security_audit',
  description: 'Deep security audit of smart contract',
  price: '0.001',
  currency: 'USDC',
  chain: 'base',
  paymentRecipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  platformFee: 0.20,
  freeCallsPerDay: 5,
  rateLimitPerHour: 10,
  handler: async (args: { contractAddress: string }) => {
    // Implementation
    return {
      security: 'high',
      vulnerabilities: [],
      score: 95,
    };
  },
  category: 'security',
  tags: ['premium', 'audit', 'security'],
});

/**
 * Example: Create an enterprise tool
 */
export const exampleEnterpriseTool = createX402Tool({
  name: 'tax_report_generator',
  description: 'Generate comprehensive tax report',
  price: '0.50',
  currency: 'USDC',
  chain: 'base',
  tier: 'enterprise',
  paymentRecipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  platformFee: 0.15, // Lower fee for enterprise
  rateLimitPerHour: 100,
  handler: async (args: { year: number; walletAddress: string }) => {
    // Implementation
    return {
      totalIncome: '50000.00',
      totalExpenses: '5000.00',
      taxableGains: '45000.00',
      reportUrl: 'https://...',
    };
  },
  category: 'tax',
  tags: ['enterprise', 'tax', 'reporting'],
});
