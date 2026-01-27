/**
 * @fileoverview File-based storage adapter for registry
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  StorageAdapter,
  RegistryEntry,
  RegistryEntrySummary,
  ListOptions,
  ListResult,
} from './types';

/**
 * File-based storage for registry entries
 * Stores entries as JSON files in a directory structure
 */
export class FileStorage implements StorageAdapter {
  private dataDir: string;
  private indexCache: Map<string, RegistryEntrySummary> | null = null;
  private indexCacheTime: number = 0;
  private readonly INDEX_CACHE_TTL = 60000; // 1 minute

  constructor(dataDir?: string) {
    // Default to bundled data directory
    this.dataDir = dataDir || path.join(import.meta.dirname || __dirname, '..', 'data', 'entries');
  }

  /**
   * Ensure the data directory exists
   */
  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  /**
   * Get path to entry file
   */
  private getEntryPath(id: string): string {
    return path.join(this.dataDir, `${id}.json`);
  }

  /**
   * Build index of all entries
   */
  private async buildIndex(): Promise<Map<string, RegistryEntrySummary>> {
    const now = Date.now();
    
    // Return cached index if still valid
    if (this.indexCache && (now - this.indexCacheTime) < this.INDEX_CACHE_TTL) {
      return this.indexCache;
    }

    const index = new Map<string, RegistryEntrySummary>();
    
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.dataDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const content = await fs.readFile(path.join(this.dataDir, file), 'utf-8');
          const entry: RegistryEntry = JSON.parse(content);
          
          index.set(entry.id, {
            id: entry.id,
            name: entry.name,
            description: entry.description,
            sourceRepo: entry.sourceRepo,
            version: entry.version,
            toolCount: entry.toolCount,
            categories: entry.categories,
            popularity: entry.popularity,
            quality: entry.quality.overall,
            verified: entry.verified,
            lastUpdated: entry.lastUpdated,
          });
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    this.indexCache = index;
    this.indexCacheTime = now;
    return index;
  }

  /**
   * Invalidate the index cache
   */
  private invalidateCache(): void {
    this.indexCache = null;
  }

  /**
   * Get an entry by ID
   */
  async get(id: string): Promise<RegistryEntry | null> {
    try {
      const content = await fs.readFile(this.getEntryPath(id), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * List entries with filtering and pagination
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    const {
      category,
      search,
      sortBy = 'popularity',
      sortOrder = 'desc',
      offset = 0,
      limit = 20,
      verifiedOnly = false,
    } = options;

    const index = await this.buildIndex();
    let entries = Array.from(index.values());

    // Filter by category
    if (category) {
      entries = entries.filter(e => 
        e.categories.some(c => c.toLowerCase() === category.toLowerCase())
      );
    }

    // Filter by search query
    if (search) {
      const query = search.toLowerCase();
      entries = entries.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query) ||
        e.id.toLowerCase().includes(query) ||
        e.sourceRepo.toLowerCase().includes(query)
      );
    }

    // Filter verified only
    if (verifiedOnly) {
      entries = entries.filter(e => e.verified);
    }

    // Sort
    entries.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'quality':
          comparison = a.quality - b.quality;
          break;
        case 'lastUpdated':
          comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
          break;
        case 'toolCount':
          comparison = a.toolCount - b.toolCount;
          break;
        case 'popularity':
        default:
          comparison = a.popularity - b.popularity;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return {
      entries: paginated,
      total,
      offset,
      limit,
    };
  }

  /**
   * Save an entry
   */
  async save(entry: RegistryEntry): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(
      this.getEntryPath(entry.id),
      JSON.stringify(entry, null, 2),
      'utf-8'
    );
    this.invalidateCache();
  }

  /**
   * Delete an entry
   */
  async delete(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.getEntryPath(id));
      this.invalidateCache();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if entry exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      await fs.access(this.getEntryPath(id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const index = await this.buildIndex();
    const categories = new Set<string>();
    
    for (const entry of index.values()) {
      for (const cat of entry.categories) {
        categories.add(cat);
      }
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Search entries by query
   */
  async search(query: string): Promise<RegistryEntrySummary[]> {
    const result = await this.list({ search: query, limit: 50 });
    return result.entries;
  }
}

/**
 * In-memory storage for testing
 */
export class MemoryStorage implements StorageAdapter {
  private entries: Map<string, RegistryEntry> = new Map();

  async get(id: string): Promise<RegistryEntry | null> {
    return this.entries.get(id) || null;
  }

  async list(options: ListOptions = {}): Promise<ListResult> {
    const { offset = 0, limit = 20 } = options;
    const all = Array.from(this.entries.values());
    
    return {
      entries: all.slice(offset, offset + limit).map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        sourceRepo: e.sourceRepo,
        version: e.version,
        toolCount: e.toolCount,
        categories: e.categories,
        popularity: e.popularity,
        quality: e.quality.overall,
        verified: e.verified,
        lastUpdated: e.lastUpdated,
      })),
      total: all.length,
      offset,
      limit,
    };
  }

  async save(entry: RegistryEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.entries.has(id);
  }

  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();
    for (const entry of this.entries.values()) {
      for (const cat of entry.categories) {
        categories.add(cat);
      }
    }
    return Array.from(categories).sort();
  }

  async search(query: string): Promise<RegistryEntrySummary[]> {
    const q = query.toLowerCase();
    return Array.from(this.entries.values())
      .filter(e => 
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      )
      .map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        sourceRepo: e.sourceRepo,
        version: e.version,
        toolCount: e.toolCount,
        categories: e.categories,
        popularity: e.popularity,
        quality: e.quality.overall,
        verified: e.verified,
        lastUpdated: e.lastUpdated,
      }));
  }
}
