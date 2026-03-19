/**
 * ML Training Pipeline — Type Definitions
 *
 * Configures the automated learn-from-outcomes loop:
 * capture features at signal time → label via price direction →
 * train periodically with quality gates → feed confidence back.
 */

// ── Configuration ────────────────────────────────────────────────────────────

export interface MLPipelineConfig {
  /** Master switch (default: false) */
  enabled?: boolean;
  /** How long after signal to measure outcome (default: '1h') */
  outcomeHorizon?: '1h' | '4h' | '24h';
  /** Interval for labeling unlabeled samples in ms (default: 300_000 = 5 min) */
  labelIntervalMs?: number;
  /** Interval for training cycle in ms (default: 21_600_000 = 6 hours) */
  trainIntervalMs?: number;
  /** Minimum labeled samples before first training (default: 50) */
  minTrainingSamples?: number;
  /** Model type to use (default: 'simple') */
  modelType?: 'simple' | 'xgboost_python';
  /** Whether signal router uses ML confidence for sizing (default: true) */
  useMLConfidence?: boolean;
  /** Quality gates for model deployment */
  qualityGates?: Partial<QualityGates>;
  /** Delete samples older than N days (default: 90) */
  cleanupDays?: number;
}

// ── Quality Gates ────────────────────────────────────────────────────────────

export interface QualityGates {
  /** Minimum accuracy on holdout set (default: 0.52) */
  minHoldoutAccuracy: number;
  /** Minimum AUC on holdout set (default: 0.55) */
  minHoldoutAUC: number;
  /** Minimum labeled samples to train (default: 50) */
  minTrainingSamples: number;
  /** Max accuracy drop vs previous model before rejecting (default: 0.05) */
  maxAccuracyDrop: number;
}

export const DEFAULT_QUALITY_GATES: QualityGates = {
  minHoldoutAccuracy: 0.52,
  minHoldoutAUC: 0.55,
  minTrainingSamples: 50,
  maxAccuracyDrop: 0.05,
};

// ── Training Stats ───────────────────────────────────────────────────────────

export interface TrainingStats {
  totalSamples: number;
  labeledSamples: number;
  lastTrainTime: number | null;
  lastTrainAccuracy: number | null;
  lastTrainAUC: number | null;
  lastHoldoutAccuracy: number | null;
  modelDeployed: boolean;
  trainCycles: number;
  deployedCycles: number;
  rejectedCycles: number;
}

// ── Outcome horizons in ms ───────────────────────────────────────────────────

export const HORIZON_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};
