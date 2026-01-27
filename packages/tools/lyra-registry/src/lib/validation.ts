import { z } from 'zod';

/**
 * Zod validation schemas for API requests and responses
 */

// Tool input schema validation
export const toolInputSchema = z.object({
  type: z.literal('object').optional(),
  properties: z.record(z.any()).optional(),
  required: z.array(z.string()).optional(),
}).passthrough();

// Create tool request
export const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: z.string().min(1).max(50),
  version: z.string().optional().default('1.0.0'),
  
  // Source
  sourceType: z.enum(['github', 'manual', 'discovered']).optional().default('manual'),
  sourceUrl: z.string().url().optional(),
  mcpServerUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
  
  // Schema
  inputSchema: toolInputSchema,
  outputSchema: z.record(z.any()).optional(),
  
  // Metadata
  tags: z.array(z.string()).optional(),
  chains: z.array(z.string()).optional(),
  protocols: z.array(z.string()).optional(),
  requiresApiKey: z.boolean().optional().default(false),
  apiKeyName: z.string().optional(),
  
  // Audit flags
  isValidated: z.boolean().optional().default(false),
  isClaimed: z.boolean().optional().default(false),
  hasTools: z.boolean().optional().default(true),
  hasReadme: z.boolean().optional().default(false),
  hasLicense: z.boolean().optional().default(false),
  hasDeployment: z.boolean().optional().default(false),
  hasDeployMoreThanManual: z.boolean().optional().default(false),
  hasPrompts: z.boolean().optional().default(false),
  hasResources: z.boolean().optional().default(false),
});

export type CreateToolInput = z.infer<typeof createToolSchema>;

// Update tool request
export const updateToolSchema = createToolSchema.partial();

export type UpdateToolInput = z.infer<typeof updateToolSchema>;

// Search query parameters
export const searchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  chain: z.string().optional(),
  protocol: z.string().optional(),
  grade: z.enum(['a', 'b', 'f']).optional(),
  requiresApiKey: z.enum(['true', 'false']).optional(),
  tags: z.string().optional(), // Comma-separated
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'totalScore', 'downloadCount']).optional().default('totalScore'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Trending query parameters
export const trendingQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  category: z.string().optional(),
});

export type TrendingQuery = z.infer<typeof trendingQuerySchema>;

// Category schema
export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  icon: z.string().max(100).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// MCP Server schema
export const createMcpServerSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  description: z.string().max(500).optional(),
  version: z.string().optional(),
});

export type CreateMcpServerInput = z.infer<typeof createMcpServerSchema>;

// Discovery queue submission
export const submitDiscoverySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  sourceUrl: z.string().url(),
  sourceType: z.enum(['github', 'manual', 'discovered']).optional().default('discovered'),
  rawData: z.record(z.any()).optional(),
  securityScore: z.number().int().min(0).max(100).optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
});

export type SubmitDiscoveryInput = z.infer<typeof submitDiscoverySchema>;

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Tool response with score details
export interface ToolWithScore {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  sourceType: string;
  sourceUrl: string | null;
  mcpServerUrl: string | null;
  inputSchema: Record<string, unknown>;
  tags: string[] | null;
  chains: string[] | null;
  protocols: string[] | null;
  requiresApiKey: boolean;
  apiKeyName: string | null;
  
  // Score
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string;
  
  // Flags
  isValidated: boolean;
  isClaimed: boolean;
  hasTools: boolean;
  hasReadme: boolean;
  hasLicense: boolean;
  
  // Stats
  downloadCount: number;
  usageCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
