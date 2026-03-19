/**
 * LLM Task Runner Extension
 * Provides background task execution with LLM agents
 *
 * Supports: Task queuing, parallel execution, progress tracking
 */

import { logger } from '../../utils/logger';
import { generateId as generateSecureId } from '../../utils/id';

export interface LLMTaskConfig {
  enabled: boolean;
  /** Maximum concurrent tasks */
  maxConcurrent?: number;
  /** Task timeout in milliseconds */
  taskTimeoutMs?: number;
  /** Retry failed tasks */
  retryOnFailure?: boolean;
  /** Maximum retries per task */
  maxRetries?: number;
  /** Task persistence path */
  persistPath?: string;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  name: string;
  prompt: string;
  status: TaskStatus;
  progress: number;
  result?: string;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  parentId?: string;
  subtasks?: string[];
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
}

export interface LLMTaskExtension {
  /** Create a new task */
  createTask(name: string, prompt: string, metadata?: Record<string, unknown>): Promise<string>;
  /** Create a subtask under a parent task */
  createSubtask(parentId: string, name: string, prompt: string): Promise<string>;
  /** Get task by ID */
  getTask(taskId: string): Promise<Task | null>;
  /** Get all tasks with optional filter */
  getTasks(filter?: { status?: TaskStatus; parentId?: string }): Promise<Task[]>;
  /** Cancel a task */
  cancelTask(taskId: string): Promise<boolean>;
  /** Wait for task completion */
  waitForTask(taskId: string, timeoutMs?: number): Promise<TaskResult>;
  /** Set task executor function */
  setExecutor(executor: TaskExecutor): void;
  /** Start processing tasks */
  start(): void;
  /** Stop processing tasks */
  stop(): void;
  /** Get queue statistics */
  getStats(): TaskStats;
}

export type TaskExecutor = (task: Task) => Promise<{ result?: string; error?: string }>;

export interface TaskStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgDuration: number;
}

export async function createLLMTaskExtension(config: LLMTaskConfig): Promise<LLMTaskExtension> {
  const maxConcurrent = config.maxConcurrent ?? 3;
  const taskTimeoutMs = config.taskTimeoutMs ?? 300000; // 5 minutes
  const maxRetries = config.maxRetries ?? 3;

  const MAX_COMPLETED_TASKS = 1000;
  const tasks = new Map<string, Task>();
  const pendingQueue: string[] = [];
  const runningTasks = new Set<string>();
  const taskWaiters = new Map<string, Array<(result: TaskResult) => void>>();

  let executor: TaskExecutor | null = null;
  let processingInterval: NodeJS.Timeout | null = null;
  let isRunning = false;

  function generateId(): string {
    return generateSecureId('task');
  }

  async function processTask(taskId: string): Promise<void> {
    const task = tasks.get(taskId);
    if (!task || !executor) return;

    task.status = 'running';
    task.startedAt = Date.now();
    task.attempts++;
    runningTasks.add(taskId);

    logger.info({ taskId, name: task.name, attempt: task.attempts }, 'Starting task');

    let timeoutTimer: NodeJS.Timeout | null = null;
    try {
      // Set up timeout
      const timeoutPromise = new Promise<{ error: string }>((resolve) => {
        timeoutTimer = setTimeout(() => resolve({ error: 'Task timed out' }), taskTimeoutMs);
      });

      const executionPromise = executor(task);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      if (result.error) {
        throw new Error(result.error);
      }

      task.status = 'completed';
      task.result = 'result' in result ? result.result : undefined;
      task.completedAt = Date.now();
      task.progress = 100;

      logger.info(
        { taskId, name: task.name, duration: task.completedAt - (task.startedAt || 0) },
        'Task completed'
      );

      // Notify waiters
      notifyWaiters(taskId, {
        taskId,
        success: true,
        result: 'result' in result ? result.result : undefined,
        duration: task.completedAt - (task.startedAt || 0),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (config.retryOnFailure && task.attempts < maxRetries) {
        logger.warn({ taskId, attempt: task.attempts, maxRetries }, 'Task failed, will retry');
        task.status = 'pending';
        pendingQueue.push(taskId);
      } else {
        task.status = 'failed';
        task.error = errorMessage;
        task.completedAt = Date.now();

        logger.error({ taskId, name: task.name, error: errorMessage }, 'Task failed');

        notifyWaiters(taskId, {
          taskId,
          success: false,
          error: errorMessage,
          duration: task.completedAt - (task.startedAt || 0),
        });
      }
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      runningTasks.delete(taskId);
      evictOldTasks();
    }
  }

  function notifyWaiters(taskId: string, result: TaskResult): void {
    const waiters = taskWaiters.get(taskId);
    if (waiters) {
      for (const resolve of waiters) {
        resolve(result);
      }
      taskWaiters.delete(taskId);
    }
  }

  function evictOldTasks(): void {
    if (tasks.size <= MAX_COMPLETED_TASKS) return;
    const completedTasks = Array.from(tasks.entries())
      .filter(([, t]) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')
      .sort(([, a], [, b]) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    const toRemove = completedTasks.slice(0, tasks.size - MAX_COMPLETED_TASKS);
    for (const [id] of toRemove) {
      tasks.delete(id);
    }
  }

  function processQueue(): void {
    if (!isRunning || !executor) return;

    while (runningTasks.size < maxConcurrent && pendingQueue.length > 0) {
      const taskId = pendingQueue.shift();
      if (taskId && tasks.has(taskId)) {
        processTask(taskId).catch((error) => {
          logger.error({ error, taskId }, 'Unexpected error processing task');
        });
      }
    }
  }

  const extension: LLMTaskExtension = {
    async createTask(
      name: string,
      prompt: string,
      metadata?: Record<string, unknown>
    ): Promise<string> {
      const id = generateId();

      const task: Task = {
        id,
        name,
        prompt,
        status: 'pending',
        progress: 0,
        metadata: metadata || {},
        createdAt: Date.now(),
        attempts: 0,
      };

      tasks.set(id, task);
      pendingQueue.push(id);

      logger.info({ taskId: id, name }, 'Task created');

      if (isRunning) {
        processQueue();
      }

      return id;
    },

    async createSubtask(parentId: string, name: string, prompt: string): Promise<string> {
      const parent = tasks.get(parentId);
      if (!parent) {
        throw new Error(`Parent task ${parentId} not found`);
      }

      const id = await extension.createTask(name, prompt, { parentId });
      const task = tasks.get(id)!;
      task.parentId = parentId;

      if (!parent.subtasks) {
        parent.subtasks = [];
      }
      parent.subtasks.push(id);

      return id;
    },

    async getTask(taskId: string): Promise<Task | null> {
      return tasks.get(taskId) || null;
    },

    async getTasks(filter?: { status?: TaskStatus; parentId?: string }): Promise<Task[]> {
      let result = Array.from(tasks.values());

      if (filter?.status) {
        result = result.filter((t) => t.status === filter.status);
      }

      if (filter?.parentId !== undefined) {
        result = result.filter((t) => t.parentId === filter.parentId);
      }

      return result.sort((a, b) => b.createdAt - a.createdAt);
    },

    async cancelTask(taskId: string): Promise<boolean> {
      const task = tasks.get(taskId);
      if (!task) return false;

      if (task.status === 'pending') {
        const idx = pendingQueue.indexOf(taskId);
        if (idx >= 0) {
          pendingQueue.splice(idx, 1);
        }
        task.status = 'cancelled';
        task.completedAt = Date.now();

        notifyWaiters(taskId, {
          taskId,
          success: false,
          error: 'Task cancelled',
          duration: 0,
        });

        return true;
      }

      if (task.status === 'running') {
        // Can't truly cancel a running task, but mark it
        task.status = 'cancelled';
        return true;
      }

      return false;
    },

    async waitForTask(taskId: string, timeoutMs?: number): Promise<TaskResult> {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // If already completed
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return {
          taskId,
          success: task.status === 'completed',
          result: task.result,
          error: task.error || (task.status === 'cancelled' ? 'Task cancelled' : undefined),
          duration: (task.completedAt || 0) - (task.startedAt || task.createdAt),
        };
      }

      // Wait for completion
      return new Promise((resolve, reject) => {
        const timeout = timeoutMs ?? taskTimeoutMs;

        const wrappedResolve = (result: TaskResult) => {
          clearTimeout(timer);
          resolve(result);
        };

        const timer = setTimeout(() => {
          const waiters = taskWaiters.get(taskId);
          if (waiters) {
            const idx = waiters.indexOf(wrappedResolve);
            if (idx >= 0) waiters.splice(idx, 1);
            if (waiters.length === 0) taskWaiters.delete(taskId);
          }
          reject(new Error('Wait timeout'));
        }, timeout);

        if (!taskWaiters.has(taskId)) {
          taskWaiters.set(taskId, []);
        }
        taskWaiters.get(taskId)!.push(wrappedResolve);
      });
    },

    setExecutor(exec: TaskExecutor): void {
      executor = exec;
    },

    start(): void {
      if (isRunning) return;

      isRunning = true;
      processingInterval = setInterval(processQueue, 100);
      processQueue();

      logger.info({ maxConcurrent }, 'LLM Task runner started');
    },

    stop(): void {
      isRunning = false;
      if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
      }

      logger.info('LLM Task runner stopped');
    },

    getStats(): TaskStats {
      const allTasks = Array.from(tasks.values());
      const completed = allTasks.filter((t) => t.status === 'completed');

      const totalDuration = completed.reduce(
        (sum, t) => sum + ((t.completedAt || 0) - (t.startedAt || t.createdAt)),
        0
      );

      return {
        pending: pendingQueue.length,
        running: runningTasks.size,
        completed: completed.length,
        failed: allTasks.filter((t) => t.status === 'failed').length,
        avgDuration: completed.length > 0 ? totalDuration / completed.length : 0,
      };
    },
  };

  return extension;
}
