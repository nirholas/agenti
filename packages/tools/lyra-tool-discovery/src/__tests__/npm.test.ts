import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NpmSource } from '../sources/npm.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NpmSource', () => {
  let npm: NpmSource;

  beforeEach(() => {
    npm = new NpmSource();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchMCPServers', () => {
    it('should search for crypto MCP packages', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          objects: [
            {
              package: {
                name: '@crypto/mcp-server',
                version: '1.0.0',
                description: 'A crypto MCP server',
                keywords: ['mcp', 'crypto'],
                author: { name: 'author' },
                links: {
                  npm: 'https://www.npmjs.com/package/@crypto/mcp-server',
                  homepage: 'https://example.com',
                  repository: 'https://github.com/crypto/mcp-server',
                },
                publisher: { username: 'publisher' },
              },
            },
          ],
        }),
      });

      const tools = await npm.searchMCPServers(1);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toMatchObject({
        id: 'npm:@crypto/mcp-server',
        name: '@crypto/mcp-server',
        source: 'npm',
      });
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          objects: [],
        }),
      });

      const tools = await npm.searchMCPServers(10);

      expect(tools).toHaveLength(0);
    });

    it('should detect MCP support from dependencies', async () => {
      // Search result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objects: [
            {
              package: {
                name: 'my-mcp-tool',
                version: '1.0.0',
                description: 'Tool with MCP',
                links: {
                  npm: 'https://npm.com/my-mcp-tool',
                },
                publisher: { username: 'user' },
              },
            },
          ],
        }),
      });

      // Full package info with MCP SDK dependency
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'my-mcp-tool',
          version: '1.0.0',
          description: 'Tool with MCP',
          dependencies: {
            '@modelcontextprotocol/sdk': '^1.0.0',
          },
          'dist-tags': { latest: '1.0.0' },
          versions: {
            '1.0.0': {
              dependencies: {
                '@modelcontextprotocol/sdk': '^1.0.0',
              },
            },
          },
        }),
      });

      const tools = await npm.searchMCPServers(1);

      expect(tools).toHaveLength(1);
      expect(tools[0].hasMCPSupport).toBe(true);
    });

    it('should detect CLI tools from bin field', async () => {
      // Search result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objects: [
            {
              package: {
                name: 'mcp-cli-tool',
                version: '1.0.0',
                description: 'CLI tool',
                links: { npm: 'https://npm.com/mcp-cli-tool' },
                publisher: { username: 'user' },
              },
            },
          ],
        }),
      });

      // Full package info with bin
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'mcp-cli-tool',
          version: '1.0.0',
          bin: { 'mcp-cli': './bin/cli.js' },
          'dist-tags': { latest: '1.0.0' },
          versions: {
            '1.0.0': {
              bin: { 'mcp-cli': './bin/cli.js' },
            },
          },
        }),
      });

      const tools = await npm.searchMCPServers(1);

      expect(tools).toHaveLength(1);
      expect(tools[0].mcpConfig).toMatchObject({
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'mcp-cli-tool'],
      });
    });
  });

  describe('getPackageAsTool', () => {
    it('should convert npm package to discovered tool', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'test-package',
          version: '2.0.0',
          description: 'Test package',
          license: 'MIT',
          author: { name: 'Test Author' },
          homepage: 'https://test.com',
          repository: { url: 'https://github.com/test/test' },
          keywords: ['mcp', 'test'],
          readme: '# Test Package',
          'dist-tags': { latest: '2.0.0' },
          versions: {
            '2.0.0': {
              name: 'test-package',
              version: '2.0.0',
              dependencies: {},
            },
          },
        }),
      });

      const tool = await npm.getPackageAsTool('test-package');

      expect(tool).toMatchObject({
        id: 'npm:test-package',
        name: 'test-package',
        source: 'npm',
        license: 'MIT',
        author: 'Test Author',
      });
    });

    it('should return null for non-existent package', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const tool = await npm.getPackageAsTool('non-existent-package');

      expect(tool).toBeNull();
    });
  });
});
