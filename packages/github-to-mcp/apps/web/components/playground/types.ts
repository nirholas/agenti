/**
 * Playground Component Types
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

/**
 * Transport type for MCP connections
 */
export type TransportType = 'stdio' | 'sse' | 'streamable-http';

/**
 * Configuration for stdio transport
 */
export interface StdioTransportConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  generatedCode?: string;
}

/**
 * Configuration for SSE transport
 */
export interface SseTransportConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Configuration for streamable HTTP transport
 */
export interface StreamableHttpTransportConfig {
  type: 'streamable-http';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Union type for all transport configurations
 */
export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;

/**
 * MCP server capabilities
 */
export interface McpCapabilities {
  tools?: boolean | { listChanged?: boolean };
  resources?: boolean | { subscribe?: boolean; listChanged?: boolean };
  prompts?: boolean | { listChanged?: boolean };
  logging?: boolean;
  sampling?: boolean;
}

/**
 * MCP server information
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * JSON Schema type for tool input
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  additionalProperties?: boolean;
}

/**
 * JSON Schema property definition
 */
export interface JsonSchemaProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
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
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
}

/**
 * MCP Resource definition
 */
export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource contents from reading
 */
export interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * MCP Prompt definition
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt message from execution
 */
export interface PromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: TextContent | ImageContent | ResourceContent;
}

/**
 * Text content in prompt message
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content in prompt message
 */
export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * Resource content in prompt message
 */
export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

/**
 * Log entry for execution logs
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'request' | 'response' | 'error' | 'stdout' | 'stderr' | 'success';
  message: string;
  data?: unknown;
}

/**
 * Connection status type
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Capability tab type
 */
export type CapabilityTab = 'tools' | 'resources' | 'prompts';
