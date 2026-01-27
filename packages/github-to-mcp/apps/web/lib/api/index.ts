/**
 * API Library Index
 *
 * Exports all API utilities for the playground API.
 */

// Error handling
export {
  ApiError,
  ValidationError,
  NotFoundError,
  McpConnectionError,
  McpExecutionError,
  SessionExpiredError,
  RateLimitError,
  InternalServerError,
  handleApiError,
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  isApiError,
  isValidationError,
  isNotFoundError,
  isMcpConnectionError,
  isMcpExecutionError,
  isSessionExpiredError,
  isRateLimitError,
} from './errors';

// Validation
export {
  validateTransportConfig,
  validateToolCall,
  validateResourceRead,
  validatePromptGet,
  validateSessionId,
  validateSessionIdFromQuery,
  validateConnectRequest,
  sanitizeCode,
} from './validation';
export type {
  TransportType,
  StdioTransportConfig,
  SseTransportConfig,
  HttpTransportConfig,
  TransportConfig,
} from './validation';

// Middleware
export {
  getRequestId,
  withRequestId,
  checkRateLimit,
  rateLimitResponse,
  getClientId,
  corsHeaders,
  corsPreflightResponse,
  parseJsonBody,
  applyMiddleware,
  BodyTooLargeError,
  InvalidJsonError,
  DEFAULT_RATE_LIMIT,
  RELAXED_RATE_LIMIT,
  STRICT_RATE_LIMIT,
  NO_RATE_LIMIT,
  DEFAULT_CORS,
} from './middleware';
export type {
  RateLimitConfig,
  CorsConfig,
  BodyParseOptions,
  ApiMiddlewareConfig,
  ApiContext,
} from './middleware';

// Logger
export {
  logger,
  createLogContext,
  timed,
} from './logger';
export type {
  RequestLogEntry,
  LogLevel,
} from './logger';

// Session Manager
export { SessionManager } from './session-manager';
export type {
  CreateSessionResult,
  ToolExecutionResult,
  PromptResult,
} from './session-manager';

// Types
export type {
  ApiResponse,
  ApiErrorData,
  McpCapabilities,
  McpServerInfo,
  McpTool,
  McpToolPropertySchema,
  McpResource,
  McpResourceTemplate,
  McpResourceContents,
  McpPrompt,
  McpPromptArgument,
  McpPromptMessage,
  McpPromptContent,
  McpToolResultContent,
  McpToolResult,
  SessionInfo,
  RateLimitHeaders,
  ApiRequestLog,
  // Response types
  ConnectResponseData,
  DisconnectResponseData,
  ToolsListResponseData,
  ToolCallResponseData,
  ResourcesListResponseData,
  ResourceReadResponseData,
  PromptsListResponseData,
  PromptGetResponseData,
  SessionsListResponseData,
  SessionsDeleteResponseData,
  HealthResponseData,
  // Request types
  ConnectRequestBody,
  ToolCallRequestBody,
  ResourceReadRequestBody,
  PromptGetRequestBody,
  DisconnectRequestBody,
  SessionsDeleteRequestBody,
} from './types';

// OpenAPI
export { openApiSpec, getOpenApiJson, getOpenApiYaml } from './openapi';
