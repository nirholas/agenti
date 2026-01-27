/**
 * Sweep Queue Workers
 * 
 * This file starts the BullMQ workers for processing sweep jobs
 * and other background tasks.
 */

import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  updateQueueMetrics,
  recordJobCompletion,
  setProtocolHealth,
} from './api/middleware/metrics.js';
import { createConsolidationWorker } from './queue/workers/consolidation.js';

// Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue names
const QUEUES = {
  SWEEP: 'sweep',
  PRICE_UPDATE: 'price-update',
  HEALTH_CHECK: 'health-check',
} as const;

// Initialize queues
const sweepQueue = new Queue(QUEUES.SWEEP, { connection });
const priceUpdateQueue = new Queue(QUEUES.PRICE_UPDATE, { connection });
const healthCheckQueue = new Queue(QUEUES.HEALTH_CHECK, { connection });

// ============================================
// Sweep Worker
// ============================================
const sweepWorker = new Worker(
  QUEUES.SWEEP,
  async (job) => {
    const startTime = Date.now();
    const { userId, walletAddress, chain, tokens, targetToken } = job.data;

    console.log(`[Sweep] Processing job ${job.id} for wallet ${walletAddress} on ${chain}`);

    try {
      // TODO: Implement actual sweep logic
      // 1. Get quotes for each token swap
      // 2. Build UserOperation or transaction batch
      // 3. Submit via bundler or directly
      // 4. Wait for confirmation
      // 5. Update database

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const durationMs = Date.now() - startTime;
      recordJobCompletion(QUEUES.SWEEP, chain, durationMs, true);

      return {
        success: true,
        txHash: '0x' + '0'.repeat(64), // Placeholder
        tokensSwept: tokens.length,
        chain,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorType = error instanceof Error ? error.name : 'UnknownError';
      recordJobCompletion(QUEUES.SWEEP, chain, durationMs, false, errorType);
      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// ============================================
// Price Update Worker
// ============================================
const priceUpdateWorker = new Worker(
  QUEUES.PRICE_UPDATE,
  async (job) => {
    const { tokens } = job.data;

    console.log(`[PriceUpdate] Updating prices for ${tokens.length} tokens`);

    try {
      // TODO: Implement price fetching from CoinGecko/DeFiLlama
      // Update cached prices in Redis
      
      return { updated: tokens.length };
    } catch (error) {
      console.error('[PriceUpdate] Error:', error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

// ============================================
// Health Check Worker
// ============================================
const healthCheckWorker = new Worker(
  QUEUES.HEALTH_CHECK,
  async (job) => {
    const { protocol } = job.data;

    console.log(`[HealthCheck] Checking ${protocol}`);

    try {
      // TODO: Implement health checks for each protocol
      // - Check API endpoints are responding
      // - Check contract state
      
      const healthy = true; // Placeholder
      setProtocolHealth(protocol, healthy);

      return { protocol, healthy };
    } catch (error) {
      setProtocolHealth(protocol, false);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

// ============================================
// Queue Metrics Update
// ============================================
async function updateAllQueueMetrics() {
  const queues = [
    { name: QUEUES.SWEEP, queue: sweepQueue },
    { name: QUEUES.PRICE_UPDATE, queue: priceUpdateQueue },
    { name: QUEUES.HEALTH_CHECK, queue: healthCheckQueue },
  ];

  for (const { name, queue } of queues) {
    try {
      const [waiting, active, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getDelayedCount(),
      ]);
      updateQueueMetrics(name, waiting, active, delayed);
    } catch (error) {
      console.error(`Error updating metrics for queue ${name}:`, error);
    }
  }
}

// Update metrics every 30 seconds
const metricsInterval = setInterval(updateAllQueueMetrics, 30000);

// ============================================
// Event Handlers
// ============================================
sweepWorker.on('completed', (job) => {
  console.log(`[Sweep] Job ${job.id} completed`);
});

sweepWorker.on('failed', (job, error) => {
  console.error(`[Sweep] Job ${job?.id} failed:`, error.message);
});

priceUpdateWorker.on('failed', (job, error) => {
  console.error(`[PriceUpdate] Job ${job?.id} failed:`, error.message);
});

healthCheckWorker.on('failed', (job, error) => {
  console.error(`[HealthCheck] Job ${job?.id} failed:`, error.message);
});

// ============================================
// Consolidation Worker
// ============================================
const consolidationWorker = createConsolidationWorker();

consolidationWorker.on('completed', (job, result) => {
  const status = result.success
    ? 'completed'
    : result.partialSuccess
      ? 'partial success'
      : 'failed';
  console.log(`[Consolidation] Job ${job.id} ${status}`);
});

consolidationWorker.on('failed', (job, error) => {
  console.error(`[Consolidation] Job ${job?.id} failed:`, error.message);
});

// ============================================
// Graceful Shutdown
// ============================================
async function shutdown() {
  console.log('Shutting down workers...');

  clearInterval(metricsInterval);

  await Promise.all([
    sweepWorker.close(),
    priceUpdateWorker.close(),
    healthCheckWorker.close(),
    consolidationWorker.close(),
  ]);

  await connection.quit();
  console.log('Workers shut down gracefully');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================
// Startup
// ============================================
console.log('🧹 Sweep Workers starting...');
console.log(`Connected to Redis at ${REDIS_URL}`);
console.log('Workers ready:');
console.log(`  - Sweep worker (concurrency: ${process.env.QUEUE_CONCURRENCY || 5})`);
console.log('  - Price update worker (concurrency: 2)');
console.log('  - Health check worker (concurrency: 5)');
console.log('  - Consolidation worker (concurrency: 3)');

// Initial metrics update
updateAllQueueMetrics();
