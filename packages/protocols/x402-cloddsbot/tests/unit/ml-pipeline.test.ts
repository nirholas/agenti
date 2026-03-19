/**
 * ML Pipeline Tests
 *
 * Tests the collector, trainer, feature conversion, and signal router ML integration.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';

// ============================================================================
// HELPERS
// ============================================================================

/** Minimal in-memory database mock */
function createMockDb() {
  const tables = new Map<string, any[]>();
  return {
    run(sql: string, params?: any[]) {
      // Track CREATE TABLE
      const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (createMatch) {
        const name = createMatch[1];
        if (!tables.has(name)) tables.set(name, []);
        return;
      }
      // Track CREATE INDEX (no-op)
      if (sql.startsWith('CREATE INDEX')) return;
      // Track INSERT
      if (sql.includes('INSERT')) {
        const tableMatch = sql.match(/INTO\s+(\w+)/);
        if (tableMatch) {
          const name = tableMatch[1];
          const rows = tables.get(name) || [];
          rows.push(params);
          tables.set(name, rows);
        }
        return;
      }
      // Track UPDATE
      if (sql.includes('UPDATE')) {
        // For labeling updates
        return;
      }
      // Track DELETE
      if (sql.includes('DELETE')) return;
    },
    query<T>(sql: string, params?: any[]): T[] {
      // Return empty for ml_training_samples queries by default
      if (sql.includes('ml_training_samples') && sql.includes('COUNT')) {
        return [{ total: tables.get('ml_training_samples')?.length ?? 0, labeled: 0 }] as T[];
      }
      if (sql.includes('ml_training_samples') && sql.includes('outcome_direction IS NULL')) {
        return [] as T[];
      }
      if (sql.includes('ml_training_samples') && sql.includes('outcome_direction IS NOT NULL')) {
        return [] as T[];
      }
      return [] as T[];
    },
    _tables: tables,
    close() {},
    save() {},
    withConnection: async <T>(fn: (db: any) => T) => fn({} as any),
    backupNow() {},
    getVersion: () => 1,
    setVersion: () => {},
  };
}

function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    type: 'momentum' as const,
    platform: 'polymarket',
    marketId: 'test-market-1',
    outcomeId: 'outcome-yes',
    strength: 0.7,
    direction: 'buy' as const,
    features: { momentum: 0.05 },
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: `sr-${Date.now()}-1`,
    signal: makeSignal(),
    status: 'dry_run' as const,
    orderSize: 10,
    orderPrice: 0.45,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeBus() {
  const bus = new EventEmitter() as any;
  bus.connectFeeds = () => {};
  bus.disconnectFeeds = () => {};
  bus.onTick = () => {};
  bus.onOrderbook = () => {};
  bus.onSignal = (handler: (...args: any[]) => void) => bus.on('signal', handler);
  return bus;
}

// ============================================================================
// TYPES
// ============================================================================

describe('ml-pipeline types', () => {
  it('exports default quality gates', async () => {
    const { DEFAULT_QUALITY_GATES, HORIZON_MS } = await import('../../src/ml-pipeline/types.js');

    assert.equal(DEFAULT_QUALITY_GATES.minHoldoutAccuracy, 0.52);
    assert.equal(DEFAULT_QUALITY_GATES.minHoldoutAUC, 0.55);
    assert.equal(DEFAULT_QUALITY_GATES.minTrainingSamples, 50);
    assert.equal(DEFAULT_QUALITY_GATES.maxAccuracyDrop, 0.05);

    assert.equal(HORIZON_MS['1h'], 3_600_000);
    assert.equal(HORIZON_MS['4h'], 14_400_000);
    assert.equal(HORIZON_MS['24h'], 86_400_000);
  });
});

// ============================================================================
// FEATURE CONVERSION
// ============================================================================

describe('combinedToMarketFeatures', () => {
  let combinedToMarketFeatures: any;

  beforeEach(async () => {
    const mod = await import('../../src/ml-pipeline/trainer.js');
    combinedToMarketFeatures = mod.combinedToMarketFeatures;
  });

  it('handles null combined features', () => {
    const result = combinedToMarketFeatures(null);

    assert.equal(result.price.current, 0.5);
    assert.equal(result.price.rsi14, 50);
    assert.equal(result.volume.buyRatio, 0.5);
    assert.equal(result.orderbook.bidAskRatio, 1);
    assert.equal(result.market.category, 'other');
  });

  it('maps tick features correctly', () => {
    const combined = {
      timestamp: Date.now(),
      platform: 'polymarket',
      marketId: 'test',
      outcomeId: 'yes',
      tick: {
        timestamp: Date.now(),
        platform: 'polymarket',
        marketId: 'test',
        outcomeId: 'yes',
        price: 0.65,
        priceChange: 0.05,
        priceChangePct: 0.08,
        momentum: 0.03,
        velocity: 0.01,
        volatility: 0.02,
        volatilityPct: 0.04,
        tickCount: 50,
        tickIntensity: 2,
        vwap: null,
      },
      orderbook: null,
      signals: { buyPressure: 0.7, sellPressure: 0.3, trendStrength: 0.2, liquidityScore: 0.8 },
    };

    const result = combinedToMarketFeatures(combined);

    assert.equal(result.price.current, 0.65);
    assert.equal(result.price.change1h, 0.08);
    assert.equal(result.price.momentum, 0.03);
    assert.equal(result.price.volatility24h, 0.04);
    assert.equal(result.volume.buyRatio, 0.7);
  });

  it('maps orderbook features correctly', () => {
    const combined = {
      timestamp: Date.now(),
      platform: 'polymarket',
      marketId: 'test',
      outcomeId: 'yes',
      tick: null,
      orderbook: {
        timestamp: Date.now(),
        platform: 'polymarket',
        marketId: 'test',
        outcomeId: 'yes',
        spread: 0.02,
        spreadPct: 3.0,
        midPrice: 0.50,
        bidDepth: 1000,
        askDepth: 800,
        totalDepth: 1800,
        imbalance: 0.11,
        imbalanceRatio: 1.25,
        bestBid: 0.49,
        bestAsk: 0.51,
        bestBidSize: 100,
        bestAskSize: 80,
        weightedBidPrice: 0.48,
        weightedAskPrice: 0.52,
        bidDepthAt1Pct: 200,
        askDepthAt1Pct: 150,
        bidDepthAt5Pct: 500,
        askDepthAt5Pct: 400,
      },
      signals: { buyPressure: 0.5, sellPressure: 0.5, trendStrength: 0, liquidityScore: 0.9 },
    };

    const result = combinedToMarketFeatures(combined);

    assert.equal(result.price.current, 0.50);  // Falls back to midPrice
    assert.equal(result.orderbook.imbalanceScore, 0.11);
    assert.equal(result.orderbook.spreadPct, 3.0);
    assert.equal(result.orderbook.bidAskRatio, 1000 / 800);
    assert.equal(result.orderbook.depth10Pct, 500 + 400);
  });
});

// ============================================================================
// COLLECTOR
// ============================================================================

describe('ml collector', () => {
  let createMLCollector: any;

  beforeEach(async () => {
    const mod = await import('../../src/ml-pipeline/collector.js');
    createMLCollector = mod.createMLCollector;
  });

  it('creates ml_training_samples table on init', () => {
    const db = createMockDb();
    createMLCollector(db, { outcomeHorizon: '1h', labelIntervalMs: 300_000, cleanupDays: 90 });

    assert.ok(db._tables.has('ml_training_samples'));
  });

  it('captures signal on executed event', () => {
    const db = createMockDb();
    const collector = createMLCollector(db, {
      outcomeHorizon: '1h',
      labelIntervalMs: 300_000,
      cleanupDays: 90,
    });

    // Create a mock signal router (EventEmitter)
    const router = new EventEmitter() as any;
    router.on = router.on.bind(router);
    collector.start(router, null);

    // Emit an executed signal
    router.emit('executed', makeExecution());

    const samples = db._tables.get('ml_training_samples') || [];
    assert.equal(samples.length, 1);

    collector.stop();
  });

  it('captures signal on dry_run event', () => {
    const db = createMockDb();
    const collector = createMLCollector(db, {
      outcomeHorizon: '1h',
      labelIntervalMs: 300_000,
      cleanupDays: 90,
    });

    const router = new EventEmitter() as any;
    collector.start(router, null);

    router.emit('dry_run', makeExecution({ status: 'dry_run' }));

    const samples = db._tables.get('ml_training_samples') || [];
    assert.equal(samples.length, 1);

    collector.stop();
  });

  it('returns sample counts', () => {
    const db = createMockDb();
    const collector = createMLCollector(db, {
      outcomeHorizon: '1h',
      labelIntervalMs: 300_000,
      cleanupDays: 90,
    });

    const counts = collector.getSampleCount();
    assert.equal(counts.total, 0);
    assert.equal(counts.labeled, 0);
    assert.equal(counts.unlabeled, 0);
  });

  it('stops cleanly', () => {
    const db = createMockDb();
    const collector = createMLCollector(db, {
      outcomeHorizon: '1h',
      labelIntervalMs: 300_000,
      cleanupDays: 90,
    });

    const router = new EventEmitter() as any;
    collector.start(router, null);
    collector.stop();

    // Should not throw
    router.emit('executed', makeExecution());
  });
});

// ============================================================================
// TRAINER
// ============================================================================

describe('ml trainer', () => {
  let createMLTrainer: any;
  let createMLSignalModel: any;

  beforeEach(async () => {
    const trainerMod = await import('../../src/ml-pipeline/trainer.js');
    createMLTrainer = trainerMod.createMLTrainer;

    const mlMod = await import('../../src/trading/ml-signals.js');
    createMLSignalModel = mlMod.createMLSignalModel;
  });

  it('creates trainer with stats', () => {
    const db = createMockDb();
    const model = createMLSignalModel({ type: 'simple', horizon: '1h', minConfidence: 0.1 });

    const trainer = createMLTrainer(db, model, {
      trainIntervalMs: 60_000,
      minTrainingSamples: 10,
      outcomeHorizon: '1h',
      qualityGates: {
        minHoldoutAccuracy: 0.52,
        minHoldoutAUC: 0.55,
        minTrainingSamples: 10,
        maxAccuracyDrop: 0.05,
      },
    });

    const stats = trainer.getStats();
    assert.equal(stats.totalSamples, 0);
    assert.equal(stats.labeledSamples, 0);
    assert.equal(stats.trainCycles, 0);
    assert.equal(stats.modelDeployed, false);
    assert.equal(stats.lastTrainTime, null);
  });

  it('skips training with too few samples', async () => {
    const db = createMockDb();
    const model = createMLSignalModel({ type: 'simple', horizon: '1h', minConfidence: 0.1 });

    const trainer = createMLTrainer(db, model, {
      trainIntervalMs: 60_000,
      minTrainingSamples: 50,
      outcomeHorizon: '1h',
      qualityGates: {
        minHoldoutAccuracy: 0.52,
        minHoldoutAUC: 0.55,
        minTrainingSamples: 50,
        maxAccuracyDrop: 0.05,
      },
    });

    await trainer.trainNow();

    const stats = trainer.getStats();
    assert.equal(stats.trainCycles, 0);  // Didn't train
    assert.equal(stats.lastTrainTime, null);
  });

  it('starts and stops cleanly', () => {
    const db = createMockDb();
    const model = createMLSignalModel({ type: 'simple', horizon: '1h', minConfidence: 0.1 });

    const trainer = createMLTrainer(db, model, {
      trainIntervalMs: 60_000,
      minTrainingSamples: 10,
      outcomeHorizon: '1h',
      qualityGates: {
        minHoldoutAccuracy: 0.52,
        minHoldoutAUC: 0.55,
        minTrainingSamples: 10,
        maxAccuracyDrop: 0.05,
      },
    });

    trainer.start();
    trainer.stop();
    // Should not throw
  });
});

// ============================================================================
// PIPELINE FACTORY
// ============================================================================

describe('ml pipeline factory', () => {
  let createMLPipeline: any;

  beforeEach(async () => {
    const mod = await import('../../src/ml-pipeline/index.js');
    createMLPipeline = mod.createMLPipeline;
  });

  it('creates pipeline with model', () => {
    const db = createMockDb();
    const pipeline = createMLPipeline(db, { enabled: true });

    assert.ok(pipeline.getModel());
    assert.equal(typeof pipeline.getModel().predict, 'function');
    assert.equal(typeof pipeline.getModel().train, 'function');
    assert.equal(typeof pipeline.getModel().save, 'function');
    assert.equal(typeof pipeline.getModel().load, 'function');
  });

  it('returns stats', () => {
    const db = createMockDb();
    const pipeline = createMLPipeline(db, { enabled: true });

    const stats = pipeline.getStats();
    assert.equal(stats.totalSamples, 0);
    assert.equal(stats.trainCycles, 0);
    assert.equal(stats.modelDeployed, false);
  });

  it('starts and stops with signal router', () => {
    const db = createMockDb();
    const pipeline = createMLPipeline(db, { enabled: true });

    const router = new EventEmitter() as any;
    pipeline.start(router, null);
    pipeline.stop();
    // Should not throw
  });
});

// ============================================================================
// SIGNAL ROUTER + ML MODEL
// ============================================================================

describe('signal router with ML model', () => {
  let createSignalRouter: any;

  beforeEach(async () => {
    const mod = await import('../../src/signal-router/router.js');
    createSignalRouter = mod.createSignalRouter;
  });

  it('accepts optional mlModel parameter', () => {
    const router = createSignalRouter(null, { enabled: true, dryRun: true }, null, null);
    assert.ok(router);
    assert.equal(typeof router.start, 'function');
  });

  it('works without mlModel (backward compatible)', () => {
    const router = createSignalRouter(null, { enabled: true, dryRun: true });
    assert.ok(router);
    const bus = makeBus();
    router.start(bus);
    router.stop();
  });
});
