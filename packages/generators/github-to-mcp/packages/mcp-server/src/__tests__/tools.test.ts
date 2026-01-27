/**
 * Tests for MCP server tools
 */
import { describe, it, expect } from 'vitest';
import {
  generateOpenApiTool,
  handleGenerateOpenApi,
} from '../tools/generate-openapi.js';
import {
  exportDockerTool,
  handleExportDocker,
} from '../tools/export-docker.js';
import {
  streamConvertTool,
  listProvidersTool,
  handleListProviders,
  SUPPORTED_PROVIDERS,
} from '../tools/stream-convert.js';

describe('MCP Server Tools', () => {
  describe('generate_openapi_spec tool', () => {
    it('should have correct tool definition', () => {
      expect(generateOpenApiTool.name).toBe('generate_openapi_spec');
      expect(generateOpenApiTool.description).toContain('OpenAPI 3.1');
      expect(generateOpenApiTool.inputSchema.properties).toHaveProperty('files');
      expect(generateOpenApiTool.inputSchema.required).toContain('files');
    });

    it('should generate OpenAPI spec from Express code', async () => {
      const result = await handleGenerateOpenApi({
        files: [
          {
            path: 'app.js',
            content: `
const express = require('express');
const app = express();

/**
 * Get all users
 * @tag Users
 */
app.get('/users', (req, res) => {
  res.json([]);
});

/**
 * Create user
 * @tag Users
 */
app.post('/users', (req, res) => {
  res.status(201).json(req.body);
});
            `,
          },
        ],
        format: 'both',
      });

      expect(result.type).toBe('text');
      expect(result.text).toContain('Generated OpenAPI Specification');
      expect(result.text).toContain('Framework Detected');
      expect(result.text).toContain('/users');
    });

    it('should handle empty files', async () => {
      const result = await handleGenerateOpenApi({
        files: [
          {
            path: 'empty.js',
            content: '// No routes here',
          },
        ],
      });

      expect(result.type).toBe('text');
      // Should still return a valid result with warnings
    });
  });

  describe('export_docker tool', () => {
    it('should have correct tool definition', () => {
      expect(exportDockerTool.name).toBe('export_docker');
      expect(exportDockerTool.description).toContain('Docker');
      expect(exportDockerTool.inputSchema.properties).toHaveProperty('language');
      expect(exportDockerTool.inputSchema.required).toContain('language');
    });

    it('should generate TypeScript Docker config', async () => {
      const result = await handleExportDocker({
        language: 'typescript',
        server_name: 'my-mcp-server',
      });

      expect(result.type).toBe('text');
      expect(result.text).toContain('Dockerfile');
      expect(result.text).toContain('docker-compose.yml');
      expect(result.text).toContain('.dockerignore');
      expect(result.text).toContain('node:20-slim');
      expect(result.text).toContain('my-mcp-server');
    });

    it('should generate Python Docker config', async () => {
      const result = await handleExportDocker({
        language: 'python',
        server_name: 'py-mcp-server',
      });

      expect(result.type).toBe('text');
      expect(result.text).toContain('python:3.11-slim');
      expect(result.text).toContain('requirements.txt');
      expect(result.text).toContain('py-mcp-server');
    });

    it('should include healthcheck when requested', async () => {
      const result = await handleExportDocker({
        language: 'typescript',
        include_healthcheck: true,
      });

      expect(result.text).toContain('HEALTHCHECK');
    });

    it('should include port mapping when specified', async () => {
      const result = await handleExportDocker({
        language: 'typescript',
        port: 3000,
      });

      expect(result.text).toContain('3000:3000');
    });

    it('should include environment variables', async () => {
      const result = await handleExportDocker({
        language: 'typescript',
        env_vars: {
          API_KEY: 'secret',
          DEBUG: 'true',
        },
      });

      expect(result.text).toContain('API_KEY=secret');
      expect(result.text).toContain('DEBUG=true');
    });
  });

  describe('stream_convert tool', () => {
    it('should have correct tool definition', () => {
      expect(streamConvertTool.name).toBe('stream_convert');
      expect(streamConvertTool.description).toContain('streaming');
      expect(streamConvertTool.inputSchema.properties).toHaveProperty('github_url');
      expect(streamConvertTool.inputSchema.required).toContain('github_url');
    });
  });

  describe('list_providers tool', () => {
    it('should have correct tool definition', () => {
      expect(listProvidersTool.name).toBe('list_providers');
      expect(listProvidersTool.description).toContain('AI providers');
    });

    it('should list all supported providers', async () => {
      const result = await handleListProviders({});

      expect(result.type).toBe('text');
      expect(result.text).toContain('Supported AI Providers');
      
      for (const provider of SUPPORTED_PROVIDERS) {
        expect(result.text).toContain(provider.name);
      }
    });

    it('should include example configurations', async () => {
      const result = await handleListProviders({
        include_examples: true,
      });

      expect(result.text).toContain('Example Configuration');
      expect(result.text).toContain('mcpServers');
    });

    it('should hide examples when not requested', async () => {
      const result = await handleListProviders({
        include_examples: false,
      });

      expect(result.text).not.toContain('Example Configuration');
    });
  });

  describe('SUPPORTED_PROVIDERS', () => {
    it('should include Claude Desktop', () => {
      const claude = SUPPORTED_PROVIDERS.find(p => p.id === 'claude-desktop');
      expect(claude).toBeDefined();
      expect(claude?.configFormat).toBe('json');
    });

    it('should include Cursor', () => {
      const cursor = SUPPORTED_PROVIDERS.find(p => p.id === 'cursor');
      expect(cursor).toBeDefined();
    });

    it('should include VS Code Copilot', () => {
      const vscode = SUPPORTED_PROVIDERS.find(p => p.id === 'vscode-copilot');
      expect(vscode).toBeDefined();
    });

    it('should have all required fields', () => {
      for (const provider of SUPPORTED_PROVIDERS) {
        expect(provider.name).toBeDefined();
        expect(provider.id).toBeDefined();
        expect(provider.description).toBeDefined();
        expect(provider.configFormat).toBeDefined();
        expect(provider.configPath).toBeDefined();
      }
    });
  });
});
