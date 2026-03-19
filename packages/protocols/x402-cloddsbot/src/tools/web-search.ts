/**
 * Web Search Tool - Clawdbot-style web search via Brave Search API
 *
 * Features:
 * - Search the web using Brave Search API
 * - Configurable result count
 * - Response caching
 * - Rate limiting
 */

import { logger } from '../utils/logger';

/** Search result */
export interface SearchResult {
  title: string;
  url: string;
  description: string;
  /** Publication date if available */
  date?: string;
}

/** Search options */
export interface SearchOptions {
  /** Number of results (default: 5, max: 20) */
  count?: number;
  /** Page number (1-based) */
  page?: number;
  /** Explicit offset (overrides page) */
  offset?: number;
  /** Country code for localization */
  country?: string;
  /** Search freshness: day, week, month, year */
  freshness?: 'day' | 'week' | 'month' | 'year';
  /** Safe search: off, moderate, strict */
  safesearch?: 'off' | 'moderate' | 'strict';
}

/** Search response */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults?: number;
  /** Page number (1-based) */
  page: number;
  /** Offset used for this request */
  offset: number;
  /** Requested count per page */
  count: number;
  /** Whether another page is likely available */
  hasMore: boolean;
  cached: boolean;
}

export interface WebSearchTool {
  /** Search the web */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;

  /** Clear the cache */
  clearCache(): void;
}

// Simple in-memory cache
interface CacheEntry {
  response: SearchResponse;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();
const ALLOWED_FRESHNESS = new Set(['day', 'week', 'month', 'year']);
const ALLOWED_SAFESEARCH = new Set(['off', 'moderate', 'strict']);
const ENGINE_NAME = 'brave';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 30;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const engineRateLimits = new Map<string, RateLimitEntry>();

function checkEngineRateLimit(engine: string): { allowed: boolean; resetInMs: number } {
  const now = Date.now();
  const windowMs = Math.max(
    1_000,
    parseInt(process.env.CLODDS_SEARCH_RATE_WINDOW_MS || '', 10) || DEFAULT_RATE_LIMIT_WINDOW_MS
  );
  const maxRequests = Math.max(
    1,
    parseInt(process.env.CLODDS_SEARCH_RATE_MAX || '', 10) || DEFAULT_RATE_LIMIT_MAX
  );

  let entry = engineRateLimits.get(engine);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    engineRateLimits.set(engine, entry);
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, resetInMs: Math.max(0, entry.resetAt - now) };
  }

  entry.count += 1;
  return { allowed: true, resetInMs: Math.max(0, entry.resetAt - now) };
}

function normalizeCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (!trimmed) return undefined;
  // Brave expects ISO country codes; normalize to uppercase 2-3 letter token.
  const code = trimmed.toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) {
    throw new Error(`Invalid country code: ${country}`);
  }
  return code;
}

function normalizeFreshness(
  freshness?: SearchOptions['freshness']
): SearchOptions['freshness'] | undefined {
  if (!freshness) return undefined;
  if (!ALLOWED_FRESHNESS.has(freshness)) {
    throw new Error(`Invalid freshness: ${freshness}`);
  }
  return freshness;
}

function normalizeSafeSearch(
  safesearch?: SearchOptions['safesearch']
): SearchOptions['safesearch'] | undefined {
  if (!safesearch) return undefined;
  if (!ALLOWED_SAFESEARCH.has(safesearch)) {
    throw new Error(`Invalid safesearch: ${safesearch}`);
  }
  return safesearch;
}

export function createWebSearchTool(apiKey?: string): WebSearchTool {
  const braveApiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY;

  if (!braveApiKey) {
    logger.warn('Brave Search API key not configured, web search will be unavailable');
  }

  function getCacheKey(query: string, options: SearchOptions): string {
    return JSON.stringify({ query, ...options });
  }

  return {
    async search(query, options = {}): Promise<SearchResponse> {
      const count = Math.min(options.count || 5, 20);
      const page = Math.max(1, Math.floor(options.page || 1));
      const offset =
        options.offset !== undefined
          ? Math.max(0, Math.floor(options.offset))
          : (page - 1) * count;
      const country = normalizeCountry(options.country);
      const freshness = normalizeFreshness(options.freshness);
      const safesearch = normalizeSafeSearch(options.safesearch);

      const cacheKey = getCacheKey(query, {
        ...options,
        count,
        page,
        offset,
        country,
        freshness,
        safesearch,
      });

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug({ query }, 'Returning cached search results');
        return { ...cached.response, cached: true };
      }

      if (!braveApiKey) {
        throw new Error('Brave Search API key not configured');
      }

      const rateLimit = checkEngineRateLimit(ENGINE_NAME);
      if (!rateLimit.allowed) {
        const resetSeconds = Math.ceil(rateLimit.resetInMs / 1000);
        throw new Error(
          `Search rate limit exceeded for ${ENGINE_NAME}. Try again in ${resetSeconds}s.`
        );
      }

      logger.info({ query, count, page, offset, country, freshness, safesearch }, 'Performing web search');

      try {
        // Build URL
        const params = new URLSearchParams({
          q: query,
          count: count.toString(),
          offset: offset.toString(),
        });

        if (country) {
          params.set('country', country);
        }
        if (freshness) {
          params.set('freshness', freshness);
        }
        if (safesearch) {
          params.set('safesearch', safesearch);
        }

        const response = await fetch(
          `https://api.search.brave.com/res/v1/web/search?${params}`,
          {
            headers: {
              Accept: 'application/json',
              'X-Subscription-Token': braveApiKey,
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Brave Search API error: ${response.status} ${error}`);
        }

        const data = await response.json() as {
          web?: { results?: Array<{ title: string; url: string; description: string; age?: string }>; total?: number };
        };

        // Parse results
        const results: SearchResult[] = (data.web?.results || []).map(
          (r: any) => ({
            title: r.title,
            url: r.url,
            description: r.description,
            date: r.age,
          })
        );

        const totalResults = data.web?.total;
        const hasMore =
          typeof totalResults === 'number'
            ? offset + results.length < totalResults
            : results.length === count;

        const searchResponse: SearchResponse = {
          query,
          results,
          totalResults,
          page,
          offset,
          count,
          hasMore,
          cached: false,
        };

        // Evict stale entries if cache is at capacity.
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const now = Date.now();
          for (const [k, v] of cache) {
            if (now - v.timestamp >= CACHE_TTL) cache.delete(k);
          }
        }
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }

        // Cache results
        cache.set(cacheKey, {
          response: searchResponse,
          timestamp: Date.now(),
        });

        return searchResponse;
      } catch (error) {
        logger.error({ error, query }, 'Web search failed');
        throw error;
      }
    },

    clearCache() {
      cache.clear();
      logger.info('Web search cache cleared');
    },
  };
}

/**
 * Format search results for display
 */
export function formatSearchResults(response: SearchResponse): string {
  if (response.results.length === 0) {
    return `No results found for "${response.query}"`;
  }

  const headerParts = [`**Search results for "${response.query}":**`];
  headerParts.push(`Page ${response.page}`);
  if (typeof response.totalResults === 'number') {
    headerParts.push(`${response.totalResults.toLocaleString()} total`);
  }
  const lines = [`${headerParts.join(' ')}\n`];

  for (let i = 0; i < response.results.length; i++) {
    const r = response.results[i];
    const index = response.offset + i + 1;
    lines.push(`${index}. **${r.title}**`);
    lines.push(`   ${r.url}`);
    lines.push(`   ${r.description}`);
    if (r.date) {
      lines.push(`   _${r.date}_`);
    }
    lines.push('');
  }

  if (response.hasMore) {
    lines.push(`More results available. Try page ${response.page + 1}.`);
  }

  return lines.join('\n');
}
