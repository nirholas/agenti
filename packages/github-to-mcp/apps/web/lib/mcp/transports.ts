/**
 * MCP Transport Abstraction - Factory for creating MCP transports
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import type {
  TransportConfig,
  StdioTransportConfig,
  SseTransportConfig,
  StreamableHttpTransportConfig,
} from './types.js';
import {
  McpTransportError,
  McpErrorCode,
  McpError,
  isStdioTransportConfig,
  isSseTransportConfig,
  isStreamableHttpTransportConfig,
} from './types.js';
import type { Logger } from './logger.js';
import { createNoopLogger } from './logger.js';
import type { McpEventEmitter } from './events.js';
import type { RetryConfig } from './retry.js';
import { retry, CircuitBreaker } from './retry.js';

// ============================================================================
// Enhanced Transport Types
// ============================================================================

/**
 * Transport health status
 */
export interface TransportHealthStatus {
  readonly healthy: boolean;
  readonly lastCheck: Date;
  readonly consecutiveFailures: number;
  readonly latencyMs: number | null;
  readonly error?: string;
}

/**
 * Transport wrapper with enhanced capabilities
 */
export interface EnhancedTransport {
  readonly transport: Transport;
  readonly config: TransportConfig;
  readonly createdAt: Date;
  readonly healthStatus: TransportHealthStatus;
  
  /** Check if transport is healthy */
  checkHealth(): Promise<TransportHealthStatus>;
  
  /** Close and cleanup the transport */
  close(): Promise<void>;
}

/**
 * Configuration for transport with reconnection support
 */
export interface ReconnectingTransportConfig {
  readonly transportConfig: TransportConfig;
  readonly retryConfig?: Partial<RetryConfig>;
  readonly healthCheckIntervalMs?: number;
  readonly autoReconnect?: boolean;
  readonly logger?: Logger;
  readonly events?: McpEventEmitter;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  readonly maxConnections: number;
  readonly minConnections: number;
  readonly acquireTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly healthCheckIntervalMs: number;
  readonly logger?: Logger;
  readonly events?: McpEventEmitter;
}

/**
 * Connection pool entry
 */
interface PoolEntry {
  transport: EnhancedTransport;
  inUse: boolean;
  lastUsed: Date;
  acquiredAt: Date | null;
}

// ============================================================================
// Transport Factory
// ============================================================================

/**
 * Creates an MCP transport based on the provided configuration.
 *
 * @param config - Transport configuration specifying the type and parameters
 * @returns A Transport instance ready to be connected
 * @throws {McpTransportError} If the transport type is unsupported or configuration is invalid
 *
 * @example
 * ```typescript
 * // Create stdio transport
 * const stdioTransport = createTransport({
 *   type: 'stdio',
 *   command: 'npx',
 *   args: ['tsx', 'server.ts'],
 * });
 *
 * // Create streamable HTTP transport
 * const httpTransport = createTransport({
 *   type: 'streamable-http',
 *   url: 'http://localhost:3000/mcp',
 * });
 * ```
 */
export function createTransport(config: TransportConfig): Transport {
  if (isStdioTransportConfig(config)) {
    return createStdioTransport(config);
  }

  if (isSseTransportConfig(config)) {
    return createSseTransport(config);
  }

  if (isStreamableHttpTransportConfig(config)) {
    return createStreamableHttpTransport(config);
  }

  // TypeScript should prevent this, but handle it for runtime safety
  throw new McpError(
    McpErrorCode.UnsupportedTransport,
    `Unsupported transport type: ${(config as TransportConfig).type}`
  );
}

// ============================================================================
// Stdio Transport
// ============================================================================

/**
 * Creates a stdio transport for spawning local MCP server processes.
 *
 * @param config - Stdio transport configuration
 * @returns StdioClientTransport instance
 * @throws {McpTransportError} If the configuration is invalid
 */
function createStdioTransport(config: StdioTransportConfig): StdioClientTransport {
  if (!config.command || typeof config.command !== 'string') {
    throw new McpTransportError('Stdio transport requires a valid command string');
  }

  try {
    return new StdioClientTransport({
      command: config.command,
      args: config.args ? [...config.args] : undefined,
      env: config.env ? { ...config.env } : undefined,
      cwd: config.cwd,
    });
  } catch (error) {
    throw new McpTransportError(
      `Failed to create stdio transport: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

// ============================================================================
// SSE Transport
// ============================================================================

/**
 * Creates an SSE transport for connecting to legacy HTTP+SSE MCP servers.
 *
 * @param config - SSE transport configuration
 * @returns SSEClientTransport instance
 * @throws {McpTransportError} If the configuration is invalid
 * @deprecated SSE transport is deprecated in favor of streamable-http
 */
function createSseTransport(config: SseTransportConfig): SSEClientTransport {
  if (!config.url || typeof config.url !== 'string') {
    throw new McpTransportError('SSE transport requires a valid URL string');
  }

  let url: URL;
  try {
    url = new URL(config.url);
  } catch (error) {
    throw new McpTransportError(
      `Invalid SSE URL: ${config.url}`,
      error
    );
  }

  // Validate URL protocol
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new McpTransportError(
      `SSE transport requires http or https URL, got: ${url.protocol}`
    );
  }

  try {
    const options = config.headers
      ? {
          requestInit: {
            headers: { ...config.headers },
          },
        }
      : undefined;

    return new SSEClientTransport(url, options);
  } catch (error) {
    throw new McpTransportError(
      `Failed to create SSE transport: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

// ============================================================================
// Streamable HTTP Transport
// ============================================================================

/**
 * Creates a Streamable HTTP transport for connecting to modern MCP servers.
 *
 * @param config - Streamable HTTP transport configuration
 * @returns StreamableHTTPClientTransport instance
 * @throws {McpTransportError} If the configuration is invalid
 */
function createStreamableHttpTransport(
  config: StreamableHttpTransportConfig
): StreamableHTTPClientTransport {
  if (!config.url || typeof config.url !== 'string') {
    throw new McpTransportError('Streamable HTTP transport requires a valid URL string');
  }

  let url: URL;
  try {
    url = new URL(config.url);
  } catch (error) {
    throw new McpTransportError(
      `Invalid Streamable HTTP URL: ${config.url}`,
      error
    );
  }

  // Validate URL protocol
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new McpTransportError(
      `Streamable HTTP transport requires http or https URL, got: ${url.protocol}`
    );
  }

  try {
    const options: {
      requestInit?: RequestInit;
      sessionId?: string;
    } = {};

    if (config.headers) {
      options.requestInit = {
        headers: { ...config.headers },
      };
    }

    if (config.sessionId) {
      options.sessionId = config.sessionId;
    }

    return new StreamableHTTPClientTransport(
      url,
      Object.keys(options).length > 0 ? options : undefined
    );
  } catch (error) {
    throw new McpTransportError(
      `Failed to create Streamable HTTP transport: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

// ============================================================================
// Transport Utilities
// ============================================================================

/**
 * Validates a transport configuration without creating the transport.
 *
 * @param config - Transport configuration to validate
 * @returns True if the configuration is valid
 * @throws {McpTransportError} If the configuration is invalid
 */
export function validateTransportConfig(config: TransportConfig): boolean {
  if (!config || typeof config !== 'object') {
    throw new McpTransportError('Transport configuration must be an object');
  }

  if (!config.type || typeof config.type !== 'string') {
    throw new McpTransportError('Transport configuration must have a type');
  }

  switch (config.type) {
    case 'stdio':
      if (!config.command || typeof config.command !== 'string') {
        throw new McpTransportError('Stdio transport requires a valid command string');
      }
      break;

    case 'sse':
    case 'streamable-http':
      if (!config.url || typeof config.url !== 'string') {
        throw new McpTransportError(`${config.type} transport requires a valid URL string`);
      }
      try {
        const url = new URL(config.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new McpTransportError(
            `${config.type} transport requires http or https URL, got: ${url.protocol}`
          );
        }
      } catch (error) {
        if (error instanceof McpTransportError) {
          throw error;
        }
        throw new McpTransportError(`Invalid URL: ${config.url}`, error);
      }
      break;

    default:
      throw new McpError(
        McpErrorCode.UnsupportedTransport,
        `Unsupported transport type: ${(config as TransportConfig).type}`
      );
  }

  return true;
}

/**
 * Gets the display name for a transport type.
 *
 * @param type - Transport type
 * @returns Human-readable transport name
 */
export function getTransportDisplayName(type: TransportConfig['type']): string {
  switch (type) {
    case 'stdio':
      return 'Standard I/O (Local Process)';
    case 'sse':
      return 'Server-Sent Events (Legacy HTTP)';
    case 'streamable-http':
      return 'Streamable HTTP';
    default:
      return 'Unknown Transport';
  }
}

/**
 * Checks if a transport type is supported in the current environment.
 *
 * @param type - Transport type to check
 * @returns True if the transport type is supported
 */
export function isTransportSupported(type: TransportConfig['type']): boolean {
  switch (type) {
    case 'stdio':
      // Stdio transport requires Node.js process spawning
      return typeof globalThis.process !== 'undefined';

    case 'sse':
    case 'streamable-http':
      // HTTP transports are supported in all environments with fetch
      return typeof globalThis.fetch !== 'undefined';

    default:
      return false;
  }
}

// ============================================================================
// Enhanced Transport Wrapper
// ============================================================================

/**
 * Creates an enhanced transport with health checking capabilities
 */
export function createEnhancedTransport(
  config: TransportConfig,
  logger: Logger = createNoopLogger()
): EnhancedTransport {
  const transport = createTransport(config);
  const createdAt = new Date();
  
  let healthStatus: TransportHealthStatus = {
    healthy: true,
    lastCheck: createdAt,
    consecutiveFailures: 0,
    latencyMs: null,
  };

  const checkHealth = async (): Promise<TransportHealthStatus> => {
    const startTime = performance.now();
    
    try {
      // For HTTP transports, we can do a lightweight check
      if (isSseTransportConfig(config) || isStreamableHttpTransportConfig(config)) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(config.url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          const latencyMs = performance.now() - startTime;
          healthStatus = {
            healthy: response.ok,
            lastCheck: new Date(),
            consecutiveFailures: response.ok ? 0 : healthStatus.consecutiveFailures + 1,
            latencyMs,
            error: response.ok ? undefined : `HTTP ${response.status}`,
          };
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } else {
        // For stdio, we assume healthy if transport exists
        // Actual health would be checked via ping through the client
        healthStatus = {
          healthy: true,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          latencyMs: performance.now() - startTime,
        };
      }
      
      logger.debug('Transport health check passed', { data: { latencyMs: healthStatus.latencyMs } });
    } catch (error) {
      const latencyMs = performance.now() - startTime;
      healthStatus = {
        healthy: false,
        lastCheck: new Date(),
        consecutiveFailures: healthStatus.consecutiveFailures + 1,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      };
      
      logger.warn('Transport health check failed', { 
        data: { 
          errorMessage: healthStatus.error,
          consecutiveFailures: healthStatus.consecutiveFailures,
        },
      });
    }
    
    return healthStatus;
  };

  const close = async (): Promise<void> => {
    try {
      await transport.close?.();
      logger.debug('Transport closed');
    } catch (error) {
      logger.error('Error closing transport', {
        data: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
    }
  };

  return {
    transport,
    config,
    createdAt,
    get healthStatus() {
      return healthStatus;
    },
    checkHealth,
    close,
  };
}

// ============================================================================
// Reconnecting Transport
// ============================================================================

/**
 * Transport wrapper with automatic reconnection support
 */
export class ReconnectingTransport {
  private _transport: EnhancedTransport | null = null;
  private _config: ReconnectingTransportConfig;
  private _logger: Logger;
  private _events?: McpEventEmitter;
  private _circuitBreaker: CircuitBreaker;
  private _healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _closed = false;
  private _reconnecting = false;
  private _connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  constructor(config: ReconnectingTransportConfig) {
    this._config = config;
    this._logger = config.logger ?? createNoopLogger();
    this._events = config.events;
    this._circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 30000,
    });
  }

  /**
   * Get the underlying transport
   */
  get transport(): Transport | null {
    return this._transport?.transport ?? null;
  }

  /**
   * Check if currently connected
   */
  get isConnected(): boolean {
    return this._transport !== null && this._transport.healthStatus.healthy;
  }

  /**
   * Check if closed
   */
  get isClosed(): boolean {
    return this._closed;
  }

  /**
   * Connect the transport with retry support
   */
  async connect(): Promise<Transport> {
    if (this._closed) {
      throw new McpTransportError('Transport is closed');
    }

    const previousState = this._connectionState;
    this._connectionState = 'connecting';
    
    this._events?.emit({
      type: 'connection:stateChange',
      previousState: previousState,
      currentState: 'connecting',
      timestamp: new Date(),
    });

    const retryOptions: Partial<RetryConfig> = {
      maxAttempts: this._config.retryConfig?.maxAttempts ?? 3,
      initialDelayMs: this._config.retryConfig?.initialDelayMs ?? 1000,
      maxDelayMs: this._config.retryConfig?.maxDelayMs ?? 30000,
      backoffMultiplier: this._config.retryConfig?.backoffMultiplier ?? 2,
      jitter: this._config.retryConfig?.jitter ?? true,
    };

    const result = await retry(
      async () => {
        // Use circuit breaker to guard connection attempts
        return await this._circuitBreaker.execute(async () => {
          const enhancedTransport = createEnhancedTransport(
            this._config.transportConfig,
            this._logger
          );
          
          // Verify transport is healthy
          const health = await enhancedTransport.checkHealth();
          if (!health.healthy) {
            throw new McpTransportError(`Transport health check failed: ${health.error}`);
          }
          
          return enhancedTransport;
        });
      },
      retryOptions
    );

    if (!result.success || !result.value) {
      this._connectionState = 'error';
      this._events?.emit({
        type: 'connection:stateChange',
        previousState: 'connecting',
        currentState: 'error',
        timestamp: new Date(),
      });
      throw result.error ?? new McpTransportError('Failed to connect');
    }

    this._transport = result.value;
    this._connectionState = 'connected';
    
    this._events?.emit({
      type: 'connection:stateChange',
      previousState: 'connecting',
      currentState: 'connected',
      timestamp: new Date(),
    });
    
    // Start health check interval
    if (this._config.healthCheckIntervalMs && this._config.healthCheckIntervalMs > 0) {
      this._startHealthCheck();
    }

    return this._transport.transport;
  }

  /**
   * Reconnect the transport
   */
  async reconnect(): Promise<Transport> {
    if (this._closed) {
      throw new McpTransportError('Transport is closed');
    }

    if (this._reconnecting) {
      throw new McpTransportError('Reconnection already in progress');
    }

    this._reconnecting = true;
    const previousState = this._connectionState;
    
    this._events?.emit({
      type: 'connection:reconnecting',
      attempt: 1,
      maxAttempts: this._config.retryConfig?.maxAttempts ?? 3,
      delayMs: this._config.retryConfig?.initialDelayMs ?? 1000,
      timestamp: new Date(),
    });

    try {
      // Close existing transport
      if (this._transport) {
        await this._transport.close();
        this._transport = null;
      }

      // Connect again
      return await this.connect();
    } catch (error) {
      this._connectionState = 'error';
      this._events?.emit({
        type: 'connection:stateChange',
        previousState,
        currentState: 'error',
        timestamp: new Date(),
      });
      throw error;
    } finally {
      this._reconnecting = false;
    }
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this._closed = true;
    this._stopHealthCheck();
    
    const previousState = this._connectionState;
    
    if (this._transport) {
      await this._transport.close();
      this._transport = null;
    }
    
    this._connectionState = 'disconnected';
    this._events?.emit({
      type: 'connection:stateChange',
      previousState,
      currentState: 'disconnected',
      timestamp: new Date(),
    });
    
    this._events?.emit({
      type: 'connection:closed',
      reason: 'manual',
      wasClean: true,
      timestamp: new Date(),
    });
  }

  /**
   * Get current health status
   */
  async checkHealth(): Promise<TransportHealthStatus | null> {
    return this._transport?.checkHealth() ?? null;
  }

  private _startHealthCheck(): void {
    this._stopHealthCheck();
    
    this._healthCheckInterval = setInterval(async () => {
      if (this._closed || !this._transport) return;
      
      const health = await this._transport.checkHealth();
      
      if (!health.healthy && this._config.autoReconnect !== false) {
        this._logger.warn('Health check failed, attempting reconnect', {
          data: { consecutiveFailures: health.consecutiveFailures },
        });
        
        try {
          await this.reconnect();
        } catch (error) {
          this._logger.error('Reconnect failed', {
            data: { errorMessage: error instanceof Error ? error.message : String(error) },
          });
          
          this._events?.emit({
            type: 'connection:error',
            error: error instanceof Error ? error : new Error(String(error)),
            recoverable: true,
            timestamp: new Date(),
          });
        }
      }
    }, this._config.healthCheckIntervalMs);
  }

  private _stopHealthCheck(): void {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
  }
}

// ============================================================================
// Connection Pool
// ============================================================================

/**
 * Connection pool for managing multiple transports
 */
export class TransportPool {
  private _config: ConnectionPoolConfig;
  private _transportConfig: TransportConfig;
  private _pool: PoolEntry[] = [];
  private _waitQueue: Array<{
    resolve: (transport: EnhancedTransport) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }> = [];
  private _logger: Logger;
  private _events?: McpEventEmitter;
  private _healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _closed = false;

  constructor(transportConfig: TransportConfig, config: Partial<ConnectionPoolConfig> = {}) {
    this._transportConfig = transportConfig;
    this._config = {
      maxConnections: config.maxConnections ?? 10,
      minConnections: config.minConnections ?? 1,
      acquireTimeoutMs: config.acquireTimeoutMs ?? 30000,
      idleTimeoutMs: config.idleTimeoutMs ?? 60000,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
      logger: config.logger,
      events: config.events,
    };
    this._logger = this._config.logger ?? createNoopLogger();
    this._events = this._config.events;
  }

  /**
   * Initialize the pool with minimum connections
   */
  async initialize(): Promise<void> {
    if (this._closed) {
      throw new McpTransportError('Pool is closed');
    }

    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < this._config.minConnections; i++) {
      promises.push(this._createConnection());
    }

    await Promise.all(promises);
    this._startHealthCheck();
    
    this._logger.info('Connection pool initialized', {
      data: {
        minConnections: this._config.minConnections,
        maxConnections: this._config.maxConnections,
      },
    });
  }

  /**
   * Get the current pool size
   */
  get size(): number {
    return this._pool.length;
  }

  /**
   * Get the number of available connections
   */
  get available(): number {
    return this._pool.filter(entry => !entry.inUse).length;
  }

  /**
   * Get the number of in-use connections
   */
  get inUse(): number {
    return this._pool.filter(entry => entry.inUse).length;
  }

  /**
   * Acquire a transport from the pool
   */
  async acquire(): Promise<EnhancedTransport> {
    if (this._closed) {
      throw new McpTransportError('Pool is closed');
    }

    // Try to find an available healthy connection
    const available = this._pool.find(entry => !entry.inUse && entry.transport.healthStatus.healthy);
    
    if (available) {
      available.inUse = true;
      available.acquiredAt = new Date();
      this._logger.debug('Acquired connection from pool', { data: { poolSize: this.size } });
      return available.transport;
    }

    // Create a new connection if under max
    if (this._pool.length < this._config.maxConnections) {
      await this._createConnection();
      
      const newEntry = this._pool.find(entry => !entry.inUse);
      if (newEntry) {
        newEntry.inUse = true;
        newEntry.acquiredAt = new Date();
        this._logger.debug('Created new connection', { data: { poolSize: this.size } });
        return newEntry.transport;
      }
    }

    // Wait for a connection to become available
    return new Promise<EnhancedTransport>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this._waitQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this._waitQueue.splice(index, 1);
        }
        reject(new McpTransportError('Acquire timeout exceeded'));
      }, this._config.acquireTimeoutMs);

      this._waitQueue.push({ resolve, reject, timeoutId });
    });
  }

  /**
   * Release a transport back to the pool
   */
  release(transport: EnhancedTransport): void {
    const entry = this._pool.find(e => e.transport === transport);
    
    if (!entry) {
      this._logger.warn('Attempted to release unknown transport');
      return;
    }

    entry.inUse = false;
    entry.lastUsed = new Date();
    entry.acquiredAt = null;
    
    this._logger.debug('Released connection to pool', { data: { poolSize: this.size, available: this.available } });

    // Process wait queue
    if (this._waitQueue.length > 0) {
      const waiter = this._waitQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeoutId);
        entry.inUse = true;
        entry.acquiredAt = new Date();
        waiter.resolve(entry.transport);
      }
    }
  }

  /**
   * Close all connections and shutdown the pool
   */
  async close(): Promise<void> {
    this._closed = true;
    this._stopHealthCheck();

    // Reject all waiters
    for (const waiter of this._waitQueue) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new McpTransportError('Pool is closing'));
    }
    this._waitQueue = [];

    // Close all connections
    const closePromises = this._pool.map(entry => entry.transport.close());
    await Promise.allSettled(closePromises);
    
    this._pool = [];
    this._logger.info('Connection pool closed');
  }

  private async _createConnection(): Promise<void> {
    const transport = createEnhancedTransport(this._transportConfig, this._logger);
    await transport.checkHealth();

    this._pool.push({
      transport,
      inUse: false,
      lastUsed: new Date(),
      acquiredAt: null,
    });
  }

  private _startHealthCheck(): void {
    this._stopHealthCheck();
    
    this._healthCheckInterval = setInterval(async () => {
      if (this._closed) return;

      const now = Date.now();
      const toRemove: PoolEntry[] = [];

      for (const entry of this._pool) {
        // Skip in-use connections
        if (entry.inUse) continue;

        // Check for idle timeout
        const idleTime = now - entry.lastUsed.getTime();
        if (idleTime > this._config.idleTimeoutMs && this._pool.length > this._config.minConnections) {
          toRemove.push(entry);
          continue;
        }

        // Check health
        const health = await entry.transport.checkHealth();
        if (!health.healthy && health.consecutiveFailures >= 3) {
          toRemove.push(entry);
        }
      }

      // Remove unhealthy/idle connections
      for (const entry of toRemove) {
        const index = this._pool.indexOf(entry);
        if (index !== -1) {
          this._pool.splice(index, 1);
          await entry.transport.close();
          this._logger.debug('Removed connection from pool', { data: { reason: 'unhealthy or idle' } });
        }
      }

      // Ensure minimum connections
      while (this._pool.length < this._config.minConnections && !this._closed) {
        try {
          await this._createConnection();
        } catch (error) {
          this._logger.warn('Failed to create connection for pool', {
            data: { errorMessage: error instanceof Error ? error.message : String(error) },
          });
          break;
        }
      }
    }, this._config.healthCheckIntervalMs);
  }

  private _stopHealthCheck(): void {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
  }
}
