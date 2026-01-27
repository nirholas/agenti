/**
 * useMcpPrompts Hook
 * Manages MCP prompt discovery and execution with caching and deduplication
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  McpPrompt,
  PromptExecution,
  PromptMessage,
  UseMcpPromptsOptions,
  UseMcpPromptsReturn,
  ListPromptsResponse,
  GetPromptResponse,
  ApiResponse,
  PromptEvent,
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
const CACHE_KEY_PROMPTS = 'prompts';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMcpPrompts(options: UseMcpPromptsOptions): UseMcpPromptsReturn {
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
    () => createDebugLogger('useMcpPrompts', { enabled: debug }),
    [debug]
  );

  // State
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<PromptExecution[]>([]);
  const [isStale, setIsStale] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const loadAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new SimpleCache<McpPrompt[]>());
  const deduplicatorRef = useRef(new RequestDeduplicator());

  // Event emission helper
  const emitEvent = useCallback(
    (event: Omit<PromptEvent, 'timestamp'>) => {
      if (eventEmitter) {
        eventEmitter.emit({
          ...event,
          timestamp: new Date(),
        } as PromptEvent);
      }
    },
    [eventEmitter]
  );

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
   * Load prompts with caching and stale-while-revalidate
   */
  const loadPromptsInternal = useCallback(async (bypassCache: boolean = false): Promise<void> => {
    if (!sessionId) {
      setError('No active session. Please connect first.');
      return;
    }

    const cacheKey = `${CACHE_KEY_PROMPTS}:${sessionId}`;

    // Check cache first (unless bypassing)
    if (!bypassCache && cacheTtl > 0) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        log.debug('Using cached prompts', { count: cached.length });
        if (mountedRef.current) {
          setPrompts(cached);
          setIsStale(false);
        }
        return;
      }

      // Stale-while-revalidate
      const stale = cacheRef.current.getStale(cacheKey);
      if (stale) {
        log.debug('Using stale prompts while revalidating', { count: stale.length });
        if (mountedRef.current) {
          setPrompts(stale);
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
          type: 'prompts:loading',
          sessionId,
        });

        log.info('Loading prompts');

        const response = await fetchWithTimeout(
          `${API_BASE}/prompts?sessionId=${encodeURIComponent(sessionId)}`,
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
          throw new Error(errorData.error || `Failed to load prompts: ${response.status}`);
        }

        const data = await response.json() as ApiResponse<ListPromptsResponse>;

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Failed to load prompts: No data received');
        }

        log.info('Prompts loaded', { count: data.data.prompts.length });

        // Update cache
        if (cacheTtl > 0) {
          cacheRef.current.set(cacheKey, data.data.prompts, cacheTtl);
        }

        if (mountedRef.current) {
          setPrompts(data.data.prompts);
          setError(null);
          setIsStale(false);
        }

        emitEvent({
          type: 'prompts:loaded',
          sessionId,
          data: { prompts: data.data.prompts },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load prompts';
      log.error('Failed to load prompts', { error: errorMessage });

      if (mountedRef.current) {
        setError(errorMessage);
      }

      emitEvent({
        type: 'prompts:error',
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
   * Load prompts (uses cache)
   */
  const loadPrompts = useCallback(async (): Promise<void> => {
    return loadPromptsInternal(false);
  }, [loadPromptsInternal]);

  /**
   * Force refresh prompts (bypasses cache)
   */
  const refreshPrompts = useCallback(async (): Promise<void> => {
    return loadPromptsInternal(true);
  }, [loadPromptsInternal]);

  // Auto-load prompts when sessionId changes
  useEffect(() => {
    if (sessionId && autoLoad) {
      loadPrompts();
    } else if (!sessionId) {
      setPrompts([]);
      setError(null);
      setIsStale(false);
      cacheRef.current.clear();
    }
  }, [sessionId, autoLoad, loadPrompts]);

  /**
   * Get prompt messages with arguments
   */
  const getPrompt = useCallback(
    async (
      name: string,
      args?: Record<string, string>
    ): Promise<PromptExecution> => {
      if (!sessionId) {
        const execution: PromptExecution = {
          id: generateId(),
          name,
          promptName: name,
          args: args || {},
          arguments: args || {},
          status: 'error',
          error: 'No active session. Please connect first.',
        };
        return execution;
      }

      const executionId = generateId();
      const abortController = new AbortController();
      abortControllersRef.current.set(executionId, abortController);

      const execution: PromptExecution = {
        id: executionId,
        name,
        promptName: name,
        args: args || {},
        arguments: args || {},
        status: 'executing',
        startedAt: new Date(),
      };

      if (mountedRef.current) {
        setExecutions(prev => [execution, ...prev]);
      }

      emitEvent({
        type: 'prompt:executing',
        sessionId,
        data: { name, args },
      });

      log.info('Getting prompt', { name, args });

      try {
        const response = await fetchWithTimeout(`${API_BASE}/prompts/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            name,
            arguments: args || {},
          }),
          signal: abortController.signal,
          timeout,
        });

        if (!mountedRef.current) {
          return execution;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as ApiResponse<never>;
          throw new Error(errorData.error || `Prompt get failed: ${response.status}`);
        }

        const data = await response.json() as ApiResponse<GetPromptResponse>;

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Prompt get failed: No data received');
        }

        log.info('Prompt retrieved', { name, messageCount: data.data.messages?.length });

        const completedExecution: PromptExecution = {
          ...execution,
          status: 'success',
          messages: data.data.messages,
          description: data.data.description,
          completedAt: new Date(),
          executedAt: new Date(),
        };

        if (mountedRef.current) {
          setExecutions(prev =>
            prev.map(e => (e.id === executionId ? completedExecution : e))
          );
        }

        emitEvent({
          type: 'prompt:executed',
          sessionId,
          data: { name, messages: data.data.messages },
        });

        return completedExecution;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          const cancelledExecution: PromptExecution = {
            ...execution,
            status: 'error',
            error: 'Request cancelled',
            completedAt: new Date(),
          };

          if (mountedRef.current) {
            setExecutions(prev =>
              prev.map(e => (e.id === executionId ? cancelledExecution : e))
            );
          }

          return cancelledExecution;
        }

        const errorMessage = err instanceof Error ? err.message : 'Prompt get failed';
        log.error('Prompt get failed', { name, error: errorMessage });

        const failedExecution: PromptExecution = {
          ...execution,
          status: 'error',
          error: errorMessage,
          completedAt: new Date(),
        };

        if (mountedRef.current) {
          setExecutions(prev =>
            prev.map(e => (e.id === executionId ? failedExecution : e))
          );
        }

        emitEvent({
          type: 'prompt:error',
          sessionId,
          data: { name, error: errorMessage },
        });

        return failedExecution;
      } finally {
        abortControllersRef.current.delete(executionId);
      }
    },
    [sessionId, timeout, log, emitEvent]
  );

  /**
   * Execute a prompt (alias for getPrompt for backwards compatibility)
   */
  const executePrompt = getPrompt;

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
   * Get messages from the last successful execution
   */
  const getLastMessages = useCallback((): PromptMessage[] | null => {
    const lastSuccess = executions.find(e => e.status === 'success');
    return lastSuccess?.messages || null;
  }, [executions]);

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
    prompts,
    isLoading,
    error,
    executions,
    isStale,

    // Actions
    loadPrompts,
    refreshPrompts,
    getPrompt,
    executePrompt,
    clearExecutions,
    getLastMessages,
    clearError,
  };
}

export default useMcpPrompts;
