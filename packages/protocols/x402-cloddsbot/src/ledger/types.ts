/**
 * Trade Ledger - Type Definitions
 *
 * Decision audit trail with confidence calibration for Clodds.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type DecisionCategory =
  | 'trade'
  | 'copy'
  | 'arbitrage'
  | 'opportunity'
  | 'risk'
  | 'tool';

export type DecisionOutcome =
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'blocked'
  | 'executed'
  | 'failed';

export type ConstraintType =
  | 'max_order_size'
  | 'max_exposure'
  | 'max_position'
  | 'min_edge'
  | 'min_liquidity'
  | 'min_win_rate'
  | 'circuit_breaker'
  | 'daily_loss'
  | 'concurrent_positions'
  | 'feature_filter'
  | 'identity_check'
  | 'category_filter'
  | 'custom';

// =============================================================================
// DECISION RECORD
// =============================================================================

export interface ConstraintEvaluation {
  type: ConstraintType | string;
  rule: string;
  threshold?: number;
  actual?: number;
  passed: boolean;
  violation?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionInputs {
  platform?: string;
  market?: string;
  marketId?: string;
  side?: 'buy' | 'sell' | 'long' | 'short';
  size?: number;
  price?: number;
  address?: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DecisionAnalysis {
  observations?: string[];
  factors?: Record<string, unknown>;
  alternativesConsidered?: Array<{
    action: string;
    reasonRejected?: string;
  }>;
  modelUsed?: string;
  [key: string]: unknown;
}

export interface DecisionOutcomeData {
  success?: boolean;
  orderId?: string;
  filledSize?: number;
  avgPrice?: number;
  pnl?: number;
  error?: string;
  txHash?: string;
  [key: string]: unknown;
}

export interface DecisionRecord {
  id: string;
  userId: string;
  sessionId?: string;
  timestamp: number;
  category: DecisionCategory;
  action: string;
  platform?: string;
  marketId?: string;

  // The reasoning
  inputs: DecisionInputs;
  analysis?: DecisionAnalysis;
  constraints: ConstraintEvaluation[];
  confidence?: number; // 0-100

  // Decision
  decision: DecisionOutcome;
  reason: string;

  // Outcome (filled post-execution)
  outcome?: DecisionOutcomeData;
  pnl?: number;
  accurate?: boolean; // Did prediction match outcome?

  // Integrity
  hash?: string;
  anchorTx?: string; // Onchain anchor transaction
}

// =============================================================================
// STATISTICS
// =============================================================================

export interface ConfidenceBucket {
  range: string; // e.g., "80-100"
  min: number;
  max: number;
  count: number;
  accurate: number;
  accuracyRate: number;
}

export interface ConfidenceCalibration {
  buckets: ConfidenceBucket[];
  overallAccuracy: number;
  totalWithOutcome: number;
}

export interface DecisionBreakdown {
  approved: number;
  rejected: number;
  skipped: number;
  blocked: number;
  executed: number;
  failed: number;
}

export interface TopBlockReason {
  reason: string;
  count: number;
}

export interface LedgerStats {
  period: string;
  totalDecisions: number;
  breakdown: DecisionBreakdown;
  byCategory: Record<DecisionCategory, number>;
  topBlockReasons: TopBlockReason[];
  calibration: ConfidenceCalibration;
  avgConfidence?: number;
  pnlTotal?: number;
  winRate?: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface LedgerConfig {
  enabled: boolean;
  captureAll: boolean; // All decisions vs just trades
  hashIntegrity: boolean; // SHA-256 commitment
  retentionDays: number;
  onchainAnchor: boolean;
  anchorChain?: 'solana' | 'polygon' | 'base';
}

export const DEFAULT_LEDGER_CONFIG: LedgerConfig = {
  enabled: false,
  captureAll: false,
  hashIntegrity: false,
  retentionDays: 90,
  onchainAnchor: false,
};

// =============================================================================
// QUERY OPTIONS
// =============================================================================

export interface ListDecisionsOptions {
  limit?: number;
  offset?: number;
  category?: DecisionCategory;
  decision?: DecisionOutcome;
  platform?: string;
  startTime?: number;
  endTime?: number;
}

export interface StatsOptions {
  period?: '24h' | '7d' | '30d' | '90d' | 'all';
  category?: DecisionCategory;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface LedgerService {
  capture(record: Omit<DecisionRecord, 'id' | 'timestamp' | 'hash'>): Promise<string>;
  updateOutcome(id: string, outcome: DecisionOutcomeData): Promise<void>;
  get(id: string): Promise<DecisionRecord | null>;
  list(userId: string, options?: ListDecisionsOptions): Promise<DecisionRecord[]>;
  stats(userId: string, options?: StatsOptions): Promise<LedgerStats>;
  calibration(userId: string): Promise<ConfidenceCalibration>;
  prune(retentionDays: number): Promise<number>;
  export(userId: string, format: 'json' | 'csv'): Promise<string>;
}
