/**
 * useMcpTools Hook
 * Manages MCP tool discovery and execution with caching, deduplication, and batch execution
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  McpTool,
  ToolExecution,
  ToolCallResult,
  UseMcpToolsOptions,
  UseMcpToolsReturn,
  ListToolsResponse,
  ExecuteToolResponse,
  ApiResponse,
  BatchToolRequest,
  BatchToolResult,
  BatchExecutionOptions,
  ToolEvent,
} from './types';
import {
  generateId,
  DEFAULT_TIMEOUT,
  DEFAULT_CACHE_TTL,
  fetchWithTimeout,
  createDebugLogger,
  SimpleCache,
  RequestDeduplicator,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const API_BASE = '/api/playground/v2';
const CACHE_KEY_TOOLS = 'tools';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMcpTools(options: UseMcpToolsOptions): UseMcpToolsReturn {
  const {
    sessionId,
    autoLoad = true,
    debug = false,
    timeout = DEFAULT_TIMEOUT,
    eventEmitter,
    cacheTtl = DEFAULT_CACHE_TTL,
  } = options;

  // Create debug logger
  const log = useMemo(
    () => createDebugLogger('useMcpTools', { enabled: debug }),
    [debug]
  );

  // State
  const [tools, setTools] = useState<McpTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [isStale, setIsStale] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const loadAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new SimpleCache<McpTool[]>());
  const deduplicatorRef = useRef(new RequestDeduplicator());

  // Event emission helper
  const emitEvent = useCallback(
    (event: Omit<ToolEvent, 'timestamp'>) => {
      if (eventEmitter) {
        eventEmitter.emit({
          ...event,
          timestamp: new Date(),
        } as ToolEvent);
      }
    },
    [eventEmitter]
  );

  // Computed: current execution (most recent running)
  const currentExecution = useMemo(() => {
    return executions.find(e => e.status === 'running') ?? null;
  }, [executions]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadAbortRef.current?.abort();
      abortControllersRef.current.forEach(controller => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  /**
   * Load tools with caching and stale-while-revalidate
   */
  const loadToolsInternal = useCallback(async (bypassCache: boolean = false): Promise<void> => {
    if (!sessionId) {
      setError('No active session. Please connect first.');
      return;
    }

    const cacheKey = `${CACHE_KEY_TOOLS}:${sessionId}`;

    // Check cache first (unless bypassing)
    if (!bypassCache && cacheTtl > 0) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        log.debug('Using cached tools', { count: cached.length });
        if (mountedRef.current) {
          setTools(cached);
          setIsStale(false);
        }
        return;
      }

      // Stale-while-revalidate: return stale data while fetching fresh
      const stale = cacheRef.current.getStale(cacheKey);
      if (stale) {
        log.debug('Using stale tools while revalidating', { count: stale.length });
        if (mountedRef.current) {
          setTools(stale);
          setIsStale(true);
        }
      }
    }

    // Deduplicate concurrent requests
    try {
      await deduplicatorRef.current.execute(cacheKey, async () => {
        loadAbortRef.current?.abort();
        loadAbortRef.current = new AbortController();

        if (mountedRef.current) {
          setIsLoading(true);
          setError(null);
        }

        emitEvent({
          type: 'tools:loading',
          sessionId,
        });

        log.info('Loading tools');

        const response = await fetchWithTimeout(
          `${API_BASE}/tools?sessionId=${encodeURIComponent(sessionId)}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: loadAbortRef.current.signal,
            timeout,
          }
        );

        if (!mountedRef.current) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as ApiResponse<never>;
          throw new Error(errorData.error || `Failed to load tools: ${response.status}`);
        }

        const data = await response.json() as ApiResponse<ListToolsResponse>;

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Failed to load tools: No data received');
        }

        log.info('Tools loaded', { count: data.data.tools.length });

        // Update cache
        if (cacheTtl > 0) {
          cacheRef.current.set(cacheKey, data.data.tools, cacheTtl);
        }

        if (mountedRef.current) {
          setTools(data.data.tools);
          setError(null);
          setIsStale(false);
        }

        emitEvent({
          type: 'tools:loaded',
          sessionId,
          data: { tools: data.data.tools },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load tools';
      log.error('Failed to load tools', { error: errorMessage });

      if (mountedRef.current) {
        setError(errorMessage);
      }

      emitEvent({
        type: 'tools:error',
        sessionId,
        data: { error: errorMessage },
      });
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sessionId, cacheTtl, timeout, log, emitEvent]);

  /**
   * Load tools (uses cache)
   */
  const loadTools = useCallback(async (): Promise<void> => {
    return loadToolsInternal(false);
  }, [loadToolsInternal]);

  /**
   * Force refresh tools (bypasses cache)
   */
  const refreshTools = useCallback(async (): Promise<void> => {
    return loadToolsInternal(true);
  }, [loadToolsInternal]);

  // Auto-load tools when sessionId changes
  useEffect(() => {
    if (sessionId && autoLoad) {
      loadTools();
    } else if (!sessionId) {
      setTools([]);
      setError(null);
      setIsStale(false);
      cacheRef.current.clear();
    }
  }, [sessionId, autoLoad, loadTools]);

  /**
   * Execute a single tool
   */
  const executeTool = useCallback(async (
    name: string,
    params: Record<string, unknown>
  ): Promise<ToolExecution> => {
    if (!sessionId) {
      const execution: ToolExecution = {
        id: generateId(),
        toolName: name,
        params,
        status: 'error',
        error: 'No active session. Please connect first.',
        startedAt: new Date(),
        completedAt: new Date(),
        logs: [],
      };
      return execution;
    }

    const executionId = generateId();
    const abortController = new AbortController();
    abortControllersRef.current.set(executionId, abortController);

    const execution: ToolExecution = {
      id: executionId,
      toolName: name,
      params,
      status: 'running',
      startedAt: new Date(),
      logs: [],
    };

    if (mountedRef.current) {
      setExecutions(prev => [execution, ...prev]);
    }

    emitEvent({
      type: 'tool:executing',
      sessionId,
      data: { toolName: name, params },
    });

    log.info('Executing tool', { name, params });

    try {
      const response = await fetchWithTimeout(`${API_BASE}/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, tool: name, params }),
        signal: abortController.signal,
        timeout,
      });

      if (!mountedRef.current) {
        return execution;
      }

      const completedAt = new Date();
      const executionTime = completedAt.getTime() - execution.startedAt.getTime();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ApiResponse<never>;
        throw new Error(errorData.error || `Tool execution failed: ${response.status}`);
      }

      const data = await response.json() as ApiResponse<ExecuteToolResponse>;

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Tool execution failed: No data received');
      }

      const updatedExecution: ToolExecution = {
        ...execution,
        status: data.data.result.isError ? 'error' : 'success',
        result: data.data.result,
        completedAt,
        executionTime: data.data.executionTime || executionTime,
        logs: data.data.logs || [],
      };

      if (data.data.result.isError) {
        const errorContent = data.data.result.content.find(c => c.type === 'text');
        if (errorContent && 'text' in errorContent) {
          updatedExecution.error = errorContent.text;
        }
      }

      log.info('Tool executed', { name, executionTime: updatedExecution.executionTime });

      if (mountedRef.current) {
        setExecutions(prev =>
          prev.map(e => (e.id === executionId ? updatedExecution : e))
        );
      }

      emitEvent({
        type: 'tool:executed',
        sessionId,
        data: {
          toolName: name,
          params,
          result: data.data.result,
          executionTime: updatedExecution.executionTime,
        },
      });

      return updatedExecution;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const cancelledExecution: ToolExecution = {
          ...execution,
          status: 'error',
          error: 'Execution cancelled',
          completedAt: new Date(),
          executionTime: new Date().getTime() - execution.startedAt.getTime(),
        };

        if (mountedRef.current) {
          setExecutions(prev =>
            prev.map(e => (e.id === executionId ? cancelledExecution : e))
          );
        }

        emitEvent({
          type: 'tool:cancelled',
          sessionId,
          data: { toolName: name },
        });

        return cancelledExecution;
      }

      const errorMessage = err instanceof Error ? err.message : 'Tool execution failed';
      log.error('Tool execution failed', { name, error: errorMessage });

      const failedExecution: ToolExecution = {
        ...execution,
        status: 'error',
        error: errorMessage,
        completedAt: new Date(),
        executionTime: new Date().getTime() - execution.startedAt.getTime(),
      };

      if (mountedRef.current) {
        setExecutions(prev =>
          prev.map(e => (e.id === executionId ? failedExecution : e))
        );
      }

      emitEvent({
        type: 'tool:error',
        sessionId,
        data: { toolName: name, error: errorMessage },
      });

      return failedExecution;
    } finally {
      abortControllersRef.current.delete(executionId);
    }
  }, [sessionId, timeout, log, emitEvent]);

  /**
   * Execute multiple tools in parallel (batch execution)
   */
  const executeBatch = useCallback(async (
    requests: BatchToolRequest[],
    options: BatchExecutionOptions = {}
  ): Promise<BatchToolResult[]> => {
    const {
      concurrency = 5,
      stopOnError = false,
      timeout: batchTimeout = timeout,
    } = options;

    log.info('Executing batch', { count: requests.length, concurrency });

    const results: BatchToolResult[] = [];
    const queue = [...requests];
    const executing: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      if (queue.length === 0) return;

      const request = queue.shift()!;

      try {
        const execution = await executeTool(request.name, request.params);
        results.push({ request, execution });

        if (stopOnError && execution.status === 'error') {
          // Clear remaining queue
          queue.length = 0;
          return;
        }
      } catch (err) {
        const execution: ToolExecution = {
          id: generateId(),
          toolName: request.name,
          params: request.params,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          startedAt: new Date(),
          completedAt: new Date(),
          logs: [],
        };
        results.push({ request, execution });

        if (stopOnError) {
          queue.length = 0;
          return;
        }
      }
    };

    // Process with concurrency limit
    while (queue.length > 0 || executing.length > 0) {
      // Start new executions up to concurrency limit
      while (executing.length < concurrency && queue.length > 0) {
        const promise = processNext().then(() => {
          const index = executing.indexOf(promise);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });
        executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    log.info('Batch completed', { count: results.length });
    return results;
  }, [executeTool, timeout, log]);

  /**
   * Cancel a running execution
   */
  const cancelExecution = useCallback((id: string): void => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      log.debug('Cancelling execution', { id });
      controller.abort();
    }
  }, [log]);

  /**
   * Clear all executions
   */
  const clearExecutions = useCallback((): void => {
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();

    if (mountedRef.current) {
      setExecutions([]);
    }
  }, []);

  /**
   * Clear the error state
   */
  const clearError = useCallback((): void => {
    if (mountedRef.current) {
      setError(null);
    }
  }, []);

  return {
    // State
    tools,
    isLoading,
    error,
    executions,
    currentExecution,
    isStale,

    // Actions
    loadTools,
    refreshTools,
    executeTool,
    executeBatch,
    cancelExecution,
    clearExecutions,
    clearError,
  };
}

export default useMcpTools;
