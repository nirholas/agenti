/**
 * useMcpConnection Hook
 * Manages MCP server connection state and lifecycle
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  ConnectionStatus,
  McpCapabilities,
  ServerInfo,
  SessionInfo,
  TransportConfig,
  UseMcpConnectionOptions,
  UseMcpConnectionReturn,
  ConnectResponse,
  ApiResponse,
  RetryConfig,
  ConnectionEvent,
} from './types';
import {
  DEFAULT_TIMEOUT,
  DEFAULT_HEARTBEAT_INTERVAL,
  DEFAULT_RECONNECT_DEBOUNCE,
  fetchWithTimeout,
  debounce,
  createDebugLogger,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const API_BASE = '/api/playground/v2';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMcpConnection(
  options: UseMcpConnectionOptions = {}
): UseMcpConnectionReturn {
  const {
    autoConnect = false,
    onConnect,
    onDisconnect,
    onError,
    debug = false,
    timeout = DEFAULT_TIMEOUT,
    eventEmitter,
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL,
    reconnectDebounce = DEFAULT_RECONNECT_DEBOUNCE,
  } = options;

  // Create debug logger
  const log = useMemo(
    () => createDebugLogger('useMcpConnection', { enabled: debug }),
    [debug]
  );

  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<McpCapabilities | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

  // Refs for managing connection lifecycle
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const connectingRef = useRef(false);
  const lastConfigRef = useRef<TransportConfig | null>(null);
  const retryCountRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Event emission helper
  const emitEvent = useCallback(
    (event: Omit<ConnectionEvent, 'timestamp'>) => {
      if (eventEmitter) {
        eventEmitter.emit({
          ...event,
          timestamp: new Date(),
        } as ConnectionEvent);
      }
    },
    [eventEmitter]
  );

  /**
   * Clear the current error
   */
  const clearError = useCallback((): void => {
    if (mountedRef.current) {
      setError(null);
    }
  }, []);

  /**
   * Perform a heartbeat check
   */
  const heartbeat = useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      log.debug('Heartbeat skipped: no session');
      return false;
    }

    try {
      log.debug('Sending heartbeat');
      const response = await fetchWithTimeout(`${API_BASE}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        timeout: 5000, // Short timeout for heartbeat
      });

      if (!response.ok) {
        log.warn('Heartbeat failed', { status: response.status });
        return false;
      }

      const now = new Date();
      if (mountedRef.current) {
        setLastHeartbeat(now);
      }

      emitEvent({
        type: 'connection:heartbeat',
        sessionId,
        data: {},
      });

      log.debug('Heartbeat successful');
      return true;
    } catch (err) {
      log.error('Heartbeat error', err);
      return false;
    }
  }, [sessionId, log, emitEvent]);

  // Setup heartbeat interval
  useEffect(() => {
    if (status === 'connected' && heartbeatInterval > 0) {
      log.debug('Starting heartbeat interval', { interval: heartbeatInterval });
      heartbeatIntervalRef.current = setInterval(() => {
        heartbeat().then(success => {
          if (!success && mountedRef.current) {
            log.warn('Heartbeat failed, connection may be stale');
          }
        });
      }, heartbeatInterval);
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [status, heartbeatInterval, heartbeat, log]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  /**
   * Connect to MCP server with given transport configuration
   */
  const connect = useCallback(async (config: TransportConfig): Promise<void> => {
    // Prevent duplicate connection attempts
    if (connectingRef.current) {
      log.warn('Connection already in progress');
      return;
    }

    // Cancel any existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Setup new abort controller
    abortControllerRef.current = new AbortController();
    connectingRef.current = true;
    lastConfigRef.current = config;

    // Update state
    if (mountedRef.current) {
      setStatus('connecting');
      setError(null);
    }

    emitEvent({
      type: 'connection:connecting',
      sessionId: null,
    });

    log.info('Connecting', { config });

    try {
      const response = await fetchWithTimeout(`${API_BASE}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transport: config }),
        signal: abortControllerRef.current.signal,
        timeout,
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ApiResponse<never>;
        throw new Error(errorData.error || `Connection failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as ApiResponse<ConnectResponse>;

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Connection failed: No data received');
      }

      const { sessionId: newSessionId, serverInfo: newServerInfo, capabilities: newCapabilities } = data.data;

      log.info('Connected', { sessionId: newSessionId, serverInfo: newServerInfo });

      // Extract server URL from config if available
      const extractedUrl = 'url' in config ? config.url : null;

      // Update state if still mounted
      if (mountedRef.current) {
        setSessionId(newSessionId);
        setServerInfo(newServerInfo);
        setCapabilities(newCapabilities);
        setServerUrl(extractedUrl);
        setStatus('connected');
        setError(null);
        setLastHeartbeat(new Date());
        retryCountRef.current = 0;

        const sessionInfo: SessionInfo = {
          sessionId: newSessionId,
          serverInfo: newServerInfo,
          capabilities: newCapabilities,
          connectedAt: new Date(),
        };

        emitEvent({
          type: 'connection:connected',
          sessionId: newSessionId,
          data: { serverInfo: newServerInfo, capabilities: newCapabilities },
        });

        onConnect?.(sessionInfo);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        log.debug('Connection aborted');
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown connection error';
      log.error('Connection failed', { error: errorMessage });

      if (mountedRef.current) {
        setStatus('error');
        setError(errorMessage);
        setSessionId(null);
        setCapabilities(null);
        setServerInfo(null);
        setServerUrl(null);
        setLastHeartbeat(null);

        emitEvent({
          type: 'connection:error',
          sessionId: null,
          data: { error: errorMessage },
        });

        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      connectingRef.current = false;
    }
  }, [onConnect, onError, timeout, log, emitEvent]);

  /**
   * Disconnect from MCP server
   */
  const disconnect = useCallback(async (): Promise<void> => {
    log.info('Disconnecting');

    // Stop heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Abort any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const currentSessionId = sessionId;

    // Optimistically update state
    if (mountedRef.current) {
      setStatus('disconnected');
      setSessionId(null);
      setCapabilities(null);
      setServerInfo(null);
      setError(null);
      setLastHeartbeat(null);
    }

    emitEvent({
      type: 'connection:disconnected',
      sessionId: currentSessionId,
    });

    // Notify server of disconnect (best effort)
    if (currentSessionId) {
      try {
        await fetchWithTimeout(`${API_BASE}/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId }),
          timeout: 5000,
        });
        log.debug('Server notified of disconnect');
      } catch (err) {
        log.warn('Error notifying server of disconnect', err);
      }
    }

    onDisconnect?.();
  }, [sessionId, onDisconnect, log, emitEvent]);

  /**
   * Debounced reconnect to prevent rapid reconnection spam
   */
  const debouncedReconnect = useMemo(
    () =>
      debounce(async () => {
        if (!lastConfigRef.current) {
          const errorMessage = 'Cannot reconnect: No previous connection configuration';
          log.error(errorMessage);
          if (mountedRef.current) {
            setError(errorMessage);
          }
          return;
        }

        log.info('Reconnecting');
        await disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
        await connect(lastConfigRef.current);
      }, reconnectDebounce),
    [connect, disconnect, reconnectDebounce, log]
  );

  /**
   * Reconnect using the last transport configuration
   */
  const reconnect = useCallback(async (): Promise<void> => {
    debouncedReconnect();
  }, [debouncedReconnect]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedReconnect.cancel();
    };
  }, [debouncedReconnect]);

  return {
    // State
    status,
    sessionId,
    capabilities,
    serverInfo,
    serverUrl,
    error,
    lastHeartbeat,

    // Actions
    connect,
    disconnect,
    reconnect,
    clearError,
    heartbeat,
  };
}

// ============================================================================
// Helper Hook: Connection with Auto-Reconnect
// ============================================================================

export interface UseMcpConnectionWithRetryOptions extends UseMcpConnectionOptions {
  retryConfig?: Partial<RetryConfig>;
  enableAutoRetry?: boolean;
}

/**
 * Extended connection hook with automatic retry on failure
 */
export function useMcpConnectionWithRetry(
  options: UseMcpConnectionWithRetryOptions = {}
): UseMcpConnectionReturn & { retryCount: number; isRetrying: boolean } {
  const {
    retryConfig: customRetryConfig,
    enableAutoRetry = true,
    ...baseOptions
  } = options;

  const retryConfig: RetryConfig = {
    maxRetries: customRetryConfig?.maxRetries ?? 3,
    baseDelay: customRetryConfig?.baseDelay ?? 1000,
    maxDelay: customRetryConfig?.maxDelay ?? 30000,
    factor: customRetryConfig?.factor ?? 2,
  };

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const baseConnection = useMcpConnection({
    ...baseOptions,
    onError: (error) => {
      baseOptions.onError?.(error);

      // Schedule retry if enabled and under max retries
      if (enableAutoRetry && retryCount < retryConfig.maxRetries) {
        const delay = calculateBackoffDelay(retryCount, retryConfig);

        if (mountedRef.current) {
          setIsRetrying(true);
        }

        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setRetryCount(prev => prev + 1);
            baseConnection.reconnect();
          }
        }, delay);
      }
    },
    onConnect: (session) => {
      if (mountedRef.current) {
        setRetryCount(0);
        setIsRetrying(false);
      }
      baseOptions.onConnect?.(session);
    },
  });

  return {
    ...baseConnection,
    retryCount,
    isRetrying,
  };
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.factor, attempt),
    config.maxDelay
  );
  return delay + Math.random() * delay * 0.1;
}

export default useMcpConnection;
