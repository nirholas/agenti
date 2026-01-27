/**
 * MCP SDK Integration Module
 *
 * This module provides a clean, high-level API for interacting with MCP servers
 * using the official @modelcontextprotocol/sdk.
 *
 * @example
 * ```typescript
 * import {
 *   McpClient,
 *   SessionManager,
 *   createTransport,
 *   createConsoleLogger,
 *   createEventEmitter,
 *   retry,
 *   CircuitBreaker,
 *   type TransportConfig,
 *   type McpTool,
 * } from './lib/mcp';
 *
 * // Direct client usage with enhanced features
 * const logger = createConsoleLogger({ level: LogLevel.Debug });
 * const events = createEventEmitter();
 * 
 * events.on('tool:complete', (event) => {
 *   console.log(`Tool ${event.toolName} completed in ${event.durationMs}ms`);
 * });
 *
 * const client = new McpClient({ 
 *   name: 'my-app', 
 *   version: '1.0.0',
 *   logger,
 *   events,
 *   enableMetrics: true,
 * });
 * 
 * await client.connect({ type: 'stdio', command: 'npx', args: ['tsx', 'server.ts'] });
 * const tools = await client.listTools();
 * 
 * // Call tool with cancellation support
 * const controller = new AbortController();
 * const result = await client.callTool('my-tool', { param: 'value' }, { signal: controller.signal });
 * 
 * // Batch tool calls
 * const batch = await client.callToolsBatch([
 *   { name: 'tool1', params: { a: 1 } },
 *   { name: 'tool2', params: { b: 2 } },
 * ]);
 * 
 * await client.disconnect();
 *
 * // Session manager usage (recommended for multi-user environments)
 * const manager = SessionManager.getInstance({
 *   logger,
 *   enableMetrics: true,
 *   healthCheckIntervalMs: 30000,
 * });
 * 
 * manager.events.on('session:created', (event) => {
 *   console.log(`Session created: ${event.sessionId}`);
 * });
 * 
 * const session = await manager.createSession({ type: 'stdio', command: 'node', args: ['server.js'] });
 * const sessionClient = manager.getClient(session.id);
 * const health = manager.getSessionHealth(session.id);
 * ```
 *
 * @module mcp
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

// ============================================================================
// Client
// ============================================================================

export { McpClient } from './client.js';
export type {
  MiddlewareFunction,
  MiddlewareRequest,
  MiddlewareResponse,
  BatchToolCall,
  BatchResult,
  EnhancedClientOptions,
} from './client.js';

// ============================================================================
// Session Manager
// ============================================================================

export {
  SessionManager,
  getSessionManager,
  createSession,
  getClient,
  destroySession,
  getSessionHealth,
} from './session-manager.js';
export type {
  SessionHealthStatus,
  EnhancedSessionManagerOptions,
} from './session-manager.js';

// ============================================================================
// Transports
// ============================================================================

export {
  createTransport,
  validateTransportConfig,
  getTransportDisplayName,
  isTransportSupported,
  createEnhancedTransport,
  ReconnectingTransport,
  TransportPool,
} from './transports.js';
export type {
  TransportHealthStatus,
  EnhancedTransport,
  ReconnectingTransportConfig,
  ConnectionPoolConfig,
} from './transports.js';

// ============================================================================
// Logger
// ============================================================================

export {
  LogLevel,
  parseLogLevel,
  ConsoleLogger,
  NoopLogger,
  createConsoleLogger,
  createNoopLogger,
} from './logger.js';
export type {
  LogLevelName,
  LogContext,
  Logger,
  ConsoleLoggerOptions,
} from './logger.js';

// ============================================================================
// Events
// ============================================================================

export {
  McpEventEmitter,
  createEventEmitter,
} from './events.js';
export type {
  ConnectionStateChangeEvent,
  ConnectionEstablishedEvent,
  ConnectionClosedEvent,
  ConnectionErrorEvent,
  ReconnectionAttemptEvent,
  ToolsChangedEvent,
  ToolExecutionStartEvent,
  ToolExecutionCompleteEvent,
  ToolExecutionErrorEvent,
  ResourcesChangedEvent,
  ResourceUpdatedEvent,
  PromptsChangedEvent,
  ServerLogEvent,
  RequestStartEvent,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestCancelledEvent,
  SessionCreatedEvent,
  SessionDestroyedEvent,
  McpEvent,
  McpEventMap,
  McpEventType,
  McpEventListener,
  McpWildcardListener,
} from './events.js';

// ============================================================================
// Retry & Circuit Breaker
// ============================================================================

export {
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  defaultRetryPredicate,
  createRetryPredicate,
  retry,
  CircuitBreaker,
  CircuitOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './retry.js';
export type {
  RetryConfig,
  RetryOptions,
  RetryContext,
  RetryResult,
  RetryPredicate,
  DelayFunction,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from './retry.js';

// ============================================================================
// Metrics
// ============================================================================

export {
  createClientMetrics,
  createSessionManagerMetrics,
  MetricsRegistry,
  getMetricsRegistry,
} from './metrics.js';
export type {
  Counter,
  Gauge,
  Histogram,
  Timer,
  TimerObservation,
  MetricsSnapshot,
  HistogramSnapshot,
  McpClientMetrics,
  SessionManagerMetrics,
} from './metrics.js';

// ============================================================================
// Types - Transport Configuration
// ============================================================================

export type {
  TransportType,
  TransportConfig,
  StdioTransportConfig,
  SseTransportConfig,
  StreamableHttpTransportConfig,
} from './types.js';

// ============================================================================
// Types - MCP Capabilities
// ============================================================================

export type {
  McpCapabilities,
} from './types.js';

// ============================================================================
// Types - Tools
// ============================================================================

export type {
  JsonSchemaProperty,
  ToolInputSchema,
  McpTool,
  TextContent,
  ImageContent,
  EmbeddedResourceContent,
  ToolResultContent,
  McpToolCallResult,
} from './types.js';

// ============================================================================
// Types - Resources
// ============================================================================

export type {
  McpResource,
  McpResourceContents,
} from './types.js';

// ============================================================================
// Types - Prompts
// ============================================================================

export type {
  McpPromptArgument,
  McpPrompt,
  PromptMessageRole,
  PromptTextContent,
  PromptImageContent,
  PromptResourceContent,
  PromptMessageContent,
  McpPromptMessage,
  McpPromptResult,
} from './types.js';

// ============================================================================
// Types - Sessions
// ============================================================================

export type {
  ConnectionState,
  McpSession,
  McpSessionInternal,
} from './types.js';

// ============================================================================
// Types - Execution Results
// ============================================================================

export type {
  McpExecutionSuccess,
  McpExecutionFailure,
  McpExecutionResult,
} from './types.js';

// ============================================================================
// Types - Configuration
// ============================================================================

export type {
  McpClientOptions,
  SessionManagerOptions,
} from './types.js';

export {
  DEFAULT_CLIENT_OPTIONS,
  DEFAULT_SESSION_MANAGER_OPTIONS,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export {
  McpErrorCode,
  McpError,
  McpConnectionError,
  McpTransportError,
  McpTimeoutError,
  McpSessionError,
} from './types.js';

// ============================================================================
// Type Guards
// ============================================================================

export {
  isStdioTransportConfig,
  isSseTransportConfig,
  isStreamableHttpTransportConfig,
  isExecutionSuccess,
  isExecutionFailure,
  isMcpError,
  isTextContent,
  isImageContent,
  isEmbeddedResourceContent,
} from './types.js';
