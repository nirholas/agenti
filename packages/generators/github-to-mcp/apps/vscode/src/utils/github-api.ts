/**
 * @fileoverview GitHub API client for VS Code extension
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  download_url?: string;
  content?: string;
  encoding?: string;
}

interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * GitHub API client for the VS Code extension
 */
export class GitHubApiClient {
  private static instance: GitHubApiClient;
  private baseUrl = 'https://api.github.com';
  private token: string | undefined;

  private constructor() {
    this.loadToken();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GitHubApiClient {
    if (!GitHubApiClient.instance) {
      GitHubApiClient.instance = new GitHubApiClient();
    }
    return GitHubApiClient.instance;
  }

  /**
   * Load GitHub token from VS Code settings or environment
   */
  private loadToken(): void {
    const config = vscode.workspace.getConfiguration('github-to-mcp');
    this.token = config.get<string>('githubToken') || process.env.GITHUB_TOKEN;
  }

  /**
   * Set GitHub token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Make a request to GitHub API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-to-MCP-VSCode-Extension'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
          throw new Error('GitHub API rate limit exceeded. Please try again later or add a GitHub token.');
        }
      }
      if (response.status === 404) {
        throw new Error('Repository not found. Check the URL and make sure the repository is public.');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) {
      return null;
    }
    return { owner: match[1], repo: match[2] };
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  /**
   * Get repository from URL
   */
  async getRepositoryFromUrl(url: string): Promise<GitHubRepo> {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed) {
      throw new Error('Invalid GitHub URL');
    }
    return this.getRepository(parsed.owner, parsed.repo);
  }

  /**
   * Get repository contents at a path
   */
  async getContents(owner: string, repo: string, path: string = ''): Promise<GitHubContent[]> {
    const result = await this.request<GitHubContent | GitHubContent[]>(
      `/repos/${owner}/${repo}/contents/${path}`
    );
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Get file content
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const content = await this.request<GitHubContent>(
      `/repos/${owner}/${repo}/contents/${path}`
    );

    if (content.content && content.encoding === 'base64') {
      return Buffer.from(content.content, 'base64').toString('utf-8');
    }

    if (content.download_url) {
      const response = await fetch(content.download_url);
      return response.text();
    }

    throw new Error(`Could not retrieve content for ${path}`);
  }

  /**
   * Get README content
   */
  async getReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const readme = await this.request<GitHubContent>(
        `/repos/${owner}/${repo}/readme`
      );

      if (readme.content && readme.encoding === 'base64') {
        return Buffer.from(readme.content, 'base64').toString('utf-8');
      }

      if (readme.download_url) {
        const response = await fetch(readme.download_url);
        return response.text();
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Search for files in repository
   */
  async searchFiles(
    owner: string, 
    repo: string, 
    query: string
  ): Promise<Array<{ name: string; path: string }>> {
    try {
      const result = await this.request<{
        items: Array<{ name: string; path: string }>;
      }>(`/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`);
      return result.items || [];
    } catch {
      return [];
    }
  }

  /**
   * Find OpenAPI/Swagger files in repository
   */
  async findOpenApiFiles(owner: string, repo: string): Promise<string[]> {
    const commonPaths = [
      'openapi.json',
      'openapi.yaml',
      'openapi.yml',
      'swagger.json',
      'swagger.yaml',
      'swagger.yml',
      'api/openapi.json',
      'api/openapi.yaml',
      'docs/openapi.json',
      'docs/openapi.yaml',
      'spec/openapi.json',
      'spec/openapi.yaml'
    ];

    const found: string[] = [];

    for (const path of commonPaths) {
      try {
        await this.request(`/repos/${owner}/${repo}/contents/${path}`);
        found.push(path);
      } catch {
        // File doesn't exist, continue
      }
    }

    return found;
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<GitHubRateLimit> {
    const result = await this.request<{ rate: GitHubRateLimit }>('/rate_limit');
    return result.rate;
  }

  /**
   * Check rate limit and warn if low
   */
  async checkRateLimit(): Promise<boolean> {
    try {
      const limit = await this.getRateLimit();
      
      if (limit.remaining < 10) {
        const resetDate = new Date(limit.reset * 1000);
        const message = `GitHub API rate limit low (${limit.remaining} remaining). ` +
          `Resets at ${resetDate.toLocaleTimeString()}.`;
        
        if (this.token) {
          vscode.window.showWarningMessage(message);
        } else {
          vscode.window.showWarningMessage(
            `${message} Add a GitHub token for higher limits.`,
            'Add Token'
          ).then(selection => {
            if (selection === 'Add Token') {
              vscode.commands.executeCommand('workbench.action.openSettings', 'github-to-mcp.githubToken');
            }
          });
        }
        
        return limit.remaining > 0;
      }
      
      return true;
    } catch {
      // Can't check rate limit, proceed anyway
      return true;
    }
  }
}

/**
 * Get the GitHub API client instance
 */
export function getGitHubClient(): GitHubApiClient {
  return GitHubApiClient.getInstance();
}

/**
 * Prompt user to enter GitHub token
 */
export async function promptForGitHubToken(): Promise<string | undefined> {
  const token = await vscode.window.showInputBox({
    prompt: 'Enter your GitHub Personal Access Token',
    placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return 'Token is required';
      }
      if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
        return 'Invalid token format';
      }
      return null;
    }
  });

  if (token) {
    const config = vscode.workspace.getConfiguration('github-to-mcp');
    await config.update('githubToken', token, vscode.ConfigurationTarget.Global);
    getGitHubClient().setToken(token);
    vscode.window.showInformationMessage('GitHub token saved successfully!');
  }

  return token;
}
