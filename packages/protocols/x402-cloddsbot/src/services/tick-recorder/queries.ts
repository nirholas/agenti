/**
 * Tick Recorder Query Builders
 * Functions for querying historical tick and orderbook data
 */

import type { TimescaleClient } from './timescale';
import type {
  Tick,
  TickQuery,
  Candle,
  OHLCParams,
  OHLCInterval,
  OrderbookSnapshot,
  OrderbookQuery,
  SpreadHistoryParams,
  SpreadCandle,
} from './types';
import type { Platform } from '../../types';

/**
 * Convert OHLC interval to TimescaleDB/PostgreSQL interval string
 */
function intervalToPostgres(interval: OHLCInterval): string {
  const map: Record<OHLCInterval, string> = {
    '1m': '1 minute',
    '5m': '5 minutes',
    '15m': '15 minutes',
    '1h': '1 hour',
    '4h': '4 hours',
    '1d': '1 day',
  };
  return map[interval];
}

/**
 * Get raw tick data
 */
export async function getTicks(
  client: TimescaleClient,
  query: TickQuery
): Promise<Tick[]> {
  const { platform, marketId, outcomeId, startTime, endTime, limit } = query;

  let sql = `
    SELECT
      time,
      platform,
      market_id as "marketId",
      outcome_id as "outcomeId",
      price::float,
      prev_price::float as "prevPrice"
    FROM ticks
    WHERE platform = $1
      AND market_id = $2
      AND time >= to_timestamp($3)
      AND time <= to_timestamp($4)
  `;

  const params: unknown[] = [platform, marketId, startTime / 1000, endTime / 1000];

  if (outcomeId) {
    sql += ` AND outcome_id = $${params.length + 1}`;
    params.push(outcomeId);
  }

  sql += ` ORDER BY time DESC`;

  if (limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const result = await client.query<{
    time: Date;
    platform: Platform;
    marketId: string;
    outcomeId: string;
    price: number;
    prevPrice: number | null;
  }>(sql, params);

  return result.rows.map((row) => ({
    time: row.time,
    platform: row.platform,
    marketId: row.marketId,
    outcomeId: row.outcomeId,
    price: row.price,
    prevPrice: row.prevPrice,
  }));
}

/**
 * Get OHLC candles using time_bucket (TimescaleDB) or date_trunc (PostgreSQL fallback)
 */
export async function getOHLC(
  client: TimescaleClient,
  params: OHLCParams
): Promise<Candle[]> {
  const { platform, marketId, outcomeId, interval, startTime, endTime } = params;
  const pgInterval = intervalToPostgres(interval);

  // Try TimescaleDB time_bucket first, fall back to date_trunc
  const hasTimeBucket = await checkTimeBucket(client);

  let sql: string;
  if (hasTimeBucket) {
    sql = `
      SELECT
        time_bucket($1, time) as bucket,
        (array_agg(price ORDER BY time ASC))[1]::float as open,
        max(price)::float as high,
        min(price)::float as low,
        (array_agg(price ORDER BY time DESC))[1]::float as close,
        count(*)::int as "tickCount"
      FROM ticks
      WHERE platform = $2
        AND market_id = $3
        AND outcome_id = $4
        AND time >= to_timestamp($5)
        AND time <= to_timestamp($6)
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  } else {
    // Fallback for plain PostgreSQL
    sql = `
      SELECT
        date_trunc($1, time) as bucket,
        (array_agg(price ORDER BY time ASC))[1]::float as open,
        max(price)::float as high,
        min(price)::float as low,
        (array_agg(price ORDER BY time DESC))[1]::float as close,
        count(*)::int as "tickCount"
      FROM ticks
      WHERE platform = $2
        AND market_id = $3
        AND outcome_id = $4
        AND time >= to_timestamp($5)
        AND time <= to_timestamp($6)
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  // For date_trunc, map to the closest supported truncation unit.
  // Note: date_trunc only supports standard units (minute, hour, day).
  // Multi-minute/multi-hour intervals (5m, 15m, 4h) will be bucketed at the
  // base unit, which is less accurate but still functional without TimescaleDB.
  const intervalArg = hasTimeBucket
    ? pgInterval
    : interval === '1d'
      ? 'day'
      : interval.endsWith('h')
        ? 'hour'
        : 'minute';

  const result = await client.query<{
    bucket: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    tickCount: number;
  }>(sql, [intervalArg, platform, marketId, outcomeId, startTime / 1000, endTime / 1000]);

  return result.rows.map((row) => ({
    time: row.bucket.getTime(),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    tickCount: row.tickCount,
  }));
}

/**
 * Get orderbook snapshots
 */
export async function getOrderbookSnapshots(
  client: TimescaleClient,
  query: OrderbookQuery
): Promise<OrderbookSnapshot[]> {
  const { platform, marketId, outcomeId, startTime, endTime, limit } = query;

  let sql = `
    SELECT
      time,
      platform,
      market_id as "marketId",
      outcome_id as "outcomeId",
      bids,
      asks,
      spread::float,
      mid_price::float as "midPrice"
    FROM orderbook_snapshots
    WHERE platform = $1
      AND market_id = $2
      AND time >= to_timestamp($3)
      AND time <= to_timestamp($4)
  `;

  const params: unknown[] = [platform, marketId, startTime / 1000, endTime / 1000];

  if (outcomeId) {
    sql += ` AND outcome_id = $${params.length + 1}`;
    params.push(outcomeId);
  }

  sql += ` ORDER BY time DESC`;

  if (limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  const result = await client.query<{
    time: Date;
    platform: Platform;
    marketId: string;
    outcomeId: string;
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    spread: number | null;
    midPrice: number | null;
  }>(sql, params);

  return result.rows.map((row) => ({
    time: row.time,
    platform: row.platform,
    marketId: row.marketId,
    outcomeId: row.outcomeId,
    bids: row.bids,
    asks: row.asks,
    spread: row.spread,
    midPrice: row.midPrice,
  }));
}

/**
 * Get spread history over time
 */
export async function getSpreadHistory(
  client: TimescaleClient,
  params: SpreadHistoryParams
): Promise<SpreadCandle[]> {
  const { platform, marketId, outcomeId, interval, startTime, endTime } = params;
  const pgInterval = intervalToPostgres(interval);
  const hasTimeBucket = await checkTimeBucket(client);

  let sql: string;
  if (hasTimeBucket) {
    sql = `
      SELECT
        time_bucket($1, time) as bucket,
        avg(spread)::float as "avgSpread",
        min(spread)::float as "minSpread",
        max(spread)::float as "maxSpread",
        avg(mid_price)::float as "avgMidPrice"
      FROM orderbook_snapshots
      WHERE platform = $2
        AND market_id = $3
        AND outcome_id = $4
        AND time >= to_timestamp($5)
        AND time <= to_timestamp($6)
        AND spread IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  } else {
    sql = `
      SELECT
        date_trunc($1, time) as bucket,
        avg(spread)::float as "avgSpread",
        min(spread)::float as "minSpread",
        max(spread)::float as "maxSpread",
        avg(mid_price)::float as "avgMidPrice"
      FROM orderbook_snapshots
      WHERE platform = $2
        AND market_id = $3
        AND outcome_id = $4
        AND time >= to_timestamp($5)
        AND time <= to_timestamp($6)
        AND spread IS NOT NULL
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  }

  // See note in getOHLC: date_trunc fallback only supports base units
  const intervalArg = hasTimeBucket
    ? pgInterval
    : interval === '1d'
      ? 'day'
      : interval.endsWith('h')
        ? 'hour'
        : 'minute';

  const result = await client.query<{
    bucket: Date;
    avgSpread: number;
    minSpread: number;
    maxSpread: number;
    avgMidPrice: number;
  }>(sql, [intervalArg, platform, marketId, outcomeId, startTime / 1000, endTime / 1000]);

  return result.rows.map((row) => ({
    time: row.bucket.getTime(),
    avgSpread: row.avgSpread,
    minSpread: row.minSpread,
    maxSpread: row.maxSpread,
    avgMidPrice: row.avgMidPrice,
  }));
}

/**
 * Check if time_bucket function is available (TimescaleDB)
 */
let timeBucketAvailable: boolean | null = null;

async function checkTimeBucket(client: TimescaleClient): Promise<boolean> {
  if (timeBucketAvailable !== null) {
    return timeBucketAvailable;
  }

  try {
    await client.query("SELECT time_bucket('1 hour', now())");
    timeBucketAvailable = true;
  } catch {
    timeBucketAvailable = false;
  }

  return timeBucketAvailable;
}

/**
 * Bulk insert ticks
 */
export async function insertTicks(
  client: TimescaleClient,
  ticks: Array<{
    time: Date;
    platform: string;
    marketId: string;
    outcomeId: string;
    price: number;
    prevPrice: number | null;
  }>
): Promise<number> {
  if (ticks.length === 0) return 0;

  // Use unnest for efficient bulk insert
  const times = ticks.map((t) => t.time);
  const platforms = ticks.map((t) => t.platform);
  const marketIds = ticks.map((t) => t.marketId);
  const outcomeIds = ticks.map((t) => t.outcomeId);
  const prices = ticks.map((t) => t.price);
  const prevPrices = ticks.map((t) => t.prevPrice);

  const result = await client.query(
    `INSERT INTO ticks (time, platform, market_id, outcome_id, price, prev_price)
     SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::decimal[], $6::decimal[])`,
    [times, platforms, marketIds, outcomeIds, prices, prevPrices]
  );

  return result.rowCount ?? 0;
}

/**
 * Bulk insert orderbook snapshots
 */
export async function insertOrderbookSnapshots(
  client: TimescaleClient,
  snapshots: Array<{
    time: Date;
    platform: string;
    marketId: string;
    outcomeId: string;
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    spread: number | null;
    midPrice: number | null;
  }>
): Promise<number> {
  if (snapshots.length === 0) return 0;

  const times = snapshots.map((s) => s.time);
  const platforms = snapshots.map((s) => s.platform);
  const marketIds = snapshots.map((s) => s.marketId);
  const outcomeIds = snapshots.map((s) => s.outcomeId);
  const bids = snapshots.map((s) => JSON.stringify(s.bids));
  const asks = snapshots.map((s) => JSON.stringify(s.asks));
  const spreads = snapshots.map((s) => s.spread);
  const midPrices = snapshots.map((s) => s.midPrice);

  const result = await client.query(
    `INSERT INTO orderbook_snapshots (time, platform, market_id, outcome_id, bids, asks, spread, mid_price)
     SELECT t, p, m, o, b::jsonb, a::jsonb, s, mp
     FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::decimal[], $8::decimal[])
     AS x(t, p, m, o, b, a, s, mp)`,
    [times, platforms, marketIds, outcomeIds, bids, asks, spreads, midPrices]
  );

  return result.rowCount ?? 0;
}
