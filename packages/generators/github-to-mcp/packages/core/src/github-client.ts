/**
 * @fileoverview API client implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * GitHub Repository Client
 * Fetch files and metadata from GitHub repositories
 */

import { Octokit } from '@octokit/rest';
import { RepoMetadata, FileContent, ApiSpec } from './types';

export class GithubClient {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token
    });
  }

  /**
   * Parse GitHub URL to extract metadata
   */
  parseGithubUrl(url: string): RepoMetadata {
    // Handle URLs with /tree/branch pattern
    // Format: github.com/owner/repo/tree/branch[/path]
    const treeMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/(.+)/);
    if (treeMatch) {
      const owner = treeMatch[1];
      const repo = treeMatch[2].replace('.git', '');
      const rest = treeMatch[3];
      
      // Split the rest into parts
      const parts = rest.split('/');
      
      // Heuristic: if the URL looks like it has a file path (contains common extensions or known dirs)
      // try to identify where branch ends and path begins
      // Common approach: first segment is branch unless it contains file-like patterns
      
      // Check if this looks like a branch with slashes (feature/xxx pattern)
      // by looking for common file extensions or src/lib/etc paths
      const fileExtensions = /\.(ts|js|py|md|json|yaml|yml|tsx|jsx|html|css|go|rs|java|rb|php)$/i;
      const commonDirs = ['src', 'lib', 'packages', 'apps', 'test', 'tests', 'docs', 'examples'];
      
      let branch = parts[0];
      let pathParts: string[] = [];
      
      // If only one part, it's just the branch
      if (parts.length === 1) {
        return { owner, repo, branch, path: undefined };
      }
      
      // Check if second part looks like a directory/file rather than continuation of branch
      // This handles: tree/main/src/file.ts (branch=main, path=src/file.ts)
      // vs: tree/feature/new-feature (branch=feature/new-feature)
      if (commonDirs.includes(parts[1]) || fileExtensions.test(parts[parts.length - 1])) {
        // Likely first part is branch, rest is path
        branch = parts[0];
        pathParts = parts.slice(1);
      } else {
        // Could be a branch with slashes - if last part has extension, work backwards
        if (fileExtensions.test(parts[parts.length - 1])) {
          // Find where path starts by looking for common dirs
          let pathStart = parts.length;
          for (let i = 1; i < parts.length; i++) {
            if (commonDirs.includes(parts[i])) {
              pathStart = i;
              break;
            }
          }
          branch = parts.slice(0, pathStart).join('/');
          pathParts = parts.slice(pathStart);
        } else {
          // No file extension - assume it's all branch name
          branch = rest;
          pathParts = [];
        }
      }
      
      return {
        owner,
        repo,
        branch,
        path: pathParts.length > 0 ? pathParts.join('/') : undefined
      };
    }
    
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)$/,
      /github\.com\/([^\/]+)\/([^\/]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace('.git', ''),
          branch: match[3] || 'main',
          path: match[4]
        };
      }
    }

    throw new Error(`Invalid GitHub URL: ${url}`);
  }

  /**
   * Get repository metadata
   */
  async getRepoMetadata(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({
      owner,
      repo
    });

    return {
      stars: data.stargazers_count,
      language: data.language || 'unknown',
      license: data.license?.spdx_id ?? undefined,
      description: data.description ?? undefined,
      defaultBranch: data.default_branch
    };
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });

      if (Array.isArray(data)) {
        return null; // Directory
      }

      if (data.type === 'file' && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
          path: data.path,
          content,
          type: 'file',
          sha: data.sha
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(
    owner: string,
    repo: string,
    path: string = '',
    branch?: string
  ): Promise<FileContent[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map(item => ({
        path: item.path,
        content: '',
        type: item.type as 'file' | 'dir',
        sha: item.sha
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for API specification files
   */
  async findApiSpecs(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<ApiSpec[]> {
    const specs: ApiSpec[] = [];

    // Common locations for API specs
    const locations = [
      'openapi.json',
      'openapi.yaml',
      'openapi.yml',
      'swagger.json',
      'swagger.yaml',
      'swagger.yml',
      'api/openapi.json',
      'api/swagger.json',
      'spec/openapi.json',
      'spec/swagger.json',
      'docs/openapi.json',
      'docs/swagger.json',
      '.well-known/openapi.json'
    ];

    for (const location of locations) {
      const file = await this.getFileContent(owner, repo, location, branch);
      
      if (file) {
        try {
          const spec = JSON.parse(file.content);
          
          // Determine type and version
          let type: 'openapi' | 'swagger' = 'openapi';
          let version = '3.0.0';

          if (spec.swagger) {
            type = 'swagger';
            version = spec.swagger;
          } else if (spec.openapi) {
            type = 'openapi';
            version = spec.openapi;
          }

          specs.push({
            type,
            version,
            spec,
            path: location
          });
        } catch (error) {
          // Not JSON, try YAML
          continue;
        }
      }
    }

    return specs;
  }

  /**
   * Get README content
   */
  async getReadme(owner: string, repo: string, branch?: string): Promise<string | null> {
    const readmeFiles = ['README.md', 'README.MD', 'readme.md', 'Readme.md'];

    for (const filename of readmeFiles) {
      const file = await this.getFileContent(owner, repo, filename, branch);
      if (file) {
        return file.content;
      }
    }

    return null;
  }

  /**
   * Search repository for files by pattern
   */
  async searchFiles(
    owner: string,
    repo: string,
    pattern: RegExp,
    maxDepth: number = 3
  ): Promise<FileContent[]> {
    const results: FileContent[] = [];

    const searchDir = async (path: string, depth: number) => {
      if (depth > maxDepth) return;

      const contents = await this.listDirectory(owner, repo, path);

      for (const item of contents) {
        if (item.type === 'file' && pattern.test(item.path)) {
          const file = await this.getFileContent(owner, repo, item.path);
          if (file) {
            results.push(file);
          }
        } else if (item.type === 'dir') {
          await searchDir(item.path, depth + 1);
        }
      }
    };

    await searchDir('', 0);
    return results;
  }

  /**
   * Rate limit info
   */
  async getRateLimit() {
    const { data } = await this.octokit.rateLimit.get();
    return {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      reset: new Date(data.rate.reset * 1000)
    };
  }
}
