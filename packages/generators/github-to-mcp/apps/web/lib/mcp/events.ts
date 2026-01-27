/**
 * MCP Events - Typed event emitter for MCP client events
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import type {
  ConnectionState,
  McpTool,
  McpResource,
  McpPrompt,
  McpToolCallResult,
  McpError,
} from './types.js';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Connection state change event
 */
export interface ConnectionStateChangeEvent {
  readonly type: 'connection:stateChange';
  readonly previousState: ConnectionState;
  readonly currentState: ConnectionState;
  readonly timestamp: Date;
}

/**
 * Connection established event
 */
export interface ConnectionEstablishedEvent {
  readonly type: 'connection:established';
  readonly serverName: string;
  readonly serverVersion: string;
  readonly timestamp: Date;
}

/**
 * Connection closed event
 */
export interface ConnectionClosedEvent {
  readonly type: 'connection:closed';
  readonly reason?: string;
  readonly wasClean: boolean;
  readonly timestamp: Date;
}

/**
 * Connection error event
 */
export interface ConnectionErrorEvent {
  readonly type: 'connection:error';
  readonly error: McpError | Error;
  readonly recoverable: boolean;
  readonly timestamp: Date;
}

/**
 * Reconnection attempt event
 */
export interface ReconnectionAttemptEvent {
  readonly type: 'connection:reconnecting';
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly timestamp: Date;
}

/**
 * Tool list change event (from server notification)
 */
export interface ToolsChangedEvent {
  readonly type: 'tools:changed';
  readonly tools: readonly McpTool[];
  readonly timestamp: Date;
}

/**
 * Tool execution start event
 */
export interface ToolExecutionStartEvent {
  readonly type: 'tool:start';
  readonly toolName: string;
  readonly requestId: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;
}

/**
 * Tool execution complete event
 */
export interface ToolExecutionCompleteEvent {
  readonly type: 'tool:complete';
  readonly toolName: string;
  readonly requestId: string;
  readonly result: McpToolCallResult;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Tool execution error event
 */
export interface ToolExecutionErrorEvent {
  readonly type: 'tool:error';
  readonly toolName: string;
  readonly requestId: string;
  readonly error: McpError | Error;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Resource list change event (from server notification)
 */
export interface ResourcesChangedEvent {
  readonly type: 'resources:changed';
  readonly resources: readonly McpResource[];
  readonly timestamp: Date;
}

/**
 * Resource updated event (from subscription)
 */
export interface ResourceUpdatedEvent {
  readonly type: 'resource:updated';
  readonly uri: string;
  readonly timestamp: Date;
}

/**
 * Prompt list change event (from server notification)
 */
export interface PromptsChangedEvent {
  readonly type: 'prompts:changed';
  readonly prompts: readonly McpPrompt[];
  readonly timestamp: Date;
}

/**
 * Server log message event
 */
export interface ServerLogEvent {
  readonly type: 'server:log';
  readonly level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  readonly message: string;
  readonly data?: unknown;
  readonly timestamp: Date;
}

/**
 * Request start event (for any MCP request)
 */
export interface RequestStartEvent {
  readonly type: 'request:start';
  readonly requestId: string;
  readonly method: string;
  readonly timestamp: Date;
}

/**
 * Request complete event
 */
export interface RequestCompleteEvent {
  readonly type: 'request:complete';
  readonly requestId: string;
  readonly method: string;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Request error event
 */
export interface RequestErrorEvent {
  readonly type: 'request:error';
  readonly requestId: string;
  readonly method: string;
  readonly error: McpError | Error;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Request cancelled event
 */
export interface RequestCancelledEvent {
  readonly type: 'request:cancelled';
  readonly requestId: string;
  readonly method: string;
  readonly durationMs: number;
  readonly timestamp: Date;
}

/**
 * Session created event
 */
export interface SessionCreatedEvent {
  readonly type: 'session:created';
  readonly sessionId: string;
  readonly timestamp: Date;
}

/**
 * Session destroyed event
 */
export interface SessionDestroyedEvent {
  readonly type: 'session:destroyed';
  readonly sessionId: string;
  readonly reason: 'timeout' | 'manual' | 'evicted' | 'error' | 'shutdown';
  readonly timestamp: Date;
}

/**
 * Union of all MCP events
 */
export type McpEvent =
  | ConnectionStateChangeEvent
  | ConnectionEstablishedEvent
  | ConnectionClosedEvent
  | ConnectionErrorEvent
  | ReconnectionAttemptEvent
  | ToolsChangedEvent
  | ToolExecutionStartEvent
  | ToolExecutionCompleteEvent
  | ToolExecutionErrorEvent
  | ResourcesChangedEvent
  | ResourceUpdatedEvent
  | PromptsChangedEvent
  | ServerLogEvent
  | RequestStartEvent
  | RequestCompleteEvent
  | RequestErrorEvent
  | RequestCancelledEvent
  | SessionCreatedEvent
  | SessionDestroyedEvent;

/**
 * Event type to event mapping for type safety
 */
export interface McpEventMap {
  'connection:stateChange': ConnectionStateChangeEvent;
  'connection:established': ConnectionEstablishedEvent;
  'connection:closed': ConnectionClosedEvent;
  'connection:error': ConnectionErrorEvent;
  'connection:reconnecting': ReconnectionAttemptEvent;
  'tools:changed': ToolsChangedEvent;
  'tool:start': ToolExecutionStartEvent;
  'tool:complete': ToolExecutionCompleteEvent;
  'tool:error': ToolExecutionErrorEvent;
  'resources:changed': ResourcesChangedEvent;
  'resource:updated': ResourceUpdatedEvent;
  'prompts:changed': PromptsChangedEvent;
  'server:log': ServerLogEvent;
  'request:start': RequestStartEvent;
  'request:complete': RequestCompleteEvent;
  'request:error': RequestErrorEvent;
  'request:cancelled': RequestCancelledEvent;
  'session:created': SessionCreatedEvent;
  'session:destroyed': SessionDestroyedEvent;
}

/**
 * Event type string literal type
 */
export type McpEventType = keyof McpEventMap;

/**
 * Event listener function type
 */
export type McpEventListener<T extends McpEventType> = (event: McpEventMap[T]) => void;

/**
 * Wildcard listener that receives all events
 */
export type McpWildcardListener = (event: McpEvent) => void;

// ============================================================================
// Event Emitter Class
// ============================================================================

/**
 * Subscription handle for unsubscribing from events
 */
export interface EventSubscription {
  /** Unsubscribe from the event */
  unsubscribe(): void;
}

/**
 * Typed event emitter for MCP events
 *
 * @example
 * ```typescript
 * const emitter = new McpEventEmitter();
 *
 * // Subscribe to specific event
 * const sub = emitter.on('connection:established', (event) => {
 *   console.log(`Connected to ${event.serverName}`);
 * });
 *
 * // Subscribe to all events
 * emitter.onAny((event) => {
 *   console.log(`Event: ${event.type}`);
 * });
 *
 * // Emit an event
 * emitter.emit({
 *   type: 'connection:established',
 *   serverName: 'my-server',
 *   serverVersion: '1.0.0',
 *   timestamp: new Date(),
 * });
 *
 * // Unsubscribe
 * sub.unsubscribe();
 * ```
 */
export class McpEventEmitter {
  private readonly _listeners: Map<McpEventType, Set<McpEventListener<McpEventType>>> = new Map();
  private readonly _wildcardListeners: Set<McpWildcardListener> = new Set();
  private readonly _onceListeners: Map<McpEventType, Set<McpEventListener<McpEventType>>> = new Map();
  private _maxListeners = 100;
  private _isPaused = false;
  private _eventQueue: McpEvent[] = [];

  /**
   * Maximum number of listeners per event type
   */
  get maxListeners(): number {
    return this._maxListeners;
  }

  set maxListeners(value: number) {
    this._maxListeners = value;
  }

  /**
   * Subscribe to a specific event type
   *
   * @param eventType - Event type to listen for
   * @param listener - Callback function
   * @returns Subscription handle
   */
  on<T extends McpEventType>(eventType: T, listener: McpEventListener<T>): EventSubscription {
    let listeners = this._listeners.get(eventType);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(eventType, listeners);
    }

    if (listeners.size >= this._maxListeners) {
      console.warn(
        `McpEventEmitter: Maximum listeners (${this._maxListeners}) reached for event '${eventType}'`
      );
    }

    listeners.add(listener as McpEventListener<McpEventType>);

    return {
      unsubscribe: () => {
        listeners?.delete(listener as McpEventListener<McpEventType>);
      },
    };
  }

  /**
   * Subscribe to a specific event type for one emission only
   *
   * @param eventType - Event type to listen for
   * @param listener - Callback function
   * @returns Subscription handle
   */
  once<T extends McpEventType>(eventType: T, listener: McpEventListener<T>): EventSubscription {
    let onceListeners = this._onceListeners.get(eventType);
    if (!onceListeners) {
      onceListeners = new Set();
      this._onceListeners.set(eventType, onceListeners);
    }

    onceListeners.add(listener as McpEventListener<McpEventType>);

    return {
      unsubscribe: () => {
        onceListeners?.delete(listener as McpEventListener<McpEventType>);
      },
    };
  }

  /**
   * Subscribe to all events
   *
   * @param listener - Callback function
   * @returns Subscription handle
   */
  onAny(listener: McpWildcardListener): EventSubscription {
    this._wildcardListeners.add(listener);

    return {
      unsubscribe: () => {
        this._wildcardListeners.delete(listener);
      },
    };
  }

  /**
   * Unsubscribe a listener from a specific event type
   *
   * @param eventType - Event type
   * @param listener - Listener to remove
   */
  off<T extends McpEventType>(eventType: T, listener: McpEventListener<T>): void {
    const listeners = this._listeners.get(eventType);
    listeners?.delete(listener as McpEventListener<McpEventType>);

    const onceListeners = this._onceListeners.get(eventType);
    onceListeners?.delete(listener as McpEventListener<McpEventType>);
  }

  /**
   * Remove all listeners for a specific event type, or all listeners if no type specified
   *
   * @param eventType - Optional event type
   */
  removeAllListeners(eventType?: McpEventType): void {
    if (eventType) {
      this._listeners.delete(eventType);
      this._onceListeners.delete(eventType);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
      this._wildcardListeners.clear();
    }
  }

  /**
   * Emit an event to all listeners
   *
   * @param event - Event to emit
   */
  emit<T extends McpEvent>(event: T): void {
    if (this._isPaused) {
      this._eventQueue.push(event);
      return;
    }

    this._emitInternal(event);
  }

  /**
   * Internal emit implementation
   */
  private _emitInternal(event: McpEvent): void {
    const eventType = event.type as McpEventType;

    // Notify specific listeners
    const listeners = this._listeners.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event as McpEventMap[typeof eventType]);
        } catch (error) {
          console.error(`Error in event listener for '${eventType}':`, error);
        }
      }
    }

    // Notify once listeners
    const onceListeners = this._onceListeners.get(eventType);
    if (onceListeners && onceListeners.size > 0) {
      const listenersToCall = Array.from(onceListeners);
      onceListeners.clear();
      for (const listener of listenersToCall) {
        try {
          listener(event as McpEventMap[typeof eventType]);
        } catch (error) {
          console.error(`Error in once listener for '${eventType}':`, error);
        }
      }
    }

    // Notify wildcard listeners
    for (const listener of this._wildcardListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in wildcard event listener:', error);
      }
    }
  }

  /**
   * Get the count of listeners for a specific event type
   *
   * @param eventType - Event type
   * @returns Number of listeners
   */
  listenerCount(eventType?: McpEventType): number {
    if (eventType) {
      const listeners = this._listeners.get(eventType);
      const onceListeners = this._onceListeners.get(eventType);
      return (listeners?.size ?? 0) + (onceListeners?.size ?? 0);
    }

    let count = this._wildcardListeners.size;
    for (const listeners of this._listeners.values()) {
      count += listeners.size;
    }
    for (const listeners of this._onceListeners.values()) {
      count += listeners.size;
    }
    return count;
  }

  /**
   * Get all event types that have listeners
   *
   * @returns Array of event types
   */
  eventTypes(): McpEventType[] {
    const types = new Set<McpEventType>();
    for (const type of this._listeners.keys()) {
      types.add(type);
    }
    for (const type of this._onceListeners.keys()) {
      types.add(type);
    }
    return Array.from(types);
  }

  /**
   * Pause event emission - events will be queued
   */
  pause(): void {
    this._isPaused = true;
  }

  /**
   * Resume event emission and flush queued events
   */
  resume(): void {
    this._isPaused = false;
    const queuedEvents = this._eventQueue;
    this._eventQueue = [];
    for (const event of queuedEvents) {
      this._emitInternal(event);
    }
  }

  /**
   * Wait for a specific event type
   *
   * @param eventType - Event type to wait for
   * @param timeoutMs - Optional timeout
   * @returns Promise that resolves with the event
   */
  waitFor<T extends McpEventType>(
    eventType: T,
    timeoutMs?: number
  ): Promise<McpEventMap[T]> {
    return new Promise((resolve, reject) => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      const subscription = this.once(eventType, (event) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        resolve(event);
      });

      if (timeoutMs !== undefined) {
        timeoutHandle = setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error(`Timeout waiting for event '${eventType}' after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new event emitter instance
 */
export function createEventEmitter(): McpEventEmitter {
  return new McpEventEmitter();
}

/**
 * Create a timestamp for event creation
 */
export function createEventTimestamp(): Date {
  return new Date();
}

/**
 * Type guard for connection events
 */
export function isConnectionEvent(event: McpEvent): event is
  | ConnectionStateChangeEvent
  | ConnectionEstablishedEvent
  | ConnectionClosedEvent
  | ConnectionErrorEvent
  | ReconnectionAttemptEvent {
  return event.type.startsWith('connection:');
}

/**
 * Type guard for tool events
 */
export function isToolEvent(event: McpEvent): event is
  | ToolsChangedEvent
  | ToolExecutionStartEvent
  | ToolExecutionCompleteEvent
  | ToolExecutionErrorEvent {
  return event.type.startsWith('tool:') || event.type === 'tools:changed';
}

/**
 * Type guard for resource events
 */
export function isResourceEvent(event: McpEvent): event is
  | ResourcesChangedEvent
  | ResourceUpdatedEvent {
  return event.type.startsWith('resource:') || event.type === 'resources:changed';
}

/**
 * Type guard for request events
 */
export function isRequestEvent(event: McpEvent): event is
  | RequestStartEvent
  | RequestCompleteEvent
  | RequestErrorEvent
  | RequestCancelledEvent {
  return event.type.startsWith('request:');
}

/**
 * Type guard for session events
 */
export function isSessionEvent(event: McpEvent): event is
  | SessionCreatedEvent
  | SessionDestroyedEvent {
  return event.type.startsWith('session:');
}
