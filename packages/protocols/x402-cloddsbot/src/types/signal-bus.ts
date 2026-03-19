/**
 * Signal Bus — Shared type definitions for feed → consumer event system.
 *
 * These types are public (tracked in git). The implementation lives in
 * src/gateway/signal-bus.ts (private, gitignored).
 */

import { EventEmitter } from 'events';
import type { Platform } from '../types.js';

// ── Event payloads ──────────────────────────────────────────────────────────

export interface TickUpdate {
  platform: Platform;
  marketId: string;
  outcomeId: string;
  price: number;
  prevPrice: number | null;
  timestamp: number;
}

export interface OrderbookUpdate {
  platform: Platform;
  marketId: string;
  outcomeId: string;
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  spread?: number | null;
  midPrice?: number | null;
  timestamp: number;
}

export interface TradingSignal {
  type: 'momentum' | 'reversal' | 'volatility_spike' | 'spread_widening' | 'opportunity' | 'sentiment_shift';
  platform: string;
  marketId: string;
  outcomeId: string;
  strength: number;     // 0–1
  direction: 'buy' | 'sell' | 'neutral';
  features: Record<string, number>;
  timestamp: number;
}

// ── SignalBus interface ─────────────────────────────────────────────────────

export interface SignalBus extends EventEmitter {
  /** Subscribe to FeedManager events (call once, or again after rebuildRuntime). */
  connectFeeds(feeds: unknown): void;
  /** Remove listeners from the current FeedManager. */
  disconnectFeeds(): void;
  /** Register a tick consumer. */
  onTick(handler: (update: TickUpdate) => void): void;
  /** Register an orderbook consumer. */
  onOrderbook(handler: (update: OrderbookUpdate) => void): void;
  /** Register a trading-signal consumer. */
  onSignal(handler: (signal: TradingSignal) => void): void;
}
