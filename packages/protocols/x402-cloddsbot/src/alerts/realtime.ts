/**
 * Real-time Alerts System
 *
 * Sends push notifications for:
 * - Whale trades above threshold
 * - Arbitrage opportunities above edge threshold
 * - Price movements above threshold
 * - Copy trading events
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger';
import type { OutgoingMessage, Platform } from '../types';
import type { WhaleTracker, WhaleTrade } from '../feeds/polymarket/whale-tracker';
import type { OpportunityFinder } from '../opportunity';

// =============================================================================
// TYPES
// =============================================================================

export interface RealtimeAlertsConfig {
  /** Enable real-time alerts (default: true) */
  enabled?: boolean;
  /** Alert targets - where to send notifications */
  targets?: AlertTarget[];
  /** Whale trade alerts config */
  whaleTrades?: {
    enabled?: boolean;
    /** Min trade size to alert (default: 50000) */
    minSize?: number;
    /** Cooldown per address in ms (default: 300000 = 5 min) */
    cooldownMs?: number;
  };
  /** Arbitrage opportunity alerts config */
  arbitrage?: {
    enabled?: boolean;
    /** Min edge % to alert (default: 2) */
    minEdge?: number;
    /** Cooldown per opportunity in ms (default: 600000 = 10 min) */
    cooldownMs?: number;
  };
  /** Price movement alerts config */
  priceMovement?: {
    enabled?: boolean;
    /** Min price change % to alert (default: 5) */
    minChangePct?: number;
    /** Time window in ms (default: 300000 = 5 min) */
    windowMs?: number;
  };
  /** Copy trading alerts config */
  copyTrading?: {
    enabled?: boolean;
    /** Alert on trade copied */
    onCopied?: boolean;
    /** Alert on copy failed */
    onFailed?: boolean;
  };
}

export interface AlertTarget {
  platform: Platform;
  chatId: string;
  accountId?: string;
}

interface AlertEvent {
  type: 'whale_trade' | 'arbitrage' | 'price_movement' | 'copy_trade';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type RealtimeAlertsEvents = {
  alert: (event: AlertEvent) => void;
  error: (error: Error) => void;
};

export interface RealtimeAlertsService extends EventEmitter<RealtimeAlertsEvents> {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  sendAlert(event: AlertEvent): Promise<void>;
  getStats(): AlertStats;
  // Handlers for integration
  handleWhaleTrade(trade: WhaleTrade): void;
  handleArbitrageOpportunity(opp: {
    id: string;
    type: string;
    edgePct: number;
    markets: Array<{ platform: string; question?: string }>;
    confidence?: number;
  }): void;
  handlePriceMovement(data: {
    marketId: string;
    platform: string;
    question?: string;
    oldPrice: number;
    newPrice: number;
    changePct: number;
  }): void;
  handleCopyTradeEvent(data: {
    type: 'copied' | 'failed';
    originalTrade?: WhaleTrade;
    error?: string;
    size?: number;
    entryPrice?: number;
  }): void;
}

interface AlertStats {
  totalSent: number;
  byType: Record<string, number>;
  lastSentAt: Date | null;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createRealtimeAlertsService(
  sendMessage: (message: OutgoingMessage) => Promise<string | null>,
  config: RealtimeAlertsConfig = {}
): RealtimeAlertsService {
  const emitter = new EventEmitter<RealtimeAlertsEvents>();

  let running = false;
  const cooldowns = new Map<string, number>();
  const stats: AlertStats = {
    totalSent: 0,
    byType: {},
    lastSentAt: null,
  };

  // Track connected services
  let whaleTrackerCleanup: (() => void) | null = null;
  let opportunityFinderCleanup: (() => void) | null = null;

  function shouldAlert(key: string, cooldownMs: number): boolean {
    const last = cooldowns.get(key);
    const now = Date.now();
    if (last && now - last < cooldownMs) return false;
    cooldowns.set(key, now);

    // Prune expired cooldown entries to prevent unbounded growth
    if (cooldowns.size > 500) {
      for (const [k, ts] of cooldowns) {
        if (now - ts > cooldownMs * 2) {
          cooldowns.delete(k);
        }
      }
    }

    return true;
  }

  function formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  async function sendAlertToTargets(event: AlertEvent): Promise<void> {
    const targets = config.targets ?? [];
    if (targets.length === 0) {
      logger.debug({ event: event.type }, 'Alert suppressed - no targets configured');
      return;
    }

    const text = `${event.title}\n\n${event.body}`;

    for (const target of targets) {
      try {
        await sendMessage({
          platform: target.platform,
          chatId: target.chatId,
          accountId: target.accountId,
          text,
        });
      } catch (error) {
        logger.warn({ error, target, event: event.type }, 'Failed to send alert');
      }
    }

    stats.totalSent++;
    stats.byType[event.type] = (stats.byType[event.type] ?? 0) + 1;
    stats.lastSentAt = new Date();

    emitter.emit('alert', event);
  }

  // =============================================================================
  // WHALE TRADE HANDLER
  // =============================================================================

  function handleWhaleTrade(trade: WhaleTrade): void {
    const whaleConfig = config.whaleTrades ?? {};
    if (whaleConfig.enabled === false) return;

    const minSize = whaleConfig.minSize ?? 50000;
    if (trade.usdValue < minSize) return;

    const cooldownMs = whaleConfig.cooldownMs ?? 300000;
    const tradeAddress = trade.maker || trade.taker || 'unknown';
    const key = `whale:${tradeAddress}:${trade.marketId}`;
    if (!shouldAlert(key, cooldownMs)) return;

    const event: AlertEvent = {
      type: 'whale_trade',
      title: `Whale ${trade.side.toUpperCase()} Detected`,
      body: [
        `Address: ${tradeAddress.slice(0, 8)}...${tradeAddress.slice(-6)}`,
        `Market: ${trade.marketQuestion?.slice(0, 50) ?? trade.marketId}`,
        `Side: ${trade.side.toUpperCase()} ${trade.outcome}`,
        `Size: ${formatUSD(trade.usdValue)}`,
        `Price: ${(trade.price * 100).toFixed(1)}%`,
      ].join('\n'),
      data: { trade },
    };

    void sendAlertToTargets(event);
  }

  // =============================================================================
  // ARBITRAGE HANDLER
  // =============================================================================

  function handleArbitrageOpportunity(opp: {
    id: string;
    type: string;
    edgePct: number;
    markets: Array<{ platform: string; question?: string }>;
    confidence?: number;
  }): void {
    const arbConfig = config.arbitrage ?? {};
    if (arbConfig.enabled === false) return;

    const minEdge = arbConfig.minEdge ?? 2;
    if (opp.edgePct < minEdge) return;

    const cooldownMs = arbConfig.cooldownMs ?? 600000;
    const key = `arb:${opp.id}`;
    if (!shouldAlert(key, cooldownMs)) return;

    const event: AlertEvent = {
      type: 'arbitrage',
      title: `Arbitrage Opportunity: ${formatPercent(opp.edgePct)} Edge`,
      body: [
        `Type: ${opp.type}`,
        `Edge: ${formatPercent(opp.edgePct)}`,
        `Confidence: ${((opp.confidence ?? 0) * 100).toFixed(0)}%`,
        `Markets:`,
        ...opp.markets.map(m => `  - ${m.platform}: ${m.question?.slice(0, 40) ?? 'Unknown'}`),
      ].join('\n'),
      data: { opportunity: opp },
    };

    void sendAlertToTargets(event);
  }

  // =============================================================================
  // PRICE MOVEMENT HANDLER
  // =============================================================================

  function handlePriceMovement(data: {
    marketId: string;
    platform: string;
    question?: string;
    oldPrice: number;
    newPrice: number;
    changePct: number;
  }): void {
    const priceConfig = config.priceMovement ?? {};
    if (priceConfig.enabled === false) return;

    const minChangePct = priceConfig.minChangePct ?? 5;
    if (Math.abs(data.changePct) < minChangePct) return;

    const cooldownMs = priceConfig.windowMs ?? 300000;
    const key = `price:${data.platform}:${data.marketId}`;
    if (!shouldAlert(key, cooldownMs)) return;

    const direction = data.changePct > 0 ? 'UP' : 'DOWN';
    const event: AlertEvent = {
      type: 'price_movement',
      title: `Price ${direction}: ${formatPercent(data.changePct)}`,
      body: [
        `Market: ${data.question?.slice(0, 50) ?? data.marketId}`,
        `Platform: ${data.platform}`,
        `Price: ${(data.oldPrice * 100).toFixed(1)}% -> ${(data.newPrice * 100).toFixed(1)}%`,
        `Change: ${formatPercent(data.changePct)}`,
      ].join('\n'),
      data,
    };

    void sendAlertToTargets(event);
  }

  // =============================================================================
  // COPY TRADING HANDLER
  // =============================================================================

  function handleCopyTradeEvent(data: {
    type: 'copied' | 'failed';
    originalTrade?: WhaleTrade;
    error?: string;
    size?: number;
    entryPrice?: number;
  }): void {
    const copyConfig = config.copyTrading ?? {};
    if (copyConfig.enabled === false) return;
    if (data.type === 'copied' && copyConfig.onCopied === false) return;
    if (data.type === 'failed' && copyConfig.onFailed === false) return;

    const originalAddress = data.originalTrade?.maker || data.originalTrade?.taker || 'unknown';
    const event: AlertEvent = {
      type: 'copy_trade',
      title: data.type === 'copied' ? 'Trade Copied' : 'Copy Trade Failed',
      body: data.type === 'copied'
        ? [
            `Copied from: ${originalAddress.slice(0, 10)}...`,
            `Market: ${data.originalTrade?.marketQuestion?.slice(0, 40) ?? 'Unknown'}`,
            `Size: ${formatUSD(data.size ?? 0)}`,
            `Entry: ${((data.entryPrice ?? 0) * 100).toFixed(1)}%`,
          ].join('\n')
        : [
            `Failed to copy trade`,
            `Reason: ${data.error ?? 'Unknown error'}`,
            `Original: ${originalAddress.slice(0, 10)}...`,
          ].join('\n'),
      data,
    };

    void sendAlertToTargets(event);
  }

  // =============================================================================
  // SERVICE INTERFACE
  // =============================================================================

  const service: RealtimeAlertsService = Object.assign(emitter, {
    start(): void {
      if (running) return;
      running = true;
      logger.info({ targets: config.targets?.length ?? 0 }, 'Real-time alerts started');
    },

    stop(): void {
      if (!running) return;
      running = false;

      // Cleanup subscriptions
      if (whaleTrackerCleanup) {
        whaleTrackerCleanup();
        whaleTrackerCleanup = null;
      }
      if (opportunityFinderCleanup) {
        opportunityFinderCleanup();
        opportunityFinderCleanup = null;
      }

      logger.info('Real-time alerts stopped');
    },

    isRunning(): boolean {
      return running;
    },

    async sendAlert(event: AlertEvent): Promise<void> {
      await sendAlertToTargets(event);
    },

    getStats(): AlertStats {
      return { ...stats };
    },

    // Exposed handlers for integration
    handleWhaleTrade,
    handleArbitrageOpportunity,
    handlePriceMovement,
    handleCopyTradeEvent,
  });

  return service;
}

// =============================================================================
// INTEGRATION HELPERS
// =============================================================================

/**
 * Connect whale tracker to alerts service
 */
export function connectWhaleTracker(
  alerts: RealtimeAlertsService,
  whaleTracker: WhaleTracker
): () => void {
  const handler = (trade: WhaleTrade) => {
    // Access the internal handler via the service
    (alerts as any).handleWhaleTrade?.(trade);
  };

  whaleTracker.on('trade', handler);

  return () => {
    whaleTracker.off('trade', handler);
  };
}

/**
 * Connect opportunity finder to alerts service
 */
export function connectOpportunityFinder(
  alerts: RealtimeAlertsService,
  finder: OpportunityFinder
): () => void {
  const handler = (opp: any) => {
    (alerts as any).handleArbitrageOpportunity?.(opp);
  };

  finder.on('opportunity', handler);

  return () => {
    finder.off('opportunity', handler);
  };
}
