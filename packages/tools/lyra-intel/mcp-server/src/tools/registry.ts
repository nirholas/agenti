import { z } from 'zod';
import { 
  analyzeCodebaseTool, 
  searchCodeTool, 
  getComplexityTool, 
  getSecurityIssuesTool 
} from './analysis.js';
import { discoveryTools } from './discovery.js';
import { enhancedTools } from './enhanced.js';

export interface UnifiedTool {
  name: string;
  description: string;
  zodSchema: z.ZodSchema;
  prompt?: {
    description: string;
    arguments?: Record<string, unknown>;
  };
  category: string;
  execute: (args: unknown, onProgress?: (message: string) => void) => Promise<string>;
}

export interface ToolArguments {
  [key: string]: unknown;
}

export const toolRegistry: UnifiedTool[] = [
  // Analysis tools
  analyzeCodebaseTool,
  searchCodeTool,
  getComplexityTool,
  getSecurityIssuesTool,
  // Discovery tools
  ...discoveryTools,
  // Enhanced tools (diff, docs, forensics)
  ...enhancedTools,
];

export function getToolDefinitions() {
  return toolRegistry.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object' as const,
      properties: zodSchemaToJsonSchema(tool.zodSchema),
      required: getRequiredFields(tool.zodSchema),
    },
  }));
}

export function getPromptDefinitions() {
  return toolRegistry
    .filter(tool => tool.prompt)
    .map(tool => ({
      name: tool.name,
      description: tool.prompt!.description,
      arguments: tool.prompt!.arguments || extractPromptArguments(tool.zodSchema),
    }));
}

export async function executeTool(
  toolName: string,
  args: ToolArguments,
  onProgress?: (newOutput: string) => void
): Promise<string> {
  const tool = toolRegistry.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    const validatedArgs = tool.zodSchema.parse(args);
    return await tool.execute(validatedArgs, onProgress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      throw new Error(`Invalid arguments for ${toolName}: ${issues}`);
    }
    throw error;
  }
}

export function toolExists(toolName: string): boolean {
  return toolRegistry.some(t => t.name === toolName);
}

// Helper functions
function zodSchemaToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodSchema>;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      properties[key] = getJsonSchemaForField(fieldSchema);
    }
  }
  
  return properties;
}

function getJsonSchemaForField(fieldSchema: z.ZodSchema): Record<string, unknown> {
  if (fieldSchema instanceof z.ZodString) {
    return { type: 'string' };
  } else if (fieldSchema instanceof z.ZodNumber) {
    return { type: 'number' };
  } else if (fieldSchema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  } else if (fieldSchema instanceof z.ZodArray) {
    return { type: 'array' };
  } else if (fieldSchema instanceof z.ZodEnum) {
    return { 
      type: 'string',
      enum: (fieldSchema as z.ZodEnum<any>).options
    };
  }
  
  return { type: 'string' };
}

function getRequiredFields(schema: z.ZodSchema): string[] {
  const required: string[] = [];
  
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodSchema>;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      // Check if field is required (not optional)
      if (!(fieldSchema instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
  }
  
  return required;
}

function extractPromptArguments(_schema: z.ZodSchema): Record<string, unknown> {
  return {};
}
