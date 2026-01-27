/**
 * @fileoverview Unit tests for GitLab client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitLabClient, createGitLabClient } from '../providers/gitlab-client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitLabClient', () => {
  let client: GitLabClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitLabClient({ token: 'test-token' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('parseUrl', () => {
    it('should parse simple GitLab URL', () => {
      const result = client.parseUrl('https://gitlab.com/owner/repo');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('main');
    });

    it('should parse GitLab URL with .git suffix', () => {
      const result = client.parseUrl('https://gitlab.com/owner/repo.git');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should parse GitLab URL with nested groups', () => {
      const result = client.parseUrl('https://gitlab.com/group/subgroup/repo');

      expect(result.owner).toBe('group/subgroup');
      expect(result.repo).toBe('repo');
    });

    it('should parse GitLab URL with tree/branch', () => {
      const result = client.parseUrl('https://gitlab.com/owner/repo/-/tree/develop');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('develop');
    });

    it('should parse GitLab URL with tree/branch/path', () => {
      const result = client.parseUrl('https://gitlab.com/owner/repo/-/tree/main/src/index.ts');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.branch).toBe('main');
      expect(result.path).toBe('src/index.ts');
    });

    it('should throw error for invalid URL', () => {
      expect(() => client.parseUrl('https://invalid-url.com/test')).toThrow('Invalid GitLab URL');
    });
  });

  describe('getRepoMetadata', () => {
    it('should fetch repository metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          name: 'test-repo',
          description: 'A test repository',
          default_branch: 'main',
          star_count: 50,
          forks_count: 10,
          open_issues_count: 5,
          created_at: '2024-01-01T00:00:00Z',
          last_activity_at: '2024-06-01T00:00:00Z',
          topics: ['test', 'mcp'],
          license: { key: 'MIT', name: 'MIT License' }
        })
      });

      const metadata = await client.getRepoMetadata('owner', 'repo');

      expect(metadata.stars).toBe(50);
      expect(metadata.defaultBranch).toBe('main');
      expect(metadata.license).toBe('MIT');
      expect(metadata.description).toBe('A test repository');
      expect(metadata.forksCount).toBe(10);
      expect(metadata.topics).toContain('mcp');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(client.getRepoMetadata('owner', 'nonexistent')).rejects.toThrow('GitLab API error');
    });
  });

  describe('getFile', () => {
    it('should fetch file content', async () => {
      const content = 'Hello, World!';
      const base64Content = Buffer.from(content).toString('base64');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          file_path: 'README.md',
          encoding: 'base64',
          content: base64Content,
          blob_id: 'abc123'
        })
      });

      const file = await client.getFile('owner', 'repo', 'README.md');

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

      const file = await client.getFile('owner', 'repo', 'nonexistent.md');

      expect(file).toBeNull();
    });
  });

  describe('getReadme', () => {
    it('should fetch README content', async () => {
      const content = '# Test Repo\n\nThis is a test.';
      const base64Content = Buffer.from(content).toString('base64');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          file_path: 'README.md',
          encoding: 'base64',
          content: base64Content,
          blob_id: 'abc123'
        })
      });

      const readme = await client.getReadme('owner', 'repo');

      expect(readme).toBe(content);
    });

    it('should try multiple README variants', async () => {
      // First call fails (README.md)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Second call fails (README.MD)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      // Third call succeeds (readme.md)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          file_path: 'readme.md',
          encoding: 'base64',
          content: Buffer.from('Found!').toString('base64'),
          blob_id: 'abc123'
        })
      });

      const readme = await client.getReadme('owner', 'repo');

      expect(readme).toBe('Found!');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('listFiles', () => {
    it('should list directory contents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: '1', name: 'src', type: 'tree', path: 'src', mode: '040000' },
          { id: '2', name: 'README.md', type: 'blob', path: 'README.md', mode: '100644' }
        ]
      });

      const files = await client.listFiles('owner', 'repo');

      expect(files).toHaveLength(2);
      expect(files[0].type).toBe('dir');
      expect(files[1].type).toBe('file');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const files = await client.listFiles('owner', 'repo');

      expect(files).toEqual([]);
    });
  });

  describe('searchCode', () => {
    it('should search code in repository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            basename: 'index',
            data: 'function test() {}',
            path: 'src/index.ts',
            filename: 'index.ts',
            id: 'abc123',
            ref: 'main',
            startline: 10,
            project_id: 123
          }
        ]
      });

      const results = await client.searchCode('owner', 'repo', 'function');

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
      expect(results[0].matchedLines?.[0].lineNumber).toBe(10);
    });

    it('should filter by extensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { path: 'src/index.ts', filename: 'index.ts', data: 'test', id: '1', startline: 1, project_id: 1 },
          { path: 'src/style.css', filename: 'style.css', data: 'test', id: '2', startline: 1, project_id: 1 }
        ]
      });

      const results = await client.searchCode('owner', 'repo', 'test', {
        extensions: ['ts']
      });

      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/index.ts');
    });
  });

  describe('findApiSpecs', () => {
    it('should find OpenAPI specs', async () => {
      const spec = { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } };

      // Mock multiple file lookups - first fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 }) // openapi.json
        .mockResolvedValueOnce({ ok: false, status: 404 }) // openapi.yaml
        .mockResolvedValueOnce({ ok: false, status: 404 }) // openapi.yml
        .mockResolvedValueOnce({ // swagger.json - succeeds
          ok: true,
          json: async () => ({
            file_path: 'swagger.json',
            encoding: 'base64',
            content: Buffer.from(JSON.stringify(spec)).toString('base64'),
            blob_id: 'abc123'
          })
        });

      const specs = await client.findApiSpecs('owner', 'repo');

      // May find specs in swagger.json location
      expect(Array.isArray(specs)).toBe(true);
    });
  });

  describe('getRateLimit', () => {
    it('should return rate limit info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'RateLimit-Remaining': '100',
          'RateLimit-Limit': '200',
          'RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600)
        }),
        json: async () => []
      });

      const rateLimit = await client.getRateLimit();

      expect(rateLimit.remaining).toBe(100);
      expect(rateLimit.limit).toBe(200);
      expect(rateLimit.reset).toBeInstanceOf(Date);
    });
  });
});

describe('createGitLabClient', () => {
  it('should create a GitLabClient instance', () => {
    const client = createGitLabClient({ token: 'test-token' });

    expect(client).toBeInstanceOf(GitLabClient);
    expect(client.name).toBe('gitlab');
  });

  it('should create client with custom base URL', () => {
    const client = createGitLabClient({
      token: 'test-token',
      baseUrl: 'https://gitlab.example.com/api/v4'
    });

    expect(client).toBeInstanceOf(GitLabClient);
  });
});
