import { describe, it, expect } from 'vitest';
import {
  parseAIResponse,
  safeParseAIResponse,
  isValidTemplate,
  PluginTemplateSchema,
  MCPHttpConfigSchema,
  MCPStdioConfigSchema,
} from '../schemas.js';

describe('schemas', () => {
  describe('PluginTemplateSchema', () => {
    it('should accept valid templates', () => {
      const validTemplates = [
        'mcp-http',
        'mcp-stdio',
        'openapi',
        'basic',
        'default',
        'markdown',
        'standalone',
        'settings',
      ];

      for (const template of validTemplates) {
        expect(PluginTemplateSchema.safeParse(template).success).toBe(true);
      }
    });

    it('should reject invalid templates', () => {
      expect(PluginTemplateSchema.safeParse('invalid').success).toBe(false);
      expect(PluginTemplateSchema.safeParse('').success).toBe(false);
      expect(PluginTemplateSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('MCPHttpConfigSchema', () => {
    it('should accept valid HTTP config', () => {
      const config = {
        type: 'http',
        url: 'https://example.com/mcp',
      };

      expect(MCPHttpConfigSchema.safeParse(config).success).toBe(true);
    });

    it('should accept HTTP config with auth', () => {
      const config = {
        type: 'http',
        url: 'https://example.com/mcp',
        auth: {
          type: 'bearer',
          token: 'abc123',
        },
      };

      expect(MCPHttpConfigSchema.safeParse(config).success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const config = {
        type: 'http',
        url: 'not-a-url',
      };

      expect(MCPHttpConfigSchema.safeParse(config).success).toBe(false);
    });
  });

  describe('MCPStdioConfigSchema', () => {
    it('should accept valid STDIO config', () => {
      const config = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'mcp-server'],
      };

      expect(MCPStdioConfigSchema.safeParse(config).success).toBe(true);
    });

    it('should accept STDIO config with env', () => {
      const config = {
        type: 'stdio',
        command: 'node',
        args: ['./server.js'],
        env: {
          API_KEY: 'secret',
        },
      };

      expect(MCPStdioConfigSchema.safeParse(config).success).toBe(true);
    });

    it('should require command', () => {
      const config = {
        type: 'stdio',
        args: ['-y', 'mcp-server'],
      };

      expect(MCPStdioConfigSchema.safeParse(config).success).toBe(false);
    });
  });

  describe('parseAIResponse', () => {
    it('should parse valid MCP plugin response', () => {
      const response = {
        template: 'mcp-stdio',
        reasoning: 'Has MCP SDK and bin entry',
        config: {
          identifier: 'my-mcp-tool',
          customParams: {
            mcp: {
              type: 'stdio',
              command: 'npx',
              args: ['-y', 'my-mcp-tool'],
            },
            description: 'A great tool',
          },
        },
      };

      const result = parseAIResponse(response);

      expect(result.template).toBe('mcp-stdio');
      expect(result.reasoning).toBe('Has MCP SDK and bin entry');
    });

    it('should parse valid standard plugin response', () => {
      const response = {
        template: 'openapi',
        reasoning: 'Has OpenAPI spec',
        config: {
          identifier: 'my-api',
          manifest: 'https://example.com/manifest.json',
          author: 'me',
          meta: {
            title: 'My API',
            description: 'An API plugin',
          },
        },
      };

      const result = parseAIResponse(response);

      expect(result.template).toBe('openapi');
    });

    it('should throw on invalid response', () => {
      const invalidResponse = {
        template: 'invalid-template',
        reasoning: 'Test',
        config: {},
      };

      expect(() => parseAIResponse(invalidResponse)).toThrow();
    });
  });

  describe('safeParseAIResponse', () => {
    it('should return parsed result for valid input', () => {
      const response = {
        template: 'basic',
        reasoning: 'Simple utility',
        config: {
          identifier: 'util',
          meta: {
            title: 'Utility',
            description: 'A utility',
          },
        },
      };

      const result = safeParseAIResponse(response);

      expect(result).not.toBeNull();
      expect(result?.template).toBe('basic');
    });

    it('should return null for invalid input', () => {
      const result = safeParseAIResponse({ invalid: true });

      expect(result).toBeNull();
    });
  });

  describe('isValidTemplate', () => {
    it('should return true for valid templates', () => {
      expect(isValidTemplate('mcp-http')).toBe(true);
      expect(isValidTemplate('mcp-stdio')).toBe(true);
      expect(isValidTemplate('openapi')).toBe(true);
    });

    it('should return false for invalid templates', () => {
      expect(isValidTemplate('invalid')).toBe(false);
      expect(isValidTemplate('')).toBe(false);
    });
  });
});
