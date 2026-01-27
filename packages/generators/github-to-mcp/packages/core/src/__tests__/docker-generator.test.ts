/**
 * @fileoverview Unit tests for docker-generator module
 */

import { describe, it, expect } from 'vitest';
import {
  DockerGenerator,
  generateDockerfile,
  generateDockerCompose,
  DockerOptions,
  DockerComposeOptions
} from '../docker-generator';
import type { GenerationResult, ExtractedTool, RepoClassification, SourceBreakdown } from '../types';

// Mock GenerationResult for testing
function createMockResult(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    repo: 'owner/test-repo',
    name: 'test-repo',
    tools: [
      {
        name: 'testTool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: {}, required: [] },
        source: { type: 'readme', file: 'README.md' }
      }
    ],
    sources: [{ type: 'readme', count: 1, files: ['README.md'] }],
    classification: {
      type: 'library',
      confidence: 0.8,
      indicators: ['test']
    },
    metadata: {
      stars: 100,
      language: 'TypeScript',
      license: 'MIT',
      description: 'A test repository'
    },
    generate: () => '',
    save: async () => {},
    download: () => {},
    ...overrides
  };
}

describe('DockerGenerator', () => {
  const generator = new DockerGenerator();

  describe('generateDockerfile', () => {
    it('should generate TypeScript Dockerfile by default', () => {
      const result = createMockResult();
      const dockerfile = generator.generateDockerfile(result);

      expect(dockerfile).toContain('FROM node:20-alpine');
      expect(dockerfile).toContain('test-repo');
      expect(dockerfile).toContain('MCP Server');
      expect(dockerfile).toContain('EXPOSE');
      expect(dockerfile).toContain('USER mcpserver');
    });

    it('should generate Python Dockerfile when specified', () => {
      const result = createMockResult();
      const dockerfile = generator.generateDockerfile(result, 'python');

      expect(dockerfile).toContain('FROM python:3.11-slim');
      expect(dockerfile).toContain('requirements.txt');
      expect(dockerfile).toContain('CMD ["python", "-m", "mcp_server"]');
      expect(dockerfile).toContain('PYTHONUNBUFFERED=1');
    });

    it('should include custom base image', () => {
      const result = createMockResult();
      const options: DockerOptions = { baseImage: 'node:18-alpine' };
      const dockerfile = generator.generateDockerfile(result, 'typescript', options);

      expect(dockerfile).toContain('FROM node:18-alpine');
    });

    it('should include custom port', () => {
      const result = createMockResult();
      const options: DockerOptions = { port: 8080 };
      const dockerfile = generator.generateDockerfile(result, 'typescript', options);

      expect(dockerfile).toContain('EXPOSE 8080');
      expect(dockerfile).toContain('PORT=8080');
    });

    it('should include environment variables', () => {
      const result = createMockResult();
      const options: DockerOptions = {
        env: {
          API_KEY: 'test-key',
          DEBUG: 'true'
        }
      };
      const dockerfile = generator.generateDockerfile(result, 'typescript', options);

      expect(dockerfile).toContain('ENV API_KEY="test-key"');
      expect(dockerfile).toContain('ENV DEBUG="true"');
    });

    it('should include custom labels', () => {
      const result = createMockResult();
      const options: DockerOptions = {
        labels: {
          'com.example.version': '1.0.0'
        }
      };
      const dockerfile = generator.generateDockerfile(result, 'typescript', options);

      expect(dockerfile).toContain('LABEL com.example.version="1.0.0"');
    });

    it('should include health check when configured', () => {
      const result = createMockResult();
      const options: DockerOptions = {
        healthCheck: {
          interval: '60s',
          timeout: '20s',
          retries: 5
        }
      };
      const dockerfile = generator.generateDockerfile(result, 'typescript', options);

      expect(dockerfile).toContain('HEALTHCHECK');
      expect(dockerfile).toContain('--interval=60s');
      expect(dockerfile).toContain('--timeout=20s');
      expect(dockerfile).toContain('--retries=5');
    });
  });

  describe('generateDockerCompose', () => {
    it('should generate basic Docker Compose file', () => {
      const result = createMockResult();
      const compose = generator.generateDockerCompose(result);

      expect(compose).toContain('version:');
      expect(compose).toContain('services:');
      expect(compose).toContain('test-repo');
      expect(compose).toContain('networks:');
      expect(compose).toContain('mcp-network');
    });

    it('should include Redis service when requested', () => {
      const result = createMockResult();
      const options: DockerComposeOptions = { includeRedis: true };
      const compose = generator.generateDockerCompose(result, 'typescript', options);

      expect(compose).toContain('redis:');
      expect(compose).toContain('redis:7-alpine');
      expect(compose).toContain('redis-data:');
      expect(compose).toContain('REDIS_URL');
    });

    it('should include custom service name', () => {
      const result = createMockResult();
      const options: DockerComposeOptions = { serviceName: 'my-custom-service' };
      const compose = generator.generateDockerCompose(result, 'typescript', options);

      expect(compose).toContain('my-custom-service:');
      expect(compose).toContain('my-custom-service-mcp');
    });

    it('should include custom networks', () => {
      const result = createMockResult();
      const options: DockerComposeOptions = { networks: ['custom-network'] };
      const compose = generator.generateDockerCompose(result, 'typescript', options);

      expect(compose).toContain('custom-network:');
    });

    it('should include depends_on when specified', () => {
      const result = createMockResult();
      const options: DockerComposeOptions = {
        dependsOn: ['database', 'cache']
      };
      const compose = generator.generateDockerCompose(result, 'typescript', options);

      expect(compose).toContain('depends_on:');
      expect(compose).toContain('- database');
      expect(compose).toContain('- cache');
    });

    it('should generate Python-compatible compose file', () => {
      const result = createMockResult();
      const compose = generator.generateDockerCompose(result, 'python');

      expect(compose).toContain('python');
    });
  });

  describe('generateDockerIgnore', () => {
    it('should generate .dockerignore content', () => {
      const dockerignore = generator.generateDockerIgnore();

      expect(dockerignore).toContain('node_modules/');
      expect(dockerignore).toContain('.git/');
      expect(dockerignore).toContain('.env');
      expect(dockerignore).toContain('*.test.ts');
      expect(dockerignore).toContain('coverage/');
    });
  });

  describe('generateRequirementsTxt', () => {
    it('should generate Python requirements', () => {
      const result = createMockResult();
      const requirements = generator.generateRequirementsTxt(result);

      expect(requirements).toContain('mcp>=');
      expect(requirements).toContain('httpx>=');
      expect(requirements).toContain('pydantic>=');
    });
  });

  describe('generateDockerComposeWithInfra', () => {
    it('should include Traefik when requested', () => {
      const result = createMockResult();
      const compose = generator.generateDockerComposeWithInfra(result, 'typescript', {
        includeTraefik: true
      });

      expect(compose).toContain('traefik:');
      expect(compose).toContain('traefik:v2.10');
    });

    it('should include Prometheus when requested', () => {
      const result = createMockResult();
      const compose = generator.generateDockerComposeWithInfra(result, 'typescript', {
        includePrometheus: true
      });

      expect(compose).toContain('prometheus:');
      expect(compose).toContain('prom/prometheus');
    });
  });
});

describe('Exported functions', () => {
  it('generateDockerfile should work as standalone function', () => {
    const result = createMockResult();
    const dockerfile = generateDockerfile(result);

    expect(dockerfile).toBeTruthy();
    expect(dockerfile).toContain('FROM');
  });

  it('generateDockerCompose should work as standalone function', () => {
    const result = createMockResult();
    const compose = generateDockerCompose(result);

    expect(compose).toBeTruthy();
    expect(compose).toContain('services:');
  });
});
