/**
 * @fileoverview Bitbucket API client implementing BaseProvider
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  AbstractProvider,
  ProviderConfig,
  ProviderRepoMetadata,
  CodeSearchResult,
  FileTreeItem,
  SearchOptions,
  RateLimitInfo
} from './base-provider';
import type { RepoMetadata, FileContent, ApiSpec } from '../types';

/**
 * Bitbucket API response interfaces
 */
interface BitbucketRepository {
  uuid: string;
  name: string;
  full_name: string;
  description: string;
  language: string;
  mainbranch?: {
    name: string;
    type: string;
  };
  created_on: string;
  updated_on: string;
  size: number;
  is_private: boolean;
  fork_policy: string;
  links: {
    watchers: { href: string };
    forks: { href: string };
  };
}

interface BitbucketFile {
  path: string;
  type: 'commit_file' | 'commit_directory';
  size?: number;
  commit: {
    hash: string;
  };
  links: {
    self: { href: string };
  };
}

interface BitbucketTreeResponse {
  values: BitbucketFile[];
  pagelen: number;
  page?: number;
  next?: string;
}

interface BitbucketSearchResult {
  type: string;
  content_match_count: number;
  path_matches: Array<{
    text: string;
    match: boolean;
  }>;
  file: {
    path: string;
    type: string;
    links: {
      self: { href: string };
    };
  };
  content_matches?: Array<{
    lines: Array<{
      line: number;
      segments: Array<{
        text: string;
        match: boolean;
      }>;
    }>;
  }>;
}

/**
 * Bitbucket provider implementation
 */
export class BitbucketClient extends AbstractProvider {
  readonly name = 'bitbucket';
  private baseUrl: string;

  constructor(config: ProviderConfig = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.bitbucket.org/2.0';
  }

  /**
   * Parse Bitbucket URL to extract workspace and repo
   */
  parseUrl(url: string): RepoMetadata {
    // Format: bitbucket.org/workspace/repo
    // With path: bitbucket.org/workspace/repo/src/branch/path

    // Handle src/branch/path pattern
    const srcMatch = url.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)\/src\/([^\/]+)(?:\/(.*))?$/);
    if (srcMatch) {
      return {
        owner: srcMatch[1],
        repo: srcMatch[2],
        branch: srcMatch[3],
        path: srcMatch[4]
      };
    }

    // Simple format: bitbucket.org/workspace/repo
    const simpleMatch = url.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)(?:\.git)?(?:\/|$|\?|#)/);
    if (simpleMatch) {
      return {
        owner: simpleMatch[1],
        repo: simpleMatch[2].replace(/\.git$/, ''),
        branch: 'main'
      };
    }

    throw new Error(`Invalid Bitbucket URL: ${url}`);
  }

  /**
   * Get authorization header for Bitbucket
   * Bitbucket uses different auth format for app passwords
   */
  protected override getAuthHeader(): Record<string, string> {
    if (!this.config.token) {
      return {};
    }
    // Check if it's a username:app_password format
    if (this.config.token.includes(':')) {
      const encoded = Buffer.from(this.config.token).toString('base64');
      return { Authorization: `Basic ${encoded}` };
    }
    return { Authorization: `Bearer ${this.config.token}` };
  }

  /**
   * Get repository metadata
   */
  async getRepoMetadata(owner: string, repo: string): Promise<ProviderRepoMetadata> {
    const url = `${this.baseUrl}/repositories/${owner}/${repo}`;

    const response = await this.fetchWithTimeout(url, {
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Bitbucket API error: ${response.status} ${response.statusText}`);
    }

    const repository = await response.json() as BitbucketRepository;

    // Get watchers count (requires separate request)
    let stars = 0;
    try {
      const watchersResponse = await this.fetchWithTimeout(repository.links.watchers.href, {
        headers: this.getAuthHeader()
      });
      if (watchersResponse.ok) {
        const watchersData = await watchersResponse.json();
        stars = (watchersData as { size?: number }).size || 0;
      }
    } catch {
      // Ignore watchers count error
    }

    return {
      stars,
      language: repository.language || 'unknown',
      description: repository.description || undefined,
      defaultBranch: repository.mainbranch?.name || 'main',
      createdAt: repository.created_on,
      updatedAt: repository.updated_on,
      size: repository.size
    };
  }

  /**
   * Get README content
   */
  async getReadme(owner: string, repo: string, branch?: string): Promise<string | null> {
    for (const filename of this.readmeFileNames) {
      const file = await this.getFile(owner, repo, filename, branch);
      if (file) {
        return file.content;
      }
    }
    return null;
  }

  /**
   * Get file content
   */
  async getFile(owner: string, repo: string, path: string, branch?: string): Promise<FileContent | null> {
    const ref = branch || 'main';
    const url = `${this.baseUrl}/repositories/${owner}/${repo}/src/${ref}/${path}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          ...this.getAuthHeader(),
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        return null;
      }

      const content = await response.text();

      // Get file metadata
      const metaUrl = `${this.baseUrl}/repositories/${owner}/${repo}/src/${ref}/${path}?format=meta`;
      let sha = '';
      try {
        const metaResponse = await this.fetchWithTimeout(metaUrl, {
          headers: this.getAuthHeader()
        });
        if (metaResponse.ok) {
          const meta = await metaResponse.json();
          sha = (meta as { commit?: { hash?: string } }).commit?.hash || '';
        }
      } catch {
        // Ignore metadata error
      }

      return {
        path,
        content,
        type: 'file',
        sha
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(owner: string, repo: string, path: string = '', branch?: string): Promise<FileTreeItem[]> {
    const ref = branch || 'main';
    let url = `${this.baseUrl}/repositories/${owner}/${repo}/src/${ref}/`;
    if (path) {
      url += `${path}/`;
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as BitbucketTreeResponse;

      return data.values.map(item => ({
        path: item.path,
        type: item.type === 'commit_directory' ? 'dir' : 'file',
        size: item.size,
        sha: item.commit?.hash
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for code in the repository
   */
  async searchCode(owner: string, repo: string, query: string, options: SearchOptions = {}): Promise<CodeSearchResult[]> {
    // Bitbucket Code Search API
    const maxResults = options.maxResults || 20;
    const url = `${this.baseUrl}/repositories/${owner}/${repo}/search/code?search_query=${encodeURIComponent(query)}&pagelen=${maxResults}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Fallback to manual search if code search API is not available
        return this.manualSearch(owner, repo, query, options);
      }

      const data = await response.json();
      const results = (data as { values?: BitbucketSearchResult[] }).values || [];

      return results
        .filter(result => {
          const filePath = result.file.path;

          // Filter by extensions if specified
          if (options.extensions && options.extensions.length > 0) {
            const ext = filePath.split('.').pop() || '';
            if (!options.extensions.includes(ext)) {
              return false;
            }
          }

          // Filter by paths if specified
          if (options.paths && options.paths.length > 0) {
            if (!options.paths.some(p => filePath.startsWith(p))) {
              return false;
            }
          }

          return true;
        })
        .map(result => ({
          path: result.file.path,
          matchedLines: result.content_matches?.flatMap(match =>
            match.lines.map(line => ({
              lineNumber: line.line,
              content: line.segments.map(s => s.text).join('')
            }))
          )
        }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Manual search fallback (searches through files)
   */
  private async manualSearch(owner: string, repo: string, query: string, options: SearchOptions = {}): Promise<CodeSearchResult[]> {
    const results: CodeSearchResult[] = [];
    const maxResults = options.maxResults || 20;
    const searchRegex = new RegExp(query, 'gi');

    const searchDir = async (path: string) => {
      if (results.length >= maxResults) return;

      const files = await this.listFiles(owner, repo, path, options.branch);

      for (const file of files) {
        if (results.length >= maxResults) break;

        if (file.type === 'file') {
          // Check extensions filter
          if (options.extensions && options.extensions.length > 0) {
            const ext = file.path.split('.').pop() || '';
            if (!options.extensions.includes(ext)) continue;
          }

          // Check paths filter
          if (options.paths && options.paths.length > 0) {
            if (!options.paths.some(p => file.path.startsWith(p))) continue;
          }

          const content = await this.getFile(owner, repo, file.path, options.branch);
          if (content && searchRegex.test(content.content)) {
            const lines = content.content.split('\n');
            const matchedLines: Array<{ lineNumber: number; content: string }> = [];

            lines.forEach((line, index) => {
              if (searchRegex.test(line)) {
                matchedLines.push({ lineNumber: index + 1, content: line });
              }
            });

            results.push({
              path: file.path,
              content: content.content,
              matchedLines
            });
          }
        } else if (file.type === 'dir' && (!options.paths || options.paths.some(p => file.path.startsWith(p) || p.startsWith(file.path)))) {
          await searchDir(file.path);
        }
      }
    };

    await searchDir('');
    return results.slice(0, maxResults);
  }

  /**
   * Find API specification files
   */
  async findApiSpecs(owner: string, repo: string, branch?: string): Promise<ApiSpec[]> {
    const specs: ApiSpec[] = [];

    for (const location of this.apiSpecLocations) {
      const file = await this.getFile(owner, repo, location, branch);
      if (file) {
        try {
          const spec = this.parseSpec(file.content, location);
          if (spec) {
            specs.push(spec);
          }
        } catch (error) {
          // Not a valid spec, continue
        }
      }
    }

    return specs;
  }

  /**
   * Parse API spec content
   */
  private parseSpec(content: string, path: string): ApiSpec | null {
    try {
      const spec = JSON.parse(content);

      let type: 'openapi' | 'swagger' = 'openapi';
      let version = '3.0.0';

      if (spec.swagger) {
        type = 'swagger';
        version = spec.swagger;
      } else if (spec.openapi) {
        type = 'openapi';
        version = spec.openapi;
      }

      return { type, version, spec, path };
    } catch {
      // Not JSON, might be YAML - would need yaml parser
      return null;
    }
  }

  /**
   * Get rate limit information
   * Bitbucket rate limiting is different - mainly based on IP/user
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    // Bitbucket doesn't have a dedicated rate limit endpoint
    // Return estimated values based on their documentation
    return {
      remaining: 1000,
      limit: 1000,
      reset: new Date(Date.now() + 3600000) // 1 hour from now
    };
  }
}

// Export singleton factory
export function createBitbucketClient(config?: ProviderConfig): BitbucketClient {
  return new BitbucketClient(config);
}
