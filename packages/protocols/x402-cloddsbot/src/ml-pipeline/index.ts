/**
 * ML Pipeline — Factory & Re-exports
 *
 * Creates the full pipeline: MLSignalModel + Collector + Trainer.
 * Single entry point for gateway integration.
 */

import type { Database } from '../db/index.js';
import type { SignalRouter } from '../signal-router/router.js';
import type { TradeLogger } from '../trading/logger.js';
import type { MLSignalModel } from '../trading/ml-signals.js';
import { createMLSignalModel } from '../trading/ml-signals.js';
import type { MLPipelineConfig, TrainingStats } from './types.js';
import { DEFAULT_QUALITY_GATES, HORIZON_MS } from './types.js';
import { createMLCollector } from './collector.js';
import { createMLTrainer } from './trainer.js';
import { logger } from '../utils/logger.js';

// ── Re-exports ───────────────────────────────────────────────────────────────

export type { MLPipelineConfig, QualityGates, TrainingStats } from './types.js';
export { combinedToMarketFeatures } from './trainer.js';

// ── Interface ────────────────────────────────────────────────────────────────

export interface MLPipeline {
  start(signalRouter: SignalRouter, tradeLogger: TradeLogger | null): void;
  stop(): void;
  getModel(): MLSignalModel;
  getStats(): TrainingStats;
  trainNow(): Promise<void>;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createMLPipeline(
  db: Database,
  config: MLPipelineConfig,
): MLPipeline {
  const outcomeHorizon = config.outcomeHorizon ?? '1h';
  const labelIntervalMs = config.labelIntervalMs ?? 300_000;
  const trainIntervalMs = config.trainIntervalMs ?? 21_600_000;
  const minTrainingSamples = config.minTrainingSamples ?? 50;
  const cleanupDays = config.cleanupDays ?? 90;
  const modelType = config.modelType ?? 'simple';
  const qualityGates = { ...DEFAULT_QUALITY_GATES, ...config.qualityGates };

  // Create the ML model
  const model = createMLSignalModel({
    type: modelType,
    horizon: outcomeHorizon as '1h' | '4h' | '24h',
    minConfidence: 0.1,
  });

  // Try loading a previously saved model
  const loaded = model.load();
  if (loaded) {
    logger.info('[ml-pipeline] Loaded saved model');
  }

  // Create collector and trainer
  const collector = createMLCollector(db, {
    outcomeHorizon,
    labelIntervalMs,
    cleanupDays,
  });

  const trainer = createMLTrainer(db, model, {
    trainIntervalMs,
    minTrainingSamples,
    outcomeHorizon,
    qualityGates,
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  function start(signalRouter: SignalRouter, tradeLogger: TradeLogger | null): void {
    collector.start(signalRouter, tradeLogger);
    trainer.start();
    logger.info(
      { outcomeHorizon, trainIntervalMs, minTrainingSamples, modelType },
      '[ml-pipeline] Started',
    );
  }

  function stop(): void {
    collector.stop();
    trainer.stop();
    logger.info('[ml-pipeline] Stopped');
  }

  function getModel(): MLSignalModel {
    return model;
  }

  function getStats(): TrainingStats {
    return trainer.getStats();
  }

  async function trainNow(): Promise<void> {
    await trainer.trainNow();
  }

  return { start, stop, getModel, getStats, trainNow };
}
