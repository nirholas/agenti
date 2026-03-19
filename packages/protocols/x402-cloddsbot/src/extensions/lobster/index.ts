/**
 * Lobster Extension
 * Provides Lobste.rs (lobsters.rs) integration for tech news and discussions
 *
 * Lobste.rs is a computing-focused link aggregation site
 */

import { logger } from '../../utils/logger';

export interface LobsterConfig {
  enabled: boolean;
  /** API base URL */
  baseUrl?: string;
  /** User token for authenticated requests */
  userToken?: string;
  /** Cache duration in milliseconds */
  cacheDurationMs?: number;
  /** Tags to filter by */
  defaultTags?: string[];
}

export interface LobsterStory {
  id: string;
  shortId: string;
  title: string;
  url?: string;
  description?: string;
  score: number;
  commentCount: number;
  tags: string[];
  submitter: string;
  submittedAt: Date;
  commentsUrl: string;
}

export interface LobsterComment {
  id: string;
  shortId: string;
  storyId: string;
  author: string;
  content: string;
  score: number;
  depth: number;
  parentId?: string;
  createdAt: Date;
}

export interface LobsterUser {
  username: string;
  about?: string;
  karma: number;
  createdAt: Date;
  avatar?: string;
}

export interface LobsterExtension {
  /** Get hottest stories */
  getHottest(page?: number): Promise<LobsterStory[]>;
  /** Get newest stories */
  getNewest(page?: number): Promise<LobsterStory[]>;
  /** Get stories by tag */
  getByTag(tag: string, page?: number): Promise<LobsterStory[]>;
  /** Search stories */
  searchStories(query: string, page?: number): Promise<LobsterStory[]>;
  /** Get story details */
  getStory(shortId: string): Promise<LobsterStory | null>;
  /** Get story comments */
  getComments(storyShortId: string): Promise<LobsterComment[]>;
  /** Get user profile */
  getUser(username: string): Promise<LobsterUser | null>;
  /** Get all available tags */
  getTags(): Promise<string[]>;
  /** Find stories relevant to prediction markets */
  findMarketRelevant(keywords?: string[]): Promise<LobsterStory[]>;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export async function createLobsterExtension(config: LobsterConfig): Promise<LobsterExtension> {
  const baseUrl = config.baseUrl || 'https://lobste.rs';
  const cacheDuration = config.cacheDurationMs ?? 300000; // 5 minutes
  const MAX_CACHE_ENTRIES = 200;
  const cache = new Map<string, CacheEntry<unknown>>();

  async function fetchJSON<T>(path: string): Promise<T> {
    const url = `${baseUrl}${path}.json`;
    const cacheKey = url;

    // Check cache
    const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    // Remove expired entry
    if (cached) {
      cache.delete(cacheKey);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Clodds/1.0 (prediction market assistant)',
    };

    if (config.userToken) {
      headers['Authorization'] = `Bearer ${config.userToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Lobster API error: ${response.status}`);
    }

    const data = (await response.json()) as T;

    // Evict expired/oldest entries if cache is full
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(key);
      }
      // If still full, remove oldest entries
      if (cache.size >= MAX_CACHE_ENTRIES) {
        const oldest = Array.from(cache.keys()).slice(0, Math.floor(MAX_CACHE_ENTRIES / 4));
        for (const key of oldest) cache.delete(key);
      }
    }

    // Cache the result
    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + cacheDuration,
    });

    return data;
  }

  function parseStory(raw: any): LobsterStory {
    return {
      id: raw.short_id || raw.id,
      shortId: raw.short_id,
      title: raw.title,
      url: raw.url,
      description: raw.description || raw.description_plain,
      score: raw.score ?? 0,
      commentCount: raw.comment_count ?? 0,
      tags: raw.tags ?? [],
      submitter: raw.submitter_user?.username ?? raw.submitter,
      submittedAt: new Date(raw.created_at),
      commentsUrl: raw.comments_url || `${baseUrl}/s/${raw.short_id}`,
    };
  }

  function parseComment(raw: any): LobsterComment {
    return {
      id: raw.short_id || raw.id,
      shortId: raw.short_id,
      storyId: raw.story_id,
      author: raw.commenting_user?.username || raw.user,
      content: raw.comment_plain || raw.comment,
      score: raw.score ?? 0,
      depth: raw.indent_level ?? raw.depth ?? 0,
      parentId: raw.parent_comment,
      createdAt: new Date(raw.created_at),
    };
  }

  const extension: LobsterExtension = {
    async getHottest(page?: number): Promise<LobsterStory[]> {
      const path = page && page > 1 ? `/page/${page}` : '';
      const data = await fetchJSON<Record<string, unknown>[]>(path || '/hottest');
      return (Array.isArray(data) ? data : []).map(parseStory);
    },

    async getNewest(page?: number): Promise<LobsterStory[]> {
      const path = `/newest${page && page > 1 ? `/page/${page}` : ''}`;
      const data = await fetchJSON<Record<string, unknown>[]>(path);
      return (Array.isArray(data) ? data : []).map(parseStory);
    },

    async getByTag(tag: string, page?: number): Promise<LobsterStory[]> {
      const path = `/t/${tag}${page && page > 1 ? `/page/${page}` : ''}`;
      const data = await fetchJSON<Record<string, unknown>[]>(path);
      return (Array.isArray(data) ? data : []).map(parseStory);
    },

    async searchStories(query: string, page?: number): Promise<LobsterStory[]> {
      const path = `/search?q=${encodeURIComponent(query)}${page ? `&page=${page}` : ''}`;
      const data = await fetchJSON<{ stories?: Record<string, unknown>[] }>(path);
      return (data.stories || []).map(parseStory);
    },

    async getStory(shortId: string): Promise<LobsterStory | null> {
      try {
        const data = await fetchJSON<any>(`/s/${shortId}`);
        return parseStory(data);
      } catch (error) {
        logger.warn({ error, shortId }, 'Failed to get Lobster story');
        return null;
      }
    },

    async getComments(storyShortId: string): Promise<LobsterComment[]> {
      const data = await fetchJSON<any>(`/s/${storyShortId}`);
      return (data.comments || []).map(parseComment);
    },

    async getUser(username: string): Promise<LobsterUser | null> {
      try {
        const data = await fetchJSON<any>(`/u/${username}`);
        return {
          username: data.username,
          about: data.about,
          karma: data.karma || 0,
          createdAt: new Date(data.created_at),
          avatar: data.avatar_url,
        };
      } catch (error) {
        logger.warn({ error, username }, 'Failed to get Lobster user');
        return null;
      }
    },

    async getTags(): Promise<string[]> {
      const data = await fetchJSON<Array<Record<string, unknown> | string>>('/tags');
      return (data || []).map((t) => typeof t === 'string' ? t : String(t.tag || t));
    },

    async findMarketRelevant(keywords?: string[]): Promise<LobsterStory[]> {
      const defaultKeywords = [
        'prediction',
        'forecast',
        'probability',
        'betting',
        'market',
        'election',
        'poll',
        'crypto',
        'bitcoin',
        'ethereum',
        'ai',
        'regulation',
        'policy',
        'economic',
        'finance',
      ];

      const searchTerms = keywords || defaultKeywords;
      const relevantStories: LobsterStory[] = [];
      const seenIds = new Set<string>();

      // Get hottest stories and filter
      const hottest = await extension.getHottest();
      for (const story of hottest) {
        const titleLower = story.title.toLowerCase();
        const descLower = (story.description || '').toLowerCase();
        const isRelevant = searchTerms.some(
          (kw) => titleLower.includes(kw) || descLower.includes(kw) || story.tags.includes(kw)
        );

        if (isRelevant && !seenIds.has(story.shortId)) {
          seenIds.add(story.shortId);
          relevantStories.push(story);
        }
      }

      // Also check specific tags
      const relevantTags = ['crypto', 'finance', 'law', 'politics'];
      for (const tag of relevantTags) {
        try {
          const tagStories = await extension.getByTag(tag);
          for (const story of tagStories.slice(0, 5)) {
            if (!seenIds.has(story.shortId)) {
              seenIds.add(story.shortId);
              relevantStories.push(story);
            }
          }
        } catch {
          // Tag might not exist
        }
      }

      return relevantStories.sort((a, b) => b.score - a.score).slice(0, 20);
    },
  };

  return extension;
}
