/**
 * useMcpClient Hook
 * 
 * React hook that provides a clean interface to the MCP client
 * with automatic lifecycle management and React state integration.
 * 
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright 2024-2026 nich (nirholas)
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  EnhancedMcpClient,
  EnhancedMcpClientOptions,
  McpClientEvents,
  WebSocketTransport,
  WebSocketTransportOptions,
} from '@/lib/mcp-client-enhanced';
import {
  McpClient,
  HttpTransport,
  McpClientOptions,
  McpClientState,
} from '@/lib/mcp-client';
import { McpTool, CallToolResult, ServerCapabilities, ServerInfo } from '@/lib/mcp-types';
import { McpError, formatMcpError } from '@/lib/mcp-errors';

// ============================================================================
// Types
// ============================================================================

/** MCP React Hooks - nich (x.com/nichxbt | github.com/nirholas) */
const _HOOKS_META = { author: 'nich', twitter: 'nichxbt', github: 'nirholas' } as const;

export interface UseMcpClientOptions {
  /** Transport type */
  transport: 'http' | 'websocket';
  /** Endpoint URL */
  endpoint: string;
  /** Additional headers for HTTP transport */
  headers?: Record<string, string>;
  /** Client options */
  clientOptions?: Partial<McpClientOptions | EnhancedMcpClientOptions>;
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Reconnect on error */
  autoReconnect?: boolean;
  /** Log events to console */
  debug?: boolean;
}

export interface McpClientHookState {
  /** Current connection state */
  state: McpClientState;
  /** Whether client is connected and ready */
  isReady: boolean;
  /** Whether client is connecting */
  isConnecting: boolean;
  /** Whether a tool call is in progress */
  isExecuting: boolean;
  /** Available tools */
  tools: McpTool[];
  /** Server capabilities */
  capabilities: ServerCapabilities | null;
  /** Server info */
  serverInfo: ServerInfo | null;
  /** Last error */
  error: string | null;
  /** Execution logs */
  logs: McpClientLog[];
}

export interface McpClientLog {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

export interface UseMcpClientReturn extends McpClientHookState {
  /** Connect to the MCP server */
  connect: () => Promise<void>;
  /** Disconnect from the MCP server */
  disconnect: () => Promise<void>;
  /** Refresh the tools list */
  refreshTools: () => Promise<McpTool[]>;
  /** Execute a tool */
  executeTool: (name: string, params?: Record<string, unknown>) => Promise<CallToolResult>;
  /** Clear logs */
  clearLogs: () => void;
  /** Clear error */
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useMcpClient(options: UseMcpClientOptions): UseMcpClientReturn {
  const {
    transport: transportType,
    endpoint,
    headers,
    clientOptions,
    autoConnect = false,
    autoReconnect = true,
    debug = false,
  } = options;

  // State
  const [state, setState] = useState<McpClientState>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<McpClientLog[]>([]);

  // Refs
  const clientRef = useRef<McpClient | EnhancedMcpClient | null>(null);
  const mountedRef = useRef(true);

  // Derived state
  const isReady = state === 'ready';
  const isConnecting = state === 'connecting' || state === 'initializing';

  // Logging
  const addLog = useCallback((
    type: McpClientLog['type'],
    message: string,
    data?: unknown
  ) => {
    if (!mountedRef.current) return;
    
    const log: McpClientLog = {
      id: generateLogId(),
      timestamp: new Date(),
      type,
      message,
      data,
    };
    
    setLogs(prev => [...prev.slice(-99), log]); // Keep last 100 logs
    
    if (debug) {
      const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'debug' ? '🔍' : 'ℹ️';
      console.log(`[MCP Client] ${prefix} ${message}`, data ?? '');
    }
  }, [debug]);

  // Create client
  const createClient = useCallback(() => {
    if (transportType === 'websocket') {
      const wsTransport = new WebSocketTransport({
        url: endpoint,
        autoReconnect,
      });
      
      const client = new EnhancedMcpClient(wsTransport, {
        ...clientOptions,
        autoReconnect,
      });

      // Set up event listeners for enhanced client
      client.on<McpClientEvents['state:change']>('state:change', ({ current }) => {
        if (mountedRef.current) {
          setState(current);
          addLog('debug', `State changed to: ${current}`);
        }
      });

      client.on<McpClientEvents['connected']>('connected', ({ serverInfo: info, capabilities: caps }) => {
        if (mountedRef.current) {
          setServerInfo(info);
          setCapabilities(caps);
          addLog('success', `Connected to ${info.name} v${info.version}`);
        }
      });

      client.on<McpClientEvents['disconnected']>('disconnected', ({ reason }) => {
        if (mountedRef.current) {
          addLog('info', `Disconnected: ${reason}`);
        }
      });

      client.on<McpClientEvents['error']>('error', ({ error: err }) => {
        if (mountedRef.current) {
          setError(formatMcpError(err));
          addLog('error', formatMcpError(err));
        }
      });

      client.on<McpClientEvents['tools:changed']>('tools:changed', ({ tools: newTools }) => {
        if (mountedRef.current) {
          setTools(newTools);
          addLog('info', `Tools updated: ${newTools.length} tools available`);
        }
      });

      return client;
    } else {
      const httpTransport = new HttpTransport({
        endpoint,
        headers,
        timeout: clientOptions?.timeout,
      });
      
      return new McpClient(httpTransport, {
        ...clientOptions,
        onOutput: (data) => addLog('info', data),
        onError: (err) => {
          setError(err);
          addLog('error', err);
        },
        onNotification: (method, params) => {
          addLog('debug', `Notification: ${method}`, params);
        },
      });
    }
  }, [transportType, endpoint, headers, clientOptions, autoReconnect, addLog]);

  // Connect
  const connect = useCallback(async () => {
    if (clientRef.current && (state === 'ready' || state === 'connecting')) {
      return;
    }

    try {
      setError(null);
      addLog('info', 'Connecting...');

      if (!clientRef.current) {
        clientRef.current = createClient();
      }

      // For non-enhanced client, manually track state
      if (!(clientRef.current instanceof EnhancedMcpClient)) {
        setState('connecting');
      }

      await clientRef.current.connect();

      if (mountedRef.current) {
        // For non-enhanced client, manually update state
        if (!(clientRef.current instanceof EnhancedMcpClient)) {
          setState('ready');
          if (clientRef.current.capabilities) {
            setCapabilities(clientRef.current.capabilities);
          }
        }

        // Fetch tools
        const fetchedTools = await clientRef.current.listTools();
        if (mountedRef.current) {
          setTools(fetchedTools);
          addLog('success', `Loaded ${fetchedTools.length} tools`);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof McpError ? formatMcpError(err) : String(err);
        setError(errorMessage);
        setState('error');
        addLog('error', `Connection failed: ${errorMessage}`);
      }
      throw err;
    }
  }, [state, createClient, addLog]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!clientRef.current) return;

    try {
      addLog('info', 'Disconnecting...');
      await clientRef.current.disconnect();
      
      if (mountedRef.current) {
        setState('disconnected');
        setTools([]);
        setCapabilities(null);
        setServerInfo(null);
        addLog('success', 'Disconnected');
      }
    } catch (err) {
      addLog('error', `Disconnect error: ${err}`);
    }
  }, [addLog]);

  // Refresh tools
  const refreshTools = useCallback(async (): Promise<McpTool[]> => {
    if (!clientRef.current || state !== 'ready') {
      throw new Error('Client not connected');
    }

    addLog('info', 'Refreshing tools...');
    
    // For enhanced client, force refresh
    const fetchedTools = clientRef.current instanceof EnhancedMcpClient
      ? await clientRef.current.listTools(true)
      : await clientRef.current.listTools();
    
    if (mountedRef.current) {
      setTools(fetchedTools);
      addLog('success', `Refreshed: ${fetchedTools.length} tools`);
    }
    
    return fetchedTools;
  }, [state, addLog]);

  // Execute tool
  const executeTool = useCallback(async (
    name: string,
    params?: Record<string, unknown>
  ): Promise<CallToolResult> => {
    if (!clientRef.current || state !== 'ready') {
      throw new Error('Client not connected');
    }

    setIsExecuting(true);
    addLog('info', `Executing: ${name}`, params);
    const startTime = Date.now();

    try {
      const result = await clientRef.current.callTool(name, params);
      const duration = Date.now() - startTime;
      
      if (mountedRef.current) {
        if (result.isError) {
          addLog('error', `Tool error: ${name} (${duration}ms)`, result);
        } else {
          addLog('success', `Completed: ${name} (${duration}ms)`, result);
        }
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof McpError ? formatMcpError(err) : String(err);
      addLog('error', `Execution failed: ${name} - ${errorMessage}`);
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsExecuting(false);
      }
    }
  }, [state, addLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect().catch(() => {
        // Error already handled in connect()
      });
    }

    return () => {
      mountedRef.current = false;
      if (clientRef.current) {
        clientRef.current.disconnect().catch(() => {});
      }
    };
  }, [autoConnect]); // Only run on mount, not when connect changes

  return {
    state,
    isReady,
    isConnecting,
    isExecuting,
    tools,
    capabilities,
    serverInfo,
    error,
    logs,
    connect,
    disconnect,
    refreshTools,
    executeTool,
    clearLogs,
    clearError,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for connecting to an MCP server via HTTP
 */
export function useHttpMcpClient(
  endpoint: string,
  options?: Omit<UseMcpClientOptions, 'transport' | 'endpoint'>
): UseMcpClientReturn {
  return useMcpClient({
    transport: 'http',
    endpoint,
    ...options,
  });
}

/**
 * Hook for connecting to an MCP server via WebSocket
 */
export function useWebSocketMcpClient(
  endpoint: string,
  options?: Omit<UseMcpClientOptions, 'transport' | 'endpoint'>
): UseMcpClientReturn {
  return useMcpClient({
    transport: 'websocket',
    endpoint,
    ...options,
  });
}

/**
 * Hook for the playground API-based MCP execution
 */
export function usePlaygroundMcpClient(
  generatedCode: string | null,
  options?: { autoConnect?: boolean; debug?: boolean }
): UseMcpClientReturn & { sessionId: string | null } {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<McpClientState>('disconnected');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<McpClientLog[]>([]);

  const mountedRef = useRef(true);

  const addLog = useCallback((
    type: McpClientLog['type'],
    message: string,
    data?: unknown
  ) => {
    if (!mountedRef.current) return;
    setLogs(prev => [...prev.slice(-99), {
      id: generateLogId(),
      timestamp: new Date(),
      type,
      message,
      data,
    }]);
  }, []);

  const connect = useCallback(async () => {
    if (!generatedCode) {
      setError('No generated code provided');
      return;
    }

    setState('connecting');
    setError(null);
    addLog('info', 'Connecting to playground server...');

    try {
      const response = await fetch('/api/playground/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedCode }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Connection failed');
      }

      const data = await response.json();
      
      if (mountedRef.current) {
        setSessionId(data.sessionId);
        setTools(data.tools || []);
        setState('ready');
        addLog('success', `Connected! Session: ${data.sessionId}`);
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setError(msg);
        setState('error');
        addLog('error', msg);
      }
    }
  }, [generatedCode, addLog]);

  const disconnect = useCallback(async () => {
    if (!sessionId) return;

    addLog('info', 'Disconnecting...');

    try {
      await fetch('/api/playground/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Best effort
    }

    if (mountedRef.current) {
      setSessionId(null);
      setTools([]);
      setState('disconnected');
      addLog('success', 'Disconnected');
    }
  }, [sessionId, addLog]);

  const executeTool = useCallback(async (
    name: string,
    params?: Record<string, unknown>
  ): Promise<CallToolResult> => {
    if (!sessionId) {
      throw new Error('Not connected');
    }

    setIsExecuting(true);
    addLog('info', `Executing: ${name}`, params);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/playground/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          toolName: name,
          toolParams: params || {},
        }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok || !data.success) {
        addLog('error', `Failed: ${name} - ${data.error}`, data);
        return {
          content: [{ type: 'text', text: data.error || 'Execution failed' }],
          isError: true,
        };
      }

      addLog('success', `Completed: ${name} (${duration}ms)`, data.result);
      
      return {
        content: [{ 
          type: 'text', 
          text: typeof data.result === 'string' 
            ? data.result 
            : JSON.stringify(data.result, null, 2) 
        }],
        isError: false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      addLog('error', `Error: ${name} - ${msg}`);
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsExecuting(false);
      }
    }
  }, [sessionId, addLog]);

  const refreshTools = useCallback(async (): Promise<McpTool[]> => {
    if (!sessionId) throw new Error('Not connected');
    
    const response = await fetch(`/api/playground/tools?sessionId=${sessionId}`);
    const data = await response.json();
    
    if (mountedRef.current && data.tools) {
      setTools(data.tools);
    }
    
    return data.tools || [];
  }, [sessionId]);

  useEffect(() => {
    if (options?.autoConnect && generatedCode) {
      connect();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    state,
    isReady: state === 'ready',
    isConnecting: state === 'connecting',
    isExecuting,
    tools,
    capabilities: null,
    serverInfo: null,
    error,
    logs,
    sessionId,
    connect,
    disconnect,
    refreshTools,
    executeTool,
    clearLogs: () => setLogs([]),
    clearError: () => setError(null),
  };
}
