/**
 * Deploy Types - Cloud-hosted MCP Server infrastructure
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

export interface DeployedServer {
  id: string;
  name: string;
  description: string;
  
  // Server configuration
  tools: DeployedTool[];
  code: string;
  language: 'typescript' | 'python';
  
  // Deployment info
  endpoint: string;
  status: 'active' | 'paused' | 'error';
  region: string;
  createdAt: string;
  updatedAt: string;
  
  // Source info
  sourceRepo?: string;
  sourceUrl?: string;
  
  // Auth & Security
  apiKeyHash?: string;
  allowedOrigins?: string[];
  rateLimit: RateLimitConfig;
  
  // Usage tracking
  usage: UsageStats;
}

export interface DeployedTool {
  name: string;
  description: string;
  inputSchema: object;
  enabled: boolean;
  callCount: number;
  lastUsed?: string;
  avgLatencyMs?: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  enabled: boolean;
}

export interface UsageStats {
  totalCalls: number;
  totalCallsToday: number;
  totalCallsThisMonth: number;
  successRate: number;
  avgLatencyMs: number;
  lastUsed?: string;
  callsByTool: Record<string, number>;
  callsByDay: DailyUsage[];
  errors: ErrorLog[];
}

export interface DailyUsage {
  date: string;
  calls: number;
  errors: number;
  avgLatencyMs: number;
}

export interface ErrorLog {
  timestamp: string;
  tool: string;
  error: string;
  input?: object;
}

export interface DeployRequest {
  name: string;
  description?: string;
  code: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: object;
  }>;
  sourceRepo?: string;
  envVars?: Record<string, string>;
  rateLimit?: Partial<RateLimitConfig>;
}

export interface DeployResponse {
  success: boolean;
  server?: DeployedServer;
  error?: string;
  endpoint?: string;
  apiKey?: string; // Only returned on creation
}

export interface ServerListResponse {
  servers: DeployedServer[];
  total: number;
  hasMore: boolean;
}

// MCP Protocol Types for HTTP/SSE transport
export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: object;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: object;
  error?: {
    code: number;
    message: string;
    data?: object;
  };
}

export interface McpToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
