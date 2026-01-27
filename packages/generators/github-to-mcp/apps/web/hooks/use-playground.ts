/**
 * usePlayground Hook
 * Unified hook that combines all MCP playground hooks with UI state management
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useMcpConnection } from './use-mcp-connection';
import { useMcpTools } from './use-mcp-tools';
import { useMcpResources } from './use-mcp-resources';
import { useMcpPrompts } from './use-mcp-prompts';
import type {
  UsePlaygroundOptions,
  UsePlaygroundReturn,
  PlaygroundTab,
  McpTool,
  McpResource,
  McpPrompt,
  McpCapabilities,
  TransportConfig,
  McpEventEmitter,
  McpEvent,
  ToolExecution,
  ResourceRead,
  PromptExecution,
} from './types';
import { createDebugLogger, McpEventEmitter as EventEmitterClass } from './types';

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePlayground(options: UsePlaygroundOptions = {}): UsePlaygroundReturn {
  const {
    debug = false,
    timeout,
    cacheTtl,
    heartbeatInterval,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  // Create debug logger
  const log = useMemo(
    () => createDebugLogger('usePlayground', { enabled: debug }),
    [debug]
  );

  // Create shared event emitter
  const eventEmitter = useMemo<McpEventEmitter>(() => {
    const emitter = new EventEmitterClass();
    
    // Log all events in debug mode
    if (debug) {
      emitter.subscribe((event: McpEvent) => {
        log.debug(`Event: ${event.type}`, event.data);
      });
    }
    
    return emitter;
  }, [debug, log]);

  // UI State
  const [activeTab, setActiveTab] = useState<PlaygroundTab>('tools');
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [selectedResource, setSelectedResource] = useState<McpResource | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<McpPrompt | null>(null);
  const [transportConfig, setTransportConfig] = useState<TransportConfig | null>(null);

  // Initialize sub-hooks with shared event emitter and debug settings
  const connection = useMcpConnection({
    debug,
    timeout,
    heartbeatInterval,
    eventEmitter,
  });

  const tools = useMcpTools({
    sessionId: connection.sessionId,
    autoLoad: true,
    debug,
    timeout,
    cacheTtl,
    eventEmitter,
  });

  const resources = useMcpResources({
    sessionId: connection.sessionId,
    autoLoad: true,
    debug,
    timeout,
    cacheTtl,
    eventEmitter,
  });

  const prompts = useMcpPrompts({
    sessionId: connection.sessionId,
    autoLoad: true,
    debug,
    timeout,
    cacheTtl,
    eventEmitter,
  });

  // Subscribe to connection events for callbacks
  useEffect(() => {
    const unsubscribe = eventEmitter.subscribe((event: McpEvent) => {
      switch (event.type) {
        case 'connection:connected':
          log.info('Connected', { sessionId: event.sessionId });
          if (event.sessionId) {
            onConnect?.(event.sessionId);
          }
          break;
        case 'connection:disconnected':
          log.info('Disconnected', { sessionId: event.sessionId });
          onDisconnect?.();
          // Clear selections on disconnect
          setSelectedTool(null);
          setSelectedResource(null);
          setSelectedPrompt(null);
          break;
        case 'connection:error':
        case 'tools:error':
        case 'resources:error':
        case 'prompts:error':
          const errorMsg = (event.data as { error?: string })?.error || 'Unknown error';
          log.error(`Error: ${event.type}`, { error: errorMsg });
          onError?.(new Error(errorMsg));
          break;
      }
    });

    return unsubscribe;
  }, [eventEmitter, onConnect, onDisconnect, onError, log]);

  // Computed: is playground ready to use
  const isReady = useMemo(() => {
    return connection.status === 'connected' && connection.sessionId !== null;
  }, [connection.status, connection.sessionId]);

  // Check if server has a specific capability
  const hasCapability = useCallback(
    (cap: keyof McpCapabilities): boolean => {
      if (!connection.capabilities) return false;
      return !!connection.capabilities[cap];
    },
    [connection.capabilities]
  );

  return {
    // Connection
    connection,

    // Data
    tools,
    resources,
    prompts,

    // UI State
    activeTab,
    setActiveTab,
    selectedTool,
    setSelectedTool,
    selectedResource,
    setSelectedResource,
    selectedPrompt,
    setSelectedPrompt,

    // Transport Config
    transportConfig,
    setTransportConfig,

    // Convenience
    isReady,
    hasCapability,
  };
}

export default usePlayground;
