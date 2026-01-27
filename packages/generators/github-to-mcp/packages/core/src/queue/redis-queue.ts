/**
 * @fileoverview Redis-based queue implementation for distributed processing
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type {
  QueueInterface,
  Job,
  JobStatus,
  JobOptions,
  QueueConfig,
  JobHandler,
  QueueStats
} from './types';

/**
 * Redis client interface (compatible with ioredis and node-redis)
 */
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpop(key: string): Promise<string | null>;
  brpop(key: string, timeout: number): Promise<[string, string] | null>;
  llen(key: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  lrem(key: string, count: number, value: string): Promise<number>;
  zadd(key: string, ...args: (string | number)[]): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zrangebyscore(key: string, min: string | number, max: string | number): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zcard(key: string): Promise<number>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hlen(key: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  quit(): Promise<any>;
  publish?(channel: string, message: string): Promise<number>;
  subscribe?(channel: string, callback: (message: string) => void): Promise<void>;
}

/**
 * Redis queue configuration
 */
export interface RedisQueueConfig extends QueueConfig {
  /** Redis client instance */
  client: RedisClientInterface;
  /** Queue name (used as Redis key prefix) */
  queueName?: string;
  /** Use blocking pop for job consumption */
  useBlocking?: boolean;
  /** Blocking timeout in seconds */
  blockingTimeout?: number;
  /** Enable distributed locking */
  enableLocking?: boolean;
  /** Lock TTL in milliseconds */
  lockTTL?: number;
}

/**
 * Redis-based queue implementation
 * Supports distributed processing across multiple workers
 */
export class RedisQueue<T = unknown> implements QueueInterface<T> {
  private client: RedisClientInterface;
  private config: RedisQueueConfig;
  private handlers: Map<string, JobHandler<T>> = new Map();
  private onCompleteCallbacks: Array<(job: Job<T>) => void> = [];
  private onFailCallbacks: Array<(job: Job<T>, error: Error) => void> = [];
  private isProcessing = false;
  private shouldStop = false;
  private jobCounter = 0;

  // Redis key prefixes
  private keys: {
    pending: string;
    delayed: string;
    processing: string;
    completed: string;
    failed: string;
    jobs: string;
    locks: string;
  };

  constructor(config: RedisQueueConfig) {
    this.client = config.client;
    this.config = {
      queueName: 'mcp-queue',
      maxConcurrency: 5,
      defaultPriority: 0,
      maxRetries: 3,
      retryDelay: 1000,
      jobTimeout: 60000,
      useBlocking: true,
      blockingTimeout: 5,
      enableLocking: true,
      lockTTL: 30000,
      ...config
    };

    const prefix = this.config.queueName!;
    this.keys = {
      pending: `${prefix}:pending`,
      delayed: `${prefix}:delayed`,
      processing: `${prefix}:processing`,
      completed: `${prefix}:completed`,
      failed: `${prefix}:failed`,
      jobs: `${prefix}:jobs`,
      locks: `${prefix}:locks`
    };
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    this.jobCounter++;
    const workerId = process.pid || Math.random().toString(36).substring(2, 6);
    return `job_${Date.now()}_${workerId}_${this.jobCounter}`;
  }

  /**
   * Serialize job for storage
   */
  private serializeJob(job: Job<T>): string {
    return JSON.stringify({
      ...job,
      createdAt: job.createdAt?.toISOString(),
      updatedAt: job.updatedAt?.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      failedAt: job.failedAt?.toISOString()
    });
  }

  /**
   * Deserialize job from storage
   */
  private deserializeJob(data: string): Job<T> {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : undefined,
      updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : undefined,
      startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
      failedAt: parsed.failedAt ? new Date(parsed.failedAt) : undefined
    };
  }

  /**
   * Enqueue a new job
   */
  async enqueue(data: T, options: JobOptions = {}): Promise<Job<T>> {
    const job: Job<T> = {
      id: this.generateJobId(),
      data,
      status: 'pending',
      priority: options.priority ?? this.config.defaultPriority ?? 0,
      attempts: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries ?? 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      delay: options.delay,
      timeout: options.timeout ?? this.config.jobTimeout,
      tags: options.tags,
      metadata: options.metadata
    };

    // Store job data
    await this.client.hset(this.keys.jobs, job.id, this.serializeJob(job));

    if (job.delay && job.delay > 0) {
      // Add to delayed set with score = timestamp when it should run
      const runAt = Date.now() + job.delay;
      await this.client.zadd(this.keys.delayed, runAt, job.id);
    } else {
      // Add to pending queue with priority
      await this.addToPendingQueue(job);
    }

    return job;
  }

  /**
   * Add job to pending queue with priority
   */
  private async addToPendingQueue(job: Job<T>): Promise<void> {
    // Use sorted set for priority ordering (higher priority = higher score)
    const score = (job.priority || 0) * 1000000000 + (1000000000 - Date.now() % 1000000000);
    await this.client.zadd(this.keys.pending, score, job.id);
  }

  /**
   * Move delayed jobs to pending queue
   */
  private async processDelayedJobs(): Promise<void> {
    const now = Date.now();
    const jobIds = await this.client.zrangebyscore(this.keys.delayed, '-inf', now);

    for (const jobId of jobIds) {
      const jobData = await this.client.hget(this.keys.jobs, jobId);
      if (jobData) {
        const job = this.deserializeJob(jobData);
        await this.client.zrem(this.keys.delayed, jobId);
        await this.addToPendingQueue(job);
      }
    }
  }

  /**
   * Dequeue the next job
   */
  async dequeue(): Promise<Job<T> | null> {
    // Process any delayed jobs first
    await this.processDelayedJobs();

    // Get highest priority job
    const jobIds = await this.client.zrange(this.keys.pending, -1, -1);
    if (jobIds.length === 0) return null;

    const jobId = jobIds[0];

    // Remove from pending
    const removed = await this.client.zrem(this.keys.pending, jobId);
    if (removed === 0) return null; // Another worker got it

    // Get job data
    const jobData = await this.client.hget(this.keys.jobs, jobId);
    if (!jobData) return null;

    const job = this.deserializeJob(jobData);
    job.status = 'processing';
    job.startedAt = new Date();
    job.updatedAt = new Date();
    job.attempts++;

    // Add to processing set
    await this.client.hset(this.keys.processing, jobId, this.serializeJob(job));
    await this.client.hset(this.keys.jobs, jobId, this.serializeJob(job));

    return job;
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<JobStatus | null> {
    const jobData = await this.client.hget(this.keys.jobs, jobId);
    if (!jobData) return null;
    const job = this.deserializeJob(jobData);
    return job.status;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<T> | null> {
    const jobData = await this.client.hget(this.keys.jobs, jobId);
    if (!jobData) return null;
    return this.deserializeJob(jobData);
  }

  /**
   * Register job completion callback
   */
  onComplete(callback: (job: Job<T>) => void): void {
    this.onCompleteCallbacks.push(callback);
  }

  /**
   * Register job failure callback
   */
  onFail(callback: (job: Job<T>, error: Error) => void): void {
    this.onFailCallbacks.push(callback);
  }

  /**
   * Register a job handler
   */
  registerHandler(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler);
  }

  /**
   * Process jobs with the default handler
   */
  async process(handler: JobHandler<T>): Promise<void> {
    this.handlers.set('default', handler);
    this.shouldStop = false;
    this.processQueue();
  }

  /**
   * Internal queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const maxConcurrency = this.config.maxConcurrency || 5;
    const activeJobs: Promise<void>[] = [];

    while (!this.shouldStop) {
      // Wait for a slot if at max concurrency
      while (activeJobs.length >= maxConcurrency) {
        await Promise.race(activeJobs);
        // Remove completed promises
        for (let i = activeJobs.length - 1; i >= 0; i--) {
          const job = activeJobs[i];
          if (await Promise.race([job.then(() => true), Promise.resolve(false)])) {
            activeJobs.splice(i, 1);
          }
        }
      }

      const job = await this.dequeue();
      if (!job) {
        // No jobs, wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const jobPromise = this.processJob(job);
      activeJobs.push(jobPromise);
    }

    // Wait for all active jobs to complete
    await Promise.all(activeJobs);
    this.isProcessing = false;
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job<T>): Promise<void> {
    const handler = this.handlers.get('default');
    if (!handler) {
      console.warn('No handler registered for job processing');
      return;
    }

    // Set up timeout
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      if (job.timeout) {
        timeoutId = setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out after ${job.timeout}ms`));
        }, job.timeout);
      }
    });

    try {
      const result = await Promise.race([
        handler(job),
        timeoutPromise
      ]);

      if (timeoutId) clearTimeout(timeoutId);

      // Job completed successfully
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      job.updatedAt = new Date();

      // Move to completed
      await this.client.hdel(this.keys.processing, job.id);
      await this.client.zadd(this.keys.completed, Date.now(), job.id);
      await this.client.hset(this.keys.jobs, job.id, this.serializeJob(job));

      // Notify callbacks
      this.onCompleteCallbacks.forEach(cb => {
        try {
          cb(job);
        } catch (err) {
          console.error('Error in onComplete callback:', err);
        }
      });

    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);

      const err = error instanceof Error ? error : new Error(String(error));
      job.error = err.message;
      job.updatedAt = new Date();

      await this.client.hdel(this.keys.processing, job.id);

      // Check if we should retry
      if (job.attempts < (job.maxRetries || 0)) {
        job.status = 'pending';
        const retryDelay = this.config.retryDelay || 1000;
        const backoffDelay = retryDelay * Math.pow(2, job.attempts - 1);

        // Add to delayed queue for retry
        const runAt = Date.now() + backoffDelay;
        await this.client.zadd(this.keys.delayed, runAt, job.id);
        await this.client.hset(this.keys.jobs, job.id, this.serializeJob(job));

      } else {
        // Mark as failed
        job.status = 'failed';
        job.failedAt = new Date();
        await this.client.zadd(this.keys.failed, Date.now(), job.id);
        await this.client.hset(this.keys.jobs, job.id, this.serializeJob(job));

        // Notify callbacks
        this.onFailCallbacks.forEach(cb => {
          try {
            cb(job, err);
          } catch (callbackErr) {
            console.error('Error in onFail callback:', callbackErr);
          }
        });
      }
    }
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      job.status = 'cancelled';
      job.updatedAt = new Date();
      await this.client.zrem(this.keys.pending, jobId);
      await this.client.hset(this.keys.jobs, jobId, this.serializeJob(job));
      return true;
    }

    return false;
  }

  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<Job<T> | null> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'failed') return null;

    job.status = 'pending';
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    job.updatedAt = new Date();

    await this.client.zrem(this.keys.failed, jobId);
    await this.addToPendingQueue(job);
    await this.client.hset(this.keys.jobs, jobId, this.serializeJob(job));

    return job;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.client.zcard(this.keys.pending),
      this.client.hlen(this.keys.processing),
      this.client.zcard(this.keys.completed),
      this.client.zcard(this.keys.failed)
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed
    };
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus, limit: number = 100): Promise<Job<T>[]> {
    let jobIds: string[] = [];

    switch (status) {
      case 'pending':
        jobIds = await this.client.zrange(this.keys.pending, -limit, -1);
        break;
      case 'processing':
        const processingData = await this.client.hgetall(this.keys.processing);
        jobIds = Object.keys(processingData).slice(0, limit);
        break;
      case 'completed':
        jobIds = await this.client.zrange(this.keys.completed, -limit, -1);
        break;
      case 'failed':
        jobIds = await this.client.zrange(this.keys.failed, -limit, -1);
        break;
    }

    const jobs: Job<T>[] = [];
    for (const jobId of jobIds) {
      const job = await this.getJob(jobId);
      if (job) jobs.push(job);
    }

    return jobs;
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(): Promise<number> {
    const jobIds = await this.client.zrange(this.keys.completed, 0, -1);
    if (jobIds.length === 0) return 0;

    await this.client.del(this.keys.completed);
    for (const jobId of jobIds) {
      await this.client.hdel(this.keys.jobs, jobId);
    }

    return jobIds.length;
  }

  /**
   * Clear failed jobs
   */
  async clearFailed(): Promise<number> {
    const jobIds = await this.client.zrange(this.keys.failed, 0, -1);
    if (jobIds.length === 0) return 0;

    await this.client.del(this.keys.failed);
    for (const jobId of jobIds) {
      await this.client.hdel(this.keys.jobs, jobId);
    }

    return jobIds.length;
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    this.shouldStop = true;
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    this.shouldStop = false;
    if (!this.isProcessing && this.handlers.has('default')) {
      this.processQueue();
    }
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    this.shouldStop = true;
    // Wait for processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await this.client.quit();
  }
}

/**
 * Create a Redis queue instance
 */
export function createRedisQueue<T = unknown>(config: RedisQueueConfig): RedisQueue<T> {
  return new RedisQueue<T>(config);
}
