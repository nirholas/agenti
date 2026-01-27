/**
 * @fileoverview Queue type definitions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Job status types
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'delayed';

/**
 * Job priority levels
 */
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Job definition
 */
export interface Job<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Job payload data */
  data: T;
  /** Current job status */
  status: JobStatus;
  /** Job priority (higher = processed first) */
  priority?: number;
  /** Number of processing attempts */
  attempts: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Job result (when completed) */
  result?: unknown;
  /** Error message (when failed) */
  error?: string;
  /** Delay in milliseconds before processing */
  delay?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Job creation timestamp */
  createdAt?: Date;
  /** Last update timestamp */
  updatedAt?: Date;
  /** Processing start timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Failure timestamp */
  failedAt?: Date;
  /** Custom tags for filtering */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Job options for enqueueing
 */
export interface JobOptions {
  /** Job priority (higher = processed first) */
  priority?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Delay in milliseconds before processing */
  delay?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Custom tags for filtering */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Maximum concurrent jobs */
  maxConcurrency?: number;
  /** Default job priority */
  defaultPriority?: number;
  /** Default max retries */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Default job timeout in milliseconds */
  jobTimeout?: number;
  /** Maximum completed jobs to keep */
  maxCompletedJobs?: number;
  /** Maximum failed jobs to keep */
  maxFailedJobs?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Number of pending jobs */
  pending: number;
  /** Number of processing jobs */
  processing: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Total jobs in queue */
  total: number;
}

/**
 * Job handler function
 */
export type JobHandler<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

/**
 * Queue interface that all queue implementations must follow
 */
export interface QueueInterface<T = unknown> {
  /**
   * Enqueue a new job
   * @param data - Job payload
   * @param options - Job options
   * @returns The created job
   */
  enqueue(data: T, options?: JobOptions): Promise<Job<T>>;

  /**
   * Dequeue the next job for processing
   * @returns The next job or null if queue is empty
   */
  dequeue(): Promise<Job<T> | null>;

  /**
   * Get job status
   * @param jobId - Job ID
   * @returns Job status or null if not found
   */
  getStatus(jobId: string): Promise<JobStatus | null>;

  /**
   * Get job by ID
   * @param jobId - Job ID
   * @returns Job or null if not found
   */
  getJob(jobId: string): Promise<Job<T> | null>;

  /**
   * Register a callback for job completion
   * @param callback - Callback function
   */
  onComplete(callback: (job: Job<T>) => void): void;

  /**
   * Register a callback for job failure
   * @param callback - Callback function
   */
  onFail(callback: (job: Job<T>, error: Error) => void): void;

  /**
   * Process jobs with a handler
   * @param handler - Job handler function
   */
  process(handler: JobHandler<T>): Promise<void>;

  /**
   * Cancel a job
   * @param jobId - Job ID
   * @returns True if job was cancelled
   */
  cancel?(jobId: string): Promise<boolean>;

  /**
   * Retry a failed job
   * @param jobId - Job ID
   * @returns The retried job or null
   */
  retry?(jobId: string): Promise<Job<T> | null>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<QueueStats>;

  /**
   * Get jobs by status
   * @param status - Job status to filter
   * @param limit - Maximum jobs to return
   */
  getJobsByStatus?(status: JobStatus, limit?: number): Promise<Job<T>[]>;

  /**
   * Clear completed jobs
   * @returns Number of jobs cleared
   */
  clearCompleted?(): Promise<number>;

  /**
   * Clear failed jobs
   * @returns Number of jobs cleared
   */
  clearFailed?(): Promise<number>;

  /**
   * Pause the queue
   */
  pause?(): Promise<void>;

  /**
   * Resume the queue
   */
  resume?(): Promise<void>;

  /**
   * Close the queue connection
   */
  close?(): Promise<void>;
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
