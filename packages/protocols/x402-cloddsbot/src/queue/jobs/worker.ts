/**
 * Execution Worker - Processes execution jobs from BullMQ
 *
 * Runs as a separate process from the gateway.
 * Holds the ExecutionService and processes orders independently.
 */

import { Worker, Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { logger } from '../../utils/logger';
import type { ExecutionService } from '../../execution';
import {
  EXECUTION_QUEUE,
  type ExecutionJob,
  type ExecutionResult,
  type OrderExecuteJob,
  type OrderCancelJob,
  type OrderCancelAllJob,
  type OrderBatchJob,
  type CopyTradeJob,
  type ArbExecuteJob,
} from './types';

// =============================================================================
// WORKER CONFIG
// =============================================================================

export interface WorkerConfig {
  redis: RedisOptions;
  /** Number of concurrent jobs (default: 10) */
  concurrency?: number;
  /** Execution service instance for processing orders */
  executionService: ExecutionService;
  /** Lock duration in ms (default: 30000) */
  lockDuration?: number;
  /** Stalled job check interval in ms (default: 30000) */
  stalledInterval?: number;
}

// =============================================================================
// JOB PROCESSORS
// =============================================================================

async function processOrderExecute(
  job: Job<OrderExecuteJob>,
  execService: ExecutionService,
): Promise<ExecutionResult> {
  const { method, request, requestId } = job.data;

  logger.info(
    { jobId: job.id, method, platform: request.platform, marketId: request.marketId },
    'Processing order execution job'
  );

  let result;

  switch (method) {
    case 'buyLimit':
      result = await execService.buyLimit(request as Parameters<ExecutionService['buyLimit']>[0]);
      break;
    case 'sellLimit':
      result = await execService.sellLimit(request as Parameters<ExecutionService['sellLimit']>[0]);
      break;
    case 'marketBuy':
      result = await execService.marketBuy(request as Parameters<ExecutionService['marketBuy']>[0]);
      break;
    case 'marketSell':
      result = await execService.marketSell(request as Parameters<ExecutionService['marketSell']>[0]);
      break;
    case 'makerBuy':
      result = await execService.makerBuy(request as Parameters<ExecutionService['makerBuy']>[0]);
      break;
    case 'makerSell':
      result = await execService.makerSell(request as Parameters<ExecutionService['makerSell']>[0]);
      break;
    default:
      throw new Error(`Unknown execution method: ${method}`);
  }

  logger.info(
    { jobId: job.id, orderId: result.orderId, success: result.success },
    'Order execution job completed'
  );

  return {
    type: 'order:execute',
    requestId,
    result: {
      success: result.success,
      orderId: result.orderId,
      error: result.error,
      avgFillPrice: result.avgFillPrice,
      filledSize: result.filledSize,
      status: result.status,
      transactionHash: result.transactionHash,
    },
  };
}

async function processOrderCancel(
  job: Job<OrderCancelJob>,
  execService: ExecutionService,
): Promise<ExecutionResult> {
  const { platform, orderId, requestId } = job.data;

  logger.info({ jobId: job.id, platform, orderId }, 'Processing cancel job');

  const success = await execService.cancelOrder(platform, orderId);

  logger.info({ jobId: job.id, success }, 'Cancel job completed');

  return {
    type: 'order:cancel',
    requestId,
    success,
  };
}

async function processOrderCancelAll(
  job: Job<OrderCancelAllJob>,
  execService: ExecutionService,
): Promise<ExecutionResult> {
  const { platform, marketId, requestId } = job.data;

  logger.info({ jobId: job.id, platform, marketId }, 'Processing cancel-all job');

  const cancelledCount = await execService.cancelAllOrders(platform, marketId);

  logger.info({ jobId: job.id, cancelledCount }, 'Cancel-all job completed');

  return {
    type: 'order:cancel_all',
    requestId,
    cancelledCount,
  };
}

async function processOrderBatch(
  job: Job<OrderBatchJob>,
  execService: ExecutionService,
): Promise<ExecutionResult> {
  const { orders, requestId } = job.data;

  logger.info({ jobId: job.id, orderCount: orders.length }, 'Processing batch order job');

  const results = await execService.placeOrdersBatch(orders);

  const successful = results.filter(r => r.success).length;
  logger.info(
    { jobId: job.id, total: orders.length, successful },
    'Batch order job completed'
  );

  return {
    type: 'order:batch',
    requestId,
    results: results.map(r => ({
      success: r.success,
      orderId: r.orderId,
      error: r.error,
      avgFillPrice: r.avgFillPrice,
      filledSize: r.filledSize,
      status: r.status,
      transactionHash: r.transactionHash,
    })),
  };
}

async function processCopyTrade(
  job: Job<CopyTradeJob>,
  execService: ExecutionService,
): Promise<ExecutionResult> {
  const { trade, requestId } = job.data;

  logger.info(
    { jobId: job.id, platform: trade.platform, marketId: trade.marketId, side: trade.side },
    'Processing copy trade job'
  );

  const request = {
    platform: trade.platform,
    marketId: trade.marketId,
    tokenId: trade.tokenId,
    price: trade.price,
    size: trade.size,
  };

  const result = trade.side === 'buy'
    ? await execService.buyLimit(request)
    : await execService.sellLimit(request);

  logger.info({ jobId: job.id, success: result.success }, 'Copy trade job completed');

  return {
    type: 'copy:trade',
    requestId,
    result: {
      success: result.success,
      orderId: result.orderId,
      error: result.error,
      avgFillPrice: result.avgFillPrice,
      filledSize: result.filledSize,
      status: result.status,
      transactionHash: result.transactionHash,
    },
  };
}

async function processArbExecute(
  job: Job<ArbExecuteJob>,
  execService: ExecutionService,
): Promise<ExecutionResult> {
  const { opportunity, requestId } = job.data;

  logger.info(
    {
      jobId: job.id,
      buyPlatform: opportunity.buyPlatform,
      sellPlatform: opportunity.sellPlatform,
      edge: opportunity.edge,
    },
    'Processing arbitrage execution job'
  );

  // Execute both legs in parallel — use allSettled so one failure doesn't mask the other
  const [buySettled, sellSettled] = await Promise.allSettled([
    execService.buyLimit({
      platform: opportunity.buyPlatform,
      marketId: opportunity.buyMarketId,
      tokenId: opportunity.buyTokenId,
      price: opportunity.buyPrice,
      size: opportunity.size,
    }),
    execService.sellLimit({
      platform: opportunity.sellPlatform,
      marketId: opportunity.sellMarketId,
      tokenId: opportunity.sellTokenId,
      price: opportunity.sellPrice,
      size: opportunity.size,
    }),
  ]);

  const failedResult = (reason: unknown) => ({
    success: false as const,
    error: reason instanceof Error ? reason.message : String(reason),
    orderId: undefined,
    avgFillPrice: undefined,
    filledSize: undefined,
    status: undefined,
    transactionHash: undefined,
  });

  const buyResult = buySettled.status === 'fulfilled' ? buySettled.value : failedResult(buySettled.reason);
  const sellResult = sellSettled.status === 'fulfilled' ? sellSettled.value : failedResult(sellSettled.reason);

  logger.info(
    { jobId: job.id, buySuccess: buyResult.success, sellSuccess: sellResult.success },
    'Arbitrage execution job completed'
  );

  return {
    type: 'arb:execute',
    requestId,
    buyResult: {
      success: buyResult.success,
      orderId: buyResult.orderId,
      error: buyResult.error,
      avgFillPrice: buyResult.avgFillPrice,
      filledSize: buyResult.filledSize,
      status: buyResult.status,
      transactionHash: buyResult.transactionHash,
    },
    sellResult: {
      success: sellResult.success,
      orderId: sellResult.orderId,
      error: sellResult.error,
      avgFillPrice: sellResult.avgFillPrice,
      filledSize: sellResult.filledSize,
      status: sellResult.status,
      transactionHash: sellResult.transactionHash,
    },
  };
}

// =============================================================================
// WORKER FACTORY
// =============================================================================

export function createExecutionWorker(config: WorkerConfig): Worker<ExecutionJob, ExecutionResult> {
  const { executionService, concurrency = 10 } = config;

  const worker = new Worker<ExecutionJob, ExecutionResult>(
    EXECUTION_QUEUE,
    async (job: Job<ExecutionJob, ExecutionResult>) => {
      const jobData = job.data;

      switch (jobData.type) {
        case 'order:execute':
          return processOrderExecute(job as Job<OrderExecuteJob>, executionService);
        case 'order:cancel':
          return processOrderCancel(job as Job<OrderCancelJob>, executionService);
        case 'order:cancel_all':
          return processOrderCancelAll(job as Job<OrderCancelAllJob>, executionService);
        case 'order:batch':
          return processOrderBatch(job as Job<OrderBatchJob>, executionService);
        case 'copy:trade':
          return processCopyTrade(job as Job<CopyTradeJob>, executionService);
        case 'arb:execute':
          return processArbExecute(job as Job<ArbExecuteJob>, executionService);
        default:
          throw new Error(`Unknown job type: ${(jobData as any).type}`);
      }
    },
    {
      connection: config.redis,
      concurrency,
      lockDuration: config.lockDuration ?? 30_000,
      stalledInterval: config.stalledInterval ?? 30_000,
    },
  );

  worker.on('completed', (job) => {
    logger.debug(
      { jobId: job.id, type: job.data.type },
      'Execution job completed'
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, type: job?.data.type, error: err.message },
      'Execution job failed'
    );
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Execution job stalled');
  });

  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'Worker error');
  });

  logger.info(
    { concurrency, queue: EXECUTION_QUEUE },
    'Execution worker started'
  );

  return worker;
}
