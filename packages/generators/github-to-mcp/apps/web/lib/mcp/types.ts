/**
 * MCP SDK Types - Type definitions for MCP client wrapper
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Supported MCP transport types
 */
export type TransportType = 'stdio' | 'sse' | 'streamable-http';

/**
 * Configuration for stdio transport - spawns a local process
 */
export interface StdioTransportConfig {
  readonly type: 'stdio';
  /** The command to execute */
  readonly command: string;
  /** Command line arguments */
  readonly args?: readonly string[];
  /** Environment variables for the process */
  readonly env?: Readonly<Record<string, string>>;
  /** Working directory for the process */
  readonly cwd?: string;
}

/**
 * Configuration for SSE transport - connects to legacy HTTP+SSE server
 * @deprecated SSE transport is deprecated in favor of streamable-http
 */
export interface SseTransportConfig {
  readonly type: 'sse';
  /** The server URL to connect to */
  readonly url: string;
  /** Optional request headers */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Configuration for Streamable HTTP transport - connects to modern HTTP server
 */
export interface StreamableHttpTransportConfig {
  readonly type: 'streamable-http';
  /** The server URL to connect to */
  readonly url: string;
  /** Optional request headers */
  readonly headers?: Readonly<Record<string, string>>;
  /** Optional session ID for reconnection */
  readonly sessionId?: string;
}

/**
 * Discriminated union of all transport configurations
 */
export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;

// ============================================================================
// MCP Capability Types
// ============================================================================

/**
 * Server capabilities returned during initialization
 */
export interface McpCapabilities {
  /** Whether the server supports tools */
  readonly tools?: {
    readonly listChanged?: boolean;
  };
  /** Whether the server supports resources */
  readonly resources?: {
    readonly subscribe?: boolean;
    readonly listChanged?: boolean;
  };
  /** Whether the server supports prompts */
  readonly prompts?: {
    readonly listChanged?: boolean;
  };
  /** Whether the server supports logging */
  readonly logging?: Record<string, unknown>;
  /** Experimental capabilities */
  readonly experimental?: Record<string, unknown>;
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * JSON Schema property definition for tool input
 */
export interface JsonSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly items?: JsonSchemaProperty;
  readonly properties?: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchemaProperty;
}

/**
 * JSON Schema for tool input validation
 */
export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties?: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * MCP Tool definition
 */
export interface McpTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: ToolInputSchema;
}

/**
 * Content types for tool execution results
 */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface ImageContent {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
}

export interface EmbeddedResourceContent {
  readonly type: 'resource';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly text?: string;
    readonly blob?: string;
  };
}

export type ToolResultContent = TextContent | ImageContent | EmbeddedResourceContent;

/**
 * Result of calling a tool
 */
export interface McpToolCallResult {
  readonly content: readonly ToolResultContent[];
  readonly isError?: boolean;
}

// ============================================================================
// MCP Resource Types
// ============================================================================

/**
 * MCP Resource definition
 */
export interface McpResource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/**
 * Contents of a resource
 */
export interface McpResourceContents {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

// ============================================================================
// MCP Prompt Types
// ============================================================================

/**
 * Prompt argument definition
 */
export interface McpPromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

/**
 * MCP Prompt definition
 */
export interface McpPrompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: readonly McpPromptArgument[];
}

/**
 * Message role in prompt
 */
export type PromptMessageRole = 'user' | 'assistant';

/**
 * Content in a prompt message
 */
export interface PromptTextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface PromptImageContent {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
}

export interface PromptResourceContent {
  readonly type: 'resource';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly text?: string;
    readonly blob?: string;
  };
}

export type PromptMessageContent =
  | PromptTextContent
  | PromptImageContent
  | PromptResourceContent;

/**
 * Message in a prompt
 */
export interface McpPromptMessage {
  readonly role: PromptMessageRole;
  readonly content: PromptMessageContent;
}

/**
 * Result of getting a prompt
 */
export interface McpPromptResult {
  readonly description?: string;
  readonly messages: readonly McpPromptMessage[];
}

// ============================================================================
// MCP Session Types
// ============================================================================

/**
 * Connection state of an MCP client
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP Session representing an active connection
 */
export interface McpSession {
  /** Unique session identifier */
  readonly id: string;
  /** Transport configuration used for this session */
  readonly transportConfig: TransportConfig;
  /** Current connection state */
  readonly state: ConnectionState;
  /** Server capabilities discovered during initialization */
  readonly capabilities?: McpCapabilities;
  /** Server info from initialization */
  readonly serverInfo?: {
    readonly name: string;
    readonly version: string;
  };
  /** When the session was created */
  readonly createdAt: Date;
  /** When the session was last used */
  lastUsedAt: Date;
}

/**
 * Internal session data with mutable transport
 */
export interface McpSessionInternal extends McpSession {
  /** The underlying transport instance */
  transport: Transport;
  /** Cleanup timer reference */
  cleanupTimer: ReturnType<typeof setTimeout>;
}

// ============================================================================
// MCP Execution Result Types
// ============================================================================

/**
 * Successful execution result
 */
export interface McpExecutionSuccess<T = unknown> {
  readonly success: true;
  readonly data: T;
  readonly executionTimeMs: number;
}

/**
 * Failed execution result
 */
export interface McpExecutionFailure {
  readonly success: false;
  readonly error: McpError;
  readonly executionTimeMs: number;
}

/**
 * Result of an MCP execution (tool call, resource read, etc.)
 */
export type McpExecutionResult<T = unknown> =
  | McpExecutionSuccess<T>
  | McpExecutionFailure;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for MCP operations
 */
export enum McpErrorCode {
  // Connection errors
  ConnectionFailed = 'CONNECTION_FAILED',
  ConnectionTimeout = 'CONNECTION_TIMEOUT',
  ConnectionClosed = 'CONNECTION_CLOSED',
  NotConnected = 'NOT_CONNECTED',
  AlreadyConnected = 'ALREADY_CONNECTED',

  // Protocol errors
  InvalidRequest = 'INVALID_REQUEST',
  InvalidResponse = 'INVALID_RESPONSE',
  MethodNotFound = 'METHOD_NOT_FOUND',
  InvalidParams = 'INVALID_PARAMS',

  // Resource errors
  ResourceNotFound = 'RESOURCE_NOT_FOUND',
  ResourceAccessDenied = 'RESOURCE_ACCESS_DENIED',

  // Tool errors
  ToolNotFound = 'TOOL_NOT_FOUND',
  ToolExecutionFailed = 'TOOL_EXECUTION_FAILED',

  // Prompt errors
  PromptNotFound = 'PROMPT_NOT_FOUND',

  // Session errors
  SessionNotFound = 'SESSION_NOT_FOUND',
  SessionExpired = 'SESSION_EXPIRED',
  MaxSessionsReached = 'MAX_SESSIONS_REACHED',

  // Transport errors
  TransportError = 'TRANSPORT_ERROR',
  UnsupportedTransport = 'UNSUPPORTED_TRANSPORT',

  // General errors
  Timeout = 'TIMEOUT',
  InternalError = 'INTERNAL_ERROR',
  Unknown = 'UNKNOWN',
}

/**
 * Base MCP Error class
 */
export class McpError extends Error {
  constructor(
    public readonly code: McpErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'McpError';
    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, McpError);
    }
  }

  /**
   * Create a JSON-serializable representation
   */
  toJSON(): Readonly<{
    name: string;
    code: McpErrorCode;
    message: string;
    cause?: unknown;
  }> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause,
    };
  }
}

/**
 * Connection-related error
 */
export class McpConnectionError extends McpError {
  constructor(code: McpErrorCode, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'McpConnectionError';
  }
}

/**
 * Transport-related error
 */
export class McpTransportError extends McpError {
  constructor(message: string, cause?: unknown) {
    super(McpErrorCode.TransportError, message, cause);
    this.name = 'McpTransportError';
  }
}

/**
 * Timeout error
 */
export class McpTimeoutError extends McpError {
  constructor(operation: string, timeoutMs: number, cause?: unknown) {
    super(
      McpErrorCode.Timeout,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      cause
    );
    this.name = 'McpTimeoutError';
  }
}

/**
 * Session-related error
 */
export class McpSessionError extends McpError {
  constructor(code: McpErrorCode, message: string, cause?: unknown) {
    super(code, message, cause);
    this.name = 'McpSessionError';
  }
}

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Configuration options for McpClient
 */
export interface McpClientOptions {
  /** Client name for identification */
  readonly name: string;
  /** Client version */
  readonly version: string;
  /** Connection timeout in milliseconds */
  readonly connectionTimeoutMs?: number;
  /** Request timeout in milliseconds */
  readonly requestTimeoutMs?: number;
  /** Enable debug logging */
  readonly debug?: boolean;
}

/**
 * Default client options
 */
export const DEFAULT_CLIENT_OPTIONS: Required<
  Pick<McpClientOptions, 'connectionTimeoutMs' | 'requestTimeoutMs' | 'debug'>
> = {
  connectionTimeoutMs: 30_000,
  requestTimeoutMs: 60_000,
  debug: false,
} as const;

// ============================================================================
// Session Manager Configuration Types
// ============================================================================

/**
 * Configuration options for SessionManager
 */
export interface SessionManagerOptions {
  /** Session timeout in milliseconds (default: 5 minutes) */
  readonly sessionTimeoutMs?: number;
  /** Maximum number of concurrent sessions (default: 100) */
  readonly maxSessions?: number;
  /** Enable debug logging */
  readonly debug?: boolean;
}

/**
 * Default session manager options
 */
export const DEFAULT_SESSION_MANAGER_OPTIONS: Required<SessionManagerOptions> = {
  sessionTimeoutMs: 5 * 60 * 1000, // 5 minutes
  maxSessions: 100,
  debug: false,
} as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for StdioTransportConfig
 */
export function isStdioTransportConfig(
  config: TransportConfig
): config is StdioTransportConfig {
  return config.type === 'stdio';
}

/**
 * Type guard for SseTransportConfig
 */
export function isSseTransportConfig(
  config: TransportConfig
): config is SseTransportConfig {
  return config.type === 'sse';
}

/**
 * Type guard for StreamableHttpTransportConfig
 */
export function isStreamableHttpTransportConfig(
  config: TransportConfig
): config is StreamableHttpTransportConfig {
  return config.type === 'streamable-http';
}

/**
 * Type guard for McpExecutionSuccess
 */
export function isExecutionSuccess<T>(
  result: McpExecutionResult<T>
): result is McpExecutionSuccess<T> {
  return result.success === true;
}

/**
 * Type guard for McpExecutionFailure
 */
export function isExecutionFailure(
  result: McpExecutionResult<unknown>
): result is McpExecutionFailure {
  return result.success === false;
}

/**
 * Type guard for McpError
 */
export function isMcpError(error: unknown): error is McpError {
  return error instanceof McpError;
}

/**
 * Type guard for TextContent
 */
export function isTextContent(
  content: ToolResultContent
): content is TextContent {
  return content.type === 'text';
}

/**
 * Type guard for ImageContent
 */
export function isImageContent(
  content: ToolResultContent
): content is ImageContent {
  return content.type === 'image';
}

/**
 * Type guard for EmbeddedResourceContent
 */
export function isEmbeddedResourceContent(
  content: ToolResultContent
): content is EmbeddedResourceContent {
  return content.type === 'resource';
}
