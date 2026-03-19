/**
 * Trade Ledger - Decision Audit Trail
 *
 * Captures AI reasoning and constraints before trade execution.
 * Tracks confidence calibration and decision accuracy over time.
 *
 * Usage:
 *   import { createLedgerService, initLedger } from './ledger';
 *
 *   // Initialize with config and database
 *   const ledger = createLedgerService(config, db);
 *
 *   // Capture a decision
 *   const id = await ledger.capture({
 *     userId: 'user123',
 *     category: 'trade',
 *     action: 'buy',
 *     inputs: { market: 'BTC', size: 100 },
 *     constraints: [{ type: 'max_exposure', rule: 'Max $5000', passed: true }],
 *     decision: 'approved',
 *     reason: 'All constraints satisfied',
 *     confidence: 75,
 *   });
 *
 *   // Update with outcome
 *   await ledger.updateOutcome(id, { success: true, pnl: 25.50 });
 *
 *   // Query stats
 *   const stats = await ledger.stats('user123', { period: '7d' });
 */

import { EventEmitter } from 'events';
import type {
  LedgerService,
  LedgerConfig,
  DecisionRecord,
  DecisionOutcomeData,
  ListDecisionsOptions,
  StatsOptions,
  LedgerStats,
  ConfidenceCalibration,
  DEFAULT_LEDGER_CONFIG,
} from './types';
import { LedgerStorage, type LedgerDb } from './storage';
import { createLedgerHooks } from './hooks';
import { hashDecision, verifyHash, createCommitment } from './hash';

// Re-export types
export * from './types';
export { hashDecision, verifyHash, createCommitment } from './hash';
export { createAnchorService, verifyAnchor, type AnchorService, type AnchorConfig, type AnchorChain, type AnchorResult } from './anchor';
export {
  captureOpportunityDecision,
  captureCopyDecision,
  captureRiskDecision,
  integrateCopyTrader,
} from './hooks';

// =============================================================================
// LEDGER SERVICE
// =============================================================================

export interface LedgerServiceInstance extends LedgerService, EventEmitter {
  readonly config: LedgerConfig;
  readonly storage: LedgerStorage;
  getHooks(): ReturnType<typeof createLedgerHooks>;
}

/**
 * Create the ledger service
 */
export function createLedgerService(
  config: LedgerConfig,
  db: LedgerDb
): LedgerServiceInstance {
  const storage = new LedgerStorage(db);
  const emitter = new EventEmitter();

  // Initialize schema
  storage.init();

  // Create hooks for auto-capture
  const hooks = createLedgerHooks(storage, config);

  const service: LedgerServiceInstance = Object.assign(emitter, {
    config,
    storage,

    getHooks() {
      return hooks;
    },

    async capture(
      record: Omit<DecisionRecord, 'id' | 'timestamp' | 'hash'>
    ): Promise<string> {
      const id = storage.capture(record, { hashIntegrity: config.hashIntegrity });

      emitter.emit('decision', { id, ...record });

      return id;
    },

    async updateOutcome(id: string, outcome: DecisionOutcomeData): Promise<void> {
      storage.updateOutcome(id, outcome);

      emitter.emit('outcome', { id, outcome });
    },

    async get(id: string): Promise<DecisionRecord | null> {
      return storage.get(id);
    },

    async list(
      userId: string,
      options?: ListDecisionsOptions
    ): Promise<DecisionRecord[]> {
      return storage.list(userId, options);
    },

    async stats(userId: string, options?: StatsOptions): Promise<LedgerStats> {
      return storage.stats(userId, options);
    },

    async calibration(userId: string): Promise<ConfidenceCalibration> {
      return storage.calibration(userId);
    },

    async prune(retentionDays: number): Promise<number> {
      const count = storage.prune(retentionDays);
      emitter.emit('prune', { count, retentionDays });
      return count;
    },

    async export(userId: string, format: 'json' | 'csv'): Promise<string> {
      return storage.export(userId, format);
    },
  });

  return service;
}

// =============================================================================
// INITIALIZATION HELPER
// =============================================================================

let globalLedgerService: LedgerServiceInstance | null = null;

/**
 * Initialize the global ledger service
 */
export function initLedger(config: LedgerConfig, db: LedgerDb): LedgerServiceInstance {
  globalLedgerService = createLedgerService(config, db);
  return globalLedgerService;
}

/**
 * Get the global ledger service (throws if not initialized)
 */
export function getLedger(): LedgerServiceInstance {
  if (!globalLedgerService) {
    throw new Error('Ledger not initialized. Call initLedger() first.');
  }
  return globalLedgerService;
}

/**
 * Check if ledger is initialized and enabled
 */
export function isLedgerEnabled(): boolean {
  return globalLedgerService?.config.enabled ?? false;
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Format a decision record for display
 */
export function formatDecision(record: DecisionRecord): string {
  const time = new Date(record.timestamp).toLocaleString();
  const status = formatDecisionStatus(record.decision);
  const confidence = record.confidence ? ` (${record.confidence}% confidence)` : '';

  let output = `${status} ${record.category}/${record.action} - ${time}${confidence}\n`;
  output += `   ${record.reason}\n`;

  if (record.constraints.length > 0) {
    const passed = record.constraints.filter((c) => c.passed).length;
    const total = record.constraints.length;
    output += `   Constraints: ${passed}/${total} passed\n`;
  }

  if (record.pnl !== undefined) {
    const pnlStr = record.pnl >= 0 ? `+$${record.pnl.toFixed(2)}` : `-$${Math.abs(record.pnl).toFixed(2)}`;
    output += `   P&L: ${pnlStr}\n`;
  }

  return output;
}

function formatDecisionStatus(decision: string): string {
  switch (decision) {
    case 'approved':
    case 'executed':
      return '[APPROVED]';
    case 'rejected':
      return '[REJECTED]';
    case 'blocked':
      return '[BLOCKED]';
    case 'skipped':
      return '[SKIPPED]';
    case 'failed':
      return '[FAILED]';
    default:
      return `[${decision.toUpperCase()}]`;
  }
}

/**
 * Format stats for display
 */
export function formatStats(stats: LedgerStats): string {
  let output = `Decision Intelligence (${stats.period})\n\n`;

  output += `Decisions: ${stats.totalDecisions}\n`;
  output += `├─ Approved: ${stats.breakdown.approved + stats.breakdown.executed}\n`;
  output += `├─ Rejected: ${stats.breakdown.rejected}\n`;
  output += `├─ Blocked: ${stats.breakdown.blocked}\n`;
  output += `└─ Skipped: ${stats.breakdown.skipped}\n\n`;

  if (stats.calibration.totalWithOutcome > 0) {
    output += `Confidence Calibration:\n`;
    for (const bucket of stats.calibration.buckets) {
      if (bucket.count > 0) {
        const mark = bucket.accuracyRate >= 50 ? '✓' : '✗';
        output += `├─ ${bucket.range}%: ${bucket.accuracyRate.toFixed(0)}% accurate ${mark}\n`;
      }
    }
    output += '\n';
  }

  if (stats.topBlockReasons.length > 0) {
    output += `Top Block Reasons:\n`;
    for (const reason of stats.topBlockReasons.slice(0, 5)) {
      output += `├─ ${reason.reason}: ${reason.count}\n`;
    }
    output += '\n';
  }

  if (stats.pnlTotal !== undefined) {
    const pnlStr = stats.pnlTotal >= 0 ? `+$${stats.pnlTotal.toFixed(2)}` : `-$${Math.abs(stats.pnlTotal).toFixed(2)}`;
    output += `Total P&L: ${pnlStr}\n`;
  }

  if (stats.winRate !== undefined) {
    output += `Win Rate: ${stats.winRate.toFixed(1)}%\n`;
  }

  return output;
}
