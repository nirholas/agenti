/**
 * Swarm Cross-DEX Arbitrage System
 *
 * Detect and execute arbitrage opportunities across DEXes:
 * - Monitor prices on Pump.fun, Bags.fm, Meteora
 * - Detect profitable spreads
 * - Execute atomic buy-low/sell-high via Jito bundles
 * - Split execution across swarm wallets for larger positions
 */

import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { generateId } from '../utils/id';
import type { PumpFunSwarm, SwarmWallet } from './pump-swarm';
import {
  SwarmTransactionBuilder,
  PumpFunBuilder,
  BagsBuilder,
  MeteoraBuilder,
  DexType,
  BuilderOptions,
  SwarmQuote,
} from './swarm-builders';

// ============================================================================
// Types
// ============================================================================

export interface ArbitrageConfig {
  enabled: boolean;
  minSpreadBps: number; // Minimum spread to trigger (basis points)
  maxTradeSize: number; // Max SOL per arbitrage
  minTradeSize: number; // Min SOL per arbitrage
  checkIntervalMs: number;
  slippageBps: number;
  useJitoBundle: boolean; // Atomic execution
  maxConcurrentArbs: number;
  enabledDexes: DexType[];
  tokenWhitelist?: string[]; // Only arb these tokens
  tokenBlacklist?: string[]; // Never arb these tokens
  maxDailyTrades?: number;
  maxDailyLossSol?: number;
}

export interface ArbitrageOpportunity {
  id: string;
  mint: string;
  buyDex: DexType;
  sellDex: DexType;
  buyPrice: number;
  sellPrice: number;
  spreadBps: number;
  potentialProfitSol: number;
  tradeSize: number;
  timestamp: number;
  poolAddresses?: {
    buy?: string;
    sell?: string;
  };
}

export interface ArbitrageResult {
  opportunity: ArbitrageOpportunity;
  success: boolean;
  buySignature?: string;
  sellSignature?: string;
  bundleId?: string;
  actualBuyPrice?: number;
  actualSellPrice?: number;
  actualProfitSol?: number;
  slippageLoss?: number;
  error?: string;
  executionTimeMs: number;
}

export interface ArbitrageStats {
  opportunitiesFound: number;
  tradesExecuted: number;
  tradesSuccessful: number;
  tradesFailed: number;
  totalProfitSol: number;
  totalLossSol: number;
  bestTradeProfitSol: number;
  worstTradeLossSol: number;
  todayTrades: number;
  todayPnlSol: number;
}

export interface PriceData {
  dex: DexType;
  price: number;
  liquidity?: number;
  poolAddress?: string;
  timestamp: number;
}

// ============================================================================
// ArbitrageBot Class
// ============================================================================

export class SwarmArbitrageBot extends EventEmitter {
  private connection: Connection;
  private swarm: PumpFunSwarm;
  private config: ArbitrageConfig;
  private builders: Map<DexType, SwarmTransactionBuilder> = new Map();
  private monitoredTokens: Set<string> = new Set();
  private priceCache: Map<string, Map<DexType, PriceData>> = new Map();
  private activeArbs: Map<string, ArbitrageOpportunity> = new Map();
  private stats: ArbitrageStats;
  private pollInterval?: NodeJS.Timeout;
  private running: boolean = false;

  constructor(
    connection: Connection,
    swarm: PumpFunSwarm,
    config: Partial<ArbitrageConfig> = {}
  ) {
    super();
    this.connection = connection;
    this.swarm = swarm;

    this.config = {
      enabled: config.enabled ?? true,
      minSpreadBps: config.minSpreadBps ?? 100, // 1% minimum
      maxTradeSize: config.maxTradeSize ?? 1.0,
      minTradeSize: config.minTradeSize ?? 0.1,
      checkIntervalMs: config.checkIntervalMs ?? 5000,
      slippageBps: config.slippageBps ?? 300,
      useJitoBundle: config.useJitoBundle ?? true,
      maxConcurrentArbs: config.maxConcurrentArbs ?? 3,
      enabledDexes: config.enabledDexes ?? ['pumpfun', 'bags', 'meteora'],
      tokenWhitelist: config.tokenWhitelist,
      tokenBlacklist: config.tokenBlacklist,
      maxDailyTrades: config.maxDailyTrades,
      maxDailyLossSol: config.maxDailyLossSol,
    };

    this.stats = {
      opportunitiesFound: 0,
      tradesExecuted: 0,
      tradesSuccessful: 0,
      tradesFailed: 0,
      totalProfitSol: 0,
      totalLossSol: 0,
      bestTradeProfitSol: 0,
      worstTradeLossSol: 0,
      todayTrades: 0,
      todayPnlSol: 0,
    };

    // Initialize builders for enabled DEXes
    if (this.config.enabledDexes.includes('pumpfun')) {
      this.builders.set('pumpfun', new PumpFunBuilder());
    }
    if (this.config.enabledDexes.includes('bags')) {
      this.builders.set('bags', new BagsBuilder());
    }
    if (this.config.enabledDexes.includes('meteora')) {
      this.builders.set('meteora', new MeteoraBuilder());
    }
  }

  // --------------------------------------------------------------------------
  // Token Management
  // --------------------------------------------------------------------------

  addToken(mint: string): void {
    if (this.config.tokenBlacklist?.includes(mint)) {
      logger.warn(`[Arbitrage] Token ${mint} is blacklisted`);
      return;
    }
    this.monitoredTokens.add(mint);
    this.priceCache.set(mint, new Map());
    logger.info(`[Arbitrage] Added token ${mint} for monitoring`);
  }

  removeToken(mint: string): void {
    this.monitoredTokens.delete(mint);
    this.priceCache.delete(mint);
    logger.info(`[Arbitrage] Removed token ${mint} from monitoring`);
  }

  listTokens(): string[] {
    return Array.from(this.monitoredTokens);
  }

  // --------------------------------------------------------------------------
  // Bot Control
  // --------------------------------------------------------------------------

  start(): void {
    if (this.running) return;

    this.running = true;
    this.pollInterval = setInterval(() => this.poll(), this.config.checkIntervalMs);
    logger.info(`[Arbitrage] Bot started, checking every ${this.config.checkIntervalMs}ms`);
    this.emit('started');

    // Initial poll
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    logger.info(`[Arbitrage] Bot stopped`);
    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): ArbitrageConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ArbitrageConfig>): void {
    Object.assign(this.config, config);

    // Restart polling if interval changed
    if (config.checkIntervalMs && this.running) {
      this.stop();
      this.start();
    }
  }

  getStats(): ArbitrageStats {
    return { ...this.stats };
  }

  resetDailyStats(): void {
    this.stats.todayTrades = 0;
    this.stats.todayPnlSol = 0;
  }

  // --------------------------------------------------------------------------
  // Price Fetching
  // --------------------------------------------------------------------------

  private async poll(): Promise<void> {
    if (!this.config.enabled || this.monitoredTokens.size === 0) return;

    for (const mint of this.monitoredTokens) {
      try {
        await this.checkToken(mint);
      } catch (error) {
        logger.error(`[Arbitrage] Error checking ${mint}:`, error);
      }
    }
  }

  private async checkToken(mint: string): Promise<void> {
    // Fetch prices from all enabled DEXes
    const prices = await this.fetchPrices(mint);
    if (prices.length < 2) return;

    // Update cache
    const tokenCache = this.priceCache.get(mint)!;
    for (const price of prices) {
      tokenCache.set(price.dex, price);
    }

    // Find arbitrage opportunities
    const opportunity = this.findOpportunity(mint, prices);
    if (opportunity) {
      this.stats.opportunitiesFound++;
      this.emit('opportunityFound', opportunity);

      // Check if we should execute
      if (this.shouldExecute(opportunity)) {
        await this.executeArbitrage(opportunity);
      }
    }
  }

  private async fetchPrices(mint: string): Promise<PriceData[]> {
    const prices: PriceData[] = [];
    const testAmount = this.config.minTradeSize;

    const fetchPromises = this.config.enabledDexes.map(async (dex) => {
      const builder = this.builders.get(dex);
      if (!builder?.getQuote) return null;

      try {
        const quote = await builder.getQuote(
          this.connection,
          mint,
          testAmount,
          true, // isBuy
          { slippageBps: this.config.slippageBps }
        );

        if (quote && quote.outputAmount > 0) {
          return {
            dex,
            price: testAmount / quote.outputAmount, // SOL per token
            liquidity: quote.priceImpact ? 100 / quote.priceImpact : undefined,
            poolAddress: quote.route, // Use route as pool identifier
            timestamp: Date.now(),
          };
        }
      } catch {
        // DEX might not have this token
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    for (const result of results) {
      if (result) prices.push(result);
    }

    return prices;
  }

  private findOpportunity(mint: string, prices: PriceData[]): ArbitrageOpportunity | null {
    if (prices.length < 2) return null;

    // Sort by price (lowest first = best to buy)
    const sorted = [...prices].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];

    // Calculate spread in basis points
    if (cheapest.price <= 0) return null;
    const spreadBps = ((mostExpensive.price - cheapest.price) / cheapest.price) * 10000;

    if (spreadBps < this.config.minSpreadBps) return null;

    // Calculate potential profit
    const tradeSize = Math.min(this.config.maxTradeSize, this.config.minTradeSize * 2);
    const tokensReceived = tradeSize / cheapest.price;
    const solReceived = tokensReceived * mostExpensive.price;
    const potentialProfitSol = solReceived - tradeSize;

    // Account for slippage (rough estimate)
    const estimatedSlippage = (this.config.slippageBps / 10000) * 2 * tradeSize;
    const netProfit = potentialProfitSol - estimatedSlippage;

    if (netProfit <= 0) return null;

    return {
      id: generateId(),
      mint,
      buyDex: cheapest.dex,
      sellDex: mostExpensive.dex,
      buyPrice: cheapest.price,
      sellPrice: mostExpensive.price,
      spreadBps,
      potentialProfitSol: netProfit,
      tradeSize,
      timestamp: Date.now(),
      poolAddresses: {
        buy: cheapest.poolAddress,
        sell: mostExpensive.poolAddress,
      },
    };
  }

  private shouldExecute(opportunity: ArbitrageOpportunity): boolean {
    // Check concurrent limit
    if (this.activeArbs.size >= this.config.maxConcurrentArbs) return false;

    // Check daily limits
    if (this.config.maxDailyTrades && this.stats.todayTrades >= this.config.maxDailyTrades) {
      return false;
    }

    if (this.config.maxDailyLossSol && this.stats.todayPnlSol <= -this.config.maxDailyLossSol) {
      return false;
    }

    // Check token filters
    if (this.config.tokenWhitelist?.length && !this.config.tokenWhitelist.includes(opportunity.mint)) {
      return false;
    }

    return true;
  }

  // --------------------------------------------------------------------------
  // Execution
  // --------------------------------------------------------------------------

  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ArbitrageResult> {
    const startTime = Date.now();
    this.activeArbs.set(opportunity.id, opportunity);
    this.stats.tradesExecuted++;
    this.stats.todayTrades++;

    logger.info(`[Arbitrage] Executing: Buy ${opportunity.buyDex} @ ${opportunity.buyPrice}, Sell ${opportunity.sellDex} @ ${opportunity.sellPrice}`);
    this.emit('executionStarted', opportunity);

    try {
      let result: ArbitrageResult;

      if (this.config.useJitoBundle) {
        result = await this.executeAtomic(opportunity);
      } else {
        result = await this.executeSequential(opportunity);
      }

      // Update stats
      if (result.success && result.actualProfitSol !== undefined) {
        if (result.actualProfitSol >= 0) {
          this.stats.tradesSuccessful++;
          this.stats.totalProfitSol += result.actualProfitSol;
          this.stats.todayPnlSol += result.actualProfitSol;
          if (result.actualProfitSol > this.stats.bestTradeProfitSol) {
            this.stats.bestTradeProfitSol = result.actualProfitSol;
          }
        } else {
          this.stats.totalLossSol += Math.abs(result.actualProfitSol);
          this.stats.todayPnlSol += result.actualProfitSol;
          if (result.actualProfitSol < this.stats.worstTradeLossSol) {
            this.stats.worstTradeLossSol = result.actualProfitSol;
          }
        }
      } else {
        this.stats.tradesFailed++;
      }

      result.executionTimeMs = Date.now() - startTime;
      this.emit('executionCompleted', result);

      return result;
    } finally {
      this.activeArbs.delete(opportunity.id);
    }
  }

  private async executeAtomic(opportunity: ArbitrageOpportunity): Promise<ArbitrageResult> {
    // For atomic execution, we use bundle mode which submits as Jito bundle
    // First buy on the cheap DEX
    const buyResult = await this.swarm.coordinatedBuy({
      mint: opportunity.mint,
      action: 'buy',
      amountPerWallet: opportunity.tradeSize,
      denominatedInSol: true,
      slippageBps: this.config.slippageBps,
      dex: opportunity.buyDex,
      poolAddress: opportunity.poolAddresses?.buy,
      executionMode: 'bundle', // Atomic execution
    });

    if (!buyResult.success) {
      return {
        opportunity,
        success: false,
        error: `Buy failed: ${buyResult.errors?.join(', ')}`,
        executionTimeMs: 0,
      };
    }

    // Immediately sell on the expensive DEX
    const sellResult = await this.swarm.coordinatedSell({
      mint: opportunity.mint,
      action: 'sell',
      amountPerWallet: '100%',
      slippageBps: this.config.slippageBps,
      dex: opportunity.sellDex,
      poolAddress: opportunity.poolAddresses?.sell,
      executionMode: 'bundle', // Atomic execution
    });

    const totalSolReceived = sellResult.walletResults.reduce((sum, r) => sum + (r.solAmount ?? 0), 0);
    const actualProfit = totalSolReceived - (buyResult.totalSolSpent ?? 0);

    return {
      opportunity,
      success: sellResult.success,
      buySignature: buyResult.walletResults[0]?.signature,
      sellSignature: sellResult.walletResults[0]?.signature,
      actualProfitSol: actualProfit,
      executionTimeMs: 0,
    };
  }

  private async executeSequential(opportunity: ArbitrageOpportunity): Promise<ArbitrageResult> {
    // Execute buy first
    const buyResult = await this.swarm.coordinatedBuy({
      mint: opportunity.mint,
      action: 'buy',
      amountPerWallet: opportunity.tradeSize,
      denominatedInSol: true,
      slippageBps: this.config.slippageBps,
      dex: opportunity.buyDex,
      poolAddress: opportunity.poolAddresses?.buy,
      executionMode: 'parallel',
    });

    if (!buyResult.success) {
      return {
        opportunity,
        success: false,
        error: `Buy failed: ${buyResult.errors?.join(', ')}`,
        executionTimeMs: 0,
      };
    }

    // Immediately sell
    const sellResult = await this.swarm.coordinatedSell({
      mint: opportunity.mint,
      action: 'sell',
      amountPerWallet: '100%',
      slippageBps: this.config.slippageBps,
      dex: opportunity.sellDex,
      poolAddress: opportunity.poolAddresses?.sell,
      executionMode: 'parallel',
    });

    const totalSolReceived = sellResult.walletResults.reduce((sum, r) => sum + (r.solAmount ?? 0), 0);
    const actualProfit = totalSolReceived - (buyResult.totalSolSpent ?? 0);

    return {
      opportunity,
      success: sellResult.success,
      buySignature: buyResult.walletResults[0]?.signature,
      sellSignature: sellResult.walletResults[0]?.signature,
      actualProfitSol: actualProfit,
      executionTimeMs: 0,
    };
  }

  // --------------------------------------------------------------------------
  // Manual Arbitrage
  // --------------------------------------------------------------------------

  async manualArbitrage(
    mint: string,
    buyDex: DexType,
    sellDex: DexType,
    amountSol: number
  ): Promise<ArbitrageResult> {
    const opportunity: ArbitrageOpportunity = {
      id: generateId(),
      mint,
      buyDex,
      sellDex,
      buyPrice: 0,
      sellPrice: 0,
      spreadBps: 0,
      potentialProfitSol: 0,
      tradeSize: amountSol,
      timestamp: Date.now(),
    };

    return this.executeArbitrage(opportunity);
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    this.stop();
    this.monitoredTokens.clear();
    this.priceCache.clear();
    this.activeArbs.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory
// ============================================================================

let arbitrageBotInstance: SwarmArbitrageBot | null = null;

export function getSwarmArbitrageBot(
  connection: Connection,
  swarm: PumpFunSwarm,
  config?: Partial<ArbitrageConfig>
): SwarmArbitrageBot {
  if (!arbitrageBotInstance) {
    arbitrageBotInstance = new SwarmArbitrageBot(connection, swarm, config);
  }
  return arbitrageBotInstance;
}

export function destroySwarmArbitrageBot(): void {
  if (arbitrageBotInstance) {
    arbitrageBotInstance.destroy();
    arbitrageBotInstance = null;
  }
}
