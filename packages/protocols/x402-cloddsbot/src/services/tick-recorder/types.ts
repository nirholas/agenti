/**
 * Tick Recorder Types
 * Types for historical tick data storage and retrieval
 */

import type { Platform } from '../../types';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface TickRecorderConfig {
  enabled: boolean;
  connectionString: string;
  batchSize?: number;
  flushIntervalMs?: number;
  retentionDays?: number;
  platforms?: Platform[];
}

// =============================================================================
// TICK DATA
// =============================================================================

export interface Tick {
  time: Date;
  platform: Platform;
  marketId: string;
  outcomeId: string;
  price: number;
  prevPrice: number | null;
}

export interface OrderbookSnapshot {
  time: Date;
  platform: Platform;
  marketId: string;
  outcomeId: string;
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  spread: number | null;
  midPrice: number | null;
}

// =============================================================================
// QUERIES
// =============================================================================

export interface TickQuery {
  platform: Platform;
  marketId: string;
  outcomeId?: string;
  startTime: number;
  endTime: number;
  limit?: number;
}

export type OHLCInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface OHLCParams {
  platform: Platform;
  marketId: string;
  outcomeId: string;
  interval: OHLCInterval;
  startTime: number;
  endTime: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickCount: number;
}

export interface OrderbookQuery {
  platform: Platform;
  marketId: string;
  outcomeId?: string;
  startTime: number;
  endTime: number;
  limit?: number;
}

export interface SpreadHistoryParams {
  platform: Platform;
  marketId: string;
  outcomeId: string;
  interval: OHLCInterval;
  startTime: number;
  endTime: number;
}

export interface SpreadCandle {
  time: number;
  avgSpread: number;
  minSpread: number;
  maxSpread: number;
  avgMidPrice: number;
}

// =============================================================================
// STATS
// =============================================================================

export interface RecorderStats {
  ticksRecorded: number;
  orderbooksRecorded: number;
  ticksInBuffer: number;
  orderbooksInBuffer: number;
  lastFlushTime: number | null;
  dbConnected: boolean;
  platforms: Platform[];
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface TickRecorder {
  start(): Promise<void>;
  stop(): Promise<void>;

  // Write (internal, called by feed subscriptions)
  recordTick(update: {
    platform: Platform;
    marketId: string;
    outcomeId: string;
    price: number;
    previousPrice?: number;
    timestamp: number;
  }): void;

  recordOrderbook(update: {
    platform: Platform;
    marketId: string;
    outcomeId: string;
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    timestamp: number;
  }): void;

  // Read (public query interface)
  getTicks(query: TickQuery): Promise<Tick[]>;
  getOHLC(params: OHLCParams): Promise<Candle[]>;
  getOrderbookSnapshots(params: OrderbookQuery): Promise<OrderbookSnapshot[]>;
  getSpreadHistory(params: SpreadHistoryParams): Promise<SpreadCandle[]>;

  // Stats
  getStats(): RecorderStats;
}
