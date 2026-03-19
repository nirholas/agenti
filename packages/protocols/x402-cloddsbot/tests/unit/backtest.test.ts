/**
 * Backtest Engine Tests
 *
 * Tests the backtest engine: metrics calculation, tick replay,
 * Monte Carlo simulation, strategy evaluation, and edge cases.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// HELPERS
// ============================================================================

/** Minimal in-memory database mock for backtest engine */
function createMockDb() {
  const tables = new Map<string, any[]>();
  return {
    run(sql: string, params?: any[]) {
      const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (createMatch) {
        if (!tables.has(createMatch[1])) tables.set(createMatch[1], []);
        return;
      }
      if (sql.startsWith('CREATE INDEX')) return;
      if (sql.includes('INSERT')) {
        const tableMatch = sql.match(/INTO\s+(\w+)/);
        if (tableMatch) {
          const rows = tables.get(tableMatch[1]) || [];
          rows.push(params);
          tables.set(tableMatch[1], rows);
        }
        return;
      }
    },
    query<T>(sql: string, _params?: any[]): T[] {
      // Return mock trade data if querying trades
      if (sql.includes('trades') && sql.includes('ORDER BY')) {
        return (tables.get('_trades') || []) as T[];
      }
      return [] as T[];
    },
    _tables: tables,
    _setTrades(trades: any[]) {
      tables.set('_trades', trades);
    },
    close() {},
    save() {},
    withConnection: async <T>(fn: (db: any) => T) => fn({} as any),
    backupNow() {},
    getVersion: () => 1,
    setVersion: () => {},
    getPositions: () => [],
  };
}

function makeTick(price: number, timeOffset: number, base = new Date('2025-01-01T00:00:00Z')): any {
  return {
    time: new Date(base.getTime() + timeOffset),
    platform: 'polymarket' as const,
    marketId: 'test-market',
    outcomeId: 'yes',
    price,
    prevPrice: null,
  };
}

function makeOrderbookSnapshot(timeOffset: number, midPrice: number, base = new Date('2025-01-01T00:00:00Z')): any {
  return {
    time: new Date(base.getTime() + timeOffset),
    platform: 'polymarket',
    marketId: 'test-market',
    outcomeId: 'yes',
    bids: [[midPrice - 0.01, 100], [midPrice - 0.02, 200]] as Array<[number, number]>,
    asks: [[midPrice + 0.01, 100], [midPrice + 0.02, 200]] as Array<[number, number]>,
    spread: 0.02,
    midPrice,
  };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

describe('backtest engine', () => {
  let createBacktestEngine: any;

  beforeEach(async () => {
    const mod = await import('../../src/trading/backtest.js');
    createBacktestEngine = mod.createBacktestEngine;
  });

  it('creates engine with all methods', () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    assert.equal(typeof engine.run, 'function');
    assert.equal(typeof engine.runWithData, 'function');
    assert.equal(typeof engine.runWithTicks, 'function');
    assert.equal(typeof engine.runFromTickRecorder, 'function');
    assert.equal(typeof engine.compare, 'function');
    assert.equal(typeof engine.monteCarlo, 'function');
    assert.equal(typeof engine.loadHistoricalData, 'function');
  });

  it('returns empty result for no ticks', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    const strategy = {
      config: { id: 'test', name: 'Test', platforms: ['polymarket'] },
      async evaluate() { return []; },
    };

    const result = await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0.1,
      slippagePct: 0.05,
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 0,
      priceHistorySize: 200,
      includeOrderbook: false,
    }, []);

    assert.equal(result.strategyId, 'test');
    assert.equal(result.metrics.totalTrades, 0);
    assert.equal(result.metrics.finalEquity, 10000);
    assert.equal(result.trades.length, 0);
    assert.equal(result.equityCurve.length, 0);
  });

  it('executes buy-and-hold strategy on tick data', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    // Generate rising price ticks (10 ticks, 5 seconds apart)
    const ticks = [];
    for (let i = 0; i < 10; i++) {
      ticks.push(makeTick(0.50 + i * 0.01, i * 5000));
    }

    const strategy = {
      config: { id: 'buy-hold', name: 'Buy Hold', platforms: ['polymarket'] },
      async evaluate(ctx: any) {
        if (ctx.positions.size === 0 && ctx.availableBalance > 10) {
          const ph = ctx.priceHistory.values().next().value as number[] | undefined;
          const price = ph?.[ph.length - 1] ?? 0.5;
          return [{
            type: 'buy' as const,
            platform: 'polymarket',
            marketId: 'test-market',
            outcome: 'yes',
            price,
            size: Math.floor(ctx.availableBalance * 0.9 / price),
            confidence: 1,
            reason: 'Buy and hold',
          }];
        }
        return [];
      },
    };

    const result = await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0,
      slippagePct: 0,
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 0,
      priceHistorySize: 200,
      includeOrderbook: false,
    }, ticks);

    assert.equal(result.strategyId, 'buy-hold');
    assert.ok(result.trades.length >= 1, 'Should have at least one trade');
    assert.equal(result.trades[0].side, 'buy');
    // Price went from 0.50 to 0.59, so equity should be > initial
    assert.ok(result.metrics.finalEquity > 10000, `Final equity ${result.metrics.finalEquity} should be > 10000`);
  });

  it('handles buy and sell signals correctly', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    // Price goes up then back down
    const ticks = [
      makeTick(0.50, 0),
      makeTick(0.55, 5000),
      makeTick(0.60, 10000),
      makeTick(0.55, 15000),
      makeTick(0.50, 20000),
    ];

    let bought = false;
    const strategy = {
      config: { id: 'buy-sell', name: 'Buy Sell', platforms: ['polymarket'] },
      async evaluate(ctx: any) {
        const ph = ctx.priceHistory.values().next().value as number[] | undefined;
        const price = ph?.[ph.length - 1] ?? 0.5;
        const posKey = 'polymarket:test-market:yes';

        // Buy at first tick
        if (!bought && ctx.positions.size === 0) {
          bought = true;
          return [{
            type: 'buy' as const,
            platform: 'polymarket',
            marketId: 'test-market',
            outcome: 'yes',
            price,
            size: 100,
            confidence: 1,
            reason: 'Entry',
          }];
        }

        // Sell when price hits 0.60
        const pos = ctx.positions.get(posKey);
        if (pos && price >= 0.59) {
          return [{
            type: 'sell' as const,
            platform: 'polymarket',
            marketId: 'test-market',
            outcome: 'yes',
            size: pos.shares,
            reason: 'Exit at target',
          }];
        }

        return [];
      },
    };

    const result = await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0,
      slippagePct: 0,
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 0,
      priceHistorySize: 200,
      includeOrderbook: false,
    }, ticks);

    // Should have 1 buy + 1 sell
    assert.equal(result.trades.length, 2);
    assert.equal(result.trades[0].side, 'buy');
    assert.equal(result.trades[1].side, 'sell');
    // Sold at 0.60, bought at 0.50 → profit
    assert.ok(result.trades[1].pnl! > 0, 'Sell trade should have positive PnL');
  });

  it('respects eval interval', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    // 10 ticks, 1 second apart
    const ticks = [];
    for (let i = 0; i < 10; i++) {
      ticks.push(makeTick(0.50, i * 1000));
    }

    let evalCount = 0;
    const strategy = {
      config: { id: 'counter', name: 'Counter', platforms: ['polymarket'] },
      async evaluate() {
        evalCount++;
        return [];
      },
    };

    await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0,
      slippagePct: 0,
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 3000, // Evaluate every 3 seconds
      priceHistorySize: 200,
      includeOrderbook: false,
    }, ticks);

    // 10 seconds of data, eval every 3s → should eval ~3-4 times (at 0, 3, 6, 9s)
    assert.ok(evalCount >= 3 && evalCount <= 5,
      `Expected 3-5 evaluations, got ${evalCount}`);
  });

  it('applies commission and slippage', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    const ticks = [makeTick(0.50, 0), makeTick(0.50, 5000)];

    const strategy = {
      config: { id: 'commission-test', name: 'Test', platforms: ['polymarket'] },
      async evaluate(ctx: any) {
        if (ctx.positions.size === 0) {
          return [{
            type: 'buy' as const,
            platform: 'polymarket',
            marketId: 'test-market',
            outcome: 'yes',
            size: 100,
            confidence: 1,
            reason: 'Buy',
          }];
        }
        return [];
      },
    };

    const result = await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 1, // 1%
      slippagePct: 0.5, // 0.5%
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 0,
      priceHistorySize: 200,
      includeOrderbook: false,
    }, ticks);

    assert.equal(result.trades.length, 1);
    const trade = result.trades[0];
    // 100 shares * 0.50 = $50 notional
    // Commission = 50 * 0.01 = 0.50
    // Slippage = 50 * 0.005 = 0.25
    assert.ok(trade.commission > 0, 'Commission should be positive');
    assert.ok(trade.slippage > 0, 'Slippage should be positive');
    assert.ok(result.metrics.totalCommission > 0, 'Total commission should be tracked');
    assert.ok(result.metrics.totalSlippage > 0, 'Total slippage should be tracked');
  });

  it('finds orderbook snapshots via binary search', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    // Tick at 30s
    const ticks = [makeTick(0.50, 30_000)];

    // Orderbook at 25s (within 60s window — should be found)
    const orderbooks = [makeOrderbookSnapshot(25_000, 0.50)];

    let receivedOrderbook = false;
    const strategy = {
      config: { id: 'ob-test', name: 'OB Test', platforms: ['polymarket'] },
      async evaluate(ctx: any) {
        if ((ctx as any).orderbook) {
          receivedOrderbook = true;
        }
        return [];
      },
    };

    await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0,
      slippagePct: 0,
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 0,
      priceHistorySize: 200,
      includeOrderbook: true,
    }, ticks, orderbooks);

    assert.ok(receivedOrderbook, 'Strategy should receive orderbook data');
  });

  it('calls strategy init and cleanup', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    const ticks = [makeTick(0.50, 0)];
    let initCalled = false;
    let cleanupCalled = false;

    const strategy = {
      config: { id: 'lifecycle', name: 'Lifecycle', platforms: ['polymarket'] },
      async init() { initCalled = true; },
      async evaluate() { return []; },
      async cleanup() { cleanupCalled = true; },
    };

    await engine.runWithTicks(strategy, {
      platform: 'polymarket',
      marketId: 'test-market',
      outcomeId: 'yes',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0,
      slippagePct: 0,
      resolutionMs: 0,
      riskFreeRate: 5,
      evalIntervalMs: 0,
      priceHistorySize: 200,
      includeOrderbook: false,
    }, ticks);

    assert.ok(initCalled, 'init should be called');
    assert.ok(cleanupCalled, 'cleanup should be called');
  });
});

// ============================================================================
// MONTE CARLO
// ============================================================================

describe('backtest monte carlo', () => {
  let createBacktestEngine: any;

  beforeEach(async () => {
    const mod = await import('../../src/trading/backtest.js');
    createBacktestEngine = mod.createBacktestEngine;
  });

  it('runs monte carlo simulation', () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    // Create a mock backtest result with daily returns
    const mockResult = {
      strategyId: 'test',
      config: {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        initialCapital: 10000,
        commissionPct: 0,
        slippagePct: 0,
        resolutionMs: 0,
        riskFreeRate: 5,
      },
      metrics: {} as any,
      trades: [],
      equityCurve: [],
      dailyReturns: [
        { date: '2025-01-01', return: 0.02 },
        { date: '2025-01-02', return: -0.01 },
        { date: '2025-01-03', return: 0.03 },
        { date: '2025-01-04', return: -0.005 },
        { date: '2025-01-05', return: 0.01 },
      ],
      drawdowns: [],
    };

    const mc = engine.monteCarlo(mockResult, 100);

    assert.equal(mc.simulations, 100);
    assert.ok('p5' in mc.percentiles);
    assert.ok('p25' in mc.percentiles);
    assert.ok('p50' in mc.percentiles);
    assert.ok('p75' in mc.percentiles);
    assert.ok('p95' in mc.percentiles);
    assert.ok(mc.probabilityOfProfit >= 0 && mc.probabilityOfProfit <= 1);
    assert.ok(mc.probabilityOfMajorLoss >= 0 && mc.probabilityOfMajorLoss <= 1);
    assert.equal(typeof mc.expectedValue, 'number');
    // With mostly positive returns, probability of profit should be high
    assert.ok(mc.probabilityOfProfit > 0.3, 'Should have reasonable probability of profit');
  });

  it('handles empty returns', () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    const mockResult = {
      strategyId: 'empty',
      config: { initialCapital: 10000 } as any,
      metrics: {} as any,
      trades: [],
      equityCurve: [],
      dailyReturns: [],
      drawdowns: [],
    };

    const mc = engine.monteCarlo(mockResult, 10);

    assert.equal(mc.simulations, 10);
    // With no returns, all outcomes should be 0
    assert.equal(mc.expectedValue, 0);
  });
});

// ============================================================================
// METRICS CALCULATION (via runWithData)
// ============================================================================

describe('backtest metrics', () => {
  let createBacktestEngine: any;

  beforeEach(async () => {
    const mod = await import('../../src/trading/backtest.js');
    createBacktestEngine = mod.createBacktestEngine;
  });

  it('calculates correct metrics for winning trades', async () => {
    const db = createMockDb();
    const engine = createBacktestEngine(db);

    // Simple rising price data
    const data = new Map<string, any[]>();
    const bars = [];
    for (let i = 0; i < 24; i++) {
      const ts = new Date('2025-01-01T00:00:00Z');
      ts.setHours(i);
      bars.push({
        timestamp: ts,
        open: 0.50 + i * 0.005,
        high: 0.50 + i * 0.005 + 0.002,
        low: 0.50 + i * 0.005 - 0.002,
        close: 0.50 + i * 0.005,
        volume: 1000,
      });
    }
    data.set('polymarket:test-market', bars);

    let bought = false;
    let soldAt10 = false;
    const strategy = {
      config: {
        id: 'rising',
        name: 'Rising',
        platforms: ['polymarket'],
        markets: ['test-market'],
      },
      async evaluate(ctx: any) {
        const posKey = 'polymarket:test-market:yes';
        const pos = ctx.positions.get(posKey);
        if (!bought) {
          bought = true;
          return [{
            type: 'buy' as const,
            platform: 'polymarket',
            marketId: 'test-market',
            outcome: 'yes',
            size: 100,
            confidence: 1,
            reason: 'Buy',
          }];
        }
        if (pos && pos.shares > 0 && !soldAt10) {
          // Sell after some time
          soldAt10 = true;
          return [{
            type: 'sell' as const,
            platform: 'polymarket',
            marketId: 'test-market',
            outcome: 'yes',
            size: pos.shares,
            reason: 'Sell',
          }];
        }
        return [];
      },
    };

    const result = await engine.runWithData(strategy, {
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
      initialCapital: 10000,
      commissionPct: 0,
      slippagePct: 0,
      resolutionMs: 3600_000,
      riskFreeRate: 5,
    }, data);

    assert.equal(result.strategyId, 'rising');
    assert.ok(result.metrics.totalTrades >= 2, 'Should have at least buy+sell');
    assert.ok(result.equityCurve.length > 0, 'Should have equity curve');
  });
});

// ============================================================================
// BUILT-IN STRATEGIES
// ============================================================================

describe('built-in strategies', () => {
  let createMeanReversionStrategy: any;
  let createMomentumStrategy: any;

  beforeEach(async () => {
    const mod = await import('../../src/trading/bots/index.js');
    createMeanReversionStrategy = mod.createMeanReversionStrategy;
    createMomentumStrategy = mod.createMomentumStrategy;
  });

  it('mean reversion strategy has correct config', () => {
    const strategy = createMeanReversionStrategy();
    assert.equal(strategy.config.id, 'mean-reversion');
    assert.equal(typeof strategy.evaluate, 'function');
    assert.equal(strategy.config.params.lookbackPeriod, 20);
    assert.equal(strategy.config.params.entryThreshold, 2);
  });

  it('momentum strategy has correct config', () => {
    const strategy = createMomentumStrategy();
    assert.equal(strategy.config.id, 'momentum');
    assert.equal(typeof strategy.evaluate, 'function');
    assert.equal(strategy.config.params.shortPeriod, 5);
    assert.equal(strategy.config.params.longPeriod, 20);
  });

  it('strategies accept custom params', () => {
    const mr = createMeanReversionStrategy({
      params: { lookbackPeriod: 50, entryThreshold: 3 },
    });
    assert.equal(mr.config.params.lookbackPeriod, 50);
    assert.equal(mr.config.params.entryThreshold, 3);

    const mom = createMomentumStrategy({
      params: { shortPeriod: 10, longPeriod: 40 },
    });
    assert.equal(mom.config.params.shortPeriod, 10);
    assert.equal(mom.config.params.longPeriod, 40);
  });
});
