/**
 * MCP Session Manager - Manages multiple concurrent MCP sessions
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { randomUUID } from 'crypto';

import { McpClient } from './client.js';
import type { EnhancedClientOptions } from './client.js';
import { createTransport } from './transports.js';
import type {
  TransportConfig,
  McpSession,
  SessionManagerOptions,
  McpClientOptions,
  ConnectionState,
} from './types.js';
import {
  McpSessionError,
  McpErrorCode,
  DEFAULT_SESSION_MANAGER_OPTIONS,
} from './types.js';
import type { Logger } from './logger.js';
import { createNoopLogger } from './logger.js';
import type { McpEventEmitter, McpEvent } from './events.js';
import { createEventEmitter } from './events.js';
import type { SessionManagerMetrics } from './metrics.js';
import { createSessionManagerMetrics } from './metrics.js';

// ============================================================================
// Enhanced Session Manager Types
// ============================================================================

/**
 * Session health status
 */
export interface SessionHealthStatus {
  readonly sessionId: string;
  readonly state: ConnectionState;
  readonly healthy: boolean;
  readonly lastUsedAt: Date;
  readonly createdAt: Date;
  readonly ageMs: number;
  readonly idleMs: number;
}

/**
 * Enhanced session manager options
 */
export interface EnhancedSessionManagerOptions extends SessionManagerOptions {
  readonly logger?: Logger;
  readonly events?: McpEventEmitter;
  readonly enableMetrics?: boolean;
  readonly healthCheckIntervalMs?: number;
  readonly clientOptions?: Partial<EnhancedClientOptions>;
}

// ============================================================================
// Session Manager Class
// ============================================================================

/**
 * Manages multiple concurrent MCP client sessions with automatic cleanup.
 *
 * Features:
 * - Session creation with configurable transports
 * - Automatic session expiration (default: 5 minutes)
 * - Maximum session limit (default: 100)
 * - Session retrieval and cleanup
 * - Event emission for session lifecycle
 * - Metrics tracking (optional)
 * - Health monitoring
 *
 * @example
 * ```typescript
 * const manager = SessionManager.getInstance({
 *   logger: createConsoleLogger(),
 *   enableMetrics: true,
 * });
 *
 * // Subscribe to session events
 * manager.events.on('session:created', (event) => {
 *   console.log(`Session created: ${event.sessionId}`);
 * });
 *
 * const session = await manager.createSession({
 *   type: 'stdio',
 *   command: 'npx',
 *   args: ['tsx', 'server.ts'],
 * });
 *
 * // Use the session
 * const client = manager.getClient(session.id);
 * const tools = await client?.listTools();
 *
 * // Check health
 * const health = manager.getSessionHealth(session.id);
 * console.log('Session healthy:', health?.healthy);
 *
 * // Sessions are automatically cleaned up after timeout
 * // Or manually cleanup:
 * await manager.destroySession(session.id);
 * ```
 */
export class SessionManager {
  private static _instance: SessionManager | null = null;

  private readonly _options: Required<SessionManagerOptions>;
  private readonly _logger: Logger;
  private readonly _events: McpEventEmitter;
  private readonly _metrics: SessionManagerMetrics | null;
  private readonly _sessions: Map<string, SessionContext> = new Map();
  private readonly _clientOptions: Partial<EnhancedClientOptions>;
  private _healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _isShuttingDown = false;

  /**
   * Creates a new SessionManager instance.
   * Use getInstance() to get the singleton instance.
   *
   * @param options - Session manager configuration options
   */
  private constructor(options: EnhancedSessionManagerOptions = {}) {
    this._options = {
      ...DEFAULT_SESSION_MANAGER_OPTIONS,
      ...options,
    };

    this._logger = options.logger ?? createNoopLogger();
    this._events = options.events ?? createEventEmitter();
    this._metrics = options.enableMetrics ? createSessionManagerMetrics() : null;
    this._clientOptions = options.clientOptions ?? {};

    // Start health check if configured
    if (options.healthCheckIntervalMs && options.healthCheckIntervalMs > 0) {
      this._startHealthCheck(options.healthCheckIntervalMs);
    }

    this._logger.info('SessionManager initialized', {
      data: {
        maxSessions: this._options.maxSessions,
        sessionTimeoutMs: this._options.sessionTimeoutMs,
      },
    });
  }

  // ============================================================================
  // Singleton Access
  // ============================================================================

  /**
   * Gets the singleton SessionManager instance.
   *
   * @param options - Optional configuration (only used on first call)
   * @returns The singleton SessionManager instance
   */
  static getInstance(options?: EnhancedSessionManagerOptions): SessionManager {
    if (!SessionManager._instance) {
      SessionManager._instance = new SessionManager(options);
    }
    return SessionManager._instance;
  }

  /**
   * Resets the singleton instance (useful for testing).
   * WARNING: This will destroy all active sessions.
   */
  static async resetInstance(): Promise<void> {
    if (SessionManager._instance) {
      await SessionManager._instance.shutdown();
      SessionManager._instance = null;
    }
  }

  // ============================================================================
  // Public Properties
  // ============================================================================

  /**
   * Number of active sessions.
   */
  get sessionCount(): number {
    return this._sessions.size;
  }

  /**
   * Maximum allowed sessions.
   */
  get maxSessions(): number {
    return this._options.maxSessions;
  }

  /**
   * Session timeout in milliseconds.
   */
  get sessionTimeoutMs(): number {
    return this._options.sessionTimeoutMs;
  }

  /**
   * Whether the manager is shutting down.
   */
  get isShuttingDown(): boolean {
    return this._isShuttingDown;
  }

  /**
   * Event emitter for subscribing to session events.
   */
  get events(): McpEventEmitter {
    return this._events;
  }

  /**
   * Session metrics (if enabled).
   */
  get metrics(): SessionManagerMetrics | null {
    return this._metrics;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Creates a new MCP session with the specified transport configuration.
   *
   * @param transportConfig - Transport configuration for the session
   * @param clientOptions - Optional client configuration
   * @returns The created session information
   * @throws {McpSessionError} If max sessions reached or creation fails
   */
  async createSession(
    transportConfig: TransportConfig,
    clientOptions?: Partial<EnhancedClientOptions>
  ): Promise<McpSession> {
    if (this._isShuttingDown) {
      throw new McpSessionError(
        McpErrorCode.InternalError,
        'SessionManager is shutting down'
      );
    }

    const timer = this._metrics?.sessionCreationDuration.start();

    // Check session limit
    if (this._sessions.size >= this._options.maxSessions) {
      // Try to clean up expired sessions first
      this._cleanupExpiredSessions();

      if (this._sessions.size >= this._options.maxSessions) {
        // Still at limit - evict the oldest session
        const oldestSession = this._findOldestSession();
        if (oldestSession) {
          this._logger.info('Evicting oldest session', { data: { sessionId: oldestSession.session.id } });
          this._metrics?.sessionsEvicted.increment();
          await this._destroySessionContext(oldestSession, 'evicted');
        }
      }

      // Check again after cleanup
      if (this._sessions.size >= this._options.maxSessions) {
        timer?.cancel();
        throw new McpSessionError(
          McpErrorCode.MaxSessionsReached,
          `Maximum sessions (${this._options.maxSessions}) reached`
        );
      }
    }

    const sessionId = randomUUID();
    const now = new Date();

    this._logger.info('Creating session', { sessionId, data: { transportType: transportConfig.type } });

    try {
      // Create client with merged options
      const mergedClientOptions: EnhancedClientOptions = {
        name: 'mcp-session',
        version: '1.0.0',
        ...this._clientOptions,
        ...clientOptions,
        // Share events and logger with the client
        logger: clientOptions?.logger ?? this._logger,
        events: clientOptions?.events ?? this._events,
      };
      
      const client = new McpClient(mergedClientOptions);

      // Connect the client
      await client.connect(transportConfig);

      // Create session object
      const session: McpSession = {
        id: sessionId,
        transportConfig,
        state: 'connected',
        capabilities: client.capabilities,
        serverInfo: client.serverInfo,
        createdAt: now,
        lastUsedAt: now,
      };

      // Set up cleanup timer
      const cleanupTimer = setTimeout(() => {
        this._onSessionTimeout(sessionId);
      }, this._options.sessionTimeoutMs);

      // Store session context
      const context: SessionContext = {
        session,
        client,
        cleanupTimer,
      };

      this._sessions.set(sessionId, context);

      // Update metrics
      this._metrics?.sessionsCreated.increment();
      this._metrics?.sessionsActive.set(this._sessions.size);
      timer?.end();

      // Emit event
      this._events.emit({
        type: 'session:created',
        sessionId,
        timestamp: now,
      });

      this._logger.info('Session created', { 
        sessionId,
        data: { 
          serverName: client.serverInfo?.name,
          serverVersion: client.serverInfo?.version,
        },
      });
      
      return { ...session };
    } catch (error) {
      timer?.cancel();
      this._logger.error('Failed to create session', { 
        data: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
      throw new McpSessionError(
        McpErrorCode.ConnectionFailed,
        `Failed to create session: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Gets a session by ID.
   *
   * @param sessionId - The session ID to retrieve
   * @returns The session if found, undefined otherwise
   */
  getSession(sessionId: string): McpSession | undefined {
    const context = this._sessions.get(sessionId);
    if (!context) {
      return undefined;
    }

    // Update last used time and reset timer
    this._touchSession(context);

    return { ...context.session };
  }

  /**
   * Gets the MCP client for a session.
   *
   * @param sessionId - The session ID
   * @returns The McpClient if session exists and is connected, undefined otherwise
   */
  getClient(sessionId: string): McpClient | undefined {
    const context = this._sessions.get(sessionId);
    if (!context || !context.client.isConnected) {
      return undefined;
    }

    // Update last used time and reset timer
    this._touchSession(context);

    return context.client;
  }

  /**
   * Gets all active session IDs.
   *
   * @returns Array of active session IDs
   */
  getSessionIds(): readonly string[] {
    return Array.from(this._sessions.keys());
  }

  /**
   * Gets all active sessions.
   *
   * @returns Array of active sessions
   */
  getAllSessions(): readonly McpSession[] {
    return Array.from(this._sessions.values()).map((ctx) => ({ ...ctx.session }));
  }

  /**
   * Destroys a session and releases its resources.
   *
   * @param sessionId - The session ID to destroy
   * @returns True if the session was destroyed, false if not found
   */
  async destroySession(sessionId: string): Promise<boolean> {
    const context = this._sessions.get(sessionId);
    if (!context) {
      return false;
    }

    await this._destroySessionContext(context);
    return true;
  }

  /**
   * Shuts down the session manager and destroys all sessions.
   */
  async shutdown(): Promise<void> {
    if (this._isShuttingDown) {
      return;
    }

    this._isShuttingDown = true;
    this._stopHealthCheck();
    this._logger.info('Shutting down SessionManager...', { data: { sessionCount: this._sessions.size } });

    const destroyPromises = Array.from(this._sessions.values()).map((context) =>
      this._destroySessionContext(context, 'shutdown').catch((error) => {
        this._logger.error('Error destroying session during shutdown', {
          sessionId: context.session.id,
          data: { errorMessage: error instanceof Error ? error.message : String(error) },
        });
      })
    );

    await Promise.all(destroyPromises);

    this._sessions.clear();
    this._isShuttingDown = false;
    this._logger.info('SessionManager shut down');
  }

  // ============================================================================
  // Session Queries
  // ============================================================================

  /**
   * Checks if a session exists.
   *
   * @param sessionId - The session ID to check
   * @returns True if the session exists
   */
  hasSession(sessionId: string): boolean {
    return this._sessions.has(sessionId);
  }

  /**
   * Gets the state of a session.
   *
   * @param sessionId - The session ID
   * @returns The session state, or undefined if not found
   */
  getSessionState(sessionId: string): ConnectionState | undefined {
    const context = this._sessions.get(sessionId);
    return context?.client.state;
  }

  /**
   * Refreshes a session's timeout, keeping it alive.
   *
   * @param sessionId - The session ID to refresh
   * @returns True if the session was refreshed, false if not found
   */
  refreshSession(sessionId: string): boolean {
    const context = this._sessions.get(sessionId);
    if (!context) {
      return false;
    }

    this._touchSession(context);
    return true;
  }

  /**
   * Gets the health status of a session.
   *
   * @param sessionId - The session ID
   * @returns Session health status, or undefined if not found
   */
  getSessionHealth(sessionId: string): SessionHealthStatus | undefined {
    const context = this._sessions.get(sessionId);
    if (!context) {
      return undefined;
    }

    const now = Date.now();
    
    return {
      sessionId,
      state: context.client.state,
      healthy: context.client.isConnected && context.client.state !== 'error',
      lastUsedAt: context.session.lastUsedAt,
      createdAt: context.session.createdAt,
      ageMs: now - context.session.createdAt.getTime(),
      idleMs: now - context.session.lastUsedAt.getTime(),
    };
  }

  /**
   * Gets health status for all sessions.
   *
   * @returns Array of session health statuses
   */
  getAllSessionHealth(): readonly SessionHealthStatus[] {
    return Array.from(this._sessions.keys()).map(
      (sessionId) => this.getSessionHealth(sessionId)!
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Updates a session's last used time and resets its cleanup timer.
   */
  private _touchSession(context: SessionContext): void {
    context.session.lastUsedAt = new Date();

    // Reset cleanup timer
    clearTimeout(context.cleanupTimer);
    context.cleanupTimer = setTimeout(() => {
      this._onSessionTimeout(context.session.id);
    }, this._options.sessionTimeoutMs);
  }

  /**
   * Handles session timeout expiration.
   */
  private _onSessionTimeout(sessionId: string): void {
    const context = this._sessions.get(sessionId);
    if (context) {
      this._logger.info('Session timed out', { sessionId });
      this._metrics?.sessionsTimedOut.increment();
      this._destroySessionContext(context, 'timeout').catch((error) => {
        this._logger.error('Error destroying timed out session', {
          sessionId,
          data: { errorMessage: error instanceof Error ? error.message : String(error) },
        });
      });
    }
  }

  /**
   * Destroys a session context and cleans up resources.
   */
  private async _destroySessionContext(
    context: SessionContext,
    reason: 'timeout' | 'manual' | 'evicted' | 'error' | 'shutdown' = 'manual'
  ): Promise<void> {
    const sessionId = context.session.id;
    const timer = this._metrics?.sessionDuration.start();
    
    this._logger.info('Destroying session', { sessionId, data: { reason } });

    // Clear timeout
    clearTimeout(context.cleanupTimer);

    // Remove from map first to prevent re-entry
    this._sessions.delete(sessionId);

    // Disconnect client
    try {
      await context.client.disconnect();
    } catch (error) {
      this._logger.warn('Error disconnecting client', {
        sessionId,
        data: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
    }

    // Update metrics
    this._metrics?.sessionsDestroyed.increment();
    this._metrics?.sessionsActive.set(this._sessions.size);
    timer?.end();

    // Emit event
    this._events.emit({
      type: 'session:destroyed',
      sessionId,
      reason,
      timestamp: new Date(),
    });

    this._logger.info('Session destroyed', { sessionId });
  }

  /**
   * Finds the oldest session based on last used time.
   */
  private _findOldestSession(): SessionContext | undefined {
    let oldest: SessionContext | undefined;

    for (const context of this._sessions.values()) {
      if (!oldest || context.session.lastUsedAt < oldest.session.lastUsedAt) {
        oldest = context;
      }
    }

    return oldest;
  }

  /**
   * Cleans up expired sessions.
   */
  private _cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: SessionContext[] = [];

    for (const context of this._sessions.values()) {
      const age = now - context.session.lastUsedAt.getTime();
      if (age >= this._options.sessionTimeoutMs) {
        expiredSessions.push(context);
      }
    }

    for (const context of expiredSessions) {
      this._destroySessionContext(context, 'timeout').catch((error) => {
        this._logger.error('Error cleaning up expired session', {
          sessionId: context.session.id,
          data: { errorMessage: error instanceof Error ? error.message : String(error) },
        });
      });
    }

    if (expiredSessions.length > 0) {
      this._logger.info('Cleaned up expired sessions', { data: { count: expiredSessions.length } });
    }
  }

  /**
   * Start health check interval.
   */
  private _startHealthCheck(intervalMs: number): void {
    this._stopHealthCheck();
    
    this._healthCheckInterval = setInterval(() => {
      if (this._isShuttingDown) return;
      
      this._performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health check interval.
   */
  private _stopHealthCheck(): void {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
  }

  /**
   * Perform health check on all sessions.
   */
  private _performHealthCheck(): void {
    const unhealthySessions: SessionContext[] = [];
    
    for (const context of this._sessions.values()) {
      if (!context.client.isConnected || context.client.state === 'error') {
        unhealthySessions.push(context);
      }
    }

    for (const context of unhealthySessions) {
      this._logger.warn('Unhealthy session detected', { 
        sessionId: context.session.id,
        data: { state: context.client.state },
      });
      
      this._destroySessionContext(context, 'error').catch((error) => {
        this._logger.error('Error destroying unhealthy session', {
          sessionId: context.session.id,
          data: { errorMessage: error instanceof Error ? error.message : String(error) },
        });
      });
    }
  }

  /**
   * Logs a message if debug mode is enabled.
   * @deprecated Use this._logger instead
   */
  private _log(message: string): void {
    if (this._options.debug) {
      console.log(`[SessionManager] ${message}`);
    }
  }
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal session context with client and cleanup timer
 */
interface SessionContext {
  session: McpSession;
  client: McpClient;
  cleanupTimer: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Gets the singleton SessionManager instance.
 *
 * @param options - Optional configuration (only used on first call)
 * @returns The singleton SessionManager instance
 */
export function getSessionManager(options?: EnhancedSessionManagerOptions): SessionManager {
  return SessionManager.getInstance(options);
}

/**
 * Creates a new session using the default SessionManager.
 *
 * @param transportConfig - Transport configuration
 * @param clientOptions - Optional client options
 * @returns The created session
 */
export async function createSession(
  transportConfig: TransportConfig,
  clientOptions?: Partial<EnhancedClientOptions>
): Promise<McpSession> {
  return SessionManager.getInstance().createSession(transportConfig, clientOptions);
}

/**
 * Gets a client from the default SessionManager.
 *
 * @param sessionId - Session ID
 * @returns The client if found
 */
export function getClient(sessionId: string): McpClient | undefined {
  return SessionManager.getInstance().getClient(sessionId);
}

/**
 * Destroys a session in the default SessionManager.
 *
 * @param sessionId - Session ID
 * @returns True if destroyed
 */
export async function destroySession(sessionId: string): Promise<boolean> {
  return SessionManager.getInstance().destroySession(sessionId);
}

/**
 * Gets session health from the default SessionManager.
 *
 * @param sessionId - Session ID
 * @returns Session health status if found
 */
export function getSessionHealth(sessionId: string): SessionHealthStatus | undefined {
  return SessionManager.getInstance().getSessionHealth(sessionId);
}
