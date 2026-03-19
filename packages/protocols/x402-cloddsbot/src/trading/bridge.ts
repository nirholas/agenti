/**
 * Trading Bridge — Connects SignalBus events to BotManager evaluation.
 *
 * The SignalBus emits real-time tick/orderbook/signal events from feeds.
 * The BotManager evaluates strategies on timer intervals.
 * This bridge:
 *   1. Maintains a shared price cache from signal bus ticks
 *   2. Routes TradingSignal events to trigger immediate strategy evaluations
 *   3. Re-emits BotManager trade/signal events through the signal bus
 */

import { logger } from '../utils/logger.js';
import type { SignalBus, TickUpdate, TradingSignal } from '../types/signal-bus.js';
import type { BotManager } from './bots/index.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TradingBridge {
  /** Start forwarding events between signal bus and bot manager. */
  connect(): void;
  /** Stop forwarding. */
  disconnect(): void;
  /** Get latest price for a market outcome. */
  getPrice(marketId: string, outcomeId: string): number | null;
  /** Get all cached prices. */
  getPrices(): Map<string, number>;
  /** Whether the bridge is connected. */
  readonly connected: boolean;
}

export interface TradingBridgeOpts {
  signalBus: SignalBus;
  botManager: BotManager;
  /** Evaluate immediately on trading signals (default: true). */
  evaluateOnSignal?: boolean;
  /** Maximum price cache age in ms before eviction (default: 60_000). */
  maxPriceAgeMs?: number;
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createTradingBridge(opts: TradingBridgeOpts): TradingBridge {
  const {
    signalBus,
    botManager,
    evaluateOnSignal = true,
    maxPriceAgeMs = 60_000,
  } = opts;

  // Price cache: "marketId:outcomeId" → { price, timestamp }
  const priceCache = new Map<string, { price: number; timestamp: number }>();
  let isConnected = false;

  // ── Handlers ────────────────────────────────────────────────────────────

  function onTick(update: TickUpdate): void {
    const key = `${update.marketId}:${update.outcomeId}`;
    priceCache.set(key, { price: update.price, timestamp: update.timestamp });
  }

  function onSignal(signal: TradingSignal): void {
    if (!evaluateOnSignal) return;

    // Find strategies that are running and match the signal's platform
    const strategies = botManager.getStrategies();
    for (const cfg of strategies) {
      const status = botManager.getBotStatus(cfg.id);
      if (status?.status !== 'running') continue;

      // Trigger immediate evaluation for relevant strategies
      botManager.evaluateNow(cfg.id).catch((err) => {
        logger.warn({ err, strategyId: cfg.id }, 'Bridge: immediate evaluation failed');
      });
    }
  }

  function onBotSignals(data: { strategyId: string; signals: unknown[] }): void {
    // Re-emit bot signals through the signal bus for other consumers
    for (const signal of data.signals) {
      const s = signal as Record<string, unknown>;
      if (s.type === 'buy' || s.type === 'sell') {
        signalBus.emit('signal', {
          type: 'opportunity',
          platform: String(s.platform || ''),
          marketId: String(s.marketId || ''),
          outcomeId: String(s.outcome || ''),
          strength: Number(s.confidence || 0.5),
          direction: s.type === 'buy' ? 'buy' : 'sell',
          features: { strategyId: data.strategyId as unknown as number },
          timestamp: Date.now(),
        } satisfies TradingSignal);
      }
    }
  }

  // ── Price eviction ──────────────────────────────────────────────────────

  let evictionTimer: ReturnType<typeof setInterval> | null = null;

  function startEviction(): void {
    evictionTimer = setInterval(() => {
      const cutoff = Date.now() - maxPriceAgeMs;
      for (const [key, entry] of priceCache) {
        if (entry.timestamp < cutoff) priceCache.delete(key);
      }
    }, maxPriceAgeMs);
  }

  function stopEviction(): void {
    if (evictionTimer) {
      clearInterval(evictionTimer);
      evictionTimer = null;
    }
  }

  // ── Bridge API ──────────────────────────────────────────────────────────

  return {
    get connected() {
      return isConnected;
    },

    connect() {
      if (isConnected) return;

      signalBus.onTick(onTick);
      signalBus.onSignal(onSignal);
      botManager.on('signals', onBotSignals);

      startEviction();
      isConnected = true;
      logger.info('Trading bridge connected');
    },

    disconnect() {
      if (!isConnected) return;

      signalBus.removeListener('tick', onTick);
      signalBus.removeListener('signal', onSignal);
      botManager.removeListener('signals', onBotSignals);

      stopEviction();
      priceCache.clear();
      isConnected = false;
      logger.info('Trading bridge disconnected');
    },

    getPrice(marketId: string, outcomeId: string): number | null {
      const entry = priceCache.get(`${marketId}:${outcomeId}`);
      if (!entry) return null;
      if (Date.now() - entry.timestamp > maxPriceAgeMs) return null;
      return entry.price;
    },

    getPrices(): Map<string, number> {
      const result = new Map<string, number>();
      const cutoff = Date.now() - maxPriceAgeMs;
      for (const [key, entry] of priceCache) {
        if (entry.timestamp >= cutoff) result.set(key, entry.price);
      }
      return result;
    },
  };
}
