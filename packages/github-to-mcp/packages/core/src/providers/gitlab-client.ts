/**
 * @fileoverview GitLab API client implementing BaseProvider
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
 * GitLab API response interfaces
 */
interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  default_branch: string;
  star_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  last_activity_at: string;
  topics: string[];
  license?: {
    key: string;
    name: string;
  };
}

interface GitLabFile {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
}

interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

interface GitLabSearchResult {
  basename: string;
  data: string;
  path: string;
  filename: string;
  id: string;
  ref: string;
  startline: number;
  project_id: number;
}

/**
 * GitLab provider implementation
 */
export class GitLabClient extends AbstractProvider {
  readonly name = 'gitlab';
  private baseUrl: string;

  constructor(config: ProviderConfig = {}) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://gitlab.com/api/v4';
  }

  /**
   * Parse GitLab URL to extract owner and repo
   */
  parseUrl(url: string): RepoMetadata {
    // Handle URLs with groups (namespaces can be nested)
    // Format: gitlab.com/group/subgroup/project
    // Or with tree: gitlab.com/group/project/-/tree/branch/path

    // Extract base path (remove tree/blob parts)
    const treeMatch = url.match(/gitlab\.com\/(.+?)\/-\/(?:tree|blob)\/([^\/]+)(?:\/(.*))?$/);
    if (treeMatch) {
      const projectPath = treeMatch[1];
      const pathParts = projectPath.split('/');
      const repo = pathParts.pop() || '';
      const owner = pathParts.join('/');

      return {
        owner,
        repo,
        branch: treeMatch[2],
        path: treeMatch[3]
      };
    }

    // Simple format: gitlab.com/owner/repo or gitlab.com/group/subgroup/repo
    const simpleMatch = url.match(/gitlab\.com\/(.+?)(?:\.git)?(?:\?|#|$)/);
    if (simpleMatch) {
      const projectPath = simpleMatch[1].replace(/\/$/, '');
      const pathParts = projectPath.split('/');
      const repo = pathParts.pop() || '';
      const owner = pathParts.join('/');

      return {
        owner,
        repo,
        branch: 'main'
      };
    }

    throw new Error(`Invalid GitLab URL: ${url}`);
  }

  /**
   * Get project ID from owner/repo (GitLab uses project IDs or URL-encoded paths)
   */
  private encodeProjectPath(owner: string, repo: string): string {
    return encodeURIComponent(`${owner}/${repo}`);
  }

  /**
   * Get repository metadata
   */
  async getRepoMetadata(owner: string, repo: string): Promise<ProviderRepoMetadata> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const url = `${this.baseUrl}/projects/${projectPath}`;

    const response = await this.fetchWithTimeout(url, {
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    const project = await response.json() as GitLabProject;

    return {
      stars: project.star_count,
      language: 'unknown', // GitLab doesn't return primary language in project API
      license: project.license?.key,
      description: project.description || undefined,
      defaultBranch: project.default_branch,
      forksCount: project.forks_count,
      openIssuesCount: project.open_issues_count,
      createdAt: project.created_at,
      updatedAt: project.last_activity_at,
      topics: project.topics
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
    const projectPath = this.encodeProjectPath(owner, repo);
    const encodedPath = encodeURIComponent(path);
    const ref = branch || 'main';

    const url = `${this.baseUrl}/projects/${projectPath}/repository/files/${encodedPath}?ref=${ref}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const file = await response.json() as GitLabFile;

      // Decode content based on encoding
      let content = file.content;
      if (file.encoding === 'base64') {
        content = Buffer.from(file.content, 'base64').toString('utf-8');
      }

      return {
        path: file.file_path,
        content,
        type: 'file',
        sha: file.blob_id
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(owner: string, repo: string, path: string = '', branch?: string): Promise<FileTreeItem[]> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const ref = branch || 'main';

    let url = `${this.baseUrl}/projects/${projectPath}/repository/tree?ref=${ref}`;
    if (path) {
      url += `&path=${encodeURIComponent(path)}`;
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

      const items = await response.json() as GitLabTreeItem[];

      return items.map(item => ({
        path: item.path,
        type: item.type === 'tree' ? 'dir' : 'file',
        sha: item.id
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for code in the repository
   */
  async searchCode(owner: string, repo: string, query: string, options: SearchOptions = {}): Promise<CodeSearchResult[]> {
    const projectPath = this.encodeProjectPath(owner, repo);
    const maxResults = options.maxResults || 20;

    const url = `${this.baseUrl}/projects/${projectPath}/search?scope=blobs&search=${encodeURIComponent(query)}&per_page=${maxResults}`;

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

      const results = await response.json() as GitLabSearchResult[];

      return results
        .filter(result => {
          // Filter by extensions if specified
          if (options.extensions && options.extensions.length > 0) {
            const ext = result.filename.split('.').pop() || '';
            if (!options.extensions.includes(ext)) {
              return false;
            }
          }

          // Filter by paths if specified
          if (options.paths && options.paths.length > 0) {
            if (!options.paths.some(p => result.path.startsWith(p))) {
              return false;
            }
          }

          return true;
        })
        .map(result => ({
          path: result.path,
          content: result.data,
          matchedLines: [{
            lineNumber: result.startline,
            content: result.data
          }],
          sha: result.id
        }));
    } catch (error) {
      return [];
    }
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
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    // GitLab returns rate limit info in response headers
    // This is a simplified implementation
    const url = `${this.baseUrl}/projects?per_page=1`;

    const response = await this.fetchWithTimeout(url, {
      headers: this.getAuthHeader()
    });

    const remaining = parseInt(response.headers.get('RateLimit-Remaining') || '0', 10);
    const limit = parseInt(response.headers.get('RateLimit-Limit') || '0', 10);
    const reset = parseInt(response.headers.get('RateLimit-Reset') || '0', 10);

    return {
      remaining,
      limit,
      reset: new Date(reset * 1000)
    };
  }
}

// Export singleton factory
export function createGitLabClient(config?: ProviderConfig): GitLabClient {
  return new GitLabClient(config);
}
