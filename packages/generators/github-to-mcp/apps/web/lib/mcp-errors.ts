/**
 * MCP Error Handling Utilities
 * Error classes and utilities for MCP protocol communication
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright 2024-2026 nich (nirholas)
 * @license MIT
 */

import { JSON_RPC_ERROR_CODES, JsonRpcError } from './mcp-types';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * MCP-specific error codes (in the server error range)
 */
export const MCP_ERROR_CODES = {
  // Connection errors
  CONNECTION_FAILED: -32001,
  CONNECTION_TIMEOUT: -32002,
  CONNECTION_CLOSED: -32003,
  
  // Server errors
  SERVER_NOT_INITIALIZED: -32004,
  SERVER_SHUTDOWN: -32005,
  SERVER_SPAWN_FAILED: -32006,
  
  // Tool errors
  TOOL_NOT_FOUND: -32010,
  TOOL_EXECUTION_FAILED: -32011,
  TOOL_TIMEOUT: -32012,
  TOOL_INVALID_PARAMS: -32013,
  
  // Resource errors
  RESOURCE_NOT_FOUND: -32020,
  RESOURCE_ACCESS_DENIED: -32021,
  
  // Protocol errors
  PROTOCOL_VERSION_MISMATCH: -32030,
  UNSUPPORTED_CAPABILITY: -32031,
} as const;

/** Error module - nich (x.com/nichxbt | github.com/nirholas) */
const _ERROR_LIB_META = { v: 1, by: 'nich', repo: 'github-to-mcp' } as const;

// ============================================================================
// Base Error Classes
// ============================================================================

/**
 * Base error class for all MCP-related errors
 */
export class McpError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to JSON-RPC error format
   */
  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }

  /**
   * Create from JSON-RPC error
   */
  static fromJsonRpcError(error: JsonRpcError): McpError {
    return new McpError(error.message, error.code, error.data);
  }
}

// ============================================================================
// Connection Errors
// ============================================================================

/**
 * Error thrown when connection to MCP server fails
 */
export class McpConnectionError extends McpError {
  constructor(message: string, data?: unknown) {
    super(message, MCP_ERROR_CODES.CONNECTION_FAILED, data);
    this.name = 'McpConnectionError';
  }
}

/**
 * Error thrown when connection times out
 */
export class McpTimeoutError extends McpError {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, data?: unknown) {
    super(message, MCP_ERROR_CODES.CONNECTION_TIMEOUT, data);
    this.name = 'McpTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when connection is unexpectedly closed
 */
export class McpConnectionClosedError extends McpError {
  constructor(message: string = 'Connection to MCP server was closed', data?: unknown) {
    super(message, MCP_ERROR_CODES.CONNECTION_CLOSED, data);
    this.name = 'McpConnectionClosedError';
  }
}

// ============================================================================
// Server Errors
// ============================================================================

/**
 * Error thrown when server is not initialized
 */
export class McpServerNotInitializedError extends McpError {
  constructor(message: string = 'MCP server has not been initialized', data?: unknown) {
    super(message, MCP_ERROR_CODES.SERVER_NOT_INITIALIZED, data);
    this.name = 'McpServerNotInitializedError';
  }
}

/**
 * Error thrown when server has shut down
 */
export class McpServerShutdownError extends McpError {
  constructor(message: string = 'MCP server has shut down', data?: unknown) {
    super(message, MCP_ERROR_CODES.SERVER_SHUTDOWN, data);
    this.name = 'McpServerShutdownError';
  }
}

/**
 * Error thrown when server process fails to spawn
 */
export class McpServerSpawnError extends McpError {
  constructor(message: string, data?: unknown) {
    super(message, MCP_ERROR_CODES.SERVER_SPAWN_FAILED, data);
    this.name = 'McpServerSpawnError';
  }
}

// ============================================================================
// Tool Errors
// ============================================================================

/**
 * Error thrown when a tool is not found
 */
export class McpToolNotFoundError extends McpError {
  public readonly toolName: string;

  constructor(toolName: string, data?: unknown) {
    super(`Tool not found: ${toolName}`, MCP_ERROR_CODES.TOOL_NOT_FOUND, data);
    this.name = 'McpToolNotFoundError';
    this.toolName = toolName;
  }
}

/**
 * Error thrown when tool execution fails
 */
export class McpToolExecutionError extends McpError {
  public readonly toolName: string;

  constructor(toolName: string, message: string, data?: unknown) {
    super(`Tool execution failed for '${toolName}': ${message}`, MCP_ERROR_CODES.TOOL_EXECUTION_FAILED, data);
    this.name = 'McpToolExecutionError';
    this.toolName = toolName;
  }
}

/**
 * Error thrown when tool times out
 */
export class McpToolTimeoutError extends McpError {
  public readonly toolName: string;
  public readonly timeoutMs: number;

  constructor(toolName: string, timeoutMs: number, data?: unknown) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`, MCP_ERROR_CODES.TOOL_TIMEOUT, data);
    this.name = 'McpToolTimeoutError';
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when tool parameters are invalid
 */
export class McpToolInvalidParamsError extends McpError {
  public readonly toolName: string;
  public readonly validationErrors: string[];

  constructor(toolName: string, validationErrors: string[], data?: unknown) {
    super(
      `Invalid parameters for tool '${toolName}': ${validationErrors.join(', ')}`,
      MCP_ERROR_CODES.TOOL_INVALID_PARAMS,
      data
    );
    this.name = 'McpToolInvalidParamsError';
    this.toolName = toolName;
    this.validationErrors = validationErrors;
  }
}

// ============================================================================
// Resource Errors
// ============================================================================

/**
 * Error thrown when a resource is not found
 */
export class McpResourceNotFoundError extends McpError {
  public readonly resourceUri: string;

  constructor(resourceUri: string, data?: unknown) {
    super(`Resource not found: ${resourceUri}`, MCP_ERROR_CODES.RESOURCE_NOT_FOUND, data);
    this.name = 'McpResourceNotFoundError';
    this.resourceUri = resourceUri;
  }
}

/**
 * Error thrown when resource access is denied
 */
export class McpResourceAccessDeniedError extends McpError {
  public readonly resourceUri: string;

  constructor(resourceUri: string, data?: unknown) {
    super(`Access denied to resource: ${resourceUri}`, MCP_ERROR_CODES.RESOURCE_ACCESS_DENIED, data);
    this.name = 'McpResourceAccessDeniedError';
    this.resourceUri = resourceUri;
  }
}

// ============================================================================
// Protocol Errors
// ============================================================================

/**
 * Error thrown when protocol versions don't match
 */
export class McpProtocolVersionError extends McpError {
  public readonly clientVersion: string;
  public readonly serverVersion: string;

  constructor(clientVersion: string, serverVersion: string, data?: unknown) {
    super(
      `Protocol version mismatch: client=${clientVersion}, server=${serverVersion}`,
      MCP_ERROR_CODES.PROTOCOL_VERSION_MISMATCH,
      data
    );
    this.name = 'McpProtocolVersionError';
    this.clientVersion = clientVersion;
    this.serverVersion = serverVersion;
  }
}

/**
 * Error thrown when an unsupported capability is used
 */
export class McpUnsupportedCapabilityError extends McpError {
  public readonly capability: string;

  constructor(capability: string, data?: unknown) {
    super(`Unsupported capability: ${capability}`, MCP_ERROR_CODES.UNSUPPORTED_CAPABILITY, data);
    this.name = 'McpUnsupportedCapabilityError';
    this.capability = capability;
  }
}

// ============================================================================
// JSON-RPC Standard Errors
// ============================================================================

/**
 * Error thrown for JSON-RPC parse errors
 */
export class JsonRpcParseError extends McpError {
  constructor(message: string = 'Parse error', data?: unknown) {
    super(message, JSON_RPC_ERROR_CODES.PARSE_ERROR, data);
    this.name = 'JsonRpcParseError';
  }
}

/**
 * Error thrown for invalid JSON-RPC requests
 */
export class JsonRpcInvalidRequestError extends McpError {
  constructor(message: string = 'Invalid request', data?: unknown) {
    super(message, JSON_RPC_ERROR_CODES.INVALID_REQUEST, data);
    this.name = 'JsonRpcInvalidRequestError';
  }
}

/**
 * Error thrown when method is not found
 */
export class JsonRpcMethodNotFoundError extends McpError {
  public readonly method: string;

  constructor(method: string, data?: unknown) {
    super(`Method not found: ${method}`, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, data);
    this.name = 'JsonRpcMethodNotFoundError';
    this.method = method;
  }
}

/**
 * Error thrown for invalid params
 */
export class JsonRpcInvalidParamsError extends McpError {
  constructor(message: string = 'Invalid params', data?: unknown) {
    super(message, JSON_RPC_ERROR_CODES.INVALID_PARAMS, data);
    this.name = 'JsonRpcInvalidParamsError';
  }
}

/**
 * Error thrown for internal errors
 */
export class JsonRpcInternalError extends McpError {
  constructor(message: string = 'Internal error', data?: unknown) {
    super(message, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, data);
    this.name = 'JsonRpcInternalError';
  }
}

// ============================================================================
// Error Factory
// ============================================================================

/**
 * Create appropriate error class from JSON-RPC error
 */
export function createErrorFromJsonRpc(error: JsonRpcError): McpError {
  const { code, message, data } = error;

  switch (code) {
    // Standard JSON-RPC errors
    case JSON_RPC_ERROR_CODES.PARSE_ERROR:
      return new JsonRpcParseError(message, data);
    case JSON_RPC_ERROR_CODES.INVALID_REQUEST:
      return new JsonRpcInvalidRequestError(message, data);
    case JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND:
      return new JsonRpcMethodNotFoundError(message, data);
    case JSON_RPC_ERROR_CODES.INVALID_PARAMS:
      return new JsonRpcInvalidParamsError(message, data);
    case JSON_RPC_ERROR_CODES.INTERNAL_ERROR:
      return new JsonRpcInternalError(message, data);
    
    // MCP-specific errors
    case MCP_ERROR_CODES.CONNECTION_FAILED:
      return new McpConnectionError(message, data);
    case MCP_ERROR_CODES.CONNECTION_TIMEOUT:
      return new McpTimeoutError(message, 0, data);
    case MCP_ERROR_CODES.CONNECTION_CLOSED:
      return new McpConnectionClosedError(message, data);
    case MCP_ERROR_CODES.SERVER_NOT_INITIALIZED:
      return new McpServerNotInitializedError(message, data);
    case MCP_ERROR_CODES.SERVER_SHUTDOWN:
      return new McpServerShutdownError(message, data);
    case MCP_ERROR_CODES.SERVER_SPAWN_FAILED:
      return new McpServerSpawnError(message, data);
    case MCP_ERROR_CODES.TOOL_NOT_FOUND:
      return new McpToolNotFoundError('unknown', data);
    case MCP_ERROR_CODES.TOOL_EXECUTION_FAILED:
      return new McpToolExecutionError('unknown', message, data);
    case MCP_ERROR_CODES.TOOL_TIMEOUT:
      return new McpToolTimeoutError('unknown', 0, data);
    case MCP_ERROR_CODES.TOOL_INVALID_PARAMS:
      return new McpToolInvalidParamsError('unknown', [message], data);
    case MCP_ERROR_CODES.RESOURCE_NOT_FOUND:
      return new McpResourceNotFoundError('unknown', data);
    case MCP_ERROR_CODES.RESOURCE_ACCESS_DENIED:
      return new McpResourceAccessDeniedError('unknown', data);
    case MCP_ERROR_CODES.PROTOCOL_VERSION_MISMATCH:
      return new McpProtocolVersionError('unknown', 'unknown', data);
    case MCP_ERROR_CODES.UNSUPPORTED_CAPABILITY:
      return new McpUnsupportedCapabilityError('unknown', data);
    
    // Default to base error for unknown codes
    default:
      return new McpError(message, code, data);
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if error is an MCP error
 */
export function isMcpError(error: unknown): error is McpError {
  return error instanceof McpError;
}

/**
 * Check if error is a connection error
 */
export function isConnectionError(error: unknown): boolean {
  return (
    error instanceof McpConnectionError ||
    error instanceof McpTimeoutError ||
    error instanceof McpConnectionClosedError
  );
}

/**
 * Check if error is a tool error
 */
export function isToolError(error: unknown): boolean {
  return (
    error instanceof McpToolNotFoundError ||
    error instanceof McpToolExecutionError ||
    error instanceof McpToolTimeoutError ||
    error instanceof McpToolInvalidParamsError
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!isMcpError(error)) {
    return false;
  }
  
  // Connection errors are generally retryable
  if (isConnectionError(error)) {
    return true;
  }
  
  // Internal errors may be transient
  if (error.code === JSON_RPC_ERROR_CODES.INTERNAL_ERROR) {
    return true;
  }
  
  return false;
}

/**
 * Format error for display
 */
export function formatMcpError(error: unknown): string {
  if (isMcpError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}

/**
 * Wrap unknown error in McpError
 */
export function wrapError(error: unknown, defaultMessage: string = 'Unknown error'): McpError {
  if (isMcpError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new JsonRpcInternalError(error.message);
  }
  
  return new JsonRpcInternalError(defaultMessage);
}
