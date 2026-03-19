/**
 * Orderbook Analysis — OBI, spread tracking, depth collapse, MM capitulation
 *
 * Ported from firstorder.rs spread_tracker + depth analysis.
 */

import type { OrderbookSnapshot, ObiCategory } from './types.js';
import { categorizeObi } from './types.js';

// ── Spread Tracker (rolling 60s window) ─────────────────────────────────────

interface SpreadEntry {
  spread: number;
  timestamp: number;
}

export interface SpreadTracker {
  record(tokenId: string, spread: number, ts?: number): void;
  getAvgSpread(tokenId: string): number | null;
  /** Spread ratio vs average. >2.0 = MM capitulation (high conviction). <1.2 = MMs confident (skip). */
  getSpreadRatio(tokenId: string): number | null;
  isMMCapitulation(tokenId: string): boolean;
  isMMLowConviction(tokenId: string): boolean;
}

const SPREAD_WINDOW_MS = 60_000;
const SPREAD_MIN_SAMPLES = 10;
const MM_CAP_SPREAD_RATIO_BOOST = 2.0;
const MM_CAP_SPREAD_RATIO_SKIP = 1.2;

export function createSpreadTracker(): SpreadTracker {
  const history = new Map<string, SpreadEntry[]>();

  function prune(tokenId: string, now: number) {
    const entries = history.get(tokenId);
    if (!entries) return;
    const cutoff = now - SPREAD_WINDOW_MS;
    while (entries.length > 0 && entries[0].timestamp < cutoff) {
      entries.shift();
    }
  }

  return {
    record(tokenId, spread, ts = Date.now()) {
      let entries = history.get(tokenId);
      if (!entries) {
        entries = [];
        history.set(tokenId, entries);
      }
      entries.push({ spread, timestamp: ts });
      prune(tokenId, ts);
    },

    getAvgSpread(tokenId) {
      const entries = history.get(tokenId);
      if (!entries || entries.length < SPREAD_MIN_SAMPLES) return null;
      return entries.reduce((s, e) => s + e.spread, 0) / entries.length;
    },

    getSpreadRatio(tokenId) {
      const entries = history.get(tokenId);
      if (!entries || entries.length < SPREAD_MIN_SAMPLES) return null;
      const avg = entries.reduce((s, e) => s + e.spread, 0) / entries.length;
      if (avg === 0) return null;
      const current = entries[entries.length - 1].spread;
      return current / avg;
    },

    isMMCapitulation(tokenId) {
      const ratio = this.getSpreadRatio(tokenId);
      return ratio !== null && ratio >= MM_CAP_SPREAD_RATIO_BOOST;
    },

    isMMLowConviction(tokenId) {
      const ratio = this.getSpreadRatio(tokenId);
      return ratio !== null && ratio < MM_CAP_SPREAD_RATIO_SKIP;
    },
  };
}

// ── Depth Tracker (collapse detection) ──────────────────────────────────────

export interface DepthTracker {
  record(tokenId: string, bidDepth: number, askDepth: number, ts?: number): void;
  /** Returns depth change % (negative = collapse). null if insufficient history. */
  getDepthChange(tokenId: string, windowMs?: number): number | null;
  /** True if depth collapsed by >= thresholdPct (e.g. 60%) in recent window */
  isCollapsed(tokenId: string, thresholdPct: number): boolean;
  getCurrentDepth(tokenId: string): { bidDepth: number; askDepth: number } | null;
}

interface DepthEntry {
  bidDepth: number;
  askDepth: number;
  total: number;
  timestamp: number;
}

const DEPTH_WINDOW_MS = 30_000;

export function createDepthTracker(): DepthTracker {
  const history = new Map<string, DepthEntry[]>();

  function prune(tokenId: string, now: number) {
    const entries = history.get(tokenId);
    if (!entries) return;
    const cutoff = now - DEPTH_WINDOW_MS;
    while (entries.length > 0 && entries[0].timestamp < cutoff) {
      entries.shift();
    }
  }

  return {
    record(tokenId, bidDepth, askDepth, ts = Date.now()) {
      let entries = history.get(tokenId);
      if (!entries) {
        entries = [];
        history.set(tokenId, entries);
      }
      entries.push({ bidDepth, askDepth, total: bidDepth + askDepth, timestamp: ts });
      prune(tokenId, ts);
    },

    getDepthChange(tokenId, windowMs = 10_000) {
      const entries = history.get(tokenId);
      if (!entries || entries.length < 2) return null;

      const now = entries[entries.length - 1].timestamp;
      const cutoff = now - windowMs;
      const baseline = entries.find((e) => e.timestamp >= cutoff) ?? entries[0];
      const current = entries[entries.length - 1];

      if (baseline.total === 0) return null;
      return ((current.total - baseline.total) / baseline.total) * 100;
    },

    isCollapsed(tokenId, thresholdPct) {
      const change = this.getDepthChange(tokenId);
      return change !== null && change <= -thresholdPct;
    },

    getCurrentDepth(tokenId) {
      const entries = history.get(tokenId);
      if (!entries || entries.length === 0) return null;
      const last = entries[entries.length - 1];
      return { bidDepth: last.bidDepth, askDepth: last.askDepth };
    },
  };
}

// ── Bid Staleness Tracker ───────────────────────────────────────────────────

export interface BidTracker {
  record(tokenId: string, bid: number, ts?: number): void;
  /** How many seconds the bid has been unchanged */
  getStalenessSec(tokenId: string): number;
  getBid(tokenId: string): number | null;
}

export function createBidTracker(): BidTracker {
  const lastBid = new Map<string, number>();
  const unchangedSince = new Map<string, number>();

  return {
    record(tokenId, bid, ts = Date.now()) {
      const prev = lastBid.get(tokenId);
      if (prev !== undefined && prev !== bid) {
        unchangedSince.set(tokenId, ts);
      } else if (prev === undefined) {
        unchangedSince.set(tokenId, ts);
      }
      lastBid.set(tokenId, bid);
    },

    getStalenessSec(tokenId) {
      const since = unchangedSince.get(tokenId);
      if (since === undefined) return 0;
      return (Date.now() - since) / 1000;
    },

    getBid(tokenId) {
      return lastBid.get(tokenId) ?? null;
    },
  };
}

// ── Build snapshot from raw orderbook data ──────────────────────────────────

export function buildOrderbookSnapshot(
  tokenId: string,
  bids: Array<[number, number]>,
  asks: Array<[number, number]>,
  timestamp?: number
): OrderbookSnapshot {
  const bidDepth = bids.reduce((s, [, size]) => s + size, 0);
  const askDepth = asks.reduce((s, [, size]) => s + size, 0);
  const totalDepth = bidDepth + askDepth;
  const obi = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

  const bestBid = bids.length > 0 ? bids[0][0] : 0;
  const bestAsk = asks.length > 0 ? asks[0][0] : 1;
  const spread = bestAsk - bestBid;
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;

  return {
    tokenId,
    bids,
    asks,
    bidDepth,
    askDepth,
    obi,
    spread,
    spreadPct,
    bestBid,
    bestAsk,
    midPrice,
    timestamp: timestamp ?? Date.now(),
  };
}

// ── OBI-based maker timeout (from firstorder.rs) ────────────────────────────

/** Returns how long to wait for maker fill based on OBI before escalating to taker. */
export function obiMakerTimeoutMs(obi: number, isSelling: boolean): number {
  const cat = categorizeObi(obi);

  if (isSelling) {
    // Selling: bid-heavy = buyers coming (good for us) → wait longer
    if (cat === 'bid_heavy') return 4000;
    if (cat === 'bid_lean' || cat === 'balanced') return 2000;
    return 0; // ask-heavy → skip maker, go taker
  } else {
    // Buying: ask-heavy = sellers available (good for us) → wait longer
    if (cat === 'ask_heavy') return 4000;
    if (cat === 'ask_lean' || cat === 'balanced') return 2000;
    return 0; // bid-heavy → skip maker, go taker
  }
}
