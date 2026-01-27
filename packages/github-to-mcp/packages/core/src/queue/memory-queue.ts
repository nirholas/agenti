/**
 * @fileoverview In-memory queue implementation for background processing
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
 * In-memory queue implementation
 * Suitable for single-instance deployments and development
 */
export class MemoryQueue<T = unknown> implements QueueInterface<T> {
  private jobs: Map<string, Job<T>> = new Map();
  private pendingJobs: Job<T>[] = [];
  private processingJobs: Map<string, Job<T>> = new Map();
  private completedJobs: Map<string, Job<T>> = new Map();
  private failedJobs: Map<string, Job<T>> = new Map();
  private handlers: Map<string, JobHandler<T>> = new Map();
  private onCompleteCallbacks: Array<(job: Job<T>) => void> = [];
  private onFailCallbacks: Array<(job: Job<T>, error: Error) => void> = [];
  private isProcessing = false;
  private config: QueueConfig;
  private jobCounter = 0;

  constructor(config: QueueConfig = {}) {
    this.config = {
      maxConcurrency: 5,
      defaultPriority: 0,
      maxRetries: 3,
      retryDelay: 1000,
      jobTimeout: 60000,
      maxCompletedJobs: 1000,
      maxFailedJobs: 1000,
      ...config
    };
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    this.jobCounter++;
    return `job_${Date.now()}_${this.jobCounter}_${Math.random().toString(36).substring(2, 9)}`;
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

    this.jobs.set(job.id, job);

    // Handle delayed jobs
    if (job.delay && job.delay > 0) {
      setTimeout(() => {
        const existingJob = this.jobs.get(job.id);
        if (existingJob && existingJob.status === 'pending') {
          this.addToPendingQueue(existingJob);
          this.processQueue();
        }
      }, job.delay);
    } else {
      this.addToPendingQueue(job);
      this.processQueue();
    }

    return job;
  }

  /**
   * Add job to pending queue in priority order
   */
  private addToPendingQueue(job: Job<T>): void {
    // Insert in priority order (higher priority first)
    const insertIndex = this.pendingJobs.findIndex(j => (j.priority || 0) < (job.priority || 0));
    if (insertIndex === -1) {
      this.pendingJobs.push(job);
    } else {
      this.pendingJobs.splice(insertIndex, 0, job);
    }
  }

  /**
   * Dequeue the next job
   */
  async dequeue(): Promise<Job<T> | null> {
    const job = this.pendingJobs.shift();
    if (!job) return null;

    job.status = 'processing';
    job.startedAt = new Date();
    job.updatedAt = new Date();
    job.attempts++;

    this.processingJobs.set(job.id, job);
    return job;
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    return job?.status || null;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.jobs.get(jobId) || null;
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
    this.processQueue();
  }

  /**
   * Internal queue processing
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const maxConcurrency = this.config.maxConcurrency || 5;

    while (this.pendingJobs.length > 0 && this.processingJobs.size < maxConcurrency) {
      const job = await this.dequeue();
      if (!job) break;

      this.processJob(job);
    }

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

      this.processingJobs.delete(job.id);
      this.addToCompletedJobs(job);

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

      this.processingJobs.delete(job.id);

      // Check if we should retry
      if (job.attempts < (job.maxRetries || 0)) {
        job.status = 'pending';
        const retryDelay = this.config.retryDelay || 1000;
        const backoffDelay = retryDelay * Math.pow(2, job.attempts - 1); // Exponential backoff

        setTimeout(() => {
          this.addToPendingQueue(job);
          this.processQueue();
        }, backoffDelay);

      } else {
        // Mark as failed
        job.status = 'failed';
        job.failedAt = new Date();
        this.addToFailedJobs(job);

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

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Add to completed jobs with limit
   */
  private addToCompletedJobs(job: Job<T>): void {
    this.completedJobs.set(job.id, job);

    // Enforce max completed jobs limit
    const maxCompleted = this.config.maxCompletedJobs || 1000;
    if (this.completedJobs.size > maxCompleted) {
      const oldestKey = this.completedJobs.keys().next().value;
      if (oldestKey) {
        this.completedJobs.delete(oldestKey);
        this.jobs.delete(oldestKey);
      }
    }
  }

  /**
   * Add to failed jobs with limit
   */
  private addToFailedJobs(job: Job<T>): void {
    this.failedJobs.set(job.id, job);

    // Enforce max failed jobs limit
    const maxFailed = this.config.maxFailedJobs || 1000;
    if (this.failedJobs.size > maxFailed) {
      const oldestKey = this.failedJobs.keys().next().value;
      if (oldestKey) {
        this.failedJobs.delete(oldestKey);
        this.jobs.delete(oldestKey);
      }
    }
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      job.status = 'cancelled';
      job.updatedAt = new Date();
      this.pendingJobs = this.pendingJobs.filter(j => j.id !== jobId);
      return true;
    }

    if (job.status === 'processing') {
      // Can't cancel processing job, but mark it
      job.status = 'cancelled';
      job.updatedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<Job<T> | null> {
    const job = this.failedJobs.get(jobId);
    if (!job) return null;

    job.status = 'pending';
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    job.updatedAt = new Date();

    this.failedJobs.delete(jobId);
    this.addToPendingQueue(job);
    this.processQueue();

    return job;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return {
      pending: this.pendingJobs.length,
      processing: this.processingJobs.size,
      completed: this.completedJobs.size,
      failed: this.failedJobs.size,
      total: this.jobs.size
    };
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus, limit: number = 100): Promise<Job<T>[]> {
    const jobs: Job<T>[] = [];

    switch (status) {
      case 'pending':
        return this.pendingJobs.slice(0, limit);
      case 'processing':
        return Array.from(this.processingJobs.values()).slice(0, limit);
      case 'completed':
        return Array.from(this.completedJobs.values()).slice(0, limit);
      case 'failed':
        return Array.from(this.failedJobs.values()).slice(0, limit);
      default:
        for (const job of this.jobs.values()) {
          if (job.status === status) {
            jobs.push(job);
            if (jobs.length >= limit) break;
          }
        }
        return jobs;
    }
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(): Promise<number> {
    const count = this.completedJobs.size;
    for (const jobId of this.completedJobs.keys()) {
      this.jobs.delete(jobId);
    }
    this.completedJobs.clear();
    return count;
  }

  /**
   * Clear failed jobs
   */
  async clearFailed(): Promise<number> {
    const count = this.failedJobs.size;
    for (const jobId of this.failedJobs.keys()) {
      this.jobs.delete(jobId);
    }
    this.failedJobs.clear();
    return count;
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    this.isProcessing = true; // Prevents new processing
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    this.isProcessing = false;
    this.processQueue();
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    this.isProcessing = true;
    // Wait for processing jobs to complete
    while (this.processingJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Create a memory queue instance
 */
export function createMemoryQueue<T = unknown>(config?: QueueConfig): MemoryQueue<T> {
  return new MemoryQueue<T>(config);
}
