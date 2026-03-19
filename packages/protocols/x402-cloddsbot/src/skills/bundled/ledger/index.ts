/**
 * Trade Ledger Skill
 *
 * Chat commands for viewing decision audit trail and statistics.
 */

import { createDatabase } from '../../../db';
import { createMigrationRunner } from '../../../db/migrations';
import { LedgerStorage, type LedgerDb } from '../../../ledger/storage';
import { formatDecision, formatStats } from '../../../ledger/index';
import type { DecisionCategory, DecisionOutcome } from '../../../ledger/types';
import { logger } from '../../../utils/logger';

// =============================================================================
// DATABASE HELPER
// =============================================================================

function withDb<T>(fn: (storage: LedgerStorage) => T): T {
  const db = createDatabase();
  createMigrationRunner(db).migrate();
  try {
    const storage = new LedgerStorage(db as unknown as LedgerDb);
    storage.init();
    return fn(storage);
  } finally {
    db.close();
  }
}

// =============================================================================
// HANDLERS
// =============================================================================

function handleList(userId: string, args: string[]): string {
  const limit = parseInt(args.find(a => /^\d+$/.test(a)) || '10', 10);
  const category = args.find(a => ['trade', 'copy', 'arbitrage', 'risk', 'opportunity', 'tool'].includes(a)) as DecisionCategory | undefined;
  const decision = args.find(a => ['approved', 'rejected', 'blocked', 'skipped', 'executed', 'failed'].includes(a)) as DecisionOutcome | undefined;

  return withDb(storage => {
    const records = storage.list(userId, { limit, category, decision });

    if (records.length === 0) {
      return 'No decisions recorded yet.';
    }

    const lines = [`**Recent Decisions** (${records.length})`, ''];
    for (const record of records.slice(0, 15)) {
      lines.push(formatDecision(record));
    }

    if (records.length > 15) {
      lines.push(`...and ${records.length - 15} more`);
    }

    return lines.join('\n');
  });
}

function handleStats(userId: string, args: string[]): string {
  const period = (args.find(a => ['24h', '7d', '30d', '90d', 'all'].includes(a)) || '7d') as '24h' | '7d' | '30d' | '90d' | 'all';
  const category = args.find(a => ['trade', 'copy', 'arbitrage', 'risk', 'opportunity', 'tool'].includes(a)) as DecisionCategory | undefined;

  return withDb(storage => {
    const stats = storage.stats(userId, { period, category });
    return formatStats(stats);
  });
}

function handleCalibration(userId: string): string {
  return withDb(storage => {
    const cal = storage.calibration(userId);

    const lines = [
      '**Confidence Calibration**',
      '',
      `Overall accuracy: ${cal.overallAccuracy.toFixed(1)}%`,
      `Decisions with outcome: ${cal.totalWithOutcome}`,
      '',
    ];

    if (cal.totalWithOutcome > 0) {
      lines.push('By confidence bucket:');
      for (const bucket of cal.buckets) {
        if (bucket.count > 0) {
          const bar = '\u2588'.repeat(Math.round(bucket.accuracyRate / 10));
          lines.push(`  ${bucket.range.padEnd(8)} ${bucket.accuracyRate.toFixed(0).padStart(3)}% ${bar} (${bucket.count})`);
        }
      }
    } else {
      lines.push('No decisions with outcomes yet.');
      lines.push('Outcomes are recorded after trades settle.');
    }

    return lines.join('\n');
  });
}

function handleGet(userId: string, id: string): string {
  if (!id) {
    return 'Usage: /ledger get <id>';
  }

  return withDb(storage => {
    const record = storage.get(id);

    if (!record) {
      return `Decision ${id} not found`;
    }

    const lines = [
      `**Decision ${record.id.slice(0, 8)}**`,
      '',
      `Category: ${record.category}`,
      `Action: ${record.action}`,
      `Decision: ${record.decision}`,
      `Reason: ${record.reason}`,
      '',
      `Time: ${new Date(record.timestamp).toLocaleString()}`,
      record.platform ? `Platform: ${record.platform}` : '',
      record.marketId ? `Market: ${record.marketId}` : '',
      record.confidence !== undefined ? `Confidence: ${record.confidence}%` : '',
      '',
      '**Constraints:**',
    ];

    for (const c of record.constraints) {
      const status = c.passed ? '\u2713' : '\u2717';
      lines.push(`  ${status} ${c.rule}${c.violation ? ` - ${c.violation}` : ''}`);
    }

    if (record.pnl !== undefined) {
      const pnlStr = record.pnl >= 0 ? `+$${record.pnl.toFixed(2)}` : `-$${Math.abs(record.pnl).toFixed(2)}`;
      lines.push('', `P&L: ${pnlStr}`);
    }

    if (record.hash) {
      lines.push('', `Hash: ${record.hash.slice(0, 16)}...`);
    }

    return lines.filter(l => l !== '').join('\n');
  });
}

function handleHelp(): string {
  return [
    '**Trade Ledger Commands**',
    '',
    '**View Decisions:**',
    '  /ledger list [n] [category]  - Recent decisions',
    '  /ledger get <id>             - Decision details',
    '',
    '**Statistics:**',
    '  /ledger stats [period]       - Decision statistics',
    '  /ledger calibration          - Confidence accuracy',
    '',
    '**Options:**',
    '  period: 24h, 7d, 30d, 90d, all',
    '  category: trade, copy, arbitrage, risk',
    '',
    '**Examples:**',
    '  /ledger list 20',
    '  /ledger list trade',
    '  /ledger stats 30d',
    '  /ledger get abc123',
  ].join('\n');
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

const skill = {
  name: 'ledger',
  description: 'Trade Ledger - Decision audit trail and statistics',
  commands: ['/ledger'],

  async handle(args: string, context?: { userId?: string }): Promise<string> {
    const parts = args.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const userId = context?.userId || 'default';

    try {
      switch (cmd) {
        case 'list':
        case 'l':
        case '':
        case undefined:
          return handleList(userId, parts.slice(1));

        case 'stats':
        case 's':
          return handleStats(userId, parts.slice(1));

        case 'calibration':
        case 'cal':
        case 'c':
          return handleCalibration(userId);

        case 'get':
        case 'g':
          return handleGet(userId, parts[1]);

        case 'help':
        default:
          return handleHelp();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message, args }, 'Ledger command failed');
      return `Error: ${message}`;
    }
  },
};

export default skill;
