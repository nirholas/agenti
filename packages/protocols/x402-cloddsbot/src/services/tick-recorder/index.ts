/**
 * Tick Recorder Service
 * Records price and orderbook data to TimescaleDB for historical analysis
 */

import { createTimescaleClient, checkTimescaleHealth, type TimescaleClient } from './timescale';
import { initializeSchema, getSchemaStats } from './schema';
import {
  getTicks as queryTicks,
  getOHLC as queryOHLC,
  getOrderbookSnapshots as queryOrderbookSnapshots,
  getSpreadHistory as querySpreadHistory,
  insertTicks,
  insertOrderbookSnapshots,
} from './queries';
import type {
  TickRecorder,
  TickRecorderConfig,
  TickQuery,
  OHLCParams,
  OrderbookQuery,
  SpreadHistoryParams,
  Tick,
  Candle,
  OrderbookSnapshot,
  SpreadCandle,
  RecorderStats,
} from './types';
import type { Platform, PriceUpdate, OrderbookUpdate } from '../../types';
import { logger } from '../../utils/logger';

// Re-export types
export type {
  TickRecorder,
  TickRecorderConfig,
  Tick,
  Candle,
  OrderbookSnapshot,
  SpreadCandle,
  TickQuery,
  OHLCParams,
  OrderbookQuery,
  SpreadHistoryParams,
  RecorderStats,
};

interface TickBuffer {
  time: Date;
  platform: string;
  marketId: string;
  outcomeId: string;
  price: number;
  prevPrice: number | null;
}

interface OrderbookBuffer {
  time: Date;
  platform: string;
  marketId: string;
  outcomeId: string;
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  spread: number | null;
  midPrice: number | null;
}

/**
 * Create a tick recorder service
 */
export function createTickRecorder(config: TickRecorderConfig): TickRecorder {
  const batchSize = config.batchSize ?? 100;
  const flushIntervalMs = config.flushIntervalMs ?? 1000;
  const retentionDays = config.retentionDays ?? 365;
  const enabledPlatforms = config.platforms ?? null; // null = all platforms

  let client: TimescaleClient | null = null;
  let tickBuffer: TickBuffer[] = [];
  let orderbookBuffer: OrderbookBuffer[] = [];
  let flushInterval: NodeJS.Timeout | null = null;
  let running = false;
  let lastFlushTime: number | null = null;

  // Stats counters
  let ticksRecorded = 0;
  let orderbooksRecorded = 0;

  /**
   * Check if a platform should be recorded
   */
  const shouldRecord = (platform: Platform): boolean => {
    if (!enabledPlatforms) return true;
    return enabledPlatforms.includes(platform);
  };

  /**
   * Flush buffers to database
   */
  const flush = async (): Promise<void> => {
    if (!client || (!tickBuffer.length && !orderbookBuffer.length)) {
      return;
    }

    const ticksToInsert = [...tickBuffer];
    const orderbooksToInsert = [...orderbookBuffer];
    tickBuffer = [];
    orderbookBuffer = [];

    try {
      const [ticksInserted, orderbooksInserted] = await Promise.all([
        ticksToInsert.length > 0 ? insertTicks(client, ticksToInsert) : 0,
        orderbooksToInsert.length > 0 ? insertOrderbookSnapshots(client, orderbooksToInsert) : 0,
      ]);

      ticksRecorded += ticksInserted;
      orderbooksRecorded += orderbooksInserted;
      lastFlushTime = Date.now();

      if (ticksInserted > 0 || orderbooksInserted > 0) {
        logger.debug(
          { ticksInserted, orderbooksInserted },
          'Flushed tick recorder buffers'
        );
      }
    } catch (err) {
      // On error, put data back in buffers for retry, but cap total size
      // to prevent unbounded growth if the database is down for a long time.
      const MAX_BUFFER_SIZE = batchSize * 10;
      tickBuffer = [...ticksToInsert, ...tickBuffer];
      orderbookBuffer = [...orderbooksToInsert, ...orderbookBuffer];

      if (tickBuffer.length > MAX_BUFFER_SIZE) {
        const dropped = tickBuffer.length - MAX_BUFFER_SIZE;
        tickBuffer = tickBuffer.slice(-MAX_BUFFER_SIZE);
        logger.warn({ dropped }, 'Tick buffer overflow, dropped oldest ticks');
      }
      if (orderbookBuffer.length > MAX_BUFFER_SIZE) {
        const dropped = orderbookBuffer.length - MAX_BUFFER_SIZE;
        orderbookBuffer = orderbookBuffer.slice(-MAX_BUFFER_SIZE);
        logger.warn({ dropped }, 'Orderbook buffer overflow, dropped oldest snapshots');
      }

      logger.error({ err }, 'Failed to flush tick recorder buffers');
    }
  };

  /**
   * Check if buffers should be flushed based on size
   */
  const checkFlush = (): void => {
    if (tickBuffer.length >= batchSize || orderbookBuffer.length >= batchSize) {
      flush().catch((err) => {
        logger.error({ err }, 'Flush check error');
      });
    }
  };

  return {
    async start(): Promise<void> {
      if (running) return;

      logger.info({ connectionString: config.connectionString.replace(/:[^:@]+@/, ':***@') }, 'Starting tick recorder');

      // Create database client
      client = createTimescaleClient({
        connectionString: config.connectionString,
      });

      // Check connection
      const health = await checkTimescaleHealth(client);
      if (!health.connected) {
        throw new Error(`Failed to connect to TimescaleDB: ${health.error}`);
      }

      logger.info(
        {
          pgVersion: health.version?.split(' ')[1],
          timescaleVersion: health.timescaleVersion,
        },
        'Connected to database'
      );

      // Initialize schema
      await initializeSchema(client, { retentionDays });

      // Start flush interval
      flushInterval = setInterval(() => {
        flush().catch((err) => {
          logger.error({ err }, 'Interval flush error');
        });
      }, flushIntervalMs);

      running = true;
      logger.info({ batchSize, flushIntervalMs, retentionDays }, 'Tick recorder started');
    },

    async stop(): Promise<void> {
      if (!running) return;

      running = false;

      // Stop flush interval
      if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
      }

      // Final flush
      await flush();

      // Close database connection
      if (client) {
        await client.close();
        client = null;
      }

      logger.info({ ticksRecorded, orderbooksRecorded }, 'Tick recorder stopped');
    },

    recordTick(update: PriceUpdate): void {
      if (!running || !shouldRecord(update.platform)) return;

      tickBuffer.push({
        time: new Date(update.timestamp),
        platform: update.platform,
        marketId: update.marketId,
        outcomeId: update.outcomeId,
        price: update.price,
        prevPrice: update.previousPrice ?? null,
      });

      checkFlush();
    },

    recordOrderbook(update: OrderbookUpdate): void {
      if (!running || !shouldRecord(update.platform)) return;

      // Calculate spread and mid price
      const bestBid = update.bids.length > 0 ? update.bids[0][0] : null;
      const bestAsk = update.asks.length > 0 ? update.asks[0][0] : null;
      const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
      const midPrice = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;

      orderbookBuffer.push({
        time: new Date(update.timestamp),
        platform: update.platform,
        marketId: update.marketId,
        outcomeId: update.outcomeId,
        bids: update.bids,
        asks: update.asks,
        spread,
        midPrice,
      });

      checkFlush();
    },

    async getTicks(query: TickQuery): Promise<Tick[]> {
      if (!client) {
        throw new Error('Tick recorder not started');
      }
      return queryTicks(client, query);
    },

    async getOHLC(params: OHLCParams): Promise<Candle[]> {
      if (!client) {
        throw new Error('Tick recorder not started');
      }
      return queryOHLC(client, params);
    },

    async getOrderbookSnapshots(params: OrderbookQuery): Promise<OrderbookSnapshot[]> {
      if (!client) {
        throw new Error('Tick recorder not started');
      }
      return queryOrderbookSnapshots(client, params);
    },

    async getSpreadHistory(params: SpreadHistoryParams): Promise<SpreadCandle[]> {
      if (!client) {
        throw new Error('Tick recorder not started');
      }
      return querySpreadHistory(client, params);
    },

    getStats(): RecorderStats {
      return {
        ticksRecorded,
        orderbooksRecorded,
        ticksInBuffer: tickBuffer.length,
        orderbooksInBuffer: orderbookBuffer.length,
        lastFlushTime,
        dbConnected: client?.isConnected() ?? false,
        platforms: enabledPlatforms ?? [],
      };
    },
  };
}

// Export schema utilities for external use
export { getSchemaStats } from './schema';
export { checkTimescaleHealth } from './timescale';
