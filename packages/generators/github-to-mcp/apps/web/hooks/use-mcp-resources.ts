/**
 * useMcpResources Hook
 * Manages MCP resource discovery and reading with caching and deduplication
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  McpResource,
  ResourceRead,
  ResourceContents,
  UseMcpResourcesOptions,
  UseMcpResourcesReturn,
  ListResourcesResponse,
  ReadResourceResponse,
  ApiResponse,
  ResourceEvent,
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
const CACHE_KEY_RESOURCES = 'resources';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMcpResources(options: UseMcpResourcesOptions): UseMcpResourcesReturn {
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
    () => createDebugLogger('useMcpResources', { enabled: debug }),
    [debug]
  );

  // State
  const [resources, setResources] = useState<McpResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState<ResourceRead[]>([]);
  const [isStale, setIsStale] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const loadAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new SimpleCache<McpResource[]>());
  const readCacheRef = useRef(new SimpleCache<ResourceContents>());
  const deduplicatorRef = useRef(new RequestDeduplicator());

  // Event emission helper
  const emitEvent = useCallback(
    (event: Omit<ResourceEvent, 'timestamp'>) => {
      if (eventEmitter) {
        eventEmitter.emit({
          ...event,
          timestamp: new Date(),
        } as ResourceEvent);
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
   * Load resources with caching and stale-while-revalidate
   */
  const loadResourcesInternal = useCallback(async (bypassCache: boolean = false): Promise<void> => {
    if (!sessionId) {
      setError('No active session. Please connect first.');
      return;
    }

    const cacheKey = `${CACHE_KEY_RESOURCES}:${sessionId}`;

    // Check cache first (unless bypassing)
    if (!bypassCache && cacheTtl > 0) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        log.debug('Using cached resources', { count: cached.length });
        if (mountedRef.current) {
          setResources(cached);
          setIsStale(false);
        }
        return;
      }

      // Stale-while-revalidate
      const stale = cacheRef.current.getStale(cacheKey);
      if (stale) {
        log.debug('Using stale resources while revalidating', { count: stale.length });
        if (mountedRef.current) {
          setResources(stale);
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
          type: 'resources:loading',
          sessionId,
        });

        log.info('Loading resources');

        const response = await fetchWithTimeout(
          `${API_BASE}/resources?sessionId=${encodeURIComponent(sessionId)}`,
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
          throw new Error(errorData.error || `Failed to load resources: ${response.status}`);
        }

        const data = await response.json() as ApiResponse<ListResourcesResponse>;

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Failed to load resources: No data received');
        }

        log.info('Resources loaded', { count: data.data.resources.length });

        // Update cache
        if (cacheTtl > 0) {
          cacheRef.current.set(cacheKey, data.data.resources, cacheTtl);
        }

        if (mountedRef.current) {
          setResources(data.data.resources);
          setError(null);
          setIsStale(false);
        }

        emitEvent({
          type: 'resources:loaded',
          sessionId,
          data: { resources: data.data.resources },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load resources';
      log.error('Failed to load resources', { error: errorMessage });

      if (mountedRef.current) {
        setError(errorMessage);
      }

      emitEvent({
        type: 'resources:error',
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
   * Load resources (uses cache)
   */
  const loadResources = useCallback(async (): Promise<void> => {
    return loadResourcesInternal(false);
  }, [loadResourcesInternal]);

  /**
   * Force refresh resources (bypasses cache)
   */
  const refreshResources = useCallback(async (): Promise<void> => {
    return loadResourcesInternal(true);
  }, [loadResourcesInternal]);

  // Auto-load resources when sessionId changes
  useEffect(() => {
    if (sessionId && autoLoad) {
      loadResources();
    } else if (!sessionId) {
      setResources([]);
      setError(null);
      setIsStale(false);
      cacheRef.current.clear();
      readCacheRef.current.clear();
    }
  }, [sessionId, autoLoad, loadResources]);

  /**
   * Read a resource by URI
   */
  const readResource = useCallback(async (uri: string): Promise<ResourceRead> => {
    if (!sessionId) {
      const read: ResourceRead = {
        id: generateId(),
        uri,
        status: 'error',
        error: 'No active session. Please connect first.',
      };
      return read;
    }

    // Check read cache
    const readCacheKey = `read:${sessionId}:${uri}`;
    const cachedContents = readCacheRef.current.get(readCacheKey);
    if (cachedContents) {
      log.debug('Using cached resource read', { uri });
      const cachedRead: ResourceRead = {
        id: generateId(),
        uri,
        status: 'success',
        contents: cachedContents,
        readAt: new Date(),
      };
      if (mountedRef.current) {
        setReads(prev => [cachedRead, ...prev]);
      }
      return cachedRead;
    }

    const readId = generateId();
    const abortController = new AbortController();
    abortControllersRef.current.set(readId, abortController);

    const read: ResourceRead = {
      id: readId,
      uri,
      status: 'loading',
    };

    if (mountedRef.current) {
      setReads(prev => [read, ...prev]);
    }

    emitEvent({
      type: 'resource:reading',
      sessionId,
      data: { uri },
    });

    log.info('Reading resource', { uri });

    try {
      const response = await fetchWithTimeout(`${API_BASE}/resources/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, uri }),
        signal: abortController.signal,
        timeout,
      });

      if (!mountedRef.current) {
        return read;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ApiResponse<never>;
        throw new Error(errorData.error || `Failed to read resource: ${response.status}`);
      }

      const data = await response.json() as ApiResponse<ReadResourceResponse>;

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to read resource: No data received');
      }

      log.info('Resource read', { uri });

      // Cache the read result
      if (cacheTtl > 0) {
        readCacheRef.current.set(readCacheKey, data.data.contents, cacheTtl);
      }

      const updatedRead: ResourceRead = {
        ...read,
        status: 'success',
        contents: data.data.contents,
        readAt: new Date(),
      };

      if (mountedRef.current) {
        setReads(prev =>
          prev.map(r => (r.id === readId ? updatedRead : r))
        );
      }

      emitEvent({
        type: 'resource:read',
        sessionId,
        data: { uri, contents: data.data.contents },
      });

      return updatedRead;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const cancelledRead: ResourceRead = {
          ...read,
          status: 'error',
          error: 'Read cancelled',
        };

        if (mountedRef.current) {
          setReads(prev =>
            prev.map(r => (r.id === readId ? cancelledRead : r))
          );
        }

        return cancelledRead;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to read resource';
      log.error('Resource read failed', { uri, error: errorMessage });

      const failedRead: ResourceRead = {
        ...read,
        status: 'error',
        error: errorMessage,
      };

      if (mountedRef.current) {
        setReads(prev =>
          prev.map(r => (r.id === readId ? failedRead : r))
        );
      }

      emitEvent({
        type: 'resource:error',
        sessionId,
        data: { uri, error: errorMessage },
      });

      return failedRead;
    } finally {
      abortControllersRef.current.delete(readId);
    }
  }, [sessionId, cacheTtl, timeout, log, emitEvent]);

  /**
   * Clear all reads
   */
  const clearReads = useCallback((): void => {
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();

    if (mountedRef.current) {
      setReads([]);
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
    resources,
    isLoading,
    error,
    reads,
    isStale,

    // Actions
    loadResources,
    refreshResources,
    readResource,
    clearReads,
    clearError,
  };
}

export default useMcpResources;
