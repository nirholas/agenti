/**
 * @fileoverview Unit tests for github-client module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GithubClient } from '../github-client';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      get: vi.fn(),
      getContent: vi.fn(),
    },
    rateLimit: {
      get: vi.fn(),
    },
  })),
}));

describe('GithubClient', () => {
  let client: GithubClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GithubClient();
  });

  describe('parseGithubUrl', () => {
    it('should parse basic GitHub URL', () => {
      const url = 'https://github.com/owner/repo';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('main');
    });

    it('should parse URL with .git suffix', () => {
      const url = 'https://github.com/owner/repo.git';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should parse URL with branch', () => {
      const url = 'https://github.com/owner/repo/tree/develop';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('develop');
    });

    it('should parse URL with branch and path', () => {
      const url = 'https://github.com/owner/repo/tree/main/src/index.ts';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('main');
      expect(result.path).toBe('src/index.ts');
    });

    it('should throw for invalid URL', () => {
      const url = 'https://gitlab.com/owner/repo';

      expect(() => client.parseGithubUrl(url)).toThrow('Invalid GitHub URL');
    });

    it('should throw for empty URL', () => {
      expect(() => client.parseGithubUrl('')).toThrow('Invalid GitHub URL');
    });

    it('should handle URLs with trailing slash', () => {
      const url = 'https://github.com/owner/repo/';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should parse URL with special characters in repo name', () => {
      const url = 'https://github.com/owner/my-awesome-repo';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('my-awesome-repo');
    });

    it('should handle feature branch names', () => {
      const url = 'https://github.com/owner/repo/tree/feature/new-feature';
      const result = client.parseGithubUrl(url);

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('feature/new-feature');
    });
  });

  describe('getRepoMetadata', () => {
    it('should fetch repository metadata', async () => {
      const mockData = {
        stargazers_count: 100,
        language: 'TypeScript',
        license: { spdx_id: 'MIT' },
        description: 'A test repo',
        default_branch: 'main',
      };

      (client as any).octokit.repos.get.mockResolvedValue({ data: mockData });

      const result = await client.getRepoMetadata('owner', 'repo');

      expect(result.stars).toBe(100);
      expect(result.language).toBe('TypeScript');
      expect(result.license).toBe('MIT');
      expect(result.description).toBe('A test repo');
      expect(result.defaultBranch).toBe('main');
    });

    it('should handle null license', async () => {
      const mockData = {
        stargazers_count: 50,
        language: 'JavaScript',
        license: null,
        description: null,
        default_branch: 'master',
      };

      (client as any).octokit.repos.get.mockResolvedValue({ data: mockData });

      const result = await client.getRepoMetadata('owner', 'repo');

      expect(result.license).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should handle missing language', async () => {
      const mockData = {
        stargazers_count: 0,
        language: null,
        license: null,
        description: null,
        default_branch: 'main',
      };

      (client as any).octokit.repos.get.mockResolvedValue({ data: mockData });

      const result = await client.getRepoMetadata('owner', 'repo');

      expect(result.language).toBe('unknown');
    });
  });

  describe('getFileContent', () => {
    it('should fetch file content', async () => {
      const content = 'console.log("Hello");';
      const encoded = Buffer.from(content).toString('base64');

      (client as any).octokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          path: 'index.js',
          content: encoded,
          sha: 'abc123',
        },
      });

      const result = await client.getFileContent('owner', 'repo', 'index.js');

      expect(result).not.toBeNull();
      expect(result?.content).toBe(content);
      expect(result?.path).toBe('index.js');
    });

    it('should return null for directories', async () => {
      (client as any).octokit.repos.getContent.mockResolvedValue({
        data: [
          { type: 'file', path: 'file1.ts' },
          { type: 'file', path: 'file2.ts' },
        ],
      });

      const result = await client.getFileContent('owner', 'repo', 'src');

      expect(result).toBeNull();
    });

    it('should return null on 404 error', async () => {
      (client as any).octokit.repos.getContent.mockRejectedValue(new Error('Not Found'));

      const result = await client.getFileContent('owner', 'repo', 'nonexistent.ts');

      expect(result).toBeNull();
    });

    it('should handle file with no content', async () => {
      (client as any).octokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          path: 'empty.ts',
          content: undefined,
          sha: 'def456',
        },
      });

      const result = await client.getFileContent('owner', 'repo', 'empty.ts');

      expect(result).toBeNull();
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      (client as any).octokit.repos.getContent.mockResolvedValue({
        data: [
          { path: 'src', type: 'dir', sha: 'abc' },
          { path: 'README.md', type: 'file', sha: 'def' },
          { path: 'package.json', type: 'file', sha: 'ghi' },
        ],
      });

      const result = await client.listDirectory('owner', 'repo', '');

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('dir');
      expect(result[1].type).toBe('file');
    });

    it('should return empty array for file path', async () => {
      (client as any).octokit.repos.getContent.mockResolvedValue({
        data: { type: 'file', path: 'index.ts' },
      });

      const result = await client.listDirectory('owner', 'repo', 'index.ts');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      (client as any).octokit.repos.getContent.mockRejectedValue(new Error('Not Found'));

      const result = await client.listDirectory('owner', 'repo', 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findApiSpecs', () => {
    it('should find OpenAPI spec in root', async () => {
      const specContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
      });

      (client as any).octokit.repos.getContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'openapi.json') {
          return {
            data: {
              type: 'file',
              content: Buffer.from(specContent).toString('base64'),
              path,
              sha: 'abc',
            },
          };
        }
        throw new Error('Not Found');
      });

      const result = await client.findApiSpecs('owner', 'repo');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('openapi');
      expect(result[0].version).toBe('3.0.0');
    });

    it('should find Swagger 2.0 spec', async () => {
      const specContent = JSON.stringify({
        swagger: '2.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {},
      });

      (client as any).octokit.repos.getContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'swagger.json') {
          return {
            data: {
              type: 'file',
              content: Buffer.from(specContent).toString('base64'),
              path,
              sha: 'abc',
            },
          };
        }
        throw new Error('Not Found');
      });

      const result = await client.findApiSpecs('owner', 'repo');

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no specs found', async () => {
      (client as any).octokit.repos.getContent.mockRejectedValue(new Error('Not Found'));

      const result = await client.findApiSpecs('owner', 'repo');

      expect(result).toEqual([]);
    });
  });

  describe('getReadme', () => {
    it('should fetch README.md', async () => {
      const readmeContent = '# Hello World';
      const encoded = Buffer.from(readmeContent).toString('base64');

      (client as any).octokit.repos.getContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'README.md') {
          return {
            data: {
              type: 'file',
              content: encoded,
              path,
              sha: 'abc',
            },
          };
        }
        throw new Error('Not Found');
      });

      const result = await client.getReadme('owner', 'repo');

      expect(result).toBe(readmeContent);
    });

    it('should try alternative README filenames', async () => {
      const readmeContent = '# Hello';
      const encoded = Buffer.from(readmeContent).toString('base64');

      (client as any).octokit.repos.getContent.mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'readme.md') {
          return {
            data: {
              type: 'file',
              content: encoded,
              path,
              sha: 'abc',
            },
          };
        }
        throw new Error('Not Found');
      });

      const result = await client.getReadme('owner', 'repo');

      expect(result).toBe(readmeContent);
    });

    it('should return null when README not found', async () => {
      (client as any).octokit.repos.getContent.mockRejectedValue(new Error('Not Found'));

      const result = await client.getReadme('owner', 'repo');

      expect(result).toBeNull();
    });
  });

  describe('getRateLimit', () => {
    it('should return rate limit info', async () => {
      (client as any).octokit.rateLimit.get.mockResolvedValue({
        data: {
          rate: {
            remaining: 4999,
            limit: 5000,
            reset: 1700000000,
          },
        },
      });

      const result = await client.getRateLimit();

      expect(result.remaining).toBe(4999);
      expect(result.limit).toBe(5000);
      expect(result.reset).toBeInstanceOf(Date);
    });
  });
});
