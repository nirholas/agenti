/**
 * SQL Tool - safe, read-only SQL queries against the local clodds database
 */

import type { Database } from '../db';
import { logger } from '../utils/logger';

export interface SqlQueryOptions {
  sql: string;
  params?: unknown[];
  maxRows?: number;
}

export interface SqlQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
}

export interface SqlTool {
  isAvailable(): boolean;
  query(options: SqlQueryOptions): Promise<SqlQueryResult>;
}

const DEFAULT_MAX_ROWS = 200;
const ABSOLUTE_MAX_ROWS = 2_000;

const FORBIDDEN_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'replace',
  'truncate',
  'vacuum',
  'attach',
  'detach',
  'reindex',
];

function normalizeSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // strip block comments
    .replace(/--.*$/gm, '')              // strip line comments
    .trim();
}

function startsWithAllowedStatement(sql: string): boolean {
  const lowered = sql.trim().toLowerCase();
  return (
    lowered.startsWith('select ') ||
    lowered.startsWith('with ') ||
    lowered.startsWith('pragma ') ||
    lowered.startsWith('explain ') ||
    lowered.startsWith('values ')
  );
}

function containsForbiddenKeywords(sql: string): string | null {
  const lowered = sql.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${keyword}\\b`, 'i');
    if (re.test(lowered)) {
      return keyword;
    }
  }
  return null;
}

function ensureReadOnlySql(sql: string): void {
  const normalized = normalizeSql(sql);
  if (!normalized) {
    throw new Error('SQL is empty');
  }

  if (!startsWithAllowedStatement(normalized)) {
    throw new Error('Only read-only statements are allowed (SELECT, WITH, PRAGMA, EXPLAIN, VALUES)');
  }

  const forbidden = containsForbiddenKeywords(normalized);
  if (forbidden) {
    logger.warn({ keyword: forbidden }, 'Forbidden SQL keyword detected');
    throw new Error('SQL query validation failed');
  }

  // Disallow multiple statements separated by semicolons.
  const semicolons = normalized.split(';').filter(part => part.trim().length > 0);
  if (semicolons.length > 1) {
    throw new Error('Multiple SQL statements are not allowed');
  }
}

function clampMaxRows(value?: number): number {
  if (!value || Number.isNaN(value)) return DEFAULT_MAX_ROWS;
  return Math.max(1, Math.min(ABSOLUTE_MAX_ROWS, Math.floor(value)));
}

export function createSqlTool(db: Database): SqlTool {
  return {
    isAvailable() {
      return Boolean(db);
    },

    async query(options: SqlQueryOptions): Promise<SqlQueryResult> {
      if (!options?.sql?.trim()) {
        throw new Error('SQL query is required');
      }

      ensureReadOnlySql(options.sql);

      const maxRows = clampMaxRows(options.maxRows);
      const params = Array.isArray(options.params) ? options.params : [];

      logger.info({ maxRows }, 'Executing read-only SQL query');

      const rows = db.query<Record<string, unknown>>(options.sql, params);
      const truncated = rows.length > maxRows;

      return {
        rows: truncated ? rows.slice(0, maxRows) : rows,
        rowCount: rows.length,
        truncated,
      };
    },
  };
}
