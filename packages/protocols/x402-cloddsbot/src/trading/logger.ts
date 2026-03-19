/**
 * Trade Logger - Automatic trade capture and persistence
 *
 * Features:
 * - Auto-capture all trades from execution service
 * - Persistent SQLite storage
 * - Real-time trade events
 * - Performance metrics calculation
 */

import { EventEmitter } from 'eventemitter3';
import { randomUUID } from 'crypto';
import { Database, type SqlBindValue } from '../db/index';
import { logger } from '../utils/logger';
import type { Platform } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface Trade {
  id: string;
  platform: Platform;
  marketId: string;
  marketQuestion?: string;
  outcome: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market' | 'maker' | 'protected';
  price: number;
  size: number;
  filled: number;
  cost: number;
  /** Fees paid (positive) or rebates earned (negative) */
  fees?: number;
  /** Whether this was a maker order (earned rebate) */
  isMaker?: boolean;
  /** Maker rebate earned (positive number, subset of fees) */
  makerRebate?: number;
  orderId?: string;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'failed';
  /** Strategy/bot that placed this trade */
  strategyId?: string;
  strategyName?: string;
  /** Tags for filtering */
  tags?: string[];
  /** Exit trade ID (if this is an entry) */
  exitTradeId?: string;
  /** Entry trade ID (if this is an exit) */
  entryTradeId?: string;
  /** Realized PnL (calculated on exit) */
  realizedPnL?: number;
  realizedPnLPct?: number;
  /** Timestamps */
  createdAt: Date;
  filledAt?: Date;
  /** Metadata */
  meta?: Record<string, unknown>;
}

export interface TradeFilter {
  platform?: Platform;
  marketId?: string;
  strategyId?: string;
  status?: Trade['status'];
  side?: 'buy' | 'sell';
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  totalVolume: number;
  totalFees: number;
  /** Total maker rebates earned */
  totalMakerRebates: number;
  /** Net fees (fees paid - rebates earned) */
  netFees: number;
  /** Number of maker vs taker trades */
  makerTrades: number;
  takerTrades: number;
  byPlatform: Record<Platform, { trades: number; pnl: number }>;
  byStrategy: Record<string, { trades: number; pnl: number; winRate: number }>;
}

/**
 * Fee rates by platform (in basis points)
 *
 * VERIFIED (Jan 2026):
 * - Polymarket: 0% on most markets; 15-min crypto markets have dynamic fees (up to ~315 bps at 50/50)
 * - Kalshi: Formula-based 0.07*C*P*(1-P), averaging ~120 bps, capped at ~200 bps
 * - Betfair: 2-5% commission on net winnings (varies by market)
 * - Smarkets: 2% commission
 * - Manifold: Play money, no fees
 */
export const PLATFORM_FEES = {
  polymarket: { takerFeeBps: 0, makerRebateBps: 0 }, // Zero fees on most markets
  kalshi: { takerFeeBps: 120, makerRebateBps: 0 },   // ~1.2% average (formula-based)
  betfair: { takerFeeBps: 200, makerRebateBps: 0 },  // ~2% commission
  smarkets: { takerFeeBps: 200, makerRebateBps: 0 }, // 2% commission
  manifold: { takerFeeBps: 0, makerRebateBps: 0 },   // Play money
} as const;

/** Calculate fees for a trade */
export function calculateTradeFees(
  platform: Platform,
  cost: number,
  isMaker: boolean
): { fees: number; makerRebate: number } {
  const rates = PLATFORM_FEES[platform as keyof typeof PLATFORM_FEES] || { takerFeeBps: 0, makerRebateBps: 0 };

  if (isMaker && rates.makerRebateBps > 0) {
    const rebate = (cost * rates.makerRebateBps) / 10000;
    return { fees: -rebate, makerRebate: rebate };
  }

  const fee = (cost * rates.takerFeeBps) / 10000;
  return { fees: fee, makerRebate: 0 };
}

export interface TradeLogger extends EventEmitter {
  /** Log a new trade */
  logTrade(trade: Omit<Trade, 'id' | 'createdAt'>): Trade;

  /** Update trade status */
  updateTrade(tradeId: string, updates: Partial<Trade>): Trade | null;

  /** Mark trade as filled */
  fillTrade(tradeId: string, filledPrice: number, filledSize: number, fees?: number): Trade | null;

  /** Cancel a trade */
  cancelTrade(tradeId: string): Trade | null;

  /** Link entry and exit trades */
  linkTrades(entryId: string, exitId: string, realizedPnL: number): void;

  /** Get trade by ID */
  getTrade(tradeId: string): Trade | null;

  /** Query trades with filters */
  getTrades(filter?: TradeFilter): Trade[];

  /** Get trades for a position */
  getTradesForPosition(platform: Platform, marketId: string, outcome: string): Trade[];

  /** Get open trades (pending/partial) */
  getOpenTrades(strategyId?: string): Trade[];

  /** Calculate trade stats */
  getStats(filter?: TradeFilter): TradeStats;

  /** Get daily PnL */
  getDailyPnL(days?: number): Array<{ date: string; pnl: number; trades: number }>;

  /** Export trades to CSV */
  exportCsv(filter?: TradeFilter): string;

  /** Clear old trades */
  cleanup(olderThanDays: number): number;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createTradeLogger(db: Database): TradeLogger {
  const emitter = new EventEmitter() as TradeLogger;
  const trades = new Map<string, Trade>();

  // Initialize database
  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      market_id TEXT NOT NULL,
      market_question TEXT,
      outcome TEXT NOT NULL,
      side TEXT NOT NULL,
      order_type TEXT NOT NULL,
      price REAL NOT NULL,
      size REAL NOT NULL,
      filled REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      fees REAL,
      is_maker INTEGER DEFAULT 0,
      maker_rebate REAL DEFAULT 0,
      order_id TEXT,
      status TEXT NOT NULL,
      strategy_id TEXT,
      strategy_name TEXT,
      tags_json TEXT,
      exit_trade_id TEXT,
      entry_trade_id TEXT,
      realized_pnl REAL,
      realized_pnl_pct REAL,
      created_at TEXT NOT NULL,
      filled_at TEXT,
      meta_json TEXT
    )
  `);

  // Migration: add new columns if they don't exist
  try {
    db.run(`ALTER TABLE trades ADD COLUMN is_maker INTEGER DEFAULT 0`);
  } catch { /* column exists */ }
  try {
    db.run(`ALTER TABLE trades ADD COLUMN maker_rebate REAL DEFAULT 0`);
  } catch { /* column exists */ }

  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_platform ON trades(platform)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at)`);

  // Load recent trades into memory
  try {
    const rows = db.query<any>(
      `SELECT * FROM trades WHERE created_at > datetime('now', '-7 days') ORDER BY created_at DESC`
    );
    for (const row of rows) {
      const trade = rowToTrade(row);
      trades.set(trade.id, trade);
    }
    logger.info({ count: trades.size }, 'Loaded recent trades');
  } catch {
    logger.debug('No existing trades');
  }

  function rowToTrade(row: any): Trade {
    return {
      id: row.id,
      platform: row.platform,
      marketId: row.market_id,
      marketQuestion: row.market_question,
      outcome: row.outcome,
      side: row.side,
      orderType: row.order_type,
      price: row.price,
      size: row.size,
      filled: row.filled,
      cost: row.cost,
      fees: row.fees,
      isMaker: row.is_maker === 1,
      makerRebate: row.maker_rebate ?? 0,
      orderId: row.order_id,
      status: row.status,
      strategyId: row.strategy_id,
      strategyName: row.strategy_name,
      tags: row.tags_json ? JSON.parse(row.tags_json) : undefined,
      exitTradeId: row.exit_trade_id,
      entryTradeId: row.entry_trade_id,
      realizedPnL: row.realized_pnl,
      realizedPnLPct: row.realized_pnl_pct,
      createdAt: new Date(row.created_at),
      filledAt: row.filled_at ? new Date(row.filled_at) : undefined,
      meta: row.meta_json ? JSON.parse(row.meta_json) : undefined,
    };
  }

  const MAX_IN_MEMORY_TRADES = 1000;

  function pruneInMemoryTrades(): void {
    if (trades.size > MAX_IN_MEMORY_TRADES) {
      const entries = Array.from(trades.keys());
      const toRemove = entries.slice(0, entries.length - MAX_IN_MEMORY_TRADES);
      for (const key of toRemove) {
        trades.delete(key);
      }
    }
  }

  function saveTrade(trade: Trade): void {
    trades.set(trade.id, trade);
    pruneInMemoryTrades();

    db.run(
      `INSERT OR REPLACE INTO trades
       (id, platform, market_id, market_question, outcome, side, order_type, price, size, filled, cost, fees,
        is_maker, maker_rebate, order_id, status, strategy_id, strategy_name, tags_json, exit_trade_id, entry_trade_id,
        realized_pnl, realized_pnl_pct, created_at, filled_at, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trade.id,
        trade.platform,
        trade.marketId,
        trade.marketQuestion || null,
        trade.outcome,
        trade.side,
        trade.orderType,
        trade.price,
        trade.size,
        trade.filled,
        trade.cost,
        trade.fees ?? null,
        trade.isMaker ? 1 : 0,
        trade.makerRebate ?? 0,
        trade.orderId || null,
        trade.status,
        trade.strategyId || null,
        trade.strategyName || null,
        trade.tags ? JSON.stringify(trade.tags) : null,
        trade.exitTradeId || null,
        trade.entryTradeId || null,
        trade.realizedPnL ?? null,
        trade.realizedPnLPct ?? null,
        trade.createdAt.toISOString(),
        trade.filledAt?.toISOString() || null,
        trade.meta ? JSON.stringify(trade.meta) : null,
      ]
    );
  }

  function generateId(): string {
    return `trade_${randomUUID()}`;
  }

  // Attach methods
  Object.assign(emitter, {
    logTrade(tradeData) {
      const cost = tradeData.cost ?? tradeData.price * tradeData.size;
      const isMaker = tradeData.orderType === 'maker' || tradeData.isMaker === true;

      // Auto-calculate fees if not provided
      let fees = tradeData.fees;
      let makerRebate = tradeData.makerRebate ?? 0;

      if (fees === undefined) {
        const feeCalc = calculateTradeFees(tradeData.platform, cost, isMaker);
        fees = feeCalc.fees;
        makerRebate = feeCalc.makerRebate;
      }

      const trade: Trade = {
        ...tradeData,
        id: generateId(),
        createdAt: new Date(),
        filled: tradeData.filled ?? 0,
        cost,
        fees,
        isMaker,
        makerRebate,
        status: tradeData.status ?? 'pending',
      };

      saveTrade(trade);
      emitter.emit('trade', trade);

      logger.info(
        {
          tradeId: trade.id,
          platform: trade.platform,
          side: trade.side,
          price: trade.price,
          size: trade.size,
          isMaker: trade.isMaker,
          fees: trade.fees,
          makerRebate: trade.makerRebate,
          strategy: trade.strategyName,
        },
        'Trade logged'
      );

      return trade;
    },

    updateTrade(tradeId, updates) {
      const trade = trades.get(tradeId);
      if (!trade) {
        // Try loading from DB
        const rows = db.query<any>(`SELECT * FROM trades WHERE id = ?`, [tradeId]);
        if (rows.length === 0) return null;
        const loaded = rowToTrade(rows[0]);
        trades.set(tradeId, loaded);
        return emitter.updateTrade(tradeId, updates);
      }

      Object.assign(trade, updates);
      saveTrade(trade);
      emitter.emit('tradeUpdated', trade);

      return trade;
    },

    fillTrade(tradeId, filledPrice, filledSize, fees) {
      const trade = trades.get(tradeId);
      if (!trade) return null;

      trade.filled = filledSize;
      trade.cost = filledPrice * filledSize;
      trade.fees = fees;
      trade.status = filledSize >= trade.size ? 'filled' : 'partial';
      trade.filledAt = new Date();

      saveTrade(trade);
      emitter.emit('tradeFilled', trade);

      logger.info(
        { tradeId, filledPrice, filledSize, status: trade.status },
        'Trade filled'
      );

      return trade;
    },

    cancelTrade(tradeId) {
      const trade = trades.get(tradeId);
      if (!trade) return null;

      trade.status = 'cancelled';
      saveTrade(trade);
      emitter.emit('tradeCancelled', trade);

      return trade;
    },

    linkTrades(entryId, exitId, realizedPnL) {
      const entry = trades.get(entryId);
      const exit = trades.get(exitId);

      if (entry) {
        entry.exitTradeId = exitId;
        entry.realizedPnL = realizedPnL;
        entry.realizedPnLPct = entry.cost > 0 ? (realizedPnL / entry.cost) * 100 : 0;
        saveTrade(entry);
      }

      if (exit) {
        exit.entryTradeId = entryId;
        saveTrade(exit);
      }

      emitter.emit('tradesLinked', { entryId, exitId, realizedPnL });
    },

    getTrade(tradeId) {
      return trades.get(tradeId) || null;
    },

    getTrades(filter = {}) {
      let sql = 'SELECT * FROM trades WHERE 1=1';
      const params: SqlBindValue[] = [];

      if (filter.platform) {
        sql += ' AND platform = ?';
        params.push(filter.platform);
      }
      if (filter.marketId) {
        sql += ' AND market_id = ?';
        params.push(filter.marketId);
      }
      if (filter.strategyId) {
        sql += ' AND strategy_id = ?';
        params.push(filter.strategyId);
      }
      if (filter.status) {
        sql += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter.side) {
        sql += ' AND side = ?';
        params.push(filter.side);
      }
      if (filter.startDate) {
        sql += ' AND created_at >= ?';
        params.push(filter.startDate.toISOString());
      }
      if (filter.endDate) {
        sql += ' AND created_at <= ?';
        params.push(filter.endDate.toISOString());
      }

      sql += ' ORDER BY created_at DESC';

      if (filter.limit) {
        sql += ' LIMIT ?';
        params.push(filter.limit);
      }
      if (filter.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }

      const rows = db.query<any>(sql, params);
      return rows.map(rowToTrade);
    },

    getTradesForPosition(platform, marketId, outcome) {
      return emitter.getTrades({ platform, marketId }).filter((t) => t.outcome === outcome);
    },

    getOpenTrades(strategyId) {
      const filter: TradeFilter = { status: 'pending' };
      if (strategyId) filter.strategyId = strategyId;

      const pending = emitter.getTrades(filter);
      const partial = emitter.getTrades({ ...filter, status: 'partial' });

      return [...pending, ...partial];
    },

    getStats(filter = {}) {
      const allTrades = emitter.getTrades(filter);
      const closedTrades = allTrades.filter((t) => t.realizedPnL !== undefined);

      const wins = closedTrades.filter((t) => (t.realizedPnL ?? 0) > 0);
      const losses = closedTrades.filter((t) => (t.realizedPnL ?? 0) < 0);

      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
      const totalWins = wins.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
      const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));

      // By platform
      const byPlatform: Record<string, { trades: number; pnl: number }> = {};
      for (const trade of closedTrades) {
        if (!byPlatform[trade.platform]) {
          byPlatform[trade.platform] = { trades: 0, pnl: 0 };
        }
        byPlatform[trade.platform].trades++;
        byPlatform[trade.platform].pnl += trade.realizedPnL ?? 0;
      }

      // By strategy
      const byStrategy: Record<string, { trades: number; pnl: number; winRate: number }> = {};
      for (const trade of closedTrades) {
        const key = trade.strategyId || 'manual';
        if (!byStrategy[key]) {
          byStrategy[key] = { trades: 0, pnl: 0, winRate: 0 };
        }
        byStrategy[key].trades++;
        byStrategy[key].pnl += trade.realizedPnL ?? 0;
      }
      // Calculate win rates
      for (const key of Object.keys(byStrategy)) {
        const stratTrades = closedTrades.filter((t) => (t.strategyId || 'manual') === key);
        const stratWins = stratTrades.filter((t) => (t.realizedPnL ?? 0) > 0);
        byStrategy[key].winRate = stratTrades.length > 0 ? (stratWins.length / stratTrades.length) * 100 : 0;
      }

      // Calculate maker/taker stats
      const makerTrades = allTrades.filter((t) => t.isMaker);
      const takerTrades = allTrades.filter((t) => !t.isMaker);
      const totalMakerRebates = allTrades.reduce((sum, t) => sum + (t.makerRebate ?? 0), 0);
      const totalFees = allTrades.reduce((sum, t) => sum + (t.fees ?? 0), 0);

      return {
        totalTrades: allTrades.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
        totalPnL,
        avgPnL: closedTrades.length > 0 ? totalPnL / closedTrades.length : 0,
        avgWin: wins.length > 0 ? totalWins / wins.length : 0,
        avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
        largestWin: wins.length > 0 ? Math.max(...wins.map((t) => t.realizedPnL || 0)) : 0,
        largestLoss: losses.length > 0 ? Math.min(...losses.map((t) => t.realizedPnL || 0)) : 0,
        profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
        totalVolume: allTrades.reduce((sum, t) => sum + t.cost, 0),
        totalFees,
        totalMakerRebates,
        netFees: totalFees + totalMakerRebates,
        makerTrades: makerTrades.length,
        takerTrades: takerTrades.length,
        byPlatform: byPlatform as any,
        byStrategy,
      };
    },

    getDailyPnL(days = 30) {
      const rows = db.query<{ date: string; pnl: number; trades: number }>(
        `SELECT
          date(created_at) as date,
          SUM(realized_pnl) as pnl,
          COUNT(*) as trades
         FROM trades
         WHERE realized_pnl IS NOT NULL
           AND created_at > datetime('now', '-' || ? || ' days')
         GROUP BY date(created_at)
         ORDER BY date DESC`,
        [days]
      );

      return rows;
    },

    exportCsv(filter = {}) {
      const allTrades = emitter.getTrades(filter);

      const headers = [
        'id', 'platform', 'market_id', 'market_question', 'outcome', 'side', 'order_type',
        'price', 'size', 'filled', 'cost', 'fees', 'status', 'strategy_id', 'strategy_name',
        'realized_pnl', 'realized_pnl_pct', 'created_at', 'filled_at',
      ];

      function csvEscape(val: unknown): string {
        const s = val == null ? '' : String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }

      const rows = allTrades.map((t) => [
        t.id, t.platform, t.marketId, t.marketQuestion ?? '', t.outcome, t.side, t.orderType,
        t.price, t.size, t.filled, t.cost, t.fees ?? '', t.status, t.strategyId ?? '', t.strategyName ?? '',
        t.realizedPnL ?? '', t.realizedPnLPct ?? '', t.createdAt.toISOString(), t.filledAt?.toISOString() ?? '',
      ]);

      return [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
    },

    cleanup(olderThanDays) {
      // Count trades to be deleted first
      const countRows = db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM trades WHERE created_at < datetime('now', '-' || ? || ' days')`,
        [olderThanDays]
      );
      const count = countRows[0]?.count || 0;

      if (count > 0) {
        db.run(
          `DELETE FROM trades WHERE created_at < datetime('now', '-' || ? || ' days')`,
          [olderThanDays]
        );
      }

      logger.info({ olderThanDays, deleted: count }, 'Cleaned up old trades');
      return count;
    },
  } as Partial<TradeLogger>);

  return emitter;
}
