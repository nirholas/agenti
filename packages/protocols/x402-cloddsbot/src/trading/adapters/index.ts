/**
 * Strategy Adapters — Wrap standalone engines as BotManager-compatible Strategies
 *
 * The crypto-hft and hft-divergence engines are self-contained (they manage their
 * own tick loops, exit checks, execution). These adapters expose them through the
 * BotManager's Strategy interface so they can be registered, started/stopped,
 * and monitored through a unified system.
 *
 * The engines still run their own internal loops — the BotManager evaluate() call
 * just returns current stats/signals rather than driving the tick loop.
 */

import type { Strategy, StrategyConfig, StrategyContext, Signal } from '../bots/index.js';
import type { CryptoFeed } from '../../feeds/crypto/index.js';
import type { ExecutionService } from '../../execution/index.js';

// ── Crypto HFT Adapter ─────────────────────────────────────────────────────

export interface CryptoHftAdapterOpts {
  feed: CryptoFeed;
  execution: ExecutionService | null;
  config?: Record<string, unknown>;
}

export function createCryptoHftAdapter(opts: CryptoHftAdapterOpts): Strategy {
  let engine: any = null; // Lazy-loaded CryptoHftEngine

  const strategyConfig: StrategyConfig = {
    id: 'crypto-hft',
    name: 'Crypto HFT',
    description: '15-minute Polymarket crypto binary market trading (4 strategies)',
    platforms: ['polymarket' as any],
    intervalMs: 1_000, // BotManager checks every 1s (engine has its own 500ms loop)
    dryRun: opts.config?.dryRun !== false,
    params: opts.config,
  };

  return {
    config: strategyConfig,

    async init() {
      const { createCryptoHftEngine } = await import('../../strategies/crypto-hft/index.js');
      engine = createCryptoHftEngine(opts.feed, opts.execution, opts.config as any);
      await engine.start();
    },

    async evaluate(_ctx: StrategyContext): Promise<Signal[]> {
      if (!engine) return [];

      // Engine runs its own internal loop. Evaluate just reports current state.
      const stats = engine.getStats();
      const positions = engine.getPositions();

      // Convert open positions to signals for BotManager tracking
      const signals: Signal[] = [];
      for (const pos of positions) {
        const pnl = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
        signals.push({
          type: 'hold',
          platform: 'polymarket' as any,
          marketId: pos.conditionId,
          outcome: pos.direction,
          price: pos.currentPrice,
          size: pos.shares,
          confidence: 1,
          reason: `[${pos.strategy}] ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`,
          meta: {
            positionId: pos.id,
            strategy: pos.strategy,
            entryPrice: pos.entryPrice,
            pnlPct: pnl,
            asset: pos.asset,
          },
        });
      }

      return signals;
    },

    async cleanup() {
      if (engine) {
        engine.stop();
        engine = null;
      }
    },
  };
}

// ── HFT Divergence Adapter ─────────────────────────────────────────────────

export interface DivergenceAdapterOpts {
  feed: CryptoFeed;
  execution: ExecutionService | null;
  config?: Record<string, unknown>;
}

export function createDivergenceAdapter(opts: DivergenceAdapterOpts): Strategy {
  let engine: any = null; // Lazy-loaded HftDivergenceEngine

  const strategyConfig: StrategyConfig = {
    id: 'hft-divergence',
    name: 'HFT Divergence',
    description: 'Spot vs Polymarket divergence detection (rolling windows + threshold buckets)',
    platforms: ['polymarket' as any],
    intervalMs: 1_000,
    dryRun: opts.config?.dryRun !== false,
    params: opts.config,
  };

  return {
    config: strategyConfig,

    async init() {
      const { createHftDivergenceEngine } = await import('../../strategies/hft-divergence/strategy.js');
      engine = createHftDivergenceEngine(opts.feed, opts.execution, opts.config as any);
      await engine.start();
    },

    async evaluate(_ctx: StrategyContext): Promise<Signal[]> {
      if (!engine) return [];

      const positions = engine.getPositions();
      const signals: Signal[] = [];

      for (const pos of positions) {
        const pnl = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
        signals.push({
          type: 'hold',
          platform: 'polymarket' as any,
          marketId: pos.conditionId,
          outcome: pos.direction,
          price: pos.currentPrice,
          size: pos.shares,
          confidence: 1,
          reason: `[${pos.strategyTag}] ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%`,
          meta: {
            positionId: pos.id,
            strategyTag: pos.strategyTag,
            entryPrice: pos.entryPrice,
            pnlPct: pnl,
            asset: pos.asset,
          },
        });
      }

      return signals;
    },

    async cleanup() {
      if (engine) {
        engine.stop();
        engine = null;
      }
    },
  };
}

// ── Utility: Get engine stats from adapter ──────────────────────────────────

export function getAdapterEngine(strategy: Strategy): any {
  // Access the engine instance (for status/stats commands)
  // The adapter closures capture the engine variable
  return (strategy as any)._engine ?? null;
}
