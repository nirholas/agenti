/**
 * TimescaleDB Schema
 * Table definitions and migrations for tick data storage
 */

import type { TimescaleClient } from './timescale';
import { logger } from '../../utils/logger';

/**
 * Initialize the tick recorder schema
 * Creates tables, hypertables, indexes, and policies
 */
export async function initializeSchema(
  client: TimescaleClient,
  options: { retentionDays?: number } = {}
): Promise<void> {
  const retentionDays = options.retentionDays ?? 365;

  logger.info('Initializing tick recorder schema');

  // Create ticks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS ticks (
      time        TIMESTAMPTZ NOT NULL,
      platform    TEXT NOT NULL,
      market_id   TEXT NOT NULL,
      outcome_id  TEXT NOT NULL,
      price       DECIMAL(10,6) NOT NULL,
      prev_price  DECIMAL(10,6)
    )
  `);

  // Create orderbook_snapshots table
  await client.query(`
    CREATE TABLE IF NOT EXISTS orderbook_snapshots (
      time        TIMESTAMPTZ NOT NULL,
      platform    TEXT NOT NULL,
      market_id   TEXT NOT NULL,
      outcome_id  TEXT NOT NULL,
      bids        JSONB NOT NULL,
      asks        JSONB NOT NULL,
      spread      DECIMAL(10,6),
      mid_price   DECIMAL(10,6)
    )
  `);

  // Try to create hypertables (requires TimescaleDB extension)
  const hasTimescale = await checkTimescaleExtension(client);

  if (hasTimescale) {
    logger.info('TimescaleDB extension detected, creating hypertables');

    // Convert to hypertables if not already
    await safeCreateHypertable(client, 'ticks', 'time');
    await safeCreateHypertable(client, 'orderbook_snapshots', 'time');

    // Add compression policies (compress chunks older than 7 days)
    await safeAddCompressionPolicy(client, 'ticks', '7 days');
    await safeAddCompressionPolicy(client, 'orderbook_snapshots', '7 days');

    // Add retention policies
    await safeAddRetentionPolicy(client, 'ticks', `${retentionDays} days`);
    await safeAddRetentionPolicy(client, 'orderbook_snapshots', `${retentionDays} days`);
  } else {
    logger.warn(
      'TimescaleDB extension not found, using plain PostgreSQL tables. ' +
        'For best performance, install TimescaleDB: https://docs.timescale.com/install/'
    );
  }

  // Create indexes (work with both TimescaleDB and plain PostgreSQL)
  await safeCreateIndex(
    client,
    'idx_ticks_market',
    'ticks',
    'platform, market_id, time DESC'
  );
  await safeCreateIndex(
    client,
    'idx_ticks_outcome',
    'ticks',
    'platform, market_id, outcome_id, time DESC'
  );
  await safeCreateIndex(
    client,
    'idx_orderbook_market',
    'orderbook_snapshots',
    'platform, market_id, time DESC'
  );
  await safeCreateIndex(
    client,
    'idx_orderbook_outcome',
    'orderbook_snapshots',
    'platform, market_id, outcome_id, time DESC'
  );

  logger.info('Tick recorder schema initialized successfully');
}

/**
 * Check if TimescaleDB extension is available
 */
async function checkTimescaleExtension(client: TimescaleClient): Promise<boolean> {
  try {
    const result = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') as exists"
    );
    return result.rows[0]?.exists ?? false;
  } catch {
    return false;
  }
}

/**
 * Safely create a hypertable (ignore if already exists)
 */
async function safeCreateHypertable(
  client: TimescaleClient,
  table: string,
  timeColumn: string
): Promise<void> {
  try {
    // Check if already a hypertable
    const checkResult = await client.query<{ count: string }>(
      `SELECT count(*) FROM timescaledb_information.hypertables WHERE hypertable_name = $1`,
      [table]
    );

    if (parseInt(checkResult.rows[0]?.count ?? '0', 10) > 0) {
      logger.debug({ table }, 'Table is already a hypertable');
      return;
    }

    await client.query(
      `SELECT create_hypertable($1, $2, if_not_exists => true, migrate_data => true)`,
      [table, timeColumn]
    );
    logger.info({ table }, 'Created hypertable');
  } catch (err) {
    // Ignore if already a hypertable or other non-fatal error
    logger.debug({ table, err }, 'Could not create hypertable (may already exist)');
  }
}

/**
 * Safely add compression policy
 */
async function safeAddCompressionPolicy(
  client: TimescaleClient,
  table: string,
  compressAfter: string
): Promise<void> {
  try {
    // First enable compression on the hypertable
    await client.query(
      `ALTER TABLE ${table} SET (timescaledb.compress, timescaledb.compress_segmentby = 'platform, market_id, outcome_id')`
    );

    // Check if policy already exists
    const checkResult = await client.query<{ count: string }>(
      `SELECT count(*) FROM timescaledb_information.jobs
       WHERE hypertable_name = $1 AND proc_name = 'policy_compression'`,
      [table]
    );

    if (parseInt(checkResult.rows[0]?.count ?? '0', 10) > 0) {
      logger.debug({ table }, 'Compression policy already exists');
      return;
    }

    await client.query(`SELECT add_compression_policy($1, INTERVAL $2, if_not_exists => true)`, [
      table,
      compressAfter,
    ]);
    logger.info({ table, compressAfter }, 'Added compression policy');
  } catch (err) {
    logger.debug({ table, err }, 'Could not add compression policy');
  }
}

/**
 * Safely add retention policy
 */
async function safeAddRetentionPolicy(
  client: TimescaleClient,
  table: string,
  dropAfter: string
): Promise<void> {
  try {
    // Check if policy already exists
    const checkResult = await client.query<{ count: string }>(
      `SELECT count(*) FROM timescaledb_information.jobs
       WHERE hypertable_name = $1 AND proc_name = 'policy_retention'`,
      [table]
    );

    if (parseInt(checkResult.rows[0]?.count ?? '0', 10) > 0) {
      logger.debug({ table }, 'Retention policy already exists');
      return;
    }

    await client.query(`SELECT add_retention_policy($1, INTERVAL $2, if_not_exists => true)`, [
      table,
      dropAfter,
    ]);
    logger.info({ table, dropAfter }, 'Added retention policy');
  } catch (err) {
    logger.debug({ table, err }, 'Could not add retention policy');
  }
}

/**
 * Safely create an index (ignore if already exists)
 */
async function safeCreateIndex(
  client: TimescaleClient,
  indexName: string,
  table: string,
  columns: string
): Promise<void> {
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} (${columns})`);
    logger.debug({ indexName, table }, 'Created index');
  } catch (err) {
    logger.debug({ indexName, err }, 'Could not create index (may already exist)');
  }
}

/**
 * Get schema statistics
 */
export async function getSchemaStats(
  client: TimescaleClient
): Promise<{
  ticksCount: number;
  orderbooksCount: number;
  oldestTick: Date | null;
  newestTick: Date | null;
  oldestOrderbook: Date | null;
  newestOrderbook: Date | null;
  tableSize: { ticks: string; orderbooks: string };
}> {
  const [ticksCountRes, orderbooksCountRes, ticksRangeRes, orderbooksRangeRes, sizeRes] =
    await Promise.all([
      client.query<{ count: string }>('SELECT count(*) FROM ticks'),
      client.query<{ count: string }>('SELECT count(*) FROM orderbook_snapshots'),
      client.query<{ min_time: Date | null; max_time: Date | null }>(
        'SELECT min(time) as min_time, max(time) as max_time FROM ticks'
      ),
      client.query<{ min_time: Date | null; max_time: Date | null }>(
        'SELECT min(time) as min_time, max(time) as max_time FROM orderbook_snapshots'
      ),
      client.query<{ relname: string; size: string }>(
        `SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) as size
         FROM pg_catalog.pg_statio_user_tables
         WHERE relname IN ('ticks', 'orderbook_snapshots')`
      ),
    ]);

  const sizeMap: Record<string, string> = {};
  for (const row of sizeRes.rows) {
    sizeMap[row.relname] = row.size;
  }

  return {
    ticksCount: parseInt(ticksCountRes.rows[0]?.count ?? '0', 10),
    orderbooksCount: parseInt(orderbooksCountRes.rows[0]?.count ?? '0', 10),
    oldestTick: ticksRangeRes.rows[0]?.min_time ?? null,
    newestTick: ticksRangeRes.rows[0]?.max_time ?? null,
    oldestOrderbook: orderbooksRangeRes.rows[0]?.min_time ?? null,
    newestOrderbook: orderbooksRangeRes.rows[0]?.max_time ?? null,
    tableSize: {
      ticks: sizeMap['ticks'] ?? 'unknown',
      orderbooks: sizeMap['orderbook_snapshots'] ?? 'unknown',
    },
  };
}
