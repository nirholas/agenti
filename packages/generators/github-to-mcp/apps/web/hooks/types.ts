/**
 * Playground Hooks Type Definitions
 * Shared types for MCP playground React hooks
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

// ============================================================================
// Constants
// ============================================================================

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT = 30000;

/** Default heartbeat interval in milliseconds */
export const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/** Default debounce delay for reconnection */
export const DEFAULT_RECONNECT_DEBOUNCE = 1000;

/** Default cache TTL in milliseconds */
export const DEFAULT_CACHE_TTL = 60000;

// ============================================================================
// Transport Configuration Types
// ============================================================================

/**
 * Supported transport types for MCP connections
 */
export type TransportType = 'stdio' | 'http' | 'websocket' | 'sse';

/**
 * Base transport configuration
 */
export interface BaseTransportConfig {
  type: TransportType;
}

/**
 * HTTP/SSE transport configuration
 */
export interface HttpTransportConfig extends BaseTransportConfig {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * WebSocket transport configuration
 */
export interface WebSocketTransportConfig extends BaseTransportConfig {
  type: 'websocket';
  url: string;
  protocols?: string[];
  headers?: Record<string, string>;
}

/**
 * Stdio transport configuration (for server-side execution)
 */
export interface StdioTransportConfig extends BaseTransportConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Union of all transport configurations
 */
export type TransportConfig =
  | HttpTransportConfig
  | WebSocketTransportConfig
  | StdioTransportConfig;

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Connection status states
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP Server capabilities
 */
export interface McpCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

/**
 * MCP Server information
 */
export interface ServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
  instructions?: string;
}

/**
 * Session information after successful connection
 */
export interface SessionInfo {
  sessionId: string;
  serverInfo: ServerInfo;
  capabilities: McpCapabilities;
  connectedAt: Date;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema property for tool input validation
 */
export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * Tool input schema
 */
export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

/**
 * Text content in tool response
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content in tool response
 */
export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * Resource content embedded in tool response
 */
export interface EmbeddedResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

/**
 * Tool content types
 */
export type ToolContent = TextContent | ImageContent | EmbeddedResourceContent;

/**
 * Result from calling a tool
 */
export interface ToolCallResult {
  content: ToolContent[];
  isError?: boolean;
}

/**
 * Execution status for async operations
 */
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error';

/**
 * Tool execution record
 */
export interface ToolExecution {
  id: string;
  toolName: string;
  params: Record<string, unknown>;
  status: ExecutionStatus;
  result?: ToolCallResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  executionTime?: number;
  logs: string[];
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * MCP Resource definition
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource content
 */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Resource contents wrapper
 */
export interface ResourceContents {
  contents: ResourceContent[];
}

/**
 * Resource read status
 */
export type ResourceReadStatus = 'pending' | 'loading' | 'success' | 'error';

/**
 * Resource read record
 */
export interface ResourceRead {
  id: string;
  uri: string;
  status: ResourceReadStatus;
  contents?: ResourceContents;
  error?: string;
  readAt?: Date;
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Prompt definition
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * Prompt message role
 */
export type PromptMessageRole = 'user' | 'assistant';

/**
 * Prompt message
 */
export interface PromptMessage {
  role: PromptMessageRole;
  content: TextContent | ImageContent | EmbeddedResourceContent;
}

/**
 * Prompt execution status
 */
export type PromptExecutionStatus = 'pending' | 'loading' | 'executing' | 'success' | 'error';

/**
 * Prompt execution record
 */
export interface PromptExecution {
  id: string;
  name: string;
  /** Alias for name (for backwards compatibility) */
  promptName?: string;
  args?: Record<string, string>;
  /** Alias for args (for backwards compatibility) */
  arguments?: Record<string, string>;
  status: PromptExecutionStatus;
  messages?: PromptMessage[];
  description?: string;
  error?: string;
  executedAt?: Date;
  /** When execution started */
  startedAt?: Date;
  /** When execution completed */
  completedAt?: Date;
}

// ============================================================================
// Execution History Types
// ============================================================================

/**
 * Type of execution entry
 */
export type ExecutionType = 'tool' | 'resource' | 'prompt';

/**
 * Execution history entry
 */
export interface ExecutionHistoryEntry {
  id: string;
  type: ExecutionType;
  name: string;
  params?: unknown;
  result?: unknown;
  error?: string;
  success: boolean;
  timestamp: Date;
  executionTime?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Connect API response
 */
export interface ConnectResponse {
  sessionId: string;
  serverInfo: ServerInfo;
  capabilities: McpCapabilities;
}

/**
 * List tools API response
 */
export interface ListToolsResponse {
  tools: McpTool[];
}

/**
 * Execute tool API response
 */
export interface ExecuteToolResponse {
  result: ToolCallResult;
  executionTime: number;
  logs?: string[];
}

/**
 * List resources API response
 */
export interface ListResourcesResponse {
  resources: McpResource[];
}

/**
 * Read resource API response
 */
export interface ReadResourceResponse {
  contents: ResourceContents;
}

/**
 * List prompts API response
 */
export interface ListPromptsResponse {
  prompts: McpPrompt[];
}

/**
 * Get prompt API response
 */
export interface GetPromptResponse {
  messages: PromptMessage[];
  description?: string;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Common hook options shared across all hooks
 */
export interface CommonHookOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /** Event emitter for subscribing to events outside React */
  eventEmitter?: McpEventEmitter;
}

/**
 * Options for useMcpConnection hook
 */
export interface UseMcpConnectionOptions extends CommonHookOptions {
  autoConnect?: boolean;
  onConnect?: (session: SessionInfo) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  /** Heartbeat interval in ms (0 to disable) */
  heartbeatInterval?: number;
  /** Debounce delay for reconnection in ms */
  reconnectDebounce?: number;
}

/**
 * Return type for useMcpConnection hook
 */
export interface UseMcpConnectionReturn {
  // State
  status: ConnectionStatus;
  sessionId: string | null;
  capabilities: McpCapabilities | null;
  serverInfo: ServerInfo | null;
  error: string | null;
  /** Last successful heartbeat timestamp */
  lastHeartbeat: Date | null;
  /** Server URL (for HTTP/SSE transports) */
  serverUrl: string | null;

  // Actions
  connect: (config: TransportConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  clearError: () => void;
  /** Manually trigger a heartbeat */
  heartbeat: () => Promise<boolean>;
}

/**
 * Options for useMcpTools hook
 */
export interface UseMcpToolsOptions extends CommonHookOptions {
  sessionId: string | null;
  autoLoad?: boolean;
  /** Cache TTL in ms (0 to disable caching) */
  cacheTtl?: number;
}

/**
 * Return type for useMcpTools hook
 */
export interface UseMcpToolsReturn {
  // State
  tools: McpTool[];
  isLoading: boolean;
  error: string | null;
  executions: ToolExecution[];
  currentExecution: ToolExecution | null;
  /** Whether data is from cache */
  isStale: boolean;

  // Actions
  loadTools: () => Promise<void>;
  /** Force refresh, bypassing cache */
  refreshTools: () => Promise<void>;
  executeTool: (name: string, params: Record<string, unknown>) => Promise<ToolExecution>;
  /** Execute multiple tools in parallel */
  executeBatch: (requests: BatchToolRequest[], options?: BatchExecutionOptions) => Promise<BatchToolResult[]>;
  cancelExecution: (id: string) => void;
  clearExecutions: () => void;
  clearError: () => void;
}

/**
 * Options for useMcpResources hook
 */
export interface UseMcpResourcesOptions extends CommonHookOptions {
  sessionId: string | null;
  autoLoad?: boolean;
  /** Cache TTL in ms (0 to disable caching) */
  cacheTtl?: number;
}

/**
 * Return type for useMcpResources hook
 */
export interface UseMcpResourcesReturn {
  // State
  resources: McpResource[];
  isLoading: boolean;
  error: string | null;
  reads: ResourceRead[];
  /** Whether data is from cache */
  isStale: boolean;

  // Actions
  loadResources: () => Promise<void>;
  /** Force refresh, bypassing cache */
  refreshResources: () => Promise<void>;
  readResource: (uri: string) => Promise<ResourceRead>;
  clearReads: () => void;
  clearError: () => void;
}

/**
 * Options for useMcpPrompts hook
 */
export interface UseMcpPromptsOptions extends CommonHookOptions {
  sessionId: string | null;
  autoLoad?: boolean;
  /** Cache TTL in ms (0 to disable caching) */
  cacheTtl?: number;
}

/**
 * Return type for useMcpPrompts hook
 */
export interface UseMcpPromptsReturn {
  // State
  prompts: McpPrompt[];
  isLoading: boolean;
  error: string | null;
  executions: PromptExecution[];
  /** Whether data is from cache */
  isStale: boolean;

  // Actions
  loadPrompts: () => Promise<void>;
  /** Force refresh, bypassing cache */
  refreshPrompts: () => Promise<void>;
  getPrompt: (name: string, args?: Record<string, string>) => Promise<PromptExecution>;
  /** Execute a prompt (alias for getPrompt) */
  executePrompt: (name: string, args?: Record<string, string>) => Promise<PromptExecution>;
  clearExecutions: () => void;
  clearError: () => void;
  /** Get messages from last successful execution */
  getLastMessages: () => PromptMessage[] | null;
}

/**
 * Return type for useExecutionHistory hook
 */
export interface UseExecutionHistoryReturn {
  history: ExecutionHistoryEntry[];
  add: (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => void;
  addExecution: (execution: ToolExecution) => void;
  addResourceRead: (read: ResourceRead) => void;
  addPromptExecution: (execution: PromptExecution) => void;
  clear: () => void;
  clearHistory: () => void;
  getByType: (type: ExecutionType) => ExecutionHistoryEntry[];
  getByStatus: (success: boolean) => ExecutionHistoryEntry[];
  export: () => string;
  exportHistory: () => string;
  import: (json: string) => void;
  importHistory: (json: string) => void;
}

/**
 * Options for usePlayground hook
 */
export interface UsePlaygroundOptions extends CommonHookOptions {
  initialCode?: string;
  initialTransport?: TransportConfig;
  /** Auto connect on mount */
  autoConnect?: boolean;
  /** Persist history to localStorage */
  persistHistory?: boolean;
  /** Custom storage key for history */
  historyKey?: string;
  /** Cache TTL in ms */
  cacheTtl?: number;
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
  /** Callback when connected */
  onConnect?: (sessionId: string) => void;
  /** Callback when disconnected */
  onDisconnect?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Options for useExecutionHistory hook
 */
export interface UseExecutionHistoryOptions {
  /** Maximum history items to keep */
  maxItems?: number;
  /** Persist to localStorage */
  persistToStorage?: boolean;
  /** Custom storage key */
  storageKey?: string;
}

/**
 * Active tab type in playground
 */
export type PlaygroundTab = 'tools' | 'resources' | 'prompts';

/**
 * Return type for usePlayground hook
 */
export interface UsePlaygroundReturn {
  // Connection
  connection: UseMcpConnectionReturn;

  // Data
  tools: UseMcpToolsReturn;
  resources: UseMcpResourcesReturn;
  prompts: UseMcpPromptsReturn;

  // UI State
  activeTab: PlaygroundTab;
  setActiveTab: (tab: PlaygroundTab) => void;
  selectedTool: McpTool | null;
  setSelectedTool: (tool: McpTool | null) => void;
  selectedResource: McpResource | null;
  setSelectedResource: (resource: McpResource | null) => void;
  selectedPrompt: McpPrompt | null;
  setSelectedPrompt: (prompt: McpPrompt | null) => void;

  // Transport Config
  transportConfig: TransportConfig | null;
  setTransportConfig: (config: TransportConfig) => void;

  // Convenience
  isReady: boolean;
  hasCapability: (cap: keyof McpCapabilities) => boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Exponential backoff configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  factor: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  factor: 2,
};

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoff(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.factor, attempt),
    config.maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * delay * 0.1;
}

// ============================================================================
// Debug & Logging Types
// ============================================================================

/**
 * Log levels for debug mode
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Debug log entry
 */
export interface DebugLogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

/**
 * Debug options for hooks
 */
export interface DebugOptions {
  enabled: boolean;
  logLevel?: LogLevel;
  onLog?: (entry: DebugLogEntry) => void;
}

/**
 * Create a debug logger
 */
export function createDebugLogger(source: string, options?: DebugOptions) {
  const logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  const minLevel = logLevels[options?.logLevel ?? 'debug'];

  return {
    debug: (message: string, data?: unknown) => {
      if (!options?.enabled || logLevels.debug < minLevel) return;
      const entry: DebugLogEntry = { timestamp: new Date(), level: 'debug', source, message, data };
      options.onLog?.(entry);
      console.debug(`[${source}]`, message, data ?? '');
    },
    info: (message: string, data?: unknown) => {
      if (!options?.enabled || logLevels.info < minLevel) return;
      const entry: DebugLogEntry = { timestamp: new Date(), level: 'info', source, message, data };
      options.onLog?.(entry);
      console.info(`[${source}]`, message, data ?? '');
    },
    warn: (message: string, data?: unknown) => {
      if (!options?.enabled || logLevels.warn < minLevel) return;
      const entry: DebugLogEntry = { timestamp: new Date(), level: 'warn', source, message, data };
      options.onLog?.(entry);
      console.warn(`[${source}]`, message, data ?? '');
    },
    error: (message: string, data?: unknown) => {
      if (!options?.enabled || logLevels.error < minLevel) return;
      const entry: DebugLogEntry = { timestamp: new Date(), level: 'error', source, message, data };
      options.onLog?.(entry);
      console.error(`[${source}]`, message, data ?? '');
    },
  };
}

// ============================================================================
// Event Emitter Types
// ============================================================================

/**
 * Event types for MCP hooks
 */
export type McpEventType =
  | 'connection:connecting'
  | 'connection:connected'
  | 'connection:disconnected'
  | 'connection:error'
  | 'connection:heartbeat'
  | 'tools:loading'
  | 'tools:loaded'
  | 'tools:error'
  | 'tool:executing'
  | 'tool:executed'
  | 'tool:error'
  | 'tool:cancelled'
  | 'resources:loading'
  | 'resources:loaded'
  | 'resources:error'
  | 'resource:reading'
  | 'resource:read'
  | 'resource:error'
  | 'prompts:loading'
  | 'prompts:loaded'
  | 'prompts:error'
  | 'prompt:getting'
  | 'prompt:got'
  | 'prompt:error'
  | 'prompt:executing'
  | 'prompt:executed';

/**
 * Event payload base
 */
export interface McpEventBase {
  type: McpEventType;
  timestamp: Date;
  sessionId?: string | null;
}

/**
 * Connection event payload
 */
export interface ConnectionEvent extends McpEventBase {
  type: 'connection:connecting' | 'connection:connected' | 'connection:disconnected' | 'connection:error' | 'connection:heartbeat';
  data?: {
    serverInfo?: ServerInfo;
    capabilities?: McpCapabilities;
    error?: string;
  };
}

/**
 * Tool event payload
 */
export interface ToolEvent extends McpEventBase {
  type: 'tools:loading' | 'tools:loaded' | 'tools:error' | 'tool:executing' | 'tool:executed' | 'tool:error' | 'tool:cancelled';
  data?: {
    tools?: McpTool[];
    toolName?: string;
    params?: Record<string, unknown>;
    result?: ToolCallResult;
    error?: string;
    executionTime?: number;
  };
}

/**
 * Resource event payload
 */
export interface ResourceEvent extends McpEventBase {
  type: 'resources:loading' | 'resources:loaded' | 'resources:error' | 'resource:reading' | 'resource:read' | 'resource:error';
  data?: {
    resources?: McpResource[];
    uri?: string;
    contents?: ResourceContents;
    error?: string;
  };
}

/**
 * Prompt event payload
 */
export interface PromptEvent extends McpEventBase {
  type: 'prompts:loading' | 'prompts:loaded' | 'prompts:error' | 'prompt:getting' | 'prompt:got' | 'prompt:error' | 'prompt:executing' | 'prompt:executed';
  data?: {
    prompts?: McpPrompt[];
    name?: string;
    args?: Record<string, string>;
    arguments?: Record<string, string>;
    messages?: PromptMessage[];
    error?: string;
  };
}

/**
 * Union of all event types
 */
export type McpEvent = ConnectionEvent | ToolEvent | ResourceEvent | PromptEvent;

/**
 * Event listener function
 */
export type McpEventListener<T extends McpEvent = McpEvent> = (event: T) => void;

/**
 * Simple event emitter for MCP events
 */
export class McpEventEmitter {
  private listeners = new Map<McpEventType | '*', Set<McpEventListener>>();

  on<T extends McpEvent>(type: T['type'] | '*', listener: McpEventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as McpEventListener);
    
    // Return unsubscribe function
    return () => this.off(type, listener);
  }

  off<T extends McpEvent>(type: T['type'] | '*', listener: McpEventListener<T>): void {
    this.listeners.get(type)?.delete(listener as McpEventListener);
  }

  /**
   * Subscribe to all events (alias for on('*', ...))
   */
  subscribe(listener: McpEventListener): () => void {
    return this.on('*', listener);
  }

  emit<T extends McpEvent>(event: T): void {
    // Emit to specific listeners
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[McpEventEmitter] Error in listener:', err);
      }
    });
    
    // Emit to wildcard listeners
    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[McpEventEmitter] Error in wildcard listener:', err);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Create an MCP event emitter instance
 */
export function createMcpEventEmitter(): McpEventEmitter {
  return new McpEventEmitter();
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Simple cache implementation
 */
export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  getStale(key: string): T | null {
    const entry = this.cache.get(key);
    return entry?.data ?? null;
  }
}

// ============================================================================
// Batch Execution Types
// ============================================================================

/**
 * Batch tool execution request
 */
export interface BatchToolRequest {
  name: string;
  params: Record<string, unknown>;
}

/**
 * Batch tool execution result
 */
export interface BatchToolResult {
  request: BatchToolRequest;
  execution: ToolExecution;
}

/**
 * Batch execution options
 */
export interface BatchExecutionOptions {
  /** Maximum concurrent executions */
  concurrency?: number;
  /** Stop on first error */
  stopOnError?: boolean;
  /** Timeout per execution in ms */
  timeout?: number;
}

// ============================================================================
// Request Deduplication Types
// ============================================================================

/**
 * Pending request tracker
 */
export class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>();

  /**
   * Execute a request with deduplication
   * If the same key is already in flight, return the existing promise
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  has(key: string): boolean {
    return this.pending.has(key);
  }

  clear(): void {
    this.pending.clear();
  }
}

// ============================================================================
// Fetch with Timeout
// ============================================================================

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combine with existing signal if present
  const signal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Combine multiple AbortSignals into one
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  return controller.signal;
}

// ============================================================================
// Debounce Utility
// ============================================================================

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
