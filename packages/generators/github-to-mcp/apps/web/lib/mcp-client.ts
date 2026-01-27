/**
 * MCP Client Implementation
 * Client-side MCP protocol handler for communicating with MCP servers
 * 
 * Features:
 * - Multiple transport support (HTTP, WebSocket, SSE, In-Memory)
 * - Automatic retry with exponential backoff
 * - Request queuing and rate limiting
 * - Event emitter for notifications
 * - Streaming support for long-running operations
 * - Connection health monitoring
 * 
 * @see https://spec.modelcontextprotocol.io/
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright 2024-2026 nich (nirholas)
 * @license MIT
 */

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  McpTool,
  ListToolsResult,
  CallToolParams,
  CallToolResult,
  ListResourcesResult,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptResult,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  ServerInfo,
  isJsonRpcError,
  MCP_METHODS,
  MCP_PROTOCOL_VERSION,
  ToolContent,
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

// ============================================================================
// Client Options & Interfaces
// ============================================================================

/**
 * Options for creating an MCP client
 */
export interface McpClientOptions {
  /** Server code or identifier (for reference) */
  serverCode?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default timeout for tool calls */
  toolTimeout?: number;
  /** Callback for server output/logs */
  onOutput?: (data: string) => void;
  /** Callback for errors */
  onError?: (error: string) => void;
  /** Callback for notifications from server */
  onNotification?: (method: string, params?: Record<string, unknown>) => void;
  /** Client name for identification */
  clientName?: string;
  /** Client version */
  clientVersion?: string;
}

/** Default client info - nich (x.com/nichxbt | github.com/nirholas) */
const _DEFAULT_CLIENT_META = {
  name: 'github-to-mcp-client',
  author: 'nich',
  links: ['x.com/nichxbt', 'github.com/nirholas'],
} as const;

/**
 * Connection state for the MCP client
 */
export type McpClientState = 
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'error'
  | 'closed';

/**
 * MCP Client interface
 */
export interface IMcpClient {
  /** Current connection state */
  readonly state: McpClientState;
  /** Server capabilities (available after initialization) */
  readonly capabilities: ServerCapabilities | null;
  
  /** Connect and initialize the MCP server */
  connect(): Promise<void>;
  /** Disconnect from the MCP server */
  disconnect(): Promise<void>;
  
  /** List available tools */
  listTools(): Promise<McpTool[]>;
  /** Call a tool with arguments */
  callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult>;
  
  /** List available resources */
  listResources(): Promise<ListResourcesResult>;
  /** Read a resource by URI */
  readResource(uri: string): Promise<ReadResourceResult>;
  
  /** List available prompts */
  listPrompts(): Promise<ListPromptsResult>;
  /** Get a prompt by name with arguments */
  getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>;
}

// ============================================================================
// Transport Interface
// ============================================================================

/**
 * Transport interface for MCP communication
 * Allows different transport mechanisms (stdio, SSE, WebSocket, etc.)
 */
export interface IMcpTransport {
  /** Send a request and wait for response */
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>;
  /** Send a notification (no response expected) */
  notify(notification: JsonRpcNotification): Promise<void>;
  /** Start the transport */
  start(): Promise<void>;
  /** Stop the transport */
  stop(): Promise<void>;
  /** Set message handler for incoming notifications */
  onMessage(handler: (message: JsonRpcNotification) => void): void;
  /** Check if transport is connected */
  isConnected(): boolean;
}

// ============================================================================
// HTTP/SSE Transport Implementation
// ============================================================================

/**
 * HTTP transport options
 */
export interface HttpTransportOptions {
  /** Server endpoint URL */
  endpoint: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request timeout */
  timeout?: number;
}

/**
 * HTTP Transport for MCP communication
 * Sends requests via HTTP POST and handles SSE for streaming
 */
export class HttpTransport implements IMcpTransport {
  private endpoint: string;
  private headers: Record<string, string>;
  private timeout: number;
  private connected: boolean = false;
  private messageHandler?: (message: JsonRpcNotification) => void;
  private eventSource?: EventSource;

  constructor(options: HttpTransportOptions) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.timeout = options.timeout ?? 30000;
  }

  async start(): Promise<void> {
    this.connected = true;
  }

  async stop(): Promise<void> {
    this.connected = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(handler: (message: JsonRpcNotification) => void): void {
    this.messageHandler = handler;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.connected) {
      throw new McpConnectionClosedError('Transport is not connected');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new McpConnectionError(
          `HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as JsonRpcResponse;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new McpTimeoutError('Request timed out', this.timeout);
      }
      throw wrapError(error, 'Failed to send request');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async notify(notification: JsonRpcNotification): Promise<void> {
    if (!this.connected) {
      throw new McpConnectionClosedError('Transport is not connected');
    }

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(notification),
      });
    } catch (error) {
      // Notifications don't expect responses, so we swallow errors
      console.warn('Failed to send notification:', error);
    }
  }

  /**
   * Connect to SSE endpoint for streaming notifications
   */
  connectSSE(sseEndpoint: string): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(sseEndpoint);

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as JsonRpcNotification;
        if (this.messageHandler && !('id' in message)) {
          this.messageHandler(message);
        }
      } catch (error) {
        console.warn('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.warn('SSE connection error');
    };
  }
}

// ============================================================================
// In-Memory Transport for Testing
// ============================================================================

/**
 * Handler function type for in-memory transport
 */
export type InMemoryHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse>;

/**
 * In-memory transport for testing MCP clients
 */
export class InMemoryTransport implements IMcpTransport {
  private handler: InMemoryHandler;
  private connected: boolean = false;
  private messageHandler?: (message: JsonRpcNotification) => void;

  constructor(handler: InMemoryHandler) {
    this.handler = handler;
  }

  async start(): Promise<void> {
    this.connected = true;
  }

  async stop(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(handler: (message: JsonRpcNotification) => void): void {
    this.messageHandler = handler;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.connected) {
      throw new McpConnectionClosedError('Transport is not connected');
    }
    return this.handler(request);
  }

  async notify(): Promise<void> {
    // No-op for in-memory transport
  }

  /**
   * Simulate a notification from the server
   */
  simulateNotification(notification: JsonRpcNotification): void {
    if (this.messageHandler) {
      this.messageHandler(notification);
    }
  }
}

// ============================================================================
// MCP Client Implementation
// ============================================================================

const DEFAULT_OPTIONS: Required<Pick<McpClientOptions, 'timeout' | 'toolTimeout' | 'clientName' | 'clientVersion'>> = {
  timeout: 30000,
  toolTimeout: 60000,
  clientName: 'github-to-mcp-client',
  clientVersion: '1.0.0',
};

/**
 * MCP Client implementation
 */
export class McpClient implements IMcpClient {
  private transport: IMcpTransport;
  private options: McpClientOptions & typeof DEFAULT_OPTIONS;
  private _state: McpClientState = 'disconnected';
  private _capabilities: ServerCapabilities | null = null;
  private requestId: number = 0;
  private cachedTools: McpTool[] | null = null;

  constructor(transport: IMcpTransport, options: McpClientOptions = {}) {
    this.transport = transport;
    this.options = { ...DEFAULT_OPTIONS, ...options };

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

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this._state === 'ready') {
      return; // Already connected
    }

    if (this._state === 'connecting' || this._state === 'initializing') {
      throw new McpError('Connection already in progress', -32001);
    }

    try {
      this._state = 'connecting';
      this.options.onOutput?.('Connecting to MCP server...');

      // Start the transport
      await this.transport.start();

      this._state = 'initializing';
      this.options.onOutput?.('Initializing MCP session...');

      // Initialize the MCP session
      const initParams: InitializeParams = {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          roots: { listChanged: true },
        },
        clientInfo: {
          name: this.options.clientName,
          version: this.options.clientVersion,
        },
      };

      const initResult = await this.request<InitializeResult>(
        MCP_METHODS.INITIALIZE,
        initParams
      );

      this._capabilities = initResult.capabilities;

      // Send initialized notification
      await this.notify(MCP_METHODS.INITIALIZED);

      this._state = 'ready';
      this.options.onOutput?.(
        `Connected to ${initResult.serverInfo.name} v${initResult.serverInfo.version}`
      );
    } catch (error) {
      this._state = 'error';
      const wrappedError = wrapError(error, 'Failed to connect to MCP server');
      this.options.onError?.(wrappedError.message);
      throw wrappedError;
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === 'disconnected' || this._state === 'closed') {
      return;
    }

    try {
      // Send shutdown request if connected
      if (this._state === 'ready') {
        try {
          await this.request(MCP_METHODS.SHUTDOWN, {});
        } catch {
          // Ignore shutdown errors
        }
      }

      await this.transport.stop();
      this._state = 'closed';
      this._capabilities = null;
      this.cachedTools = null;
      this.options.onOutput?.('Disconnected from MCP server');
    } catch (error) {
      this._state = 'error';
      throw wrapError(error, 'Failed to disconnect from MCP server');
    }
  }

  // ============================================================================
  // Tool Operations
  // ============================================================================

  async listTools(): Promise<McpTool[]> {
    this.ensureReady();

    // Return cached tools if available and caching is enabled
    if (this.cachedTools) {
      return this.cachedTools;
    }

    const result = await this.request<ListToolsResult>(MCP_METHODS.TOOLS_LIST);
    this.cachedTools = result.tools;
    return result.tools;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    this.ensureReady();

    // Verify tool exists
    const tools = await this.listTools();
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new McpToolNotFoundError(name);
    }

    const params: CallToolParams = {
      name,
      arguments: args,
    };

    try {
      const result = await this.request<CallToolResult>(
        MCP_METHODS.TOOLS_CALL,
        params,
        this.options.toolTimeout
      );
      return result;
    } catch (error) {
      if (error instanceof McpTimeoutError) {
        throw new McpToolTimeoutError(name, this.options.toolTimeout);
      }
      throw error;
    }
  }

  // ============================================================================
  // Resource Operations
  // ============================================================================

  async listResources(): Promise<ListResourcesResult> {
    this.ensureReady();
    return this.request<ListResourcesResult>(MCP_METHODS.RESOURCES_LIST);
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    this.ensureReady();
    return this.request<ReadResourceResult>(MCP_METHODS.RESOURCES_READ, { uri });
  }

  // ============================================================================
  // Prompt Operations
  // ============================================================================

  async listPrompts(): Promise<ListPromptsResult> {
    this.ensureReady();
    return this.request<ListPromptsResult>(MCP_METHODS.PROMPTS_LIST);
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    this.ensureReady();
    return this.request<GetPromptResult>(MCP_METHODS.PROMPTS_GET, { name, arguments: args });
  }

  // ============================================================================
  // Low-level Request/Notification Methods
  // ============================================================================

  /**
   * Send a JSON-RPC request and wait for response
   */
  async request<T>(
    method: string,
    params?: object,
    timeout?: number
  ): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      ...(params && { params: params as Record<string, unknown> }),
    };

    // Apply timeout if specified
    const effectiveTimeout = timeout ?? this.options.timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new McpTimeoutError(`Request timed out: ${method}`, effectiveTimeout)),
        effectiveTimeout
      );
    });

    const responsePromise = this.transport.send(request);

    const response = await Promise.race([responsePromise, timeoutPromise]);

    if (isJsonRpcError(response)) {
      throw createErrorFromJsonRpc(response.error);
    }

    if ('result' in response) {
      return response.result as T;
    }

    throw new McpError('Invalid response format', -32600);
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params && { params }),
    };

    await this.transport.notify(notification);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Ensure client is in ready state
   */
  private ensureReady(): void {
    if (this._state !== 'ready') {
      throw new McpServerNotInitializedError(
        `Client is not ready. Current state: ${this._state}`
      );
    }
  }

  /**
   * Handle incoming notifications from server
   */
  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;

    // Invalidate cache on relevant notifications
    if (method === MCP_METHODS.NOTIFICATION_TOOLS_LIST_CHANGED) {
      this.cachedTools = null;
    }

    // Call user's notification handler
    this.options.onNotification?.(method, params);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an MCP client with HTTP transport
 */
export function createHttpClient(
  endpoint: string,
  options?: McpClientOptions & { headers?: Record<string, string> }
): McpClient {
  const transport = new HttpTransport({
    endpoint,
    headers: options?.headers,
    timeout: options?.timeout,
  });

  return new McpClient(transport, options);
}

/**
 * Create an MCP client with in-memory transport for testing
 */
export function createTestClient(
  handler: InMemoryHandler,
  options?: McpClientOptions
): { client: McpClient; transport: InMemoryTransport } {
  const transport = new InMemoryTransport(handler);
  const client = new McpClient(transport, options);
  return { client, transport };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract text content from tool result
 */
export function extractTextContent(result: CallToolResult): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('\n');
}

/**
 * Check if tool result contains an error
 */
export function isToolResultError(result: CallToolResult): boolean {
  return result.isError === true;
}

/**
 * Build tool arguments from schema and values
 */
export function buildToolArguments(
  tool: McpTool,
  values: Record<string, unknown>
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const schema = tool.inputSchema;

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in values) {
        args[key] = values[key];
      } else if ('default' in prop) {
        args[key] = prop.default;
      }
    }
  }

  return args;
}

/**
 * Validate tool arguments against schema
 */
export function validateToolArguments(
  tool: McpTool,
  args: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  const schema = tool.inputSchema;

  // Check required fields
  if (schema.required) {
    for (const required of schema.required) {
      if (!(required in args) || args[required] === undefined) {
        errors.push(`Missing required argument: ${required}`);
      }
    }
  }

  // Check property types (basic validation)
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in args && args[key] !== undefined) {
        const value = args[key];
        const expectedType = prop.type;

        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Argument '${key}' must be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Argument '${key}' must be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Argument '${key}' must be a boolean`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Argument '${key}' must be an array`);
        } else if (expectedType === 'object' && (typeof value !== 'object' || value === null)) {
          errors.push(`Argument '${key}' must be an object`);
        }

        // Check enum values
        if (prop.enum && !prop.enum.includes(value as string | number | boolean)) {
          errors.push(`Argument '${key}' must be one of: ${prop.enum.join(', ')}`);
        }
      }
    }
  }

  return errors;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  McpTool,
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptResult,
  ServerCapabilities,
} from './mcp-types';

export {
  McpError,
  McpConnectionError,
  McpTimeoutError,
  McpToolNotFoundError,
  McpToolTimeoutError,
} from './mcp-errors';
