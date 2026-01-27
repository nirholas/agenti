/**
 * @fileoverview Base provider interface for git hosting platforms
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { RepoMetadata, FileContent, ApiSpec } from '../types';

/**
 * Repository metadata from the provider
 */
export interface ProviderRepoMetadata {
  stars: number;
  language: string;
  license?: string;
  description?: string;
  defaultBranch: string;
  forksCount?: number;
  openIssuesCount?: number;
  createdAt?: string;
  updatedAt?: string;
  size?: number;
  topics?: string[];
}

/**
 * Search result from code search
 */
export interface CodeSearchResult {
  path: string;
  content?: string;
  matchedLines?: Array<{
    lineNumber: number;
    content: string;
  }>;
  sha?: string;
}

/**
 * File tree item
 */
export interface FileTreeItem {
  path: string;
  type: 'file' | 'dir' | 'tree' | 'blob';
  size?: number;
  sha?: string;
}

/**
 * Base provider interface that all git hosting providers must implement
 */
export interface BaseProvider {
  /**
   * Provider name (e.g., 'github', 'gitlab', 'bitbucket')
   */
  readonly name: string;

  /**
   * Parse a URL to extract repository metadata
   */
  parseUrl(url: string): RepoMetadata;

  /**
   * Get repository metadata
   */
  getRepoMetadata(owner: string, repo: string): Promise<ProviderRepoMetadata>;

  /**
   * Get README content from the repository
   */
  getReadme(owner: string, repo: string, branch?: string): Promise<string | null>;

  /**
   * Get file content from the repository
   */
  getFile(owner: string, repo: string, path: string, branch?: string): Promise<FileContent | null>;

  /**
   * List files in a directory
   */
  listFiles(owner: string, repo: string, path?: string, branch?: string): Promise<FileTreeItem[]>;

  /**
   * Search for code in the repository
   */
  searchCode(owner: string, repo: string, query: string, options?: SearchOptions): Promise<CodeSearchResult[]>;

  /**
   * Find API specification files
   */
  findApiSpecs?(owner: string, repo: string, branch?: string): Promise<ApiSpec[]>;

  /**
   * Get rate limit information
   */
  getRateLimit?(): Promise<RateLimitInfo>;
}

/**
 * Options for code search
 */
export interface SearchOptions {
  /** Maximum results to return */
  maxResults?: number;
  /** File extensions to filter */
  extensions?: string[];
  /** Paths to search in */
  paths?: string[];
  /** Branch to search in */
  branch?: string;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: Date;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Authentication token */
  token?: string;
  /** Base URL for self-hosted instances */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Abstract base class with common functionality
 */
export abstract class AbstractProvider implements BaseProvider {
  abstract readonly name: string;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  abstract parseUrl(url: string): RepoMetadata;
  abstract getRepoMetadata(owner: string, repo: string): Promise<ProviderRepoMetadata>;
  abstract getReadme(owner: string, repo: string, branch?: string): Promise<string | null>;
  abstract getFile(owner: string, repo: string, path: string, branch?: string): Promise<FileContent | null>;
  abstract listFiles(owner: string, repo: string, path?: string, branch?: string): Promise<FileTreeItem[]>;
  abstract searchCode(owner: string, repo: string, query: string, options?: SearchOptions): Promise<CodeSearchResult[]>;

  /**
   * Common method to fetch with timeout
   */
  protected async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.config.headers,
          ...options.headers
        }
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get authorization header
   */
  protected getAuthHeader(): Record<string, string> {
    if (!this.config.token) {
      return {};
    }
    return { Authorization: `Bearer ${this.config.token}` };
  }

  /**
   * Common README file names to search
   */
  protected readonly readmeFileNames = [
    'README.md',
    'README.MD',
    'readme.md',
    'Readme.md',
    'README.rst',
    'readme.rst',
    'README.txt',
    'readme.txt',
    'README'
  ];

  /**
   * Common API spec locations
   */
  protected readonly apiSpecLocations = [
    'openapi.json',
    'openapi.yaml',
    'openapi.yml',
    'swagger.json',
    'swagger.yaml',
    'swagger.yml',
    'api/openapi.json',
    'api/openapi.yaml',
    'api/swagger.json',
    'api/swagger.yaml',
    'spec/openapi.json',
    'spec/openapi.yaml',
    'docs/openapi.json',
    'docs/openapi.yaml',
    '.well-known/openapi.json'
  ];
}

/**
 * Detect provider from URL
 */
export function detectProvider(url: string): 'github' | 'gitlab' | 'bitbucket' | 'unknown' {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('github.com') || lowerUrl.includes('github.')) {
    return 'github';
  }

  if (lowerUrl.includes('gitlab.com') || lowerUrl.includes('gitlab.')) {
    return 'gitlab';
  }

  if (lowerUrl.includes('bitbucket.org') || lowerUrl.includes('bitbucket.')) {
    return 'bitbucket';
  }

  return 'unknown';
}
