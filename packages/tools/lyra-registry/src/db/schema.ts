import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Tools table - Main registry of all Lyra ecosystem tools
 */
export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    version: text('version').notNull().default('1.0.0'),

    // Source info
    sourceType: text('source_type').notNull().default('manual'), // 'github', 'manual', 'discovered'
    sourceUrl: text('source_url'),
    mcpServerUrl: text('mcp_server_url'),
    repositoryUrl: text('repository_url'),

    // Schema
    inputSchema: jsonb('input_schema').notNull().$type<Record<string, unknown>>(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),

    // Scoring (using SperaxOS algorithm)
    scoreData: jsonb('score_data').$type<ScoreData>(),
    totalScore: integer('total_score').notNull().default(0),
    maxScore: integer('max_score').notNull().default(100),
    percentage: integer('percentage').notNull().default(0),
    grade: text('grade').notNull().default('f'), // 'a', 'b', 'f'

    // Metadata
    tags: text('tags').array(),
    chains: text('chains').array(), // ['ethereum', 'bsc', 'solana', etc.]
    protocols: text('protocols').array(), // ['uniswap', 'aave', 'compound', etc.]
    requiresApiKey: boolean('requires_api_key').notNull().default(false),
    apiKeyName: text('api_key_name'), // e.g., 'COINGECKO_API_KEY'

    // Audit flags (used for scoring)
    isValidated: boolean('is_validated').notNull().default(false),
    isClaimed: boolean('is_claimed').notNull().default(false),
    hasTools: boolean('has_tools').notNull().default(true),
    hasReadme: boolean('has_readme').notNull().default(false),
    hasLicense: boolean('has_license').notNull().default(false),
    hasDeployment: boolean('has_deployment').notNull().default(false),
    hasDeployMoreThanManual: boolean('has_deploy_more_than_manual').notNull().default(false),
    hasPrompts: boolean('has_prompts').notNull().default(false),
    hasResources: boolean('has_resources').notNull().default(false),

    // Usage stats
    downloadCount: integer('download_count').notNull().default(0),
    usageCount: integer('usage_count').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastVerifiedAt: timestamp('last_verified_at'),
  },
  (table) => ({
    nameIdx: index('tools_name_idx').on(table.name),
    categoryIdx: index('tools_category_idx').on(table.category),
    gradeIdx: index('tools_grade_idx').on(table.grade),
    tagsIdx: index('tools_tags_idx').on(table.tags),
    chainsIdx: index('tools_chains_idx').on(table.chains),
  })
);

/**
 * Categories table - Tool categories with metadata
 */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  toolCount: integer('tool_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * MCP Servers table - Registered MCP server endpoints
 */
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull().unique(),
  description: text('description'),
  version: text('version'),
  toolCount: integer('tool_count').default(0),
  isActive: boolean('is_active').default(true),
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: text('health_status').default('unknown'), // 'healthy', 'unhealthy', 'unknown'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Tool usage logs - Track tool usage for trending/analytics
 */
export const toolUsageLogs = pgTable(
  'tool_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolId: uuid('tool_id')
      .references(() => tools.id, { onDelete: 'cascade' })
      .notNull(),
    action: text('action').notNull(), // 'view', 'download', 'install', 'call'
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    toolIdIdx: index('tool_usage_tool_id_idx').on(table.toolId),
    createdAtIdx: index('tool_usage_created_at_idx').on(table.createdAt),
  })
);

/**
 * Discovery queue - Tools pending review from auto-discovery
 */
export const discoveryQueue = pgTable('discovery_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  sourceUrl: text('source_url').notNull(),
  sourceType: text('source_type').notNull().default('github'),
  rawData: jsonb('raw_data').$type<Record<string, unknown>>(),
  securityScore: integer('security_score'),
  qualityScore: integer('quality_score'),
  status: text('status').default('pending'), // 'pending', 'approved', 'rejected'
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

// Type for score data stored in JSON
export interface ScoreData {
  hasValidated: boolean;
  hasTools: boolean;
  hasDeployment: boolean;
  hasDeployMoreThanManual: boolean;
  hasReadme: boolean;
  hasLicense: boolean;
  hasPrompts: boolean;
  hasResources: boolean;
  hasClaimed: boolean;
}

// Infer types from schema
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type McpServer = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
export type ToolUsageLog = typeof toolUsageLogs.$inferSelect;
export type DiscoveryQueueItem = typeof discoveryQueue.$inferSelect;
