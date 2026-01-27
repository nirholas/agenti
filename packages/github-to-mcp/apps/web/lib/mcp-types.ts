/**
 * MCP Protocol Type Definitions
 * Types matching the Model Context Protocol specification
 * @see https://spec.modelcontextprotocol.io/
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright 2024-2026 nich (nirholas)
 * @license MIT
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 Success Response
 */
export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result: T;
}

/**
 * JSON-RPC 2.0 Error Response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  error: JsonRpcError;
}

/**
 * JSON-RPC 2.0 Error Object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Combined JSON-RPC Response type
 */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

/**
 * JSON-RPC 2.0 Notification (no id, no response expected)
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// MCP Protocol Messages
// ============================================================================

/**
 * MCP Request wrapper with typed params
 */
export type McpRequest<T extends Record<string, unknown> = Record<string, unknown>> = JsonRpcRequest & {
  params?: T;
};

/**
 * MCP Response wrapper
 */
export type McpResponse<T = unknown> = JsonRpcResponse<T>;

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * JSON Schema for tool input validation
 */
export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * JSON Schema property definition
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
 * MCP Tool Definition
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

/**
 * MCP tools/list response
 */
export interface ListToolsResult {
  tools: McpTool[];
}

// ============================================================================
// MCP Tool Call Types
// ============================================================================

/**
 * MCP tools/call request parameters
 */
export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
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
 * MCP tools/call response
 */
export interface CallToolResult {
  content: ToolContent[];
  isError?: boolean;
}

// ============================================================================
// MCP Resource Types
// ============================================================================

/**
 * MCP Resource Definition
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP resources/list response
 */
export interface ListResourcesResult {
  resources: McpResource[];
}

/**
 * MCP resources/read response
 */
export interface ReadResourceResult {
  contents: ResourceContent[];
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

// ============================================================================
// MCP Prompt Types
// ============================================================================

/**
 * MCP Prompt Argument
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Prompt Definition
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * MCP prompts/list response
 */
export interface ListPromptsResult {
  prompts: McpPrompt[];
}

/**
 * Prompt message role
 */
export type PromptMessageRole = 'user' | 'assistant';

/**
 * Prompt message content
 */
export interface PromptMessage {
  role: PromptMessageRole;
  content: TextContent | ImageContent | EmbeddedResourceContent;
}

/**
 * MCP prompts/get response
 */
export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

// ============================================================================
// MCP Initialization Types
// ============================================================================

/**
 * Client capabilities sent during initialization
 */
export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  sampling?: Record<string, unknown>;
  roots?: {
    listChanged?: boolean;
  };
}

/**
 * Server capabilities received during initialization
 */
export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
}

/**
 * Client info sent during initialization
 */
export interface ClientInfo {
  name: string;
  version: string;
}

/**
 * Server info received during initialization
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * MCP initialize request parameters
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: ClientInfo;
}

/**
 * MCP initialize response
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
  instructions?: string;
}

// ============================================================================
// MCP Method Names (Constants)
// ============================================================================

export const MCP_METHODS = {
  // Lifecycle
  INITIALIZE: 'initialize',
  INITIALIZED: 'notifications/initialized',
  SHUTDOWN: 'shutdown',
  
  // Tools
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  
  // Resources
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',
  
  // Prompts
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  
  // Logging
  LOGGING_SET_LEVEL: 'logging/setLevel',
  
  // Notifications
  NOTIFICATION_CANCELLED: 'notifications/cancelled',
  NOTIFICATION_PROGRESS: 'notifications/progress',
  NOTIFICATION_MESSAGE: 'notifications/message',
  NOTIFICATION_RESOURCES_UPDATED: 'notifications/resources/updated',
  NOTIFICATION_RESOURCES_LIST_CHANGED: 'notifications/resources/list_changed',
  NOTIFICATION_TOOLS_LIST_CHANGED: 'notifications/tools/list_changed',
  NOTIFICATION_PROMPTS_LIST_CHANGED: 'notifications/prompts/list_changed',
} as const;

// ============================================================================
// Protocol Version
// ============================================================================

export const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * Library metadata - nich (x.com/nichxbt | github.com/nirholas)
 */
export const _MCP_LIB_META = {
  author: 'nich',
  github: 'github.com/nirholas',
  twitter: 'x.com/nichxbt',
  project: 'github-to-mcp',
} as const;

// ============================================================================
// Standard JSON-RPC Error Codes
// ============================================================================

export const JSON_RPC_ERROR_CODES = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // Server errors (reserved range: -32000 to -32099)
  SERVER_ERROR_START: -32099,
  SERVER_ERROR_END: -32000,
} as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response is an error response
 */
export function isJsonRpcError(response: JsonRpcResponse): response is JsonRpcErrorResponse {
  return 'error' in response;
}

/**
 * Check if response is a success response
 */
export function isJsonRpcSuccess<T>(response: JsonRpcResponse<T>): response is JsonRpcSuccessResponse<T> {
  return 'result' in response;
}

/**
 * Check if content is text content
 */
export function isTextContent(content: ToolContent): content is TextContent {
  return content.type === 'text';
}

/**
 * Check if content is image content
 */
export function isImageContent(content: ToolContent): content is ImageContent {
  return content.type === 'image';
}

/**
 * Check if content is embedded resource content
 */
export function isResourceContent(content: ToolContent): content is EmbeddedResourceContent {
  return content.type === 'resource';
}
