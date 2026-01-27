/**
 * MCP Execution Hook - Connect to and execute tools on a real MCP server
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Tool } from '@/types';

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  type: 'stdout' | 'stderr' | 'info' | 'error' | 'success';
  message: string;
  toolName?: string;
}

export interface ExecuteToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
  logs?: string[];
}

export interface UseMcpExecutionOptions {
  generatedCode: string | null;
  onToolsLoaded?: (tools: Tool[]) => void;
  onLog?: (log: ExecutionLog) => void;
}

export interface UseMcpExecutionReturn {
  tools: Tool[];
  isConnected: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  executionLogs: ExecutionLog[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  executeTool: (name: string, params: Record<string, unknown>) => Promise<ExecuteToolResult>;
  clearLogs: () => void;
}

function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useMcpExecution({
  generatedCode,
  onToolsLoaded,
  onLog,
}: UseMcpExecutionOptions): UseMcpExecutionReturn {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((
    type: ExecutionLog['type'],
    message: string,
    toolName?: string
  ) => {
    const log: ExecutionLog = {
      id: generateLogId(),
      timestamp: new Date(),
      type,
      message,
      toolName,
    };
    setExecutionLogs(prev => [...prev, log]);
    onLog?.(log);
  }, [onLog]);

  const clearLogs = useCallback(() => {
    setExecutionLogs([]);
  }, []);

  const connect = useCallback(async () => {
    if (!generatedCode) {
      setError('No generated code available. Please convert a repository first.');
      return;
    }

    // Cancel any existing connection attempt
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsConnecting(true);
    setError(null);
    clearLogs();

    addLog('info', 'Connecting to MCP server...');

    try {
      const response = await fetch('/api/playground/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generatedCode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Connection failed: ${response.statusText}`);
      }

      const data = await response.json();

      setSessionId(data.sessionId);
      setTools(data.tools || []);
      setIsConnected(true);
      addLog('success', `Connected! Session ID: ${data.sessionId}`);
      addLog('info', `Loaded ${data.tools?.length || 0} tools from server`);

      onToolsLoaded?.(data.tools || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        addLog('info', 'Connection cancelled');
        return;
      }
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      addLog('error', message);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [generatedCode, onToolsLoaded, addLog, clearLogs]);

  const disconnect = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!sessionId) {
      setIsConnected(false);
      setTools([]);
      return;
    }

    addLog('info', 'Disconnecting from server...');

    try {
      await fetch('/api/playground/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      addLog('success', 'Disconnected from server');
    } catch (err) {
      // Best effort - still reset state
      addLog('info', 'Session cleaned up');
    } finally {
      setIsConnected(false);
      setSessionId(null);
      setTools([]);
    }
  }, [sessionId, addLog]);

  const executeTool = useCallback(async (
    name: string,
    params: Record<string, unknown>
  ): Promise<ExecuteToolResult> => {
    if (!isConnected || !sessionId) {
      const errorResult: ExecuteToolResult = {
        success: false,
        error: 'Not connected to MCP server',
        executionTime: 0,
      };
      addLog('error', 'Not connected to MCP server', name);
      return errorResult;
    }

    setIsLoading(true);
    addLog('info', `Executing tool: ${name}`, name);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/playground/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          toolName: name,
          toolParams: params,
        }),
      });

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Execution failed: ${response.statusText}`;
        addLog('error', errorMessage, name);
        return {
          success: false,
          error: errorMessage,
          executionTime,
          logs: errorData.logs,
        };
      }

      const data = await response.json();

      // Process any logs from the server
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((log: string) => {
          addLog('stdout', log, name);
        });
      }

      if (data.success) {
        addLog('success', `Completed in ${executionTime}ms`, name);
      } else {
        addLog('error', data.error || 'Unknown error', name);
      }

      return {
        success: data.success,
        result: data.result,
        error: data.error,
        executionTime,
        logs: data.logs,
      };
    } catch (err) {
      const executionTime = Date.now() - startTime;
      const message = err instanceof Error ? err.message : 'Execution failed';
      addLog('error', message, name);
      return {
        success: false,
        error: message,
        executionTime,
      };
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sessionId, addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    tools,
    isConnected,
    isConnecting,
    isLoading,
    error,
    sessionId,
    executionLogs,
    connect,
    disconnect,
    executeTool,
    clearLogs,
  };
}
