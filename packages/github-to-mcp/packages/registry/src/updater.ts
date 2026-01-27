/**
 * @fileoverview Registry updater for checking and updating entries
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import type {
  RegistryEntry,
  UpdateInfo,
  StorageAdapter,
} from './types';

/**
 * Options for the updater
 */
export interface UpdaterOptions {
  /** GitHub token for API requests */
  githubToken?: string;
  /** Whether to auto-update entries */
  autoUpdate?: boolean;
  /** Check interval in milliseconds */
  checkInterval?: number;
}

/**
 * Registry updater - checks for updates from source repos
 */
export class RegistryUpdater {
  private storage: StorageAdapter;
  private options: UpdaterOptions;

  constructor(storage: StorageAdapter, options: UpdaterOptions = {}) {
    this.storage = storage;
    this.options = options;
  }

  /**
   * Check if an entry has updates available
   */
  async checkForUpdates(id: string): Promise<UpdateInfo | null> {
    const entry = await this.storage.get(id);
    if (!entry) return null;

    try {
      const latestVersion = await this.getLatestSourceVersion(entry.sourceRepo);
      
      if (latestVersion && latestVersion !== entry.sourceVersion) {
        return {
          id: entry.id,
          currentVersion: entry.version,
          latestVersion: this.incrementVersion(entry.version),
          changelog: `Updated from ${entry.sourceVersion} to ${latestVersion}`,
          breaking: this.isBreakingUpdate(entry.sourceVersion, latestVersion),
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check all entries for updates
   */
  async checkAllForUpdates(): Promise<UpdateInfo[]> {
    const updates: UpdateInfo[] = [];
    const result = await this.storage.list({ limit: 1000 });
    
    for (const summary of result.entries) {
      const update = await this.checkForUpdates(summary.id);
      if (update) {
        updates.push(update);
      }
    }
    
    return updates;
  }

  /**
   * Get the latest version/commit from source repo
   */
  private async getLatestSourceVersion(sourceRepo: string): Promise<string | null> {
    const [owner, repo] = sourceRepo.split('/');
    if (!owner || !repo) return null;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-to-mcp-registry',
    };

    if (this.options.githubToken) {
      headers['Authorization'] = `Bearer ${this.options.githubToken}`;
    }

    try {
      // Try to get latest release first
      const releaseResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        { headers }
      );
      
      if (releaseResponse.ok) {
        const release = await releaseResponse.json() as { tag_name: string };
        return release.tag_name;
      }

      // Fall back to latest commit on default branch
      const commitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
        { headers }
      );
      
      if (commitResponse.ok) {
        const commits = await commitResponse.json() as Array<{ sha: string }>;
        if (commits.length > 0) {
          return commits[0].sha.substring(0, 7);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Increment a semver version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length === 3) {
      const patch = parseInt(parts[2], 10) || 0;
      return `${parts[0]}.${parts[1]}.${patch + 1}`;
    }
    return `${version}.1`;
  }

  /**
   * Check if an update is a breaking change
   * (Simple heuristic based on major version)
   */
  private isBreakingUpdate(oldVersion: string, newVersion: string): boolean {
    const oldMajor = this.extractMajorVersion(oldVersion);
    const newMajor = this.extractMajorVersion(newVersion);
    return newMajor > oldMajor;
  }

  /**
   * Extract major version number
   */
  private extractMajorVersion(version: string): number {
    const match = version.match(/^v?(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Update an entry from its source repo
   * Requires the core generator to be available
   */
  async updateEntry(
    id: string,
    generator?: { generate: (url: string) => Promise<unknown> }
  ): Promise<RegistryEntry | null> {
    const entry = await this.storage.get(id);
    if (!entry) return null;

    if (!generator) {
      console.warn('Generator not provided, cannot regenerate entry');
      return null;
    }

    try {
      // Regenerate from source
      const result = await generator.generate(entry.sourceUrl) as {
        tools: Array<{ name: string; description: string; source: { type: string }; inputSchema: { properties: object } }>;
        generate: () => string;
        generatePython?: () => string;
      };
      
      // Update entry
      const updatedEntry: RegistryEntry = {
        ...entry,
        version: this.incrementVersion(entry.version),
        sourceVersion: await this.getLatestSourceVersion(entry.sourceRepo) || entry.sourceVersion,
        toolCount: result.tools.length,
        tools: result.tools.map(t => ({
          name: t.name,
          description: t.description,
          source: t.source.type,
          paramCount: Object.keys(t.inputSchema?.properties || {}).length,
          requiresAuth: entry.auth.length > 0,
        })),
        generatedCode: {
          typescript: result.generate(),
          python: result.generatePython?.(),
        },
        lastUpdated: new Date().toISOString(),
      };

      await this.storage.save(updatedEntry);
      return updatedEntry;
    } catch (error) {
      console.error(`Failed to update entry ${id}:`, error);
      return null;
    }
  }
}
