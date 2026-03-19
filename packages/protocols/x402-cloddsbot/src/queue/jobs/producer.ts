/**
 * Execution Producer - Enqueues execution jobs to BullMQ
 *
 * Gateway and agents use the producer to submit orders.
 * Jobs are processed asynchronously by the worker process.
 */

import { Queue, type JobsOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';
import {
  EXECUTION_QUEUE,
  type ExecutionJob,
  type OrderExecuteJob,
  type OrderCancelJob,
  type OrderCancelAllJob,
  type OrderBatchJob,
  type CopyTradeJob,
  type ArbExecuteJob,
  type JobStatus,
  type JobState,
} from './types';
import type { ExecutionServiceRef, OrderResultRef } from '../../types';

// =============================================================================
// PRODUCER INTERFACE
// =============================================================================

export interface ExecutionProducer {
  /** Enqueue an order execution job */
  enqueueOrder(job: Omit<OrderExecuteJob, 'type' | 'requestId'>): Promise<string>;

  /** Enqueue an order cancel job */
  enqueueCancel(job: Omit<OrderCancelJob, 'type' | 'requestId'>): Promise<string>;

  /** Enqueue a cancel-all job */
  enqueueCancelAll(job: Omit<OrderCancelAllJob, 'type' | 'requestId'>): Promise<string>;

  /** Enqueue a batch order job */
  enqueueBatch(job: Omit<OrderBatchJob, 'type' | 'requestId'>): Promise<string>;

  /** Enqueue a copy trade job */
  enqueueCopyTrade(job: Omit<CopyTradeJob, 'type' | 'requestId'>): Promise<string>;

  /** Enqueue an arbitrage execution job */
  enqueueArb(job: Omit<ArbExecuteJob, 'type' | 'requestId'>): Promise<string>;

  /** Get status of a queued job */
  getJobStatus(jobId: string): Promise<JobStatus | null>;

  /** Wait for a job to complete and return its result */
  waitForJob(jobId: string, timeoutMs?: number): Promise<JobStatus>;

  /** Close the producer queue connection */
  close(): Promise<void>;
}

// =============================================================================
// DEFAULT JOB OPTIONS
// =============================================================================

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 60 * 60, // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 60 * 60, // 7 days
  },
};

// Priority job options for time-sensitive operations
const PRIORITY_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_JOB_OPTIONS,
  priority: 1,
  attempts: 1, // Don't retry market orders
};

// =============================================================================
// FACTORY
// =============================================================================

export interface ProducerConfig {
  redis: RedisOptions;
  /** Default timeout when waiting for job results (ms) */
  defaultTimeoutMs?: number;
}

export function createExecutionProducer(config: ProducerConfig): ExecutionProducer {
  const queue = new Queue(EXECUTION_QUEUE, {
    connection: config.redis,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  const defaultTimeout = config.defaultTimeoutMs ?? 30_000;

  async function enqueue(job: ExecutionJob, options?: JobsOptions): Promise<string> {
    const bullJob = await queue.add(job.type, job, {
      ...options,
      jobId: job.requestId,
    });

    logger.debug(
      { jobId: bullJob.id, type: job.type, userId: job.userId },
      'Execution job enqueued'
    );

    return bullJob.id!;
  }

  return {
    async enqueueOrder(job) {
      const requestId = randomUUID();
      const isMarketOrder = job.method === 'marketBuy' || job.method === 'marketSell';
      return enqueue(
        { ...job, type: 'order:execute', requestId },
        isMarketOrder ? PRIORITY_JOB_OPTIONS : undefined,
      );
    },

    async enqueueCancel(job) {
      const requestId = randomUUID();
      return enqueue(
        { ...job, type: 'order:cancel', requestId },
        PRIORITY_JOB_OPTIONS,
      );
    },

    async enqueueCancelAll(job) {
      const requestId = randomUUID();
      return enqueue(
        { ...job, type: 'order:cancel_all', requestId },
        PRIORITY_JOB_OPTIONS,
      );
    },

    async enqueueBatch(job) {
      const requestId = randomUUID();
      return enqueue({ ...job, type: 'order:batch', requestId });
    },

    async enqueueCopyTrade(job) {
      const requestId = randomUUID();
      return enqueue(
        { ...job, type: 'copy:trade', requestId },
        PRIORITY_JOB_OPTIONS,
      );
    },

    async enqueueArb(job) {
      const requestId = randomUUID();
      return enqueue(
        { ...job, type: 'arb:execute', requestId },
        PRIORITY_JOB_OPTIONS,
      );
    },

    async getJobStatus(jobId) {
      const job = await queue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState() as JobState;

      return {
        id: job.id!,
        state,
        progress: typeof job.progress === 'number' ? job.progress : 0,
        result: state === 'completed' ? job.returnvalue : undefined,
        error: state === 'failed' ? job.failedReason : undefined,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      };
    },

    async waitForJob(jobId, timeoutMs = defaultTimeout) {
      const startTime = Date.now();
      const pollInterval = 100;

      while (Date.now() - startTime < timeoutMs) {
        const status = await this.getJobStatus(jobId);
        if (!status) {
          throw new Error(`Job ${jobId} not found`);
        }

        if (status.state === 'completed' || status.state === 'failed') {
          return status;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
    },

    async close() {
      await queue.close();
    },
  };
}

// =============================================================================
// QUEUED EXECUTION SERVICE WRAPPER
// =============================================================================

/**
 * Creates an ExecutionServiceRef that enqueues jobs instead of executing directly.
 * Provides backwards compatibility with existing agent tool handlers.
 *
 * Each method enqueues a job, waits for the result, and returns it
 * as if the operation were synchronous.
 */
export function createQueuedExecutionService(
  producer: ExecutionProducer,
  userId: string = 'system',
): ExecutionServiceRef {
  async function enqueueAndWait(
    method: OrderExecuteJob['method'],
    request: OrderExecuteJob['request'],
  ): Promise<OrderResultRef> {
    const jobId = await producer.enqueueOrder({
      userId,
      method,
      request,
    });

    const status = await producer.waitForJob(jobId);

    if (status.state === 'failed') {
      return { success: false, error: status.error || 'Job failed' };
    }

    if (status.result && status.result.type === 'order:execute') {
      return status.result.result;
    }

    return { success: false, error: 'Unexpected job result' };
  }

  return {
    async buyLimit(request) {
      return enqueueAndWait('buyLimit', {
        ...request,
        price: request.price,
      });
    },

    async sellLimit(request) {
      return enqueueAndWait('sellLimit', {
        ...request,
        price: request.price,
      });
    },

    async marketBuy(request) {
      return enqueueAndWait('marketBuy', {
        ...request,
        price: undefined,
      });
    },

    async marketSell(request) {
      return enqueueAndWait('marketSell', {
        ...request,
        price: undefined,
      });
    },

    async makerBuy(request) {
      return enqueueAndWait('makerBuy', {
        ...request,
        price: request.price,
      });
    },

    async makerSell(request) {
      return enqueueAndWait('makerSell', {
        ...request,
        price: request.price,
      });
    },

    async cancelOrder(platform, orderId) {
      const jobId = await producer.enqueueCancel({ userId, platform, orderId });
      const status = await producer.waitForJob(jobId);

      if (status.state === 'failed') return false;
      if (status.result && status.result.type === 'order:cancel') {
        return status.result.success;
      }
      return false;
    },

    async cancelAllOrders(platform?, marketId?) {
      const jobId = await producer.enqueueCancelAll({ userId, platform, marketId });
      const status = await producer.waitForJob(jobId);

      if (status.state === 'failed') return 0;
      if (status.result && status.result.type === 'order:cancel_all') {
        return status.result.cancelledCount;
      }
      return 0;
    },

    async getOpenOrders(platform?) {
      // Open orders are a read operation - we don't queue these.
      // They should be handled directly or via a separate read path.
      // For now, return empty array (the direct execution service
      // should be used for reads when available).
      logger.warn('getOpenOrders called on queued execution service - reads should use direct service');
      return [];
    },

    async placeOrdersBatch(orders) {
      const jobId = await producer.enqueueBatch({ userId, orders });
      const status = await producer.waitForJob(jobId);

      if (status.state === 'failed') {
        return orders.map(() => ({ success: false, error: status.error || 'Batch job failed' }));
      }
      if (status.result && status.result.type === 'order:batch') {
        return status.result.results;
      }
      return orders.map(() => ({ success: false, error: 'Unexpected job result' }));
    },

    async cancelOrdersBatch(platform, orderIds) {
      // Cancel batch uses individual cancel jobs for now
      const results: Array<{ orderId: string; success: boolean }> = [];
      for (const orderId of orderIds) {
        const jobId = await producer.enqueueCancel({ userId, platform, orderId });
        const status = await producer.waitForJob(jobId);
        results.push({
          orderId,
          success: status.state === 'completed' &&
            status.result?.type === 'order:cancel' &&
            status.result.success,
        });
      }
      return results;
    },
  };
}
