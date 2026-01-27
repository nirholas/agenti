/**
 * @fileoverview Integration tests for github-to-mcp conversion
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright Copyright (c) 2024-2026 nich (nirholas)
 * @license MIT
 * @see https://github.com/nirholas/github-to-mcp
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { convertOpenApiToMcp } from '@github-to-mcp/openapi-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Integration tests - nich (x.com/nichxbt | github.com/nirholas) */
const _TEST_META = { author: 'nich', v: 1, project: 'github-to-mcp' } as const;

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

async function loadFixture(relativePath: string): Promise<string> {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  return fs.readFile(fullPath, 'utf-8');
}

// ============================================================================
// OpenAPI Conversion Tests
// ============================================================================

describe('OpenAPI to MCP Conversion', () => {
  let petstoreSpec: string;

  beforeAll(async () => {
    petstoreSpec = await loadFixture('openapi/petstore.yaml');
  });

  describe('Basic Conversion', () => {
    it('should convert Petstore OpenAPI spec to MCP tools', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);

      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
    });

    it('should extract all CRUD operations from Petstore', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);

      // Should have listPets, createPet, getPet, updatePet, deletePet
      const toolNames = result.tools.map((t: any) => t.name);
      
      expect(toolNames).toContain('listPets');
      expect(toolNames).toContain('createPet');
      expect(toolNames).toContain('getPet');
    });

    it('should generate proper input schemas', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);
      
      const listPetsTool = result.tools.find((t: any) => t.name === 'listPets');
      expect(listPetsTool).toBeDefined();
      expect(listPetsTool.inputSchema).toBeDefined();
      expect(listPetsTool.inputSchema.type).toBe('object');
      expect(listPetsTool.inputSchema.properties).toBeDefined();
      
      // Check for limit and offset parameters
      expect(listPetsTool.inputSchema.properties.limit).toBeDefined();
      expect(listPetsTool.inputSchema.properties.offset).toBeDefined();
    });

    it('should preserve descriptions from OpenAPI spec', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);
      
      const listPetsTool = result.tools.find((t: any) => t.name === 'listPets');
      expect(listPetsTool.description).toContain('pet');
    });

    it('should handle path parameters correctly', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);
      
      const getPetTool = result.tools.find((t: any) => t.name === 'getPet');
      expect(getPetTool).toBeDefined();
      expect(getPetTool.inputSchema.properties.petId).toBeDefined();
      expect(getPetTool.inputSchema.required).toContain('petId');
    });
  });

  describe('Schema Type Conversion', () => {
    it('should convert integer types correctly', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);
      
      const listPetsTool = result.tools.find((t: any) => t.name === 'listPets');
      const limitProp = listPetsTool.inputSchema.properties.limit;
      
      expect(limitProp.type).toBe('integer');
    });

    it('should handle required fields', async () => {
      const result = await convertOpenApiToMcp(petstoreSpec);
      
      const createPetTool = result.tools.find((t: any) => t.name === 'createPet');
      expect(createPetTool.inputSchema.required).toBeDefined();
    });
  });
});

// ============================================================================
// Generated Code Validation Tests
// ============================================================================

describe('Generated Code Validation', () => {
  let petstoreSpec: string;

  beforeAll(async () => {
    petstoreSpec = await loadFixture('openapi/petstore.yaml');
  });

  it('should generate tools with valid structure', async () => {
    const result = await convertOpenApiToMcp(petstoreSpec);

    for (const tool of result.tools) {
      // Every tool must have name, description, and inputSchema
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');

      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('should not have duplicate tool names', async () => {
    const result = await convertOpenApiToMcp(petstoreSpec);

    const names = result.tools.map((t: any) => t.name);
    const uniqueNames = new Set(names);
    
    expect(names.length).toBe(uniqueNames.size);
  });

  it('should generate snake_case or camelCase tool names', async () => {
    const result = await convertOpenApiToMcp(petstoreSpec);

    const validNamePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    
    for (const tool of result.tools) {
      expect(tool.name).toMatch(validNamePattern);
    }
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should handle invalid YAML gracefully', async () => {
    const invalidYaml = 'this is not: valid: yaml: [';
    
    await expect(convertOpenApiToMcp(invalidYaml)).rejects.toThrow();
  });

  it('should handle empty spec', async () => {
    const emptySpec = '';
    
    await expect(convertOpenApiToMcp(emptySpec)).rejects.toThrow();
  });

  it('should handle spec without paths', async () => {
    const noPathsSpec = `
openapi: 3.0.3
info:
  title: Empty API
  version: 1.0.0
`;
    
    const result = await convertOpenApiToMcp(noPathsSpec);
    expect(result.tools.length).toBe(0);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  let petstoreSpec: string;

  beforeAll(async () => {
    petstoreSpec = await loadFixture('openapi/petstore.yaml');
  });

  it('should convert spec within reasonable time', async () => {
    const start = Date.now();
    await convertOpenApiToMcp(petstoreSpec);
    const duration = Date.now() - start;

    // Should complete within 1 second for a small spec
    expect(duration).toBeLessThan(1000);
  });

  it('should handle multiple conversions efficiently', async () => {
    const start = Date.now();
    
    // Run 10 conversions
    await Promise.all(
      Array(10).fill(null).map(() => convertOpenApiToMcp(petstoreSpec))
    );
    
    const duration = Date.now() - start;
    
    // 10 conversions should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
  });
});
