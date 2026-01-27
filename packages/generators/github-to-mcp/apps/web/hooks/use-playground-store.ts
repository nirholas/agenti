/**
 * Playground Store Hook - Convenient access to playground state
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePlaygroundStore as useStore,
  createPlaygroundError,
  createAnalyticsTracker,
  type PlaygroundState,
  type PlaygroundError,
  type ExecuteToolRequest,
  type ExecuteToolResponse,
} from '@/lib/playground-store';
import type { ConversionResult, Tool } from '@/types';

export { type PlaygroundState, type PlaygroundError, type ExecuteToolRequest, type ExecuteToolResponse };

/**
 * Main hook for accessing playground state and actions
 */
export function usePlaygroundState() {
  const { state, dispatch, setConversionResult, setError, clearState, generateShareableLink, loadFromUrl, loadFromGist } = useStore();

  return {
    // State
    generatedCode: state.generatedCode,
    generatedPythonCode: state.generatedPythonCode,
    tools: state.tools,
    repoName: state.repoName,
    repoUrl: state.repoUrl,
    sessionId: state.sessionId,
    lastConversion: state.lastConversion,
    conversionResult: state.conversionResult,
    error: state.error,
    isLoading: state.isLoading,
    
    // Computed
    hasCode: !!state.generatedCode,
    toolCount: state.tools.length,
    
    // Actions
    setConversionResult,
    setError,
    clearState,
    generateShareableLink,
    loadFromUrl,
    loadFromGist,
    
    // Dispatch for advanced use
    dispatch,
  };
}

/**
 * Hook for navigating from conversion to playground
 */
export function usePlaygroundNavigation() {
  const router = useRouter();
  const { setConversionResult, generateShareableLink } = useStore();

  const navigateToPlayground = useCallback((result: ConversionResult) => {
    // Store the result first
    setConversionResult(result);
    
    // Navigate to playground
    router.push('/playground');
  }, [router, setConversionResult]);

  const navigateWithCode = useCallback((code: string, name?: string) => {
    // For sharing purposes, encode in URL
    const params = new URLSearchParams();
    try {
      params.set('code', btoa(encodeURIComponent(code)));
      if (name) {
        params.set('name', name);
      }
      router.push(`/playground?${params.toString()}`);
    } catch (error) {
      console.error('Failed to encode code for URL:', error);
      router.push('/playground');
    }
  }, [router]);

  return {
    navigateToPlayground,
    navigateWithCode,
    generateShareableLink,
  };
}

/**
 * Hook for managing playground errors
 */
export function usePlaygroundErrors() {
  const { state, setError, dispatch } = useStore();

  const setSyntaxError = useCallback((message: string, details?: string) => {
    setError(createPlaygroundError('syntax', message, details, false));
  }, [setError]);

  const setServerError = useCallback((message: string, details?: string) => {
    setError(createPlaygroundError('server', message, details, true));
  }, [setError]);

  const setExecutionError = useCallback((message: string, details?: string) => {
    setError(createPlaygroundError('execution', message, details, true));
  }, [setError]);

  const setNetworkError = useCallback((message: string, details?: string) => {
    setError(createPlaygroundError('network', message, details, true));
  }, [setError]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const incrementRetry = useCallback(() => {
    dispatch({ type: 'INCREMENT_RETRY' });
  }, [dispatch]);

  return {
    error: state.error,
    hasError: !!state.error,
    isRecoverable: state.error?.recoverable ?? false,
    retryCount: state.error?.retryCount ?? 0,
    setSyntaxError,
    setServerError,
    setExecutionError,
    setNetworkError,
    clearError,
    incrementRetry,
  };
}

/**
 * Hook for tool execution within the playground
 */
export function useToolExecution() {
  const { state, dispatch } = useStore();
  const analytics = useMemo(() => createAnalyticsTracker(), []);

  const executeToolLocally = useCallback(async (
    tool: Tool,
    params: Record<string, unknown>
  ): Promise<ExecuteToolResponse> => {
    if (!state.generatedCode) {
      return {
        success: false,
        error: 'No generated code available',
        sessionId: state.sessionId || '',
        executionTime: 0,
      };
    }

    const startTime = Date.now();
    
    try {
      // Call the API to execute the tool
      const request: ExecuteToolRequest = {
        generatedCode: state.generatedCode,
        toolName: tool.name,
        toolParams: params,
        sessionId: state.sessionId || undefined,
      };

      const response = await fetch('/api/playground/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        analytics.trackToolExecution(tool.name, false, executionTime);
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          sessionId: state.sessionId || '',
          executionTime,
        };
      }

      const result: ExecuteToolResponse = await response.json();
      
      // Update session ID if returned
      if (result.sessionId && result.sessionId !== state.sessionId) {
        dispatch({ type: 'SET_SESSION_ID', payload: result.sessionId });
      }

      analytics.trackToolExecution(tool.name, result.success, executionTime);
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      analytics.trackToolExecution(tool.name, false, executionTime);
      
      return {
        success: false,
        error: errorMessage,
        sessionId: state.sessionId || '',
        executionTime,
      };
    }
  }, [state.generatedCode, state.sessionId, dispatch, analytics]);

  return {
    executeToolLocally,
    sessionId: state.sessionId,
    hasCode: !!state.generatedCode,
  };
}

/**
 * Hook for analytics tracking
 */
export function usePlaygroundAnalytics() {
  const analytics = useMemo(() => createAnalyticsTracker(), []);
  
  return analytics;
}

/**
 * Hook for sharing playground state
 */
export function usePlaygroundSharing() {
  const { state, generateShareableLink } = useStore();
  const analytics = useMemo(() => createAnalyticsTracker(), []);

  const copyShareLink = useCallback(async (): Promise<boolean> => {
    const link = generateShareableLink();
    if (!link) return false;

    try {
      await navigator.clipboard.writeText(link);
      analytics.trackShare('url');
      return true;
    } catch (error) {
      console.error('Failed to copy share link:', error);
      return false;
    }
  }, [generateShareableLink, analytics]);

  const createGistAndShare = useCallback(async (token: string): Promise<string | null> => {
    if (!state.generatedCode) return null;

    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${token}`,
        },
        body: JSON.stringify({
          description: `MCP Server: ${state.repoName || 'Generated'}`,
          public: false,
          files: {
            [`${state.repoName || 'mcp-server'}.ts`]: {
              content: state.generatedCode,
            },
            ...(state.generatedPythonCode ? {
              [`${state.repoName || 'mcp-server'}.py`]: {
                content: state.generatedPythonCode,
              },
            } : {}),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create Gist: ${response.status}`);
      }

      const gist = await response.json();
      const shareUrl = `${window.location.origin}/playground?gist=${gist.id}`;
      
      analytics.trackShare('gist');
      return shareUrl;
    } catch (error) {
      console.error('Failed to create Gist:', error);
      return null;
    }
  }, [state.generatedCode, state.generatedPythonCode, state.repoName, analytics]);

  return {
    canShare: !!state.generatedCode,
    copyShareLink,
    createGistAndShare,
    generateShareableLink,
  };
}
