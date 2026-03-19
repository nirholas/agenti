/**
 * Extensions - Additional capabilities for Clodds
 */

// Diagnostics
export { createOTelExtension, type OTelConfig, type OTelExtension, type SpanContext } from './diagnostics-otel/index';

// Auth helpers
export { createCopilotProxyExtension, type CopilotProxyConfig, type CopilotProxyExtension } from './copilot-proxy/index';
export { createGoogleAuthExtension, type GoogleAuthConfig, type GoogleAuthExtension, type GeminiClient, type VertexClient } from './google-auth/index';
export { createQwenPortalExtension, type QwenPortalConfig, type QwenPortalExtension, type QwenMessage } from './qwen-portal/index';

// Memory backends
export { createLanceDBExtension, type LanceDBConfig, type LanceDBExtension, type MemoryEntry, type SearchResult } from './memory-lancedb/index';

// Task runners
export { createLLMTaskExtension, type LLMTaskConfig, type LLMTaskExtension, type Task, type TaskStatus, type TaskResult, type TaskExecutor } from './llm-task/index';

// Document editing
export { createOpenProseExtension, type OpenProseConfig, type OpenProseExtension, type Document, type EditOperation } from './open-prose/index';

// External integrations
export { createLobsterExtension, type LobsterConfig, type LobsterExtension, type LobsterStory, type LobsterComment } from './lobster/index';
