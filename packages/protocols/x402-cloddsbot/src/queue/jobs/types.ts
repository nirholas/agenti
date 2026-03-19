/**
 * Job Queue Types - Job definitions for the BullMQ execution queue
 *
 * Jobs decouple gateway (producers) from execution (workers),
 * allowing independent scaling and fault isolation.
 */

import type { PredictionPlatform, OrderResultRef } from '../../types';

// =============================================================================
// JOB TYPES
// =============================================================================

export type JobType =
  | 'order:execute'
  | 'order:cancel'
  | 'order:cancel_all'
  | 'order:batch'
  | 'copy:trade'
  | 'arb:execute';

// =============================================================================
// JOB DATA (what producers enqueue)
// =============================================================================

export interface OrderExecuteJob {
  type: 'order:execute';
  userId: string;
  requestId: string;
  method: 'buyLimit' | 'sellLimit' | 'marketBuy' | 'marketSell' | 'makerBuy' | 'makerSell';
  request: {
    platform: PredictionPlatform;
    marketId: string;
    tokenId?: string;
    outcome?: string;
    price?: number;
    size: number;
    orderType?: 'GTC' | 'FOK' | 'GTD';
    postOnly?: boolean;
    negRisk?: boolean;
  };
}

export interface OrderCancelJob {
  type: 'order:cancel';
  userId: string;
  requestId: string;
  platform: PredictionPlatform;
  orderId: string;
}

export interface OrderCancelAllJob {
  type: 'order:cancel_all';
  userId: string;
  requestId: string;
  platform?: PredictionPlatform;
  marketId?: string;
}

export interface OrderBatchJob {
  type: 'order:batch';
  userId: string;
  requestId: string;
  orders: Array<{
    platform: PredictionPlatform;
    marketId: string;
    tokenId?: string;
    outcome?: string;
    side: 'buy' | 'sell';
    price: number;
    size: number;
  }>;
}

export interface CopyTradeJob {
  type: 'copy:trade';
  userId: string;
  requestId: string;
  sourceWallet: string;
  trade: {
    platform: PredictionPlatform;
    marketId: string;
    tokenId?: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
  };
}

export interface ArbExecuteJob {
  type: 'arb:execute';
  userId: string;
  requestId: string;
  opportunity: {
    buyPlatform: PredictionPlatform;
    sellPlatform: PredictionPlatform;
    buyMarketId: string;
    sellMarketId: string;
    buyTokenId?: string;
    sellTokenId?: string;
    buyPrice: number;
    sellPrice: number;
    size: number;
    edge: number;
  };
}

export type ExecutionJob =
  | OrderExecuteJob
  | OrderCancelJob
  | OrderCancelAllJob
  | OrderBatchJob
  | CopyTradeJob
  | ArbExecuteJob;

// =============================================================================
// JOB RESULTS (what workers return)
// =============================================================================

export interface OrderExecuteResult {
  type: 'order:execute';
  requestId: string;
  result: OrderResultRef;
}

export interface OrderCancelResult {
  type: 'order:cancel';
  requestId: string;
  success: boolean;
}

export interface OrderCancelAllResult {
  type: 'order:cancel_all';
  requestId: string;
  cancelledCount: number;
}

export interface OrderBatchResult {
  type: 'order:batch';
  requestId: string;
  results: OrderResultRef[];
}

export interface CopyTradeResult {
  type: 'copy:trade';
  requestId: string;
  result: OrderResultRef;
}

export interface ArbExecuteResult {
  type: 'arb:execute';
  requestId: string;
  buyResult: OrderResultRef;
  sellResult: OrderResultRef;
}

export type ExecutionResult =
  | OrderExecuteResult
  | OrderCancelResult
  | OrderCancelAllResult
  | OrderBatchResult
  | CopyTradeResult
  | ArbExecuteResult;

// =============================================================================
// JOB STATUS
// =============================================================================

export type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'waiting-children' | 'prioritized' | 'unknown';

export interface JobStatus {
  id: string;
  state: JobState;
  progress: number;
  result?: ExecutionResult;
  error?: string;
  attemptsMade: number;
  timestamp: number;
}

// =============================================================================
// QUEUE NAMES
// =============================================================================

export const EXECUTION_QUEUE = 'execution';
