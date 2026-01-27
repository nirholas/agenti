/**
 * MCP Client Wrapper - High-level client for MCP protocol operations
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import { createTransport } from './transports.js';
import type {
  TransportConfig,
  McpCapabilities,
  McpTool,
  McpToolCallResult,
  McpResource,
  McpResourceContents,
  McpPrompt,
  McpPromptResult,
  McpClientOptions,
  McpExecutionResult,
  ConnectionState,
} from './types.js';
import {
  McpError,
  McpErrorCode,
  McpConnectionError,
  McpTimeoutError,
  DEFAULT_CLIENT_OPTIONS,
} from './types.js';
import type { Logger } from './logger.js';
import { createNoopLogger } from './logger.js';
import type { McpEventEmitter, McpEvent } from './events.js';
import { createEventEmitter } from './events.js';
import type { RetryConfig } from './retry.js';
import { retry, DEFAULT_RETRY_CONFIG } from './retry.js';
import type { McpClientMetrics } from './metrics.js';
import { createClientMetrics } from './metrics.js';

// ============================================================================
// Enhanced Client Types
// ============================================================================

/**
 * Middleware function type for request interception
 */
export type MiddlewareFunction = (
  request: MiddlewareRequest,
  next: () => Promise<MiddlewareResponse>
) => Promise<MiddlewareResponse>;

/**
 * Middleware request context
 */
export interface MiddlewareRequest {
  readonly method: string;
  readonly params: Record<string, unknown>;
  readonly requestId: string;
  readonly timestamp: Date;
  readonly signal?: AbortSignal;
}

/**
 * Middleware response
 */
export interface MiddlewareResponse {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: Error;
  readonly durationMs: number;
}

/**
 * Batch operation item
 */
export interface BatchToolCall {
  readonly name: string;
  readonly params?: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

/**
 * Batch result
 */
export interface BatchResult<T> {
  readonly results: Array<McpExecutionResult<T>>;
  readonly totalDurationMs: number;
  readonly successCount: number;
  readonly failureCount: number;
}

/**
 * Enhanced client options
 */
export interface EnhancedClientOptions extends McpClientOptions {
  readonly logger?: Logger;
  readonly events?: McpEventEmitter;
  readonly retryConfig?: Partial<RetryConfig>;
  readonly enableMetrics?: boolean;
  readonly middleware?: MiddlewareFunction[];
}

// ============================================================================
// McpClient Class
// ============================================================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * High-level MCP client wrapper that provides a clean API for interacting
 * with MCP servers using the official SDK.
 *
 * @example
 * ```typescript
 * const client = new McpClient({
 *   name: 'my-app',
 *   version: '1.0.0',
 *   logger: createConsoleLogger(),
 *   enableMetrics: true,
 * });
 *
 * // Subscribe to events
 * client.events.on('tool:complete', (event) => {
 *   console.log(`Tool ${event.toolName} completed in ${event.durationMs}ms`);
 * });
 *
 * await client.connect({
 *   type: 'stdio',
 *   command: 'npx',
 *   args: ['tsx', 'server.ts'],
 * });
 *
 * // Use with abort signal for cancellation
 * const controller = new AbortController();
 * const result = await client.callTool('my-tool', { param: 'value' }, { signal: controller.signal });
 *
 * // Batch operations
 * const batch = await client.callToolsBatch([
 *   { name: 'tool1', params: { a: 1 } },
 *   { name: 'tool2', params: { b: 2 } },
 * ]);
 *
 * await client.disconnect();
 * ```
 */
export class McpClient {
  private readonly _options: Required<McpClientOptions>;
  private readonly _logger: Logger;
  private readonly _events: McpEventEmitter;
  private readonly _metrics: McpClientMetrics | null;
  private readonly _retryConfig: RetryConfig;
  private readonly _middleware: MiddlewareFunction[];
  
  private _client: Client | null = null;
  private _transport: Transport | null = null;
  private _state: ConnectionState = 'disconnected';
  private _capabilities: McpCapabilities | undefined;
  private _serverInfo: { name: string; version: string } | undefined;
  private _activeRequests: Map<string, AbortController> = new Map();
  private _cachedTools: readonly McpTool[] | null = null;
  private _cachedResources: readonly McpResource[] | null = null;
  private _cachedPrompts: readonly McpPrompt[] | null = null;

  /**
   * Creates a new McpClient instance.
   *
   * @param options - Client configuration options
   */
  constructor(options: EnhancedClientOptions) {
    this._options = {
      ...DEFAULT_CLIENT_OPTIONS,
      ...options,
    };
    
    this._logger = options.logger ?? createNoopLogger();
    this._events = options.events ?? createEventEmitter();
    this._metrics = options.enableMetrics ? createClientMetrics() : null;
    this._retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    this._middleware = options.middleware ?? [];
  }

  // ============================================================================
  // Public Properties
  // ============================================================================

  /**
   * Current connection state of the client.
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Whether the client is currently connected.
   */
  get isConnected(): boolean {
    return this._state === 'connected';
  }

  /**
   * Server capabilities discovered during initialization.
   * Only available after successful connection.
   */
  get capabilities(): McpCapabilities | undefined {
    return this._capabilities;
  }

  /**
   * Server information from initialization.
   * Only available after successful connection.
   */
  get serverInfo(): Readonly<{ name: string; version: string }> | undefined {
    return this._serverInfo;
  }

  /**
   * Event emitter for subscribing to client events.
   */
  get events(): McpEventEmitter {
    return this._events;
  }

  /**
   * Client metrics (if enabled).
   */
  get metrics(): McpClientMetrics | null {
    return this._metrics;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connects to an MCP server using the specified transport configuration.
   *
   * @param config - Transport configuration
   * @param signal - Optional abort signal for cancellation
   * @throws {McpConnectionError} If connection fails
   * @throws {McpTimeoutError} If connection times out
   */
  async connect(config: TransportConfig, signal?: AbortSignal): Promise<void> {
    if (this._state === 'connected') {
      throw new McpConnectionError(
        McpErrorCode.AlreadyConnected,
        'Client is already connected. Call disconnect() first.'
      );
    }

    if (this._state === 'connecting') {
      throw new McpConnectionError(
        McpErrorCode.AlreadyConnected,
        'Connection already in progress.'
      );
    }

    const previousState = this._state;
    this._state = 'connecting';
    
    this._emitStateChange(previousState, 'connecting');
    this._metrics?.connectionAttempts.increment();
    
    const timer = this._metrics?.connectionDuration.start();
    this._logger.info('Connecting to MCP server...');

    try {
      // Check for cancellation
      if (signal?.aborted) {
        throw new DOMException('Connection aborted', 'AbortError');
      }

      // Create transport
      this._transport = createTransport(config);

      // Create client
      this._client = new Client(
        {
          name: this._options.name,
          version: this._options.version,
        },
        {
          capabilities: {
            // Request sampling capability for completions
            sampling: {},
          },
        }
      );

      // Set up transport event handlers
      this._setupTransportHandlers();

      // Connect with timeout
      await this._connectWithTimeout(signal);

      // Extract capabilities and server info
      this._extractServerInfo();

      this._state = 'connected';
      this._metrics?.connectionSuccesses.increment();
      this._metrics?.activeConnections.increment();
      timer?.end();
      
      this._emitStateChange('connecting', 'connected');
      this._events.emit({
        type: 'connection:established',
        serverName: this._serverInfo?.name ?? 'unknown',
        serverVersion: this._serverInfo?.version ?? 'unknown',
        timestamp: new Date(),
      });
      
      this._logger.info('Connected successfully', {
        data: {
          serverName: this._serverInfo?.name,
          serverVersion: this._serverInfo?.version,
        },
      });
    } catch (error) {
      this._state = 'error';
      this._metrics?.connectionFailures.increment();
      timer?.cancel();
      
      this._emitStateChange('connecting', 'error');
      await this._cleanup();

      if (error instanceof McpError) {
        throw error;
      }

      throw new McpConnectionError(
        McpErrorCode.ConnectionFailed,
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Disconnects from the MCP server and cleans up resources.
   */
  async disconnect(): Promise<void> {
    if (this._state === 'disconnected') {
      return;
    }

    const previousState = this._state;
    this._logger.info('Disconnecting from MCP server...');

    // Cancel all active requests
    this._cancelAllRequests();
    
    // Clear caches
    this._cachedTools = null;
    this._cachedResources = null;
    this._cachedPrompts = null;

    try {
      await this._cleanup();
    } finally {
      this._state = 'disconnected';
      this._capabilities = undefined;
      this._serverInfo = undefined;
      this._metrics?.activeConnections.decrement();
      
      this._emitStateChange(previousState, 'disconnected');
      this._events.emit({
        type: 'connection:closed',
        reason: 'manual',
        wasClean: true,
        timestamp: new Date(),
      });
      
      this._logger.info('Disconnected');
    }
  }

  /**
   * Cancel all active requests.
   */
  cancelAllRequests(): void {
    this._cancelAllRequests();
  }

  // ============================================================================
  // Tool Operations
  // ============================================================================

  /**
   * Lists all tools available on the MCP server.
   *
   * @param options - Request options
   * @returns Array of tool definitions
   * @throws {McpConnectionError} If not connected
   * @throws {McpTimeoutError} If request times out
   */
  async listTools(options?: { signal?: AbortSignal; useCache?: boolean }): Promise<readonly McpTool[]> {
    this._ensureConnected();

    // Return cached if available and requested
    if (options?.useCache && this._cachedTools) {
      return this._cachedTools;
    }

    const requestId = generateRequestId();
    const startTime = Date.now();
    
    this._logger.debug('Listing tools...', { requestId });
    this._emitRequestStart(requestId, 'listTools');

    try {
      const result = await this._executeWithMiddleware(
        {
          method: 'listTools',
          params: {},
          requestId,
          timestamp: new Date(),
          signal: options?.signal,
        },
        async () => {
          const response = await this._executeWithTimeout(
            async () => this._client!.listTools(),
            'listTools',
            options?.signal
          );
          return { success: true, data: response, durationMs: Date.now() - startTime };
        }
      );

      if (!result.success || !result.data) {
        throw result.error ?? new McpError(McpErrorCode.InternalError, 'Failed to list tools');
      }

      const responseData = result.data as { tools?: Array<{ name: string; description?: string; inputSchema: unknown }> };
      const tools: McpTool[] = (responseData.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as McpTool['inputSchema'],
      }));

      // Cache results
      this._cachedTools = tools;

      const durationMs = Date.now() - startTime;
      this._emitRequestComplete(requestId, 'listTools', durationMs);
      this._events.emit({
        type: 'tools:changed',
        tools,
        timestamp: new Date(),
      });
      
      this._logger.debug(`Found ${tools.length} tools`, { data: { count: tools.length, durationMs } });
      return tools;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this._emitRequestError(requestId, 'listTools', error, durationMs);
      throw this._wrapError(error, 'Failed to list tools');
    }
  }

  /**
   * Calls a tool on the MCP server.
   *
   * @param name - Name of the tool to call
   * @param params - Parameters to pass to the tool
   * @param options - Request options
   * @returns Tool execution result
   */
  async callTool(
    name: string,
    params: Record<string, unknown> = {},
    options?: { signal?: AbortSignal; retryEnabled?: boolean }
  ): Promise<McpExecutionResult<McpToolCallResult>> {
    this._ensureConnected();

    const requestId = generateRequestId();
    const startTime = Date.now();
    
    this._logger.debug(`Calling tool: ${name}`, { requestId, data: { toolName: name } });
    this._metrics?.toolCalls.increment();
    
    this._events.emit({
      type: 'tool:start',
      toolName: name,
      requestId,
      params,
      timestamp: new Date(),
    });

    const timer = this._metrics?.toolCallDuration.start();

    try {
      const executeToolCall = async (): Promise<McpExecutionResult<McpToolCallResult>> => {
        const result = await this._executeWithMiddleware(
          {
            method: 'callTool',
            params: { name, arguments: params },
            requestId,
            timestamp: new Date(),
            signal: options?.signal,
          },
          async () => {
            const response = await this._executeWithTimeout(
              async () => this._client!.callTool({ name, arguments: params }),
              'callTool',
              options?.signal
            );
            return { success: true, data: response, durationMs: Date.now() - startTime };
          }
        );

        if (!result.success || !result.data) {
          throw result.error ?? new McpError(McpErrorCode.InternalError, `Tool '${name}' failed`);
        }

        const responseData = result.data as { content: McpToolCallResult['content']; isError?: boolean };
        return {
          success: true,
          data: {
            content: responseData.content,
            isError: responseData.isError === true,
          },
          executionTimeMs: Date.now() - startTime,
        };
      };

      let finalResult: McpExecutionResult<McpToolCallResult>;

      if (options?.retryEnabled !== false) {
        const retryResult = await retry(executeToolCall, this._retryConfig);
        if (!retryResult.success) {
          throw retryResult.error;
        }
        finalResult = retryResult.value!;
      } else {
        finalResult = await executeToolCall();
      }

      const durationMs = Date.now() - startTime;
      timer?.end();
      
      if (finalResult.success) {
        const resultData = finalResult.data;
        this._events.emit({
          type: 'tool:complete',
          toolName: name,
          requestId,
          result: resultData,
          durationMs,
          timestamp: new Date(),
        });
      }
      
      this._logger.debug(`Tool '${name}' completed`, { data: { durationMs } });
      return finalResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      timer?.cancel();
      this._metrics?.toolCallErrors.increment();
      
      const wrappedError = this._wrapError(error, `Tool '${name}' failed`);
      
      this._events.emit({
        type: 'tool:error',
        toolName: name,
        requestId,
        error: wrappedError,
        durationMs,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: wrappedError,
        executionTimeMs: durationMs,
      };
    }
  }

  /**
   * Call multiple tools in batch.
   *
   * @param calls - Array of tool calls to execute
   * @param options - Batch options
   * @returns Batch result with all results
   */
  async callToolsBatch(
    calls: BatchToolCall[],
    options?: { concurrency?: number; stopOnError?: boolean }
  ): Promise<BatchResult<McpToolCallResult>> {
    const concurrency = options?.concurrency ?? 5;
    const stopOnError = options?.stopOnError ?? false;
    const startTime = Date.now();
    
    const results: Array<McpExecutionResult<McpToolCallResult>> = [];
    let successCount = 0;
    let failureCount = 0;

    // Process in batches based on concurrency
    for (let i = 0; i < calls.length; i += concurrency) {
      const batch = calls.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (call) => {
        try {
          const result = await this.callTool(call.name, call.params ?? {}, { signal: call.signal });
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
          return result;
        } catch (error) {
          failureCount++;
          return {
            success: false,
            error: error instanceof McpError ? error : new McpError(McpErrorCode.InternalError, String(error)),
            executionTimeMs: 0,
          } as McpExecutionResult<McpToolCallResult>;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Stop on error if requested
      if (stopOnError && failureCount > 0) {
        break;
      }
    }

    return {
      results,
      totalDurationMs: Date.now() - startTime,
      successCount,
      failureCount,
    };
  }

  // ============================================================================
  // Resource Operations
  // ============================================================================

  /**
   * Lists all resources available on the MCP server.
   *
   * @returns Array of resource definitions
   * @throws {McpConnectionError} If not connected
   * @throws {McpTimeoutError} If request times out
   */
  async listResources(): Promise<readonly McpResource[]> {
    this._ensureConnected();

    const startTime = Date.now();
    this._log('Listing resources...');

    try {
      const result = await this._executeWithTimeout(
        async () => this._client!.listResources(),
        'listResources'
      );

      const resources: McpResource[] = (result.resources ?? []).map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));

      this._log(`Found ${resources.length} resources in ${Date.now() - startTime}ms`);
      return resources;
    } catch (error) {
      throw this._wrapError(error, 'Failed to list resources');
    }
  }

  /**
   * Reads the contents of a resource from the MCP server.
   *
   * @param uri - URI of the resource to read
   * @returns Resource contents
   * @throws {McpConnectionError} If not connected
   * @throws {McpError} If resource reading fails
   * @throws {McpTimeoutError} If request times out
   */
  async readResource(uri: string): Promise<McpExecutionResult<McpResourceContents[]>> {
    this._ensureConnected();

    const startTime = Date.now();
    this._log(`Reading resource: ${uri}`);

    try {
      const result = await this._executeWithTimeout(
        async () => this._client!.readResource({ uri }),
        'readResource'
      );

      const executionTimeMs = Date.now() - startTime;
      this._log(`Resource '${uri}' read in ${executionTimeMs}ms`);

      const contents: McpResourceContents[] = (result.contents ?? []).map((content) => ({
        uri: content.uri,
        mimeType: content.mimeType,
        text: 'text' in content ? content.text : undefined,
        blob: 'blob' in content ? content.blob : undefined,
      }));

      return {
        success: true,
        data: contents,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      return {
        success: false,
        error: this._wrapError(error, `Failed to read resource '${uri}'`),
        executionTimeMs,
      };
    }
  }

  // ============================================================================
  // Prompt Operations
  // ============================================================================

  /**
   * Lists all prompts available on the MCP server.
   *
   * @returns Array of prompt definitions
   * @throws {McpConnectionError} If not connected
   * @throws {McpTimeoutError} If request times out
   */
  async listPrompts(): Promise<readonly McpPrompt[]> {
    this._ensureConnected();

    const startTime = Date.now();
    this._log('Listing prompts...');

    try {
      const result = await this._executeWithTimeout(
        async () => this._client!.listPrompts(),
        'listPrompts'
      );

      const prompts: McpPrompt[] = (result.prompts ?? []).map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
          required: arg.required,
        })),
      }));

      this._log(`Found ${prompts.length} prompts in ${Date.now() - startTime}ms`);
      return prompts;
    } catch (error) {
      throw this._wrapError(error, 'Failed to list prompts');
    }
  }

  /**
   * Gets a prompt from the MCP server with the given arguments.
   *
   * @param name - Name of the prompt to get
   * @param args - Arguments to pass to the prompt
   * @returns Prompt result with messages
   * @throws {McpConnectionError} If not connected
   * @throws {McpError} If prompt retrieval fails
   * @throws {McpTimeoutError} If request times out
   */
  async getPrompt(
    name: string,
    args: Record<string, string> = {}
  ): Promise<McpExecutionResult<McpPromptResult>> {
    this._ensureConnected();

    const startTime = Date.now();
    this._log(`Getting prompt: ${name}`);

    try {
      const result = await this._executeWithTimeout(
        async () =>
          this._client!.getPrompt({
            name,
            arguments: args,
          }),
        'getPrompt'
      );

      const executionTimeMs = Date.now() - startTime;
      this._log(`Prompt '${name}' retrieved in ${executionTimeMs}ms`);

      return {
        success: true,
        data: {
          description: result.description,
          messages: result.messages as McpPromptResult['messages'],
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      return {
        success: false,
        error: this._wrapError(error, `Failed to get prompt '${name}'`),
        executionTimeMs,
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Sets up event handlers for the transport.
   */
  private _setupTransportHandlers(): void {
    if (!this._transport) return;

    this._transport.onclose = () => {
      this._log('Transport closed');
      if (this._state === 'connected') {
        this._state = 'disconnected';
      }
    };

    this._transport.onerror = (error: Error) => {
      this._log(`Transport error: ${error.message}`);
      this._state = 'error';
    };
  }

  /**
   * Connects to the server with a timeout.
   */
  private async _connectWithTimeout(signal?: AbortSignal): Promise<void> {
    if (!this._client || !this._transport) {
      throw new McpConnectionError(
        McpErrorCode.ConnectionFailed,
        'Client or transport not initialized'
      );
    }

    const timeoutMs = this._options.connectionTimeoutMs;

    const connectPromise = this._client.connect(this._transport);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new McpTimeoutError('connect', timeoutMs)
        );
      }, timeoutMs);
    });

    // Handle abort signal
    if (signal) {
      const abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Connection aborted', 'AbortError'));
        }, { once: true });
      });
      await Promise.race([connectPromise, timeoutPromise, abortPromise]);
    } else {
      await Promise.race([connectPromise, timeoutPromise]);
    }
  }

  /**
   * Executes an operation with a timeout.
   */
  private async _executeWithTimeout<T>(
    operation: () => Promise<T>,
    operationName: string,
    signal?: AbortSignal
  ): Promise<T> {
    const requestId = generateRequestId();
    const requestController = new AbortController();
    this._activeRequests.set(requestId, requestController);

    const timeoutMs = this._options.requestTimeoutMs;
    this._metrics?.requestsTotal.increment();
    this._metrics?.requestsInFlight.increment();

    try {
      // Check for external abort signal
      if (signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }

      const operationPromise = operation();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          this._metrics?.requestTimeouts.increment();
          reject(new McpTimeoutError(operationName, timeoutMs));
        }, timeoutMs);
      });

      // Handle abort signal
      const promises: Promise<T | never>[] = [operationPromise, timeoutPromise];
      
      if (signal) {
        const abortPromise = new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            this._metrics?.requestsCancelled.increment();
            reject(new DOMException('Operation aborted', 'AbortError'));
          }, { once: true });
        });
        promises.push(abortPromise);
      }

      // Also handle internal abort
      const internalAbortPromise = new Promise<never>((_, reject) => {
        requestController.signal.addEventListener('abort', () => {
          this._metrics?.requestsCancelled.increment();
          reject(new DOMException('Operation aborted', 'AbortError'));
        }, { once: true });
      });
      promises.push(internalAbortPromise);

      const result = await Promise.race(promises);
      this._metrics?.requestsSuccess.increment();
      return result;
    } catch (error) {
      this._metrics?.requestsFailure.increment();
      throw error;
    } finally {
      this._activeRequests.delete(requestId);
      this._metrics?.requestsInFlight.decrement();
    }
  }

  /**
   * Execute operation with middleware chain.
   */
  private async _executeWithMiddleware(
    request: MiddlewareRequest,
    operation: () => Promise<MiddlewareResponse>
  ): Promise<MiddlewareResponse> {
    if (this._middleware.length === 0) {
      return operation();
    }

    // Build middleware chain
    let index = 0;
    const next = async (): Promise<MiddlewareResponse> => {
      if (index < this._middleware.length) {
        const middleware = this._middleware[index++];
        return middleware(request, next);
      }
      return operation();
    };

    return next();
  }

  /**
   * Emit connection state change event.
   */
  private _emitStateChange(
    previousState: ConnectionState,
    currentState: ConnectionState
  ): void {
    this._events.emit({
      type: 'connection:stateChange',
      previousState,
      currentState,
      timestamp: new Date(),
    });
  }

  /**
   * Emit request start event.
   */
  private _emitRequestStart(requestId: string, method: string): void {
    this._events.emit({
      type: 'request:start',
      requestId,
      method,
      timestamp: new Date(),
    });
  }

  /**
   * Emit request complete event.
   */
  private _emitRequestComplete(requestId: string, method: string, durationMs: number): void {
    this._events.emit({
      type: 'request:complete',
      requestId,
      method,
      durationMs,
      timestamp: new Date(),
    });
  }

  /**
   * Emit request error event.
   */
  private _emitRequestError(
    requestId: string,
    method: string,
    error: unknown,
    durationMs: number
  ): void {
    this._events.emit({
      type: 'request:error',
      requestId,
      method,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs,
      timestamp: new Date(),
    });
  }

  /**
   * Cancel all active requests.
   */
  private _cancelAllRequests(): void {
    for (const [requestId, controller] of this._activeRequests) {
      controller.abort();
      this._logger.debug('Cancelled request', { data: { requestId } });
    }
    this._activeRequests.clear();
  }

  /**
   * Extracts server info and capabilities from the connected client.
   */
  private _extractServerInfo(): void {
    if (!this._client) return;

    // Get server info from client's internal state
    // The SDK stores this after initialization
    const serverCapabilities = this._client.getServerCapabilities?.();
    const serverVersion = this._client.getServerVersion?.();

    if (serverCapabilities) {
      this._capabilities = {
        tools: serverCapabilities.tools ? { listChanged: serverCapabilities.tools.listChanged } : undefined,
        resources: serverCapabilities.resources
          ? {
              subscribe: serverCapabilities.resources.subscribe,
              listChanged: serverCapabilities.resources.listChanged,
            }
          : undefined,
        prompts: serverCapabilities.prompts ? { listChanged: serverCapabilities.prompts.listChanged } : undefined,
        logging: serverCapabilities.logging as Record<string, unknown> | undefined,
        experimental: serverCapabilities.experimental as Record<string, unknown> | undefined,
      };
    }

    if (serverVersion) {
      this._serverInfo = {
        name: serverVersion.name,
        version: serverVersion.version,
      };
    }
  }

  /**
   * Ensures the client is connected.
   */
  private _ensureConnected(): void {
    if (this._state !== 'connected' || !this._client) {
      throw new McpConnectionError(
        McpErrorCode.NotConnected,
        'Client is not connected. Call connect() first.'
      );
    }
  }

  /**
   * Cleans up client and transport resources.
   */
  private async _cleanup(): Promise<void> {
    try {
      if (this._client) {
        await this._client.close?.();
      }
    } catch (error) {
      this._log(`Error closing client: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      if (this._transport) {
        await this._transport.close?.();
      }
    } catch (error) {
      this._log(`Error closing transport: ${error instanceof Error ? error.message : String(error)}`);
    }

    this._client = null;
    this._transport = null;
  }

  /**
   * Wraps an error in an McpError if needed.
   */
  private _wrapError(error: unknown, context: string): McpError {
    if (error instanceof McpError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for common error types
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        return new McpTimeoutError(context, this._options.requestTimeoutMs, error);
      }

      if (error.message.includes('not found')) {
        return new McpError(McpErrorCode.MethodNotFound, `${context}: ${error.message}`, error);
      }

      return new McpError(McpErrorCode.InternalError, `${context}: ${error.message}`, error);
    }

    return new McpError(McpErrorCode.Unknown, `${context}: ${String(error)}`, error);
  }

  /**
   * Logs a message if debug mode is enabled.
   */
  private _log(message: string): void {
    if (this._options.debug) {
      console.log(`[McpClient] ${message}`);
    }
  }
}
