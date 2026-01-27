/**
 * Hooks barrel export
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

export { useStreaming } from './useStreaming';
export { useBatchConversion } from './useBatchConversion';
export { usePlatformDetection } from './usePlatformDetection';
export { useDockerConfig } from './useDockerConfig';
export { useMcpExecution } from './use-mcp-execution';
export type { 
  UseMcpExecutionOptions, 
  UseMcpExecutionReturn, 
  ExecutionLog, 
  ExecuteToolResult 
} from './use-mcp-execution';

// Enhanced MCP Client hooks
export { 
  useMcpClient,
  useHttpMcpClient,
  useWebSocketMcpClient,
  usePlaygroundMcpClient,
} from './use-mcp-client';
export type {
  UseMcpClientOptions,
  UseMcpClientReturn,
  McpClientHookState,
  McpClientLog,
} from './use-mcp-client';

// Playground hooks (legacy)
export {
  usePlaygroundState,
  usePlaygroundNavigation,
  usePlaygroundErrors,
  useToolExecution,
  usePlaygroundAnalytics,
  usePlaygroundSharing,
} from './use-playground-store';
export type {
  PlaygroundState,
  PlaygroundError,
  ExecuteToolRequest,
  ExecuteToolResponse,
} from './use-playground-store';

// ============================================================================
// New Playground V2 Hooks
// ============================================================================

// Shared Types
export * from './types';

// Connection Hook
export { useMcpConnection, useMcpConnectionWithRetry } from './use-mcp-connection';
export type { UseMcpConnectionWithRetryOptions } from './use-mcp-connection';

// Tools Hook
export { useMcpTools } from './use-mcp-tools';

// Resources Hook
export { useMcpResources } from './use-mcp-resources';

// Prompts Hook
export { useMcpPrompts } from './use-mcp-prompts';

// Execution History Hook
export { 
  useExecutionHistory,
  filterHistoryByType,
  filterHistoryBySuccess,
  filterHistoryByDateRange,
  getHistoryStats,
} from './use-execution-history';
export type { 
  UseExecutionHistoryOptions,
  HistoryStats,
} from './use-execution-history';

// Unified Playground Hook
export {
  usePlayground,
} from './use-playground';
