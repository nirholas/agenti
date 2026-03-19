/**
 * Swarm Copytrading System
 *
 * Monitor target wallets and replicate their trades across all swarm wallets.
 * Features:
 * - Real-time wallet monitoring via Solana WebSocket
 * - Trade detection (buy/sell on Pump.fun, Raydium, Jupiter)
 * - Amplified execution (1 trade → up to 20 wallets)
 * - Configurable multipliers and filters
 * - Blacklist/whitelist for tokens
 * - Delay/stealth options to avoid detection
 */

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { generateId } from '../utils/id';
import type { PumpFunSwarm, SwarmTradeParams } from './pump-swarm';
import type { DexType } from './swarm-builders';

// ============================================================================
// Types
// ============================================================================

export interface CopyTarget {
  id: string;
  address: string;
  name?: string;
  enabled: boolean;
  config: CopyConfig;
  stats: CopyStats;
  createdAt: number;
}

export interface CopyConfig {
  // Execution settings
  multiplier: number; // 1.0 = same size, 2.0 = double, 0.5 = half
  maxSolPerTrade: number; // Cap per trade
  minSolPerTrade: number; // Minimum to copy
  delayMs: number; // Delay before copying (stealth)
  delayVarianceMs: number; // Random variance in delay

  // Filtering
  copyBuys: boolean;
  copySells: boolean;
  tokenWhitelist?: string[]; // Only copy these tokens
  tokenBlacklist?: string[]; // Never copy these tokens
  minTargetSolAmount?: number; // Only copy if target trades > this

  // Execution mode
  executionMode?: 'parallel' | 'bundle' | 'multi-bundle' | 'sequential';
  dex?: DexType;
  slippageBps?: number;

  // Risk management
  maxDailyTrades?: number;
  maxDailySol?: number;
  stopAfterLossPct?: number;
}

export interface CopyStats {
  totalTradesCopied: number;
  totalSolSpent: number;
  totalSolReceived: number;
  successfulTrades: number;
  failedTrades: number;
  lastTradeAt?: number;
  todayTrades: number;
  todaySol: number;
  pnlSol: number;
}

export interface DetectedTrade {
  targetAddress: string;
  signature: string;
  action: 'buy' | 'sell';
  mint: string;
  solAmount: number;
  tokenAmount: number;
  dex: string;
  timestamp: number;
}

export interface CopyResult {
  targetTrade: DetectedTrade;
  success: boolean;
  walletsExecuted: number;
  totalSolSpent?: number;
  totalSolReceived?: number;
  error?: string;
  signatures: string[];
}

// Known DEX program IDs for trade detection
const DEX_PROGRAMS = {
  PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  RAYDIUM_AMM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_CLMM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  ORCA_WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  METEORA_DLMM: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
};

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ============================================================================
// CopyTrader Class
// ============================================================================

export class SwarmCopyTrader extends EventEmitter {
  private connection: Connection;
  private swarm: PumpFunSwarm;
  private targets: Map<string, CopyTarget> = new Map();
  private subscriptions: Map<string, number> = new Map();
  private processing: Set<string> = new Set(); // Prevent duplicate processing
  private recentTrades: Map<string, number> = new Map(); // Dedup by signature
  private cleanupInterval: NodeJS.Timeout;

  constructor(connection: Connection, swarm: PumpFunSwarm) {
    super();
    this.connection = connection;
    this.swarm = swarm;

    this.cleanupInterval = setInterval(() => this.cleanupRecentTrades(), 60000);
  }

  // --------------------------------------------------------------------------
  // Target Management
  // --------------------------------------------------------------------------

  addTarget(address: string, config: Partial<CopyConfig> = {}, name?: string): CopyTarget {
    const id = generateId();
    const target: CopyTarget = {
      id,
      address,
      name,
      enabled: true,
      config: {
        multiplier: config.multiplier ?? 1.0,
        maxSolPerTrade: config.maxSolPerTrade ?? 1.0,
        minSolPerTrade: config.minSolPerTrade ?? 0.01,
        delayMs: config.delayMs ?? 0,
        delayVarianceMs: config.delayVarianceMs ?? 0,
        copyBuys: config.copyBuys ?? true,
        copySells: config.copySells ?? true,
        tokenWhitelist: config.tokenWhitelist,
        tokenBlacklist: config.tokenBlacklist,
        minTargetSolAmount: config.minTargetSolAmount,
        executionMode: config.executionMode ?? 'parallel',
        dex: config.dex ?? 'pumpfun',
        slippageBps: config.slippageBps ?? 500,
        maxDailyTrades: config.maxDailyTrades,
        maxDailySol: config.maxDailySol,
        stopAfterLossPct: config.stopAfterLossPct,
      },
      stats: {
        totalTradesCopied: 0,
        totalSolSpent: 0,
        totalSolReceived: 0,
        successfulTrades: 0,
        failedTrades: 0,
        todayTrades: 0,
        todaySol: 0,
        pnlSol: 0,
      },
      createdAt: Date.now(),
    };

    this.targets.set(id, target);
    this.startMonitoring(target);

    logger.info(`[CopyTrader] Added target ${address} (${name || 'unnamed'})`);
    this.emit('targetAdded', target);

    return target;
  }

  removeTarget(id: string): boolean {
    const target = this.targets.get(id);
    if (!target) return false;

    this.stopMonitoring(target);
    this.targets.delete(id);

    logger.info(`[CopyTrader] Removed target ${target.address}`);
    this.emit('targetRemoved', target);

    return true;
  }

  getTarget(id: string): CopyTarget | undefined {
    return this.targets.get(id);
  }

  getTargetByAddress(address: string): CopyTarget | undefined {
    for (const target of this.targets.values()) {
      if (target.address === address) return target;
    }
    return undefined;
  }

  listTargets(): CopyTarget[] {
    return Array.from(this.targets.values());
  }

  enableTarget(id: string): boolean {
    const target = this.targets.get(id);
    if (!target) return false;

    target.enabled = true;
    this.startMonitoring(target);
    return true;
  }

  disableTarget(id: string): boolean {
    const target = this.targets.get(id);
    if (!target) return false;

    target.enabled = false;
    this.stopMonitoring(target);
    return true;
  }

  updateTargetConfig(id: string, config: Partial<CopyConfig>): boolean {
    const target = this.targets.get(id);
    if (!target) return false;

    Object.assign(target.config, config);
    return true;
  }

  // --------------------------------------------------------------------------
  // Monitoring
  // --------------------------------------------------------------------------

  private startMonitoring(target: CopyTarget): void {
    if (this.subscriptions.has(target.id)) return;

    try {
      const pubkey = new PublicKey(target.address);

      // Subscribe to account changes (transactions)
      const subId = this.connection.onLogs(
        pubkey,
        async (logs) => {
          if (!target.enabled) return;
          if (logs.err) return;

          // Avoid duplicate processing
          if (this.recentTrades.has(logs.signature)) return;
          this.recentTrades.set(logs.signature, Date.now());

          try {
            await this.processTransaction(target, logs.signature);
          } catch (error) {
            logger.error(`[CopyTrader] Error processing tx ${logs.signature}:`, error);
          }
        },
        'confirmed'
      );

      this.subscriptions.set(target.id, subId);
      logger.info(`[CopyTrader] Started monitoring ${target.address}`);
    } catch (error) {
      logger.error(`[CopyTrader] Failed to start monitoring ${target.address}:`, error);
    }
  }

  private stopMonitoring(target: CopyTarget): void {
    const subId = this.subscriptions.get(target.id);
    if (subId !== undefined) {
      this.connection.removeOnLogsListener(subId);
      this.subscriptions.delete(target.id);
      logger.info(`[CopyTrader] Stopped monitoring ${target.address}`);
    }
  }

  private async processTransaction(target: CopyTarget, signature: string): Promise<void> {
    // Prevent concurrent processing of same signature
    if (this.processing.has(signature)) return;
    this.processing.add(signature);

    try {
      // Fetch full transaction
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) return;

      // Detect if this is a trade
      const trade = this.detectTrade(target.address, tx, signature);
      if (!trade) return;

      logger.info(`[CopyTrader] Detected ${trade.action} by ${target.name || target.address}: ${trade.solAmount} SOL for ${trade.mint}`);
      this.emit('tradeDetected', { target, trade });

      // Check filters
      if (!this.shouldCopy(target, trade)) {
        logger.info(`[CopyTrader] Skipping trade (filtered)`);
        return;
      }

      // Apply delay if configured
      if (target.config.delayMs > 0) {
        const delay = target.config.delayMs + Math.random() * target.config.delayVarianceMs;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Execute copy trade
      const result = await this.executeCopy(target, trade);

      // Update stats
      this.updateStats(target, trade, result);

      this.emit('tradeCopied', { target, trade, result });
    } finally {
      this.processing.delete(signature);
    }
  }

  private detectTrade(
    targetAddress: string,
    tx: ParsedTransactionWithMeta,
    signature: string
  ): DetectedTrade | null {
    if (!tx.meta) return null;

    const preBalances = tx.meta.preTokenBalances || [];
    const postBalances = tx.meta.postTokenBalances || [];

    // Find the target's token balance changes
    const targetPre = preBalances.filter(b => b.owner === targetAddress);
    const targetPost = postBalances.filter(b => b.owner === targetAddress);

    // Find SOL balance change
    const accountKeys = tx.transaction.message.accountKeys;
    const targetIndex = accountKeys.findIndex(
      k => k.pubkey.toBase58() === targetAddress
    );

    if (targetIndex === -1) return null;

    const preSol = (tx.meta.preBalances[targetIndex] || 0) / 1e9;
    const postSol = (tx.meta.postBalances[targetIndex] || 0) / 1e9;
    const solChange = postSol - preSol;

    // Find token changes
    for (const post of targetPost) {
      const pre = targetPre.find(p => p.mint === post.mint);
      const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
      const postAmount = post.uiTokenAmount?.uiAmount ?? 0;
      const tokenChange = postAmount - preAmount;

      if (post.mint === SOL_MINT) continue; // Skip wrapped SOL

      // Determine if buy or sell
      if (tokenChange > 0 && solChange < -0.001) {
        // Bought tokens (SOL decreased, tokens increased)
        return {
          targetAddress,
          signature,
          action: 'buy',
          mint: post.mint,
          solAmount: Math.abs(solChange),
          tokenAmount: tokenChange,
          dex: this.detectDex(tx),
          timestamp: (tx.blockTime || 0) * 1000,
        };
      } else if (tokenChange < 0 && solChange > 0.001) {
        // Sold tokens (SOL increased, tokens decreased)
        return {
          targetAddress,
          signature,
          action: 'sell',
          mint: post.mint,
          solAmount: solChange,
          tokenAmount: Math.abs(tokenChange),
          dex: this.detectDex(tx),
          timestamp: (tx.blockTime || 0) * 1000,
        };
      }
    }

    return null;
  }

  private detectDex(tx: ParsedTransactionWithMeta): string {
    const programIds = tx.transaction.message.accountKeys
      .filter(k => k.signer === false && k.writable === false)
      .map(k => k.pubkey.toBase58());

    for (const [name, id] of Object.entries(DEX_PROGRAMS)) {
      if (programIds.includes(id)) return name.toLowerCase();
    }

    return 'unknown';
  }

  private shouldCopy(target: CopyTarget, trade: DetectedTrade): boolean {
    const config = target.config;

    // Check action type
    if (trade.action === 'buy' && !config.copyBuys) return false;
    if (trade.action === 'sell' && !config.copySells) return false;

    // Check whitelist
    if (config.tokenWhitelist?.length && !config.tokenWhitelist.includes(trade.mint)) {
      return false;
    }

    // Check blacklist
    if (config.tokenBlacklist?.includes(trade.mint)) {
      return false;
    }

    // Check minimum amount
    if (config.minTargetSolAmount && trade.solAmount < config.minTargetSolAmount) {
      return false;
    }

    // Check daily limits
    if (config.maxDailyTrades && target.stats.todayTrades >= config.maxDailyTrades) {
      return false;
    }

    if (config.maxDailySol && target.stats.todaySol >= config.maxDailySol) {
      return false;
    }

    // Check loss limit
    if (config.stopAfterLossPct && target.stats.pnlSol < 0 && target.stats.totalSolSpent > 0) {
      const lossPct = Math.abs(target.stats.pnlSol / target.stats.totalSolSpent) * 100;
      if (lossPct >= config.stopAfterLossPct) return false;
    }

    return true;
  }

  private async executeCopy(target: CopyTarget, trade: DetectedTrade): Promise<CopyResult> {
    const config = target.config;

    // Calculate copy amount
    let copyAmount = trade.solAmount * config.multiplier;
    copyAmount = Math.min(copyAmount, config.maxSolPerTrade);
    copyAmount = Math.max(copyAmount, config.minSolPerTrade);

    const params: SwarmTradeParams = {
      mint: trade.mint,
      action: trade.action,
      amountPerWallet: trade.action === 'buy' ? copyAmount : '100%', // For sells, sell all
      denominatedInSol: trade.action === 'buy',
      slippageBps: config.slippageBps ?? 500,
      executionMode: config.executionMode,
      dex: config.dex,
    };

    try {
      const result = trade.action === 'buy'
        ? await this.swarm.coordinatedBuy(params)
        : await this.swarm.coordinatedSell(params);

      // Calculate total SOL received for sells from wallet results
      const totalSolReceived = trade.action === 'sell'
        ? result.walletResults.reduce((sum, r) => sum + (r.solAmount ?? 0), 0)
        : undefined;

      return {
        targetTrade: trade,
        success: result.success,
        walletsExecuted: result.walletResults?.length ?? 0,
        totalSolSpent: result.totalSolSpent,
        totalSolReceived,
        signatures: result.walletResults?.map(r => r.signature).filter((s): s is string => !!s) || [],
      };
    } catch (error) {
      return {
        targetTrade: trade,
        success: false,
        walletsExecuted: 0,
        error: error instanceof Error ? error.message : String(error),
        signatures: [],
      };
    }
  }

  private updateStats(target: CopyTarget, trade: DetectedTrade, result: CopyResult): void {
    target.stats.totalTradesCopied++;
    target.stats.lastTradeAt = Date.now();
    target.stats.todayTrades++;

    if (result.success) {
      target.stats.successfulTrades++;
      if (trade.action === 'buy' && result.totalSolSpent) {
        target.stats.totalSolSpent += result.totalSolSpent;
        target.stats.todaySol += result.totalSolSpent;
      } else if (trade.action === 'sell' && result.totalSolReceived) {
        target.stats.totalSolReceived += result.totalSolReceived;
        target.stats.pnlSol = target.stats.totalSolReceived - target.stats.totalSolSpent;
      }
    } else {
      target.stats.failedTrades++;
    }
  }

  private cleanupRecentTrades(): void {
    const cutoff = Date.now() - 300000; // 5 minutes
    for (const [sig, time] of this.recentTrades.entries()) {
      if (time < cutoff) this.recentTrades.delete(sig);
    }
  }

  // Reset daily stats (call at midnight)
  resetDailyStats(): void {
    for (const target of this.targets.values()) {
      target.stats.todayTrades = 0;
      target.stats.todaySol = 0;
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const target of this.targets.values()) {
      this.stopMonitoring(target);
    }
    this.targets.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory
// ============================================================================

let copyTraderInstance: SwarmCopyTrader | null = null;

export function getSwarmCopyTrader(connection: Connection, swarm: PumpFunSwarm): SwarmCopyTrader {
  if (!copyTraderInstance) {
    copyTraderInstance = new SwarmCopyTrader(connection, swarm);
  }
  return copyTraderInstance;
}

export function destroySwarmCopyTrader(): void {
  if (copyTraderInstance) {
    copyTraderInstance.destroy();
    copyTraderInstance = null;
  }
}
