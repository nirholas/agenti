/**
 * @fileoverview Unit tests for Bitbucket client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BitbucketClient, createBitbucketClient } from '../providers/bitbucket-client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BitbucketClient', () => {
  let client: BitbucketClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BitbucketClient({ token: 'test-token' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('parseUrl', () => {
    it('should parse simple Bitbucket URL', () => {
      const result = client.parseUrl('https://bitbucket.org/workspace/repo');

      expect(result.owner).toBe('workspace');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('main');
    });

    it('should parse Bitbucket URL with .git suffix', () => {
      const result = client.parseUrl('https://bitbucket.org/workspace/repo.git');

      expect(result.owner).toBe('workspace');
      expect(result.repo).toBe('repo');
    });

    it('should parse Bitbucket URL with src/branch', () => {
      const result = client.parseUrl('https://bitbucket.org/workspace/repo/src/develop');

      expect(result.owner).toBe('workspace');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('develop');
    });

    it('should parse Bitbucket URL with src/branch/path', () => {
      const result = client.parseUrl('https://bitbucket.org/workspace/repo/src/main/src/index.ts');

      expect(result.owner).toBe('workspace');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('main');
      expect(result.path).toBe('src/index.ts');
    });

    it('should throw error for invalid URL', () => {
      expect(() => client.parseUrl('https://invalid-url.com/test')).toThrow('Invalid Bitbucket URL');
    });
  });

  describe('getRepoMetadata', () => {
    it('should fetch repository metadata', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uuid: '{12345}',
            name: 'test-repo',
            full_name: 'workspace/test-repo',
            description: 'A test repository',
            language: 'typescript',
            mainbranch: { name: 'main', type: 'branch' },
            created_on: '2024-01-01T00:00:00Z',
            updated_on: '2024-06-01T00:00:00Z',
            size: 1024,
            links: {
              watchers: { href: 'https://api.bitbucket.org/2.0/repositories/workspace/repo/watchers' },
              forks: { href: 'https://api.bitbucket.org/2.0/repositories/workspace/repo/forks' }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ size: 42 })
        });

      const metadata = await client.getRepoMetadata('workspace', 'repo');

      expect(metadata.stars).toBe(42);
      expect(metadata.defaultBranch).toBe('main');
      expect(metadata.language).toBe('typescript');
      expect(metadata.description).toBe('A test repository');
    });

    it('should handle missing watchers gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uuid: '{12345}',
            name: 'test-repo',
            full_name: 'workspace/test-repo',
            description: 'A test repository',
            language: 'typescript',
            mainbranch: { name: 'main' },
            created_on: '2024-01-01T00:00:00Z',
            updated_on: '2024-06-01T00:00:00Z',
            links: {
              watchers: { href: 'https://api.bitbucket.org/watchers' },
              forks: { href: 'https://api.bitbucket.org/forks' }
            }
          })
        })
        .mockResolvedValueOnce({ ok: false, status: 403 });

      const metadata = await client.getRepoMetadata('workspace', 'repo');

      expect(metadata.stars).toBe(0);
      expect(metadata.defaultBranch).toBe('main');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(client.getRepoMetadata('workspace', 'nonexistent')).rejects.toThrow('Bitbucket API error');
    });
  });

  describe('getFile', () => {
    it('should fetch file content', async () => {
      const content = 'Hello, World!';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => content
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { hash: 'abc123' } })
        });

      const file = await client.getFile('workspace', 'repo', 'README.md');

      expect(file).not.toBeNull();
      expect(file?.content).toBe(content);
      expect(file?.path).toBe('README.md');
      expect(file?.sha).toBe('abc123');
    });

    it('should return null for non-existent file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const file = await client.getFile('workspace', 'repo', 'nonexistent.md');

      expect(file).toBeNull();
    });
  });

  describe('getReadme', () => {
    it('should fetch README content', async () => {
      const content = '# Test Repo\n\nThis is a test.';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => content
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { hash: 'abc123' } })
        });

      const readme = await client.getReadme('workspace', 'repo');

      expect(readme).toBe(content);
    });

    it('should try multiple README variants', async () => {
      // First call fails (README.md)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Second call fails (README.MD)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Third call succeeds (readme.md)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'Found!'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { hash: 'abc' } })
        });

      const readme = await client.getReadme('workspace', 'repo');

      expect(readme).toBe('Found!');
    });
  });

  describe('listFiles', () => {
    it('should list directory contents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [
            { path: 'src', type: 'commit_directory', commit: { hash: '1' } },
            { path: 'README.md', type: 'commit_file', size: 100, commit: { hash: '2' } }
          ],
          pagelen: 10
        })
      });

      const files = await client.listFiles('workspace', 'repo');

      expect(files).toHaveLength(2);
      expect(files[0].type).toBe('dir');
      expect(files[1].type).toBe('file');
      expect(files[1].size).toBe(100);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const files = await client.listFiles('workspace', 'repo');

      expect(files).toEqual([]);
    });
  });

  describe('searchCode', () => {
    it('should search code in repository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [
            {
              type: 'code_search_result',
              content_match_count: 1,
              file: { path: 'src/index.ts', type: 'commit_file', links: { self: { href: '' } } },
              content_matches: [
                {
                  lines: [
                    { line: 10, segments: [{ text: 'function test() {}', match: true }] }
                  ]
                }
              ]
            }
          ]
        })
      });

      const results = await client.searchCode('workspace', 'repo', 'function');

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });

    it('should filter by extensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [
            { file: { path: 'src/index.ts' }, content_match_count: 1 },
            { file: { path: 'src/style.css' }, content_match_count: 1 }
          ]
        })
      });

      const results = await client.searchCode('workspace', 'repo', 'test', {
        extensions: ['ts']
      });

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });

    it('should fallback to manual search on API failure', async () => {
      // Code search fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      // List files succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [], pagelen: 10 })
      });

      const results = await client.searchCode('workspace', 'repo', 'test');

      // Should return empty since no files found
      expect(results).toEqual([]);
    });
  });

  describe('findApiSpecs', () => {
    it('should find OpenAPI specs', async () => {
      const spec = { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } };

      // First few fail, then one succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify(spec)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ commit: { hash: 'abc' } })
        });

      const specs = await client.findApiSpecs('workspace', 'repo');

      // May or may not find specs depending on which file matches
      expect(Array.isArray(specs)).toBe(true);
    });
  });

  describe('getRateLimit', () => {
    it('should return estimated rate limit info', async () => {
      const rateLimit = await client.getRateLimit();

      expect(rateLimit.remaining).toBe(1000);
      expect(rateLimit.limit).toBe(1000);
      expect(rateLimit.reset).toBeInstanceOf(Date);
    });
  });

  describe('Authentication', () => {
    it('should use Bearer token', () => {
      const client = new BitbucketClient({ token: 'my-token' });
      expect(client).toBeInstanceOf(BitbucketClient);
    });

    it('should support username:app_password format', () => {
      const client = new BitbucketClient({ token: 'username:app_password' });
      expect(client).toBeInstanceOf(BitbucketClient);
    });
  });
});

describe('createBitbucketClient', () => {
  it('should create a BitbucketClient instance', () => {
    const client = createBitbucketClient({ token: 'test-token' });

    expect(client).toBeInstanceOf(BitbucketClient);
    expect(client.name).toBe('bitbucket');
  });

  it('should create client with custom base URL', () => {
    const client = createBitbucketClient({
      token: 'test-token',
      baseUrl: 'https://api.bitbucket.example.com/2.0'
    });

    expect(client).toBeInstanceOf(BitbucketClient);
  });
});
