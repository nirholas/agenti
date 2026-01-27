/**
 * @fileoverview Queue system exports and interfaces
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

// Re-export all types from types.ts
export type {
  JobStatus,
  JobPriority,
  Job,
  JobOptions,
  QueueConfig,
  QueueStats,
  JobHandler,
  QueueInterface
} from './types';

import type { JobPriority, JobOptions, QueueInterface, QueueConfig, Job, JobStatus } from './types';

// Export implementations
export { MemoryQueue, createMemoryQueue } from './memory-queue';
export { RedisQueue, RedisQueueConfig, createRedisQueue } from './redis-queue';

import type { RedisQueueConfig } from './redis-queue';

/**
 * Queue backend types
 */
export type QueueBackend = 'memory' | 'redis';

/**
 * Queue factory configuration
 */
export interface QueueFactoryConfig<T = unknown> {
  backend: QueueBackend;
  /** Redis-specific configuration */
  redis?: RedisQueueConfig;
  /** Common queue options */
  options?: QueueConfig;
}

/**
 * Create a queue instance based on configuration
 */
export function createQueue<T = unknown>(config: QueueFactoryConfig<T>): QueueInterface<T> {
  const { backend, redis, options } = config;

  switch (backend) {
    case 'memory':
      const { createMemoryQueue } = require('./memory-queue');
      return createMemoryQueue(options) as QueueInterface<T>;

    case 'redis':
      if (!redis?.client) {
        throw new Error('Redis client is required for redis backend');
      }
      const { createRedisQueue } = require('./redis-queue');
      return createRedisQueue({
        ...options,
        ...redis
      }) as QueueInterface<T>;

    default:
      throw new Error(`Unknown queue backend: ${backend}`);
  }
}

/**
 * Convert priority name to number
 */
export function priorityToNumber(priority: JobPriority): number {
  switch (priority) {
    case 'critical':
      return 100;
    case 'high':
      return 50;
    case 'normal':
      return 0;
    case 'low':
      return -50;
    default:
      return 0;
  }
}

/**
 * Helper to create a job with common defaults
 */
export function createJobOptions(
  priority: JobPriority = 'normal',
  options: Partial<JobOptions> = {}
): JobOptions {
  return {
    priority: priorityToNumber(priority),
    maxRetries: 3,
    timeout: 60000,
    ...options
  };
}
