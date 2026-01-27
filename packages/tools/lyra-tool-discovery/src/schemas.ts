/**
 * Zod schemas for validating AI responses and configs
 */
import { z } from 'zod';
import type { PluginTemplate } from './types.js';

/**
 * Valid plugin templates
 */
export const PluginTemplateSchema = z.enum([
  'mcp-http',
  'mcp-stdio',
  'openapi',
  'basic',
  'default',
  'markdown',
  'standalone',
  'settings',
]);

/**
 * MCP HTTP connection config
 */
export const MCPHttpConfigSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  auth: z.object({
    type: z.enum(['none', 'bearer', 'oauth2']),
    token: z.string().optional(),
    accessToken: z.string().optional(),
  }).optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * MCP STDIO connection config
 */
export const MCPStdioConfigSchema = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

/**
 * MCP connection (either HTTP or STDIO)
 */
export const MCPConnectionSchema = z.discriminatedUnion('type', [
  MCPHttpConfigSchema,
  MCPStdioConfigSchema,
]);

/**
 * Plugin metadata
 */
export const PluginMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  avatar: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

/**
 * Custom plugin params
 */
export const CustomPluginParamsSchema = z.object({
  mcp: MCPConnectionSchema.optional(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  manifestUrl: z.string().url().optional(),
  useProxy: z.boolean().optional(),
});

/**
 * AI analysis response for MCP plugins
 */
export const MCPPluginConfigSchema = z.object({
  identifier: z.string(),
  customParams: z.object({
    mcp: MCPConnectionSchema,
    description: z.string().optional(),
    avatar: z.string().optional(),
  }),
});

/**
 * AI analysis response for standard plugins
 */
export const StandardPluginConfigSchema = z.object({
  identifier: z.string(),
  manifest: z.string().optional(),
  author: z.string().optional(),
  meta: PluginMetaSchema.optional(),
});

/**
 * Full AI analysis response
 */
export const AIAnalysisResponseSchema = z.object({
  template: PluginTemplateSchema,
  reasoning: z.string(),
  config: z.union([MCPPluginConfigSchema, StandardPluginConfigSchema]),
});

/**
 * Validate and parse AI response
 */
export function parseAIResponse(data: unknown): z.infer<typeof AIAnalysisResponseSchema> {
  return AIAnalysisResponseSchema.parse(data);
}

/**
 * Safely parse AI response, returning null on failure
 */
export function safeParseAIResponse(data: unknown): z.infer<typeof AIAnalysisResponseSchema> | null {
  const result = AIAnalysisResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate plugin template
 */
export function isValidTemplate(template: string): template is PluginTemplate {
  return PluginTemplateSchema.safeParse(template).success;
}
