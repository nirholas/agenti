/**
 * Queue Jobs - BullMQ job queue for execution isolation
 *
 * Decouples gateway (producers) from execution (workers):
 * - Gateway enqueues jobs via ExecutionProducer
 * - Worker processes jobs via ExecutionWorker
 * - Redis provides persistence, retry, and distribution
 */

export * from './types';
export { createExecutionProducer, createQueuedExecutionService, type ExecutionProducer, type ProducerConfig } from './producer';
export { createExecutionWorker, type WorkerConfig } from './worker';
