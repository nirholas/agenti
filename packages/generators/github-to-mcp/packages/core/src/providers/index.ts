/**
 * @fileoverview Git provider exports and factory
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

export {
  BaseProvider,
  AbstractProvider,
  ProviderConfig,
  ProviderRepoMetadata,
  CodeSearchResult,
  FileTreeItem,
  SearchOptions,
  RateLimitInfo,
  detectProvider
} from './base-provider';

export { GitLabClient, createGitLabClient } from './gitlab-client';
export { BitbucketClient, createBitbucketClient } from './bitbucket-client';

import type { BaseProvider, ProviderConfig } from './base-provider';
import { detectProvider } from './base-provider';
import { GitLabClient } from './gitlab-client';
import { BitbucketClient } from './bitbucket-client';
import { GithubClient } from '../github-client';

/**
 * Extended GitHub client that implements BaseProvider interface
 */
class GitHubProviderAdapter implements BaseProvider {
  readonly name = 'github';
  private client: GithubClient;

  constructor(config: ProviderConfig = {}) {
    this.client = new GithubClient(config.token);
  }

  parseUrl(url: string) {
    return this.client.parseGithubUrl(url);
  }

  async getRepoMetadata(owner: string, repo: string) {
    const metadata = await this.client.getRepoMetadata(owner, repo);
    return {
      stars: metadata.stars,
      language: metadata.language,
      license: metadata.license,
      description: metadata.description,
      defaultBranch: metadata.defaultBranch
    };
  }

  async getReadme(owner: string, repo: string, branch?: string) {
    return this.client.getReadme(owner, repo, branch);
  }

  async getFile(owner: string, repo: string, path: string, branch?: string) {
    return this.client.getFileContent(owner, repo, path, branch);
  }

  async listFiles(owner: string, repo: string, path?: string, branch?: string) {
    const files = await this.client.listDirectory(owner, repo, path || '', branch);
    return files.map(f => ({
      path: f.path,
      type: f.type as 'file' | 'dir',
      sha: f.sha
    }));
  }

  async searchCode(owner: string, repo: string, query: string, options?: { maxResults?: number }) {
    const pattern = new RegExp(query, 'gi');
    const files = await this.client.searchFiles(owner, repo, pattern, 3);
    return files.slice(0, options?.maxResults || 20).map(f => ({
      path: f.path,
      content: f.content,
      sha: f.sha
    }));
  }

  async findApiSpecs(owner: string, repo: string, branch?: string) {
    return this.client.findApiSpecs(owner, repo, branch);
  }

  async getRateLimit() {
    return this.client.getRateLimit();
  }
}

export { GitHubProviderAdapter };

/**
 * Provider factory configuration
 */
export interface ProviderFactoryConfig {
  github?: ProviderConfig;
  gitlab?: ProviderConfig;
  bitbucket?: ProviderConfig;
}

/**
 * Provider factory - creates the appropriate provider based on URL or type
 */
export class ProviderFactory {
  private configs: ProviderFactoryConfig;
  private providers: Map<string, BaseProvider> = new Map();

  constructor(configs: ProviderFactoryConfig = {}) {
    this.configs = configs;
  }

  /**
   * Get a provider by name
   */
  getProvider(name: 'github' | 'gitlab' | 'bitbucket'): BaseProvider {
    if (this.providers.has(name)) {
      return this.providers.get(name)!;
    }

    let provider: BaseProvider;

    switch (name) {
      case 'github':
        provider = new GitHubProviderAdapter(this.configs.github);
        break;
      case 'gitlab':
        provider = new GitLabClient(this.configs.gitlab);
        break;
      case 'bitbucket':
        provider = new BitbucketClient(this.configs.bitbucket);
        break;
      default:
        throw new Error(`Unknown provider: ${name}`);
    }

    this.providers.set(name, provider);
    return provider;
  }

  /**
   * Get provider from URL (auto-detect)
   */
  getProviderFromUrl(url: string): BaseProvider {
    const providerType = detectProvider(url);

    if (providerType === 'unknown') {
      throw new Error(`Unable to detect git provider from URL: ${url}`);
    }

    return this.getProvider(providerType);
  }

  /**
   * Parse URL and get provider info
   */
  parseUrl(url: string): { provider: BaseProvider; metadata: ReturnType<BaseProvider['parseUrl']> } {
    const provider = this.getProviderFromUrl(url);
    const metadata = provider.parseUrl(url);
    return { provider, metadata };
  }
}

/**
 * Create a provider factory with the given configuration
 */
export function createProviderFactory(configs?: ProviderFactoryConfig): ProviderFactory {
  return new ProviderFactory(configs);
}

/**
 * Quick utility to get the appropriate provider for a URL
 */
export function getProviderForUrl(url: string, configs?: ProviderFactoryConfig): BaseProvider {
  const factory = new ProviderFactory(configs);
  return factory.getProviderFromUrl(url);
}
