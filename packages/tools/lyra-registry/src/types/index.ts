/**
 * Type definitions for Lyra Registry
 */

// Re-export database types
export type {
  Tool,
  NewTool,
  Category,
  NewCategory,
  McpServer,
  NewMcpServer,
  ToolUsageLog,
  DiscoveryQueueItem,
  ScoreData,
} from '../db/schema';

// Re-export validation types
export type {
  CreateToolInput,
  UpdateToolInput,
  SearchQuery,
  TrendingQuery,
  CreateCategoryInput,
  CreateMcpServerInput,
  SubmitDiscoveryInput,
  ApiResponse,
  PaginatedResponse,
  ToolWithScore,
} from '../lib/validation';

// Re-export scoring types
export type {
  ScoreItem,
  ScoreResult,
  ScoreListItem,
  ScoreFlags,
} from '../lib/calculateScore';

// MCP Protocol Types
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, McpPropertySchema>;
    required?: string[];
  };
}

export interface McpPropertySchema {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpToolsListResponse {
  tools: McpToolDefinition[];
}

// Registry-specific types
export interface ToolSearchResult {
  id: string;
  name: string;
  description: string;
  category: string;
  grade: string;
  totalScore: number;
  tags: string[] | null;
  chains: string[] | null;
  requiresApiKey: boolean;
}

export interface RegistryStats {
  totalTools: number;
  totalCategories: number;
  toolsByGrade: {
    a: number;
    b: number;
    f: number;
  };
  toolsByCategory: Record<string, number>;
  recentlyAdded: number;
  trending: string[];
}

export interface TrendingTool {
  id: string;
  name: string;
  description: string;
  category: string;
  grade: string;
  trendingScore: number;
  recentUsage: number;
}
