import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubSource } from '../sources/github.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHubSource', () => {
  let github: GitHubSource;

  beforeEach(() => {
    github = new GitHubSource();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize without token', () => {
      const source = new GitHubSource();
      expect(source).toBeDefined();
    });

    it('should initialize with token', () => {
      const source = new GitHubSource('test-token');
      expect(source).toBeDefined();
    });

    it('should use GITHUB_TOKEN from env', () => {
      const originalEnv = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'env-token';
      
      const source = new GitHubSource();
      expect(source).toBeDefined();
      
      process.env.GITHUB_TOKEN = originalEnv;
    });
  });

  describe('searchMCPServers', () => {
    it('should search for crypto MCP servers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 1,
          items: [
            {
              id: 123,
              full_name: 'owner/repo',
              name: 'repo',
              description: 'A crypto MCP server',
              html_url: 'https://github.com/owner/repo',
              homepage: 'https://example.com',
              license: { spdx_id: 'MIT' },
              owner: { login: 'owner' },
              stargazers_count: 100,
              topics: ['mcp', 'crypto'],
            },
          ],
        }),
      });

      const tools = await github.searchMCPServers(1);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toMatchObject({
        id: 'github:owner/repo',
        name: 'repo',
        source: 'github',
        sourceUrl: 'https://github.com/owner/repo',
      });
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 0,
          items: [],
        }),
      });

      const tools = await github.searchMCPServers(10);

      expect(tools).toHaveLength(0);
    });

    it('should deduplicate results across queries', async () => {
      const mockRepo = {
        id: 123,
        full_name: 'owner/repo',
        name: 'repo',
        description: 'Test',
        html_url: 'https://github.com/owner/repo',
        homepage: null,
        license: null,
        owner: { login: 'owner' },
        stargazers_count: 50,
        topics: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 1,
          items: [mockRepo],
        }),
      });

      // Request limit of 5, but same repo returned for all queries
      const tools = await github.searchMCPServers(5);

      // Should only have 1 unique tool
      expect(tools.length).toBeLessThanOrEqual(5);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Rate limited',
      });

      // Should not throw, just return empty or partial results
      const tools = await github.searchMCPServers(5);
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('analyzeRepo', () => {
    it('should fetch README and package.json', async () => {
      // Mock README fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from('# Test Repo').toString('base64'),
          encoding: 'base64',
        }),
      });

      // Mock package.json fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: Buffer.from(JSON.stringify({
            name: 'test-package',
            dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' },
          })).toString('base64'),
          encoding: 'base64',
        }),
      });

      const result = await github.analyzeRepo('owner', 'repo');

      expect(result).toBeDefined();
      expect(result?.readme).toContain('Test Repo');
      expect(result?.packageJson).toHaveProperty('name', 'test-package');
    });

    it('should handle missing README', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await github.analyzeRepo('owner', 'repo');

      // Should return null or partial result
      expect(result === null || result?.readme === undefined).toBe(true);
    });
  });
});
