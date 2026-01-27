/**
 * @fileoverview Integration tests for Langchain exporter
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright Copyright (c) 2024-2026 nich (nirholas)
 * @license MIT
 * @see https://github.com/nirholas/github-to-mcp
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LangchainExporter, exportToLangchain } from '../../packages/core/src/langchain-exporter';
import { convertOpenApiToMcp } from '@github-to-mcp/openapi-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Langchain tests - nich (x.com/nichxbt | github.com/nirholas) */
const _TEST_META = { author: 'nich', v: 1 } as const;

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

async function loadFixture(relativePath: string): Promise<string> {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  return fs.readFile(fullPath, 'utf-8');
}

// Sample extracted tools for testing
const SAMPLE_TOOLS = [
  {
    name: 'get_user',
    description: 'Retrieve a user by their ID',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The unique user identifier',
        },
        include_profile: {
          type: 'boolean',
          description: 'Whether to include profile details',
        },
      },
      required: ['user_id'],
    },
    source: { type: 'openapi' as const, file: 'api.yaml' },
  },
  {
    name: 'create_user',
    description: 'Create a new user account',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'User email address',
        },
        name: {
          type: 'string',
          description: 'User display name',
        },
        age: {
          type: 'integer',
          minimum: 0,
          maximum: 150,
          description: 'User age',
        },
      },
      required: ['email', 'name'],
    },
    source: { type: 'openapi' as const, file: 'api.yaml' },
  },
  {
    name: 'list_users',
    description: 'List all users with pagination',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          default: 20,
          description: 'Maximum items to return',
        },
        offset: {
          type: 'integer',
          default: 0,
          description: 'Items to skip',
        },
        filter: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
          },
          description: 'Filter criteria',
        },
      },
      required: [],
    },
    source: { type: 'openapi' as const, file: 'api.yaml' },
  },
];

// ============================================================================
// Exporter Class Tests
// ============================================================================

describe('LangchainExporter', () => {
  describe('TypeScript Export', () => {
    it('should generate valid TypeScript code', () => {
      const exporter = new LangchainExporter();
      const result = exporter.exportTypeScript(SAMPLE_TOOLS);

      // Should contain imports
      expect(result).toContain("import { DynamicStructuredTool }");
      expect(result).toContain("import { z } from 'zod'");

      // Should contain tool definitions
      expect(result).toContain('getUserTool');
      expect(result).toContain('createUserTool');
      expect(result).toContain('listUsersTool');

      // Should have proper structure
      expect(result).toContain('new DynamicStructuredTool');
      expect(result).toContain('schema:');
      expect(result).toContain('func:');
    });

    it('should generate Zod schemas with correct types', () => {
      const exporter = new LangchainExporter({ includeValidation: true });
      const result = exporter.exportTypeScript(SAMPLE_TOOLS);

      // Check string types
      expect(result).toContain('z.string()');
      
      // Check email format
      expect(result).toContain('z.string().email()');
      
      // Check integer type
      expect(result).toContain('z.number().int()');
      
      // Check boolean type
      expect(result).toContain('z.boolean()');
      
      // Check optional
      expect(result).toContain('.optional()');
    });

    it('should handle enums correctly', () => {
      const exporter = new LangchainExporter();
      const result = exporter.exportTypeScript(SAMPLE_TOOLS);

      // Should have enum definition for status
      expect(result).toContain("z.enum([");
      expect(result).toContain("'active'");
      expect(result).toContain("'inactive'");
    });

    it('should generate toolkit class when format is toolkit', () => {
      const exporter = new LangchainExporter({ format: 'toolkit', toolkitName: 'userTools' });
      const result = exporter.exportTypeScript(SAMPLE_TOOLS);

      expect(result).toContain('class UserToolsToolkit');
      expect(result).toContain('getTools()');
      expect(result).toContain('getTool(name: string)');
    });

    it('should use custom options', () => {
      const exporter = new LangchainExporter({
        toolkitName: 'myApi',
        baseUrl: 'https://api.custom.com',
        apiKeyEnvVar: 'MY_API_KEY',
      });
      const result = exporter.exportTypeScript(SAMPLE_TOOLS);

      expect(result).toContain('https://api.custom.com');
      expect(result).toContain('MY_API_KEY');
      expect(result).toContain('export const myApi');
    });
  });

  describe('Python Export', () => {
    it('should generate valid Python code', () => {
      const exporter = new LangchainExporter();
      const result = exporter.exportPython(SAMPLE_TOOLS);

      // Should contain imports
      expect(result).toContain('from langchain.tools import StructuredTool');
      expect(result).toContain('from pydantic import BaseModel, Field');
      expect(result).toContain('import httpx');

      // Should contain tool definitions
      expect(result).toContain('get_user_tool');
      expect(result).toContain('create_user_tool');
      expect(result).toContain('list_users_tool');

      // Should have proper structure
      expect(result).toContain('StructuredTool.from_function');
      expect(result).toContain('async def');
    });

    it('should generate Pydantic models with correct types', () => {
      const exporter = new LangchainExporter({ includeValidation: true });
      const result = exporter.exportPython(SAMPLE_TOOLS);

      // Check Python types
      expect(result).toContain(': str');
      expect(result).toContain(': int');
      expect(result).toContain(': bool');
      
      // Check optional types
      expect(result).toContain('| None');
      
      // Check BaseModel classes
      expect(result).toContain('class GetUserInput(BaseModel)');
      expect(result).toContain('class CreateUserInput(BaseModel)');
    });

    it('should use Field for descriptions', () => {
      const exporter = new LangchainExporter({ includeValidation: true });
      const result = exporter.exportPython(SAMPLE_TOOLS);

      expect(result).toContain('Field(');
      expect(result).toContain('description=');
    });

    it('should generate toolkit class when format is toolkit', () => {
      const exporter = new LangchainExporter({ format: 'toolkit', toolkitName: 'userTools' });
      const result = exporter.exportPython(SAMPLE_TOOLS);

      expect(result).toContain('class UserToolsToolkit');
      expect(result).toContain('def get_tools(self)');
      expect(result).toContain('def get_tool(self, name: str)');
    });
  });

  describe('Combined Export', () => {
    it('should return both TypeScript and Python exports', () => {
      const exporter = new LangchainExporter();
      const result = exporter.export(SAMPLE_TOOLS);

      expect(result.typescript).toBeDefined();
      expect(result.python).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.toolCount).toBe(3);
    });

    it('should include correct metadata', () => {
      const exporter = new LangchainExporter({ toolkitName: 'customKit' });
      const result = exporter.export(SAMPLE_TOOLS);

      expect(result.metadata.toolkitName).toBe('customKit');
      expect(result.metadata.toolCount).toBe(SAMPLE_TOOLS.length);
      expect(result.metadata.generatedAt).toBeDefined();
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('exportToLangchain factory', () => {
  it('should export tools with default options', () => {
    const result = exportToLangchain(SAMPLE_TOOLS);

    expect(result.typescript).toContain('DynamicStructuredTool');
    expect(result.python).toContain('StructuredTool');
  });

  it('should respect custom options', () => {
    const result = exportToLangchain(SAMPLE_TOOLS, {
      toolkitName: 'apiTools',
      baseUrl: 'https://custom-api.com',
    });

    expect(result.typescript).toContain('https://custom-api.com');
    expect(result.typescript).toContain('export const apiTools');
  });
});

// ============================================================================
// Integration with OpenAPI Parser
// ============================================================================

describe('Langchain Export from OpenAPI', () => {
  let petstoreSpec: string;

  beforeAll(async () => {
    petstoreSpec = await loadFixture('openapi/petstore.yaml');
  });

  it('should export OpenAPI-extracted tools to Langchain format', async () => {
    const mcpResult = await convertOpenApiToMcp(petstoreSpec);
    const langchainResult = exportToLangchain(mcpResult.tools as any);

    expect(langchainResult.typescript).toContain('listPetsTool');
    expect(langchainResult.typescript).toContain('createPetTool');
    expect(langchainResult.python).toContain('list_pets_tool');
    expect(langchainResult.python).toContain('create_pet_tool');
  });

  it('should preserve tool descriptions from OpenAPI', async () => {
    const mcpResult = await convertOpenApiToMcp(petstoreSpec);
    const langchainResult = exportToLangchain(mcpResult.tools as any);

    // Descriptions should be included
    expect(langchainResult.typescript).toContain('description:');
    expect(langchainResult.python).toContain('description=');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty tool list', () => {
    const exporter = new LangchainExporter();
    const result = exporter.export([]);

    expect(result.metadata.toolCount).toBe(0);
    expect(result.typescript).toBeDefined();
    expect(result.python).toBeDefined();
  });

  it('should handle tools without descriptions', () => {
    const toolsWithoutDesc = [
      {
        name: 'simple_tool',
        description: '',
        inputSchema: { type: 'object', properties: {}, required: [] },
        source: { type: 'code' as const, file: 'test.ts' },
      },
    ];

    const exporter = new LangchainExporter();
    const result = exporter.export(toolsWithoutDesc);

    expect(result.typescript).toContain('simple_tool');
    expect(result.python).toContain('simple_tool');
  });

  it('should handle tools with complex nested schemas', () => {
    const complexTool = [
      {
        name: 'complex_tool',
        description: 'A tool with nested schema',
        inputSchema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                nested: {
                  type: 'object',
                  properties: {
                    deep: { type: 'string' },
                  },
                },
              },
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
          required: [],
        },
        source: { type: 'code' as const, file: 'test.ts' },
      },
    ];

    const exporter = new LangchainExporter();
    const result = exporter.export(complexTool);

    expect(result.typescript).toContain('z.object');
    expect(result.typescript).toContain('z.array');
  });

  it('should escape special characters in descriptions', () => {
    const toolWithSpecialChars = [
      {
        name: 'special_tool',
        description: "Tool with 'quotes' and \"double quotes\" and `backticks`",
        inputSchema: { type: 'object', properties: {}, required: [] },
        source: { type: 'code' as const, file: 'test.ts' },
      },
    ];

    const exporter = new LangchainExporter();
    const result = exporter.export(toolWithSpecialChars);

    // Should not break the code
    expect(result.typescript).toBeDefined();
    expect(result.python).toBeDefined();
  });
});
