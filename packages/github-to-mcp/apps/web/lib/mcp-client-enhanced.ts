/**
 * Enhanced MCP Client with Advanced Features
 * 
 * Builds on top of the base mcp-client.ts with:
 * - WebSocket transport for real-time bidirectional communication
 * - Automatic retry with exponential backoff
 * - Request queuing and rate limiting
 * - Event emitter pattern for notifications
 * - Connection health monitoring with heartbeat
 * - Streaming support for tool calls
 * 
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright 2024-2026 nich (nirholas)
 * @license MIT
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  McpTool,
  CallToolResult,
  ServerCapabilities,
  ServerInfo,
  MCP_METHODS,
  MCP_PROTOCOL_VERSION,
  isJsonRpcError,
  ToolContent,
  TextContent,
} from './mcp-types';

import {
  McpError,
  McpConnectionError,
  McpTimeoutError,
  McpConnectionClosedError,
  McpServerNotInitializedError,
  McpToolNotFoundError,
  McpToolTimeoutError,
  createErrorFromJsonRpc,
  wrapError,
  isRetryableError,
} from './mcp-errors';

import { IMcpTransport, McpClientState } from './mcp-client';

// ============================================================================
// Event Emitter
// ============================================================================

/** Enhanced client - nich (x.com/nichxbt | github.com/nirholas) */
const _ENHANCED_META = { author: 'nich', links: ['x.com/nichxbt', 'github.com/nirholas'] } as const;

type EventCallback<T = unknown> = (data: T) => void;

/**
 * Simple typed event emitter for MCP events
 */
export class McpEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
    
    // Return unsubscribe function
    return () => this.off(event, callback as EventCallback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<T>(event: string, data: T): void {
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// ============================================================================
// Enhanced Client Events
// ============================================================================

export interface McpClientEvents {
  'state:change': { previous: McpClientState; current: McpClientState };
  'connected': { serverInfo: ServerInfo; capabilities: ServerCapabilities };
  'disconnected': { reason: string };
  'error': { error: McpError };
  'notification': { method: string; params?: Record<string, unknown> };
  'tool:start': { name: string; args?: Record<string, unknown> };
  'tool:progress': { name: string; progress: number; message?: string };
  'tool:complete': { name: string; result: CallToolResult; duration: number };
  'tool:error': { name: string; error: McpError };
  'tools:changed': { tools: McpTool[] };
  'heartbeat': { latency: number };
  'reconnecting': { attempt: number; maxAttempts: number; delay: number };
}

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Add jitter to prevent thundering herd */
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelay);
  
  if (config.jitter) {
    // Add random jitter of ±25%
    const jitterRange = delay * 0.25;
    delay += (Math.random() - 0.5) * 2 * jitterRange;
  }
  
  return Math.round(delay);
}

// ============================================================================
// Request Queue
// ============================================================================

interface QueuedRequest {
  request: JsonRpcRequest;
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
  priority: number;
  timestamp: number;
  retryCount: number;
}

/**
 * Priority request queue with rate limiting
 */
export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing: boolean = false;
  private readonly maxConcurrent: number;
  private readonly minInterval: number;
  private activeRequests: number = 0;
  private lastRequestTime: number = 0;

  constructor(options: { maxConcurrent?: number; minInterval?: number } = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.minInterval = options.minInterval ?? 50; // 50ms minimum between requests
  }

  async enqueue(
    request: JsonRpcRequest,
    sender: (req: JsonRpcRequest) => Promise<JsonRpcResponse>,
    priority: number = 0
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const queued: QueuedRequest = {
        request,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Insert by priority (higher priority first)
      const insertIndex = this.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queued);
      } else {
        this.queue.splice(insertIndex, 0, queued);
      }

      this.processQueue(sender);
    });
  }

  private async processQueue(
    sender: (req: JsonRpcRequest) => Promise<JsonRpcResponse>
  ): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      // Rate limiting
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(r => setTimeout(r, this.minInterval - timeSinceLastRequest));
      }

      const queued = this.queue.shift();
      if (!queued) break;

      this.activeRequests++;
      this.lastRequestTime = Date.now();

      // Process request without blocking the loop
      sender(queued.request)
        .then(response => queued.resolve(response))
        .catch(error => queued.reject(error))
        .finally(() => {
          this.activeRequests--;
          this.processQueue(sender);
        });
    }

    this.processing = false;
  }

  clear(): void {
    this.queue.forEach(q => q.reject(new Error('Queue cleared')));
    this.queue = [];
  }

  get length(): number {
    return this.queue.length;
  }

  get pending(): number {
    return this.activeRequests;
  }
}

// ============================================================================
// WebSocket Transport
// ============================================================================

export interface WebSocketTransportOptions {
  /** WebSocket endpoint URL */
  url: string;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect configuration */
  reconnectConfig?: RetryConfig;
  /** Heartbeat interval in ms (0 to disable) */
  heartbeatInterval?: number;
}

/**
 * WebSocket transport for real-time bidirectional MCP communication
 */
export class WebSocketTransport implements IMcpTransport {
  private url: string;
  private socket: WebSocket | null = null;
  private messageHandler?: (message: JsonRpcNotification) => void;
  private pendingRequests: Map<number | string, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private autoReconnect: boolean;
  private reconnectConfig: RetryConfig;
  private heartbeatInterval: number;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectAttempt: number = 0;
  private intentionalClose: boolean = false;
  private onReconnecting?: (attempt: number, maxAttempts: number) => void;

  constructor(options: WebSocketTransportOptions) {
    this.url = options.url;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectConfig = options.reconnectConfig ?? DEFAULT_RETRY_CONFIG;
    this.heartbeatInterval = options.heartbeatInterval ?? 30000;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.intentionalClose = false;
        this.socket = new WebSocket(this.url);

        const connectionTimeout = setTimeout(() => {
          this.socket?.close();
          reject(new McpConnectionError('WebSocket connection timeout'));
        }, 10000);

        this.socket.onopen = () => {
          clearTimeout(connectionTimeout);
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (event) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', event);
        };

        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.stopHeartbeat();
          this.rejectAllPending(new McpConnectionClosedError(
            `WebSocket closed: ${event.code} ${event.reason}`
          ));

          if (!this.intentionalClose && this.autoReconnect) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        reject(wrapError(error, 'Failed to create WebSocket'));
      }
    });
  }

  async stop(): Promise<void> {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.rejectAllPending(new McpConnectionClosedError('Transport stopped'));
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  onMessage(handler: (message: JsonRpcNotification) => void): void {
    this.messageHandler = handler;
  }

  setReconnectHandler(handler: (attempt: number, maxAttempts: number) => void): void {
    this.onReconnecting = handler;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected()) {
      throw new McpConnectionClosedError('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new McpTimeoutError('Request timeout', 30000));
      }, 30000);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });
      this.socket!.send(JSON.stringify(request));
    });
  }

  async notify(notification: JsonRpcNotification): Promise<void> {
    if (!this.isConnected()) {
      throw new McpConnectionClosedError('WebSocket is not connected');
    }
    this.socket!.send(JSON.stringify(notification));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Check if it's a response to a pending request
      if ('id' in message && message.id !== null) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.resolve(message as JsonRpcResponse);
          return;
        }
      }

      // It's a notification
      if (this.messageHandler && !('id' in message)) {
        this.messageHandler(message as JsonRpcNotification);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private rejectAllPending(error: Error): void {
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempt >= this.reconnectConfig.maxAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempt++;
    const delay = calculateRetryDelay(this.reconnectAttempt - 1, this.reconnectConfig);
    
    this.onReconnecting?.(this.reconnectAttempt, this.reconnectConfig.maxAttempts);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.reconnectConfig.maxAttempts})`);

    await new Promise(r => setTimeout(r, delay));

    try {
      await this.start();
    } catch (error) {
      // Will trigger another reconnect attempt via onclose
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval <= 0) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        // Send a ping (could also use MCP's ping if supported)
        this.socket!.send(JSON.stringify({ jsonrpc: '2.0', method: 'ping' }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}

// ============================================================================
// Enhanced MCP Client
// ============================================================================

export interface EnhancedMcpClientOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Tool call timeout */
  toolTimeout?: number;
  /** Client identification */
  clientName?: string;
  clientVersion?: string;
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Enable request queuing */
  enableQueue?: boolean;
  /** Queue options */
  queueOptions?: { maxConcurrent?: number; minInterval?: number };
  /** Auto-reconnect on connection loss */
  autoReconnect?: boolean;
  /** Cache tool list */
  cacheTools?: boolean;
}

const DEFAULT_ENHANCED_OPTIONS: Required<EnhancedMcpClientOptions> = {
  timeout: 30000,
  toolTimeout: 60000,
  clientName: 'github-to-mcp-client',
  clientVersion: '1.0.0',
  retryConfig: DEFAULT_RETRY_CONFIG,
  enableQueue: true,
  queueOptions: { maxConcurrent: 10, minInterval: 50 },
  autoReconnect: true,
  cacheTools: true,
};

/**
 * Enhanced MCP Client with advanced features
 */
export class EnhancedMcpClient extends McpEventEmitter {
  private transport: IMcpTransport;
  private options: Required<EnhancedMcpClientOptions>;
  private _state: McpClientState = 'disconnected';
  private _capabilities: ServerCapabilities | null = null;
  private _serverInfo: ServerInfo | null = null;
  private requestId: number = 0;
  private cachedTools: McpTool[] | null = null;
  private requestQueue: RequestQueue | null = null;
  private retryConfig: RetryConfig;

  constructor(transport: IMcpTransport, options: EnhancedMcpClientOptions = {}) {
    super();
    this.transport = transport;
    this.options = { ...DEFAULT_ENHANCED_OPTIONS, ...options };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };

    if (this.options.enableQueue) {
      this.requestQueue = new RequestQueue(this.options.queueOptions);
    }

    // Set up notification handler
    this.transport.onMessage((notification) => {
      this.handleNotification(notification);
    });
  }

  get state(): McpClientState {
    return this._state;
  }

  get capabilities(): ServerCapabilities | null {
    return this._capabilities;
  }

  get serverInfo(): ServerInfo | null {
    return this._serverInfo;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this._state === 'ready') {
      return;
    }

    if (this._state === 'connecting' || this._state === 'initializing') {
      throw new McpError('Connection already in progress', -32001);
    }

    try {
      this.setState('connecting');

      await this.transport.start();

      this.setState('initializing');

      const initResult = await this.request<{
        protocolVersion: string;
        capabilities: ServerCapabilities;
        serverInfo: ServerInfo;
      }>(MCP_METHODS.INITIALIZE, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { roots: { listChanged: true } },
        clientInfo: {
          name: this.options.clientName,
          version: this.options.clientVersion,
        },
      });

      this._capabilities = initResult.capabilities;
      this._serverInfo = initResult.serverInfo;

      await this.notify(MCP_METHODS.INITIALIZED);

      this.setState('ready');
      this.emit('connected', {
        serverInfo: initResult.serverInfo,
        capabilities: initResult.capabilities,
      });
    } catch (error) {
      this.setState('error');
      const wrappedError = wrapError(error, 'Failed to connect');
      this.emit('error', { error: wrappedError });
      throw wrappedError;
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === 'disconnected' || this._state === 'closed') {
      return;
    }

    try {
      if (this._state === 'ready') {
        await this.request(MCP_METHODS.SHUTDOWN, {}).catch(() => {});
      }

      await this.transport.stop();
      this.requestQueue?.clear();
      this.setState('closed');
      this._capabilities = null;
      this._serverInfo = null;
      this.cachedTools = null;
      this.emit('disconnected', { reason: 'Client disconnect' });
    } catch (error) {
      this.setState('error');
      throw wrapError(error, 'Failed to disconnect');
    }
  }

  // ============================================================================
  // Tool Operations
  // ============================================================================

  async listTools(forceRefresh: boolean = false): Promise<McpTool[]> {
    this.ensureReady();

    if (this.options.cacheTools && this.cachedTools && !forceRefresh) {
      return this.cachedTools;
    }

    const result = await this.request<{ tools: McpTool[] }>(MCP_METHODS.TOOLS_LIST);
    this.cachedTools = result.tools;
    return result.tools;
  }

  async callTool(
    name: string, 
    args?: Record<string, unknown>,
    options?: { timeout?: number; priority?: number }
  ): Promise<CallToolResult> {
    this.ensureReady();

    const tools = await this.listTools();
    const tool = tools.find(t => t.name === name);
    if (!tool) {
      throw new McpToolNotFoundError(name);
    }

    const startTime = Date.now();
    this.emit('tool:start', { name, args });

    try {
      const result = await this.request<CallToolResult>(
        MCP_METHODS.TOOLS_CALL,
        { name, arguments: args },
        options?.timeout ?? this.options.toolTimeout,
        options?.priority ?? 0
      );

      const duration = Date.now() - startTime;
      this.emit('tool:complete', { name, result, duration });
      return result;
    } catch (error) {
      const mcpError = error instanceof McpError ? error : wrapError(error);
      this.emit('tool:error', { name, error: mcpError });
      
      if (error instanceof McpTimeoutError) {
        throw new McpToolTimeoutError(name, this.options.toolTimeout);
      }
      throw error;
    }
  }

  /**
   * Call a tool with automatic retry on retryable errors
   */
  async callToolWithRetry(
    name: string,
    args?: Record<string, unknown>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<CallToolResult> {
    const config = { ...this.retryConfig, ...retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      try {
        return await this.callTool(name, args);
      } catch (error) {
        lastError = error as Error;
        
        if (!isRetryableError(error) || attempt === config.maxAttempts - 1) {
          throw error;
        }

        const delay = calculateRetryDelay(attempt, config);
        this.emit('reconnecting', { 
          attempt: attempt + 1, 
          maxAttempts: config.maxAttempts,
          delay 
        });
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastError;
  }

  // ============================================================================
  // Request Handling
  // ============================================================================

  private async request<T>(
    method: string,
    params?: object,
    timeout?: number,
    priority?: number
  ): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      ...(params && { params: params as Record<string, unknown> }),
    };

    const effectiveTimeout = timeout ?? this.options.timeout;

    const sendRequest = async (req: JsonRpcRequest): Promise<JsonRpcResponse> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new McpTimeoutError(`Request timed out: ${method}`, effectiveTimeout)),
          effectiveTimeout
        );
      });

      return Promise.race([this.transport.send(req), timeoutPromise]);
    };

    let response: JsonRpcResponse;

    if (this.requestQueue) {
      response = await this.requestQueue.enqueue(request, sendRequest, priority);
    } else {
      response = await sendRequest(request);
    }

    if (isJsonRpcError(response)) {
      throw createErrorFromJsonRpc(response.error);
    }

    if ('result' in response) {
      return response.result as T;
    }

    throw new McpError('Invalid response format', -32600);
  }

  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params && { params }),
    };
    await this.transport.notify(notification);
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private setState(newState: McpClientState): void {
    const previous = this._state;
    this._state = newState;
    this.emit('state:change', { previous, current: newState });
  }

  private ensureReady(): void {
    if (this._state !== 'ready') {
      throw new McpServerNotInitializedError(`Client is not ready. State: ${this._state}`);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;

    if (method === MCP_METHODS.NOTIFICATION_TOOLS_LIST_CHANGED) {
      this.cachedTools = null;
      this.listTools().then(tools => {
        this.emit('tools:changed', { tools });
      });
    }

    this.emit('notification', { method, params });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an enhanced MCP client with WebSocket transport
 */
export function createWebSocketClient(
  url: string,
  options?: EnhancedMcpClientOptions & WebSocketTransportOptions
): EnhancedMcpClient {
  const transport = new WebSocketTransport({
    url,
    autoReconnect: options?.autoReconnect,
    reconnectConfig: options?.retryConfig as RetryConfig,
    heartbeatInterval: 30000,
  });

  return new EnhancedMcpClient(transport, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract all text content from a tool result
 */
export function extractAllTextContent(result: CallToolResult): string[] {
  return result.content
    .filter((c): c is TextContent => c.type === 'text')
    .map(c => c.text);
}

/**
 * Check if tool result indicates an error
 */
export function hasToolError(result: CallToolResult): boolean {
  return result.isError === true;
}

/**
 * Format tool result for display
 */
export function formatToolResult(result: CallToolResult): string {
  const texts = extractAllTextContent(result);
  if (texts.length > 0) {
    return texts.join('\n');
  }
  return JSON.stringify(result.content, null, 2);
}

/**
 * Create a promise that resolves when client reaches a specific state
 */
export function waitForState(
  client: EnhancedMcpClient,
  targetState: McpClientState,
  timeout: number = 30000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (client.state === targetState) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new McpTimeoutError(`Timeout waiting for state: ${targetState}`, timeout));
    }, timeout);

    const unsubscribe = client.on<McpClientEvents['state:change']>('state:change', ({ current }) => {
      if (current === targetState) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      }
    });
  });
}
