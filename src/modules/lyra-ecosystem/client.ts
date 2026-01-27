/**
 * Lyra Unified Client
 * @description Unified payment layer for the entire Lyra ecosystem
 * @author nirholas
 * @license Apache-2.0
 * 
 * One client for all Lyra services:
 * - lyra-intel (9⭐): Code analysis
 * - lyra-registry (9⭐): Tool catalog
 * - lyra-tool-discovery (6⭐): Auto-discovery
 * 
 * @example
 * ```typescript
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY
 * });
 * 
 * // All Lyra services, one payment layer
 * await lyra.intel.securityScan(repoUrl);    // $0.05
 * await lyra.registry.getToolDetails(id);     // $0.01  
 * await lyra.discovery.analyze(apiUrl);       // $0.02
 * ```
 */

import axios, { type AxiosInstance } from "axios";
import { createX402Client, type X402ClientWrapper } from "@/x402/client.js";
import { LyraIntel } from "./intel.js";
import { LyraRegistry } from "./registry.js";
import { LyraDiscovery } from "./discovery.js";
import type {
  LyraClientConfig,
  LyraPaymentResult,
  LyraUsageStats,
  LyraServiceName,
  ServiceUsage,
} from "./types.js";
import { LYRA_DEFAULT_NETWORK, LYRA_PRICES } from "./constants.js";
import Logger from "@/utils/logger.js";

/**
 * Unified Lyra Ecosystem Client
 * 
 * Provides a single entry point for all Lyra services with unified x402 payments.
 * 
 * @example Basic Usage
 * ```typescript
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY
 * });
 * 
 * // Intel: Security scan
 * const security = await lyra.intel.securityScan("https://github.com/user/repo");
 * 
 * // Registry: Get tool details
 * const tool = await lyra.registry.getToolDetails("mcp-server-filesystem");
 * 
 * // Discovery: Analyze API
 * const analysis = await lyra.discovery.analyze("https://api.example.com");
 * ```
 * 
 * @example With Usage Tracking
 * ```typescript
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY,
 *   maxDailySpend: "5.00" // Limit spending to $5/day
 * });
 * 
 * // Check usage
 * const stats = lyra.getUsageStats("day");
 * console.log(`Spent today: $${stats.totalSpent}`);
 * ```
 */
export class LyraClient {
  /** Lyra Intel service (code analysis) */
  public readonly intel: LyraIntel;
  
  /** Lyra Registry service (tool catalog) */
  public readonly registry: LyraRegistry;
  
  /** Lyra Tool Discovery service (auto-discovery) */
  public readonly discovery: LyraDiscovery;

  private config: LyraClientConfig;
  private x402Client: X402ClientWrapper | null = null;
  private paymentApi: AxiosInstance;
  private payments: LyraPaymentResult[] = [];
  private dailySpendReset: number = this.getMidnightTimestamp();

  constructor(config: LyraClientConfig = {}) {
    this.config = {
      network: config.network ?? LYRA_DEFAULT_NETWORK,
      maxDailySpend: config.maxDailySpend ?? "100.00",
      autoPayEnabled: config.autoPayEnabled ?? true,
      ...config,
    };

    // Create the payment-wrapped API instance
    this.paymentApi = this.createPaymentApi();

    // Initialize all services with the same payment callback
    const onPayment = this.handlePayment.bind(this);
    
    this.intel = new LyraIntel(this.paymentApi, config.intel, onPayment);
    this.registry = new LyraRegistry(this.paymentApi, config.registry, onPayment);
    this.discovery = new LyraDiscovery(this.paymentApi, config.discovery, onPayment);

    Logger.info("[LyraClient] Initialized unified Lyra ecosystem client");
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a LyraClient from environment variables
   * 
   * Environment variables:
   * - X402_PRIVATE_KEY or X402_EVM_PRIVATE_KEY: Wallet private key
   * - LYRA_NETWORK: Payment network (default: eip155:8453)
   * - LYRA_MAX_DAILY_SPEND: Maximum daily spending limit
   */
  static fromEnv(): LyraClient {
    return new LyraClient({
      x402Wallet: process.env.X402_PRIVATE_KEY ?? process.env.X402_EVM_PRIVATE_KEY,
      network: process.env.LYRA_NETWORK,
      maxDailySpend: process.env.LYRA_MAX_DAILY_SPEND,
    });
  }

  /**
   * Create a read-only client (no payments, free tier only)
   */
  static readOnly(): LyraClient {
    return new LyraClient({
      autoPayEnabled: false,
    });
  }

  // ==========================================================================
  // Payment Management
  // ==========================================================================

  /**
   * Initialize the x402 payment client
   * Call this before making paid requests
   */
  async initializePayments(): Promise<void> {
    if (!this.config.x402Wallet && !this.config.x402PrivateKey) {
      Logger.warn("[LyraClient] No wallet configured - paid features will be unavailable");
      return;
    }

    try {
      this.x402Client = await createX402Client({
        config: {
          evmPrivateKey: (this.config.x402Wallet ?? this.config.x402PrivateKey) as `0x${string}`,
        },
        networks: [this.config.network as "base" | "base-sepolia" | "arbitrum"],
      });

      // Wrap the API with payment handling
      this.paymentApi = this.x402Client.wrapAxios(this.paymentApi);
      
      // Re-initialize services with payment-wrapped API
      const onPayment = this.handlePayment.bind(this);
      (this.intel as unknown as { api: AxiosInstance }).api = this.paymentApi;
      (this.registry as unknown as { api: AxiosInstance }).api = this.paymentApi;
      (this.discovery as unknown as { api: AxiosInstance }).api = this.paymentApi;

      Logger.info("[LyraClient] x402 payments initialized");
    } catch (error) {
      Logger.error("[LyraClient] Failed to initialize x402 payments:", error);
      throw error;
    }
  }

  /**
   * Check if payments are enabled
   */
  isPaymentEnabled(): boolean {
    return this.x402Client !== null && this.config.autoPayEnabled === true;
  }

  /**
   * Get remaining daily spend allowance
   */
  getRemainingDailyAllowance(): string {
    this.resetDailySpendIfNeeded();
    const spent = this.getTodaysSpending();
    const max = parseFloat(this.config.maxDailySpend ?? "100.00");
    const remaining = Math.max(0, max - spent);
    return remaining.toFixed(2);
  }

  /**
   * Check if a payment amount is within the daily limit
   */
  canSpend(amount: string): boolean {
    const remaining = parseFloat(this.getRemainingDailyAllowance());
    return remaining >= parseFloat(amount);
  }

  // ==========================================================================
  // Usage Statistics
  // ==========================================================================

  /**
   * Get usage statistics for a time period
   */
  getUsageStats(period: "day" | "week" | "month" | "all" = "day"): LyraUsageStats {
    const now = Date.now();
    const cutoff = this.getPeriodCutoff(period, now);
    
    const relevantPayments = period === "all" 
      ? this.payments 
      : this.payments.filter(p => p.timestamp >= cutoff);

    const byService: Record<LyraServiceName, ServiceUsage> = {
      intel: { spent: "0.00", requests: 0 },
      registry: { spent: "0.00", requests: 0 },
      discovery: { spent: "0.00", requests: 0 },
    };

    let totalSpent = 0;
    for (const payment of relevantPayments) {
      const amount = parseFloat(payment.amount);
      totalSpent += amount;
      
      const service = byService[payment.service];
      service.spent = (parseFloat(service.spent) + amount).toFixed(2);
      service.requests++;
      service.lastUsed = Math.max(service.lastUsed ?? 0, payment.timestamp);
    }

    return {
      totalSpent: totalSpent.toFixed(2),
      requestCount: relevantPayments.length,
      byService,
      period,
    };
  }

  /**
   * Get payment history
   */
  getPaymentHistory(limit?: number): LyraPaymentResult[] {
    const sorted = [...this.payments].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Clear payment history
   */
  clearPaymentHistory(): void {
    this.payments = [];
  }

  // ==========================================================================
  // Pricing Information
  // ==========================================================================

  /**
   * Get pricing for all Lyra services
   */
  getPricing(): typeof LYRA_PRICES {
    return LYRA_PRICES;
  }

  /**
   * Estimate total cost for a set of operations
   */
  estimateTotalCost(operations: Array<{
    service: LyraServiceName;
    operation: string;
    count?: number;
  }>): string {
    let total = 0;
    
    for (const op of operations) {
      const servicePricing = LYRA_PRICES[op.service] as Record<string, string>;
      const price = parseFloat(servicePricing[op.operation] ?? "0");
      total += price * (op.count ?? 1);
    }
    
    return total.toFixed(2);
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Quick security scan (Intel)
   */
  async securityScan(repoUrl: string) {
    return this.intel.securityScan(repoUrl);
  }

  /**
   * Quick tool search (Registry)
   */
  async searchTools(query: string) {
    return this.registry.search(query);
  }

  /**
   * Quick API discovery (Discovery)
   */
  async discoverApi(apiUrl: string) {
    return this.discovery.discover(apiUrl);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createPaymentApi(): AxiosInstance {
    return axios.create({
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LyraClient/1.0.0",
      },
    });
  }

  private handlePayment(result: LyraPaymentResult): void {
    this.payments.push(result);
    Logger.info(
      `[LyraClient] Payment: $${result.amount} to ${result.service}.${result.operation}`,
      result.transactionHash ? `(tx: ${result.transactionHash})` : ""
    );
  }

  private getTodaysSpending(): number {
    this.resetDailySpendIfNeeded();
    const midnight = this.getMidnightTimestamp();
    
    return this.payments
      .filter(p => p.timestamp >= midnight)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  }

  private resetDailySpendIfNeeded(): void {
    const currentMidnight = this.getMidnightTimestamp();
    if (currentMidnight > this.dailySpendReset) {
      this.dailySpendReset = currentMidnight;
    }
  }

  private getMidnightTimestamp(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  private getPeriodCutoff(period: "day" | "week" | "month" | "all", now: number): number {
    switch (period) {
      case "day":
        return now - 24 * 60 * 60 * 1000;
      case "week":
        return now - 7 * 24 * 60 * 60 * 1000;
      case "month":
        return now - 30 * 24 * 60 * 60 * 1000;
      case "all":
        return 0;
    }
  }
}

// ==========================================================================
// Module-level convenience functions
// ==========================================================================

let defaultClient: LyraClient | null = null;

/**
 * Get or create the default Lyra client
 */
export function getLyraClient(): LyraClient {
  if (!defaultClient) {
    defaultClient = LyraClient.fromEnv();
  }
  return defaultClient;
}

/**
 * Set the default Lyra client
 */
export function setLyraClient(client: LyraClient): void {
  defaultClient = client;
}

/**
 * Reset the default client
 */
export function resetLyraClient(): void {
  defaultClient = null;
}
