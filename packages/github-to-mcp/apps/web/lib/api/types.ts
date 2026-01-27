/**
 * API Response Types
 *
 * Defines all response types used by the playground API routes.
 */

import type { TransportConfig } from './validation';

// ============================================================================
// Generic API Response
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorData;
}

/**
 * Error data included in API responses
 */
export interface ApiErrorData {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
  resource?: string;
  [key: string]: unknown;
}

// ============================================================================
// MCP Types (shared across responses)
// ============================================================================

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
export interface McpServerInfo {
  name: string;
  version: string;
  protocolVersion?: string;
}

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, McpToolPropertySchema>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * MCP Tool property schema
 */
export interface McpToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: McpToolPropertySchema;
  properties?: Record<string, McpToolPropertySchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
}

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
 * MCP Resource template
 */
export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Resource contents
 */
export interface McpResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // base64 encoded
}

/**
 * MCP Prompt definition
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

/**
 * MCP Prompt argument
 */
export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Prompt message
 */
export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: McpPromptContent;
}

/**
 * MCP Prompt content
 */
export interface McpPromptContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string; // base64 for images
  mimeType?: string;
  resource?: McpResourceContents;
}

/**
 * MCP Tool execution result content
 */
export interface McpToolResultContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string; // base64 for images
  mimeType?: string;
  resource?: McpResourceContents;
}

/**
 * MCP Tool execution result
 */
export interface McpToolResult {
  content: McpToolResultContent[];
  isError?: boolean;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  clientId?: string;
  transport: TransportConfig;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
  createdAt: string;
  lastActivityAt: string;
  status: 'active' | 'disconnected' | 'error';
  toolCount?: number;
  resourceCount?: number;
  promptCount?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Connect response data
 */
export interface ConnectResponseData {
  sessionId: string;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
  tools?: McpTool[];
}

/**
 * Connect API response
 */
export type ConnectResponse = ApiResponse<ConnectResponseData>;

/**
 * Disconnect response data
 */
export interface DisconnectResponseData {
  disconnected: boolean;
  sessionId?: string;
  removedCount?: number;
  clientId?: string;
}

/**
 * Disconnect API response
 */
export type DisconnectResponse = ApiResponse<DisconnectResponseData>;

/**
 * Tools list response data
 */
export interface ToolsListResponseData {
  tools: McpTool[];
}

/**
 * Tools list API response
 */
export type ToolsListResponse = ApiResponse<ToolsListResponseData>;

/**
 * Tool call response data
 */
export interface ToolCallResponseData {
  result: McpToolResult;
  executionTime: number;
  logs: string[];
}

/**
 * Tool call API response
 */
export type ToolCallResponse = ApiResponse<ToolCallResponseData>;

/**
 * Resources list response data
 */
export interface ResourcesListResponseData {
  resources: McpResource[];
  resourceTemplates?: McpResourceTemplate[];
}

/**
 * Resources list API response
 */
export type ResourcesListResponse = ApiResponse<ResourcesListResponseData>;

/**
 * Resource read response data
 */
export interface ResourceReadResponseData {
  contents: McpResourceContents[];
}

/**
 * Resource read API response
 */
export type ResourceReadResponse = ApiResponse<ResourceReadResponseData>;

/**
 * Prompts list response data
 */
export interface PromptsListResponseData {
  prompts: McpPrompt[];
}

/**
 * Prompts list API response
 */
export type PromptsListResponse = ApiResponse<PromptsListResponseData>;

/**
 * Prompt get response data
 */
export interface PromptGetResponseData {
  description?: string;
  messages: McpPromptMessage[];
}

/**
 * Prompt get API response
 */
export type PromptGetResponse = ApiResponse<PromptGetResponseData>;

/**
 * Sessions list response data
 */
export interface SessionsListResponseData {
  sessions: SessionInfo[];
  count: number;
}

/**
 * Sessions list API response
 */
export type SessionsListResponse = ApiResponse<SessionsListResponseData>;

/**
 * Sessions delete response data
 */
export interface SessionsDeleteResponseData {
  deleted: number;
}

/**
 * Sessions delete API response
 */
export type SessionsDeleteResponse = ApiResponse<SessionsDeleteResponseData>;

/**
 * Health check response data
 */
export interface HealthResponseData {
  status: string;
  activeSessions?: number;
  sessions?: {
    active: number;
  };
  uptime: number;
  version: string;
  timestamp: string;
}

/**
 * Health check API response
 */
export type HealthResponse = ApiResponse<HealthResponseData>;

// ============================================================================
// Request Types (for convenience)
// ============================================================================

/**
 * Connect request body
 */
export interface ConnectRequestBody {
  transport: TransportConfig;
  generatedCode?: string;
}

/**
 * Tool call request body
 */
export interface ToolCallRequestBody {
  sessionId: string;
  toolName: string;
  params?: Record<string, unknown>;
}

/**
 * Resource read request body
 */
export interface ResourceReadRequestBody {
  sessionId: string;
  uri: string;
}

/**
 * Prompt get request body
 */
export interface PromptGetRequestBody {
  sessionId: string;
  name: string;
  args?: Record<string, string>;
}

/**
 * Disconnect request body
 */
export interface DisconnectRequestBody {
  sessionId: string;
}

/**
 * Sessions delete request body
 */
export interface SessionsDeleteRequestBody {
  sessionId?: string; // if omitted, deletes all
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

/**
 * API request log entry
 */
export interface ApiRequestLog {
  timestamp: string;
  method: string;
  path: string;
  duration: number;
  status: number;
  sessionId?: string;
  error?: string;
}
