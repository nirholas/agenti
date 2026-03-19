/**
 * Web Fetch Tool - Clawdbot-style URL content fetching
 *
 * Features:
 * - Fetch URLs and convert to markdown
 * - HTML to markdown conversion
 * - Content truncation
 * - Caching
 * - Auto-rewrite to LLM-friendly .md URLs for supported doc sites
 */

import { logger } from '../utils/logger';

// =============================================================================
// LLM-FRIENDLY DOCUMENTATION REGISTRY
// =============================================================================

/**
 * Sites that serve clean Markdown when you append .md to the URL.
 * Following the llms.txt convention: https://llmstxt.org/
 *
 * Pattern: hostname -> { pathPrefix, transform }
 * - pathPrefix: only rewrite URLs under this path (e.g., '/docs')
 * - transform: 'append-md' appends .md to the path
 */
export interface LlmDocSiteRule {
  /** Only rewrite paths starting with this prefix */
  pathPrefix: string;
  /** How to transform the URL */
  transform: 'append-md';
  /** Human-readable name */
  name: string;
}

export const LLM_DOC_SITES: Record<string, LlmDocSiteRule[]> = {
  'solana.com': [
    { pathPrefix: '/docs', transform: 'append-md', name: 'Solana Docs' },
  ],
  'docs.anthropic.com': [
    { pathPrefix: '/', transform: 'append-md', name: 'Anthropic Docs' },
  ],
  'docs.stripe.com': [
    { pathPrefix: '/', transform: 'append-md', name: 'Stripe Docs' },
  ],
  'docs.gitbook.com': [
    { pathPrefix: '/', transform: 'append-md', name: 'GitBook Docs' },
  ],
};

/**
 * Curated LLM-friendly documentation links for blockchain/trading dev.
 * Agents and devs can reference these for research.
 */
export const LLM_DOC_URLS: Record<string, { url: string; llmUrl: string; description: string }> = {
  'solana-core':       { url: 'https://solana.com/docs/core',              llmUrl: 'https://solana.com/docs/core.md',              description: 'Solana core concepts (accounts, txs, programs)' },
  'solana-rpc':        { url: 'https://solana.com/docs/rpc',               llmUrl: 'https://solana.com/docs/rpc.md',               description: 'Solana JSON-RPC API reference' },
  'solana-tokens':     { url: 'https://solana.com/docs/core/tokens',       llmUrl: 'https://solana.com/docs/core/tokens.md',       description: 'SPL tokens, token extensions, metadata' },
  'solana-programs':   { url: 'https://solana.com/docs/programs',          llmUrl: 'https://solana.com/docs/programs.md',           description: 'On-chain program development' },
  'solana-web3js':     { url: 'https://solana.com/docs/clients/javascript',llmUrl: 'https://solana.com/docs/clients/javascript.md', description: '@solana/web3.js client SDK' },
  'anthropic-api':     { url: 'https://docs.anthropic.com/en/api',         llmUrl: 'https://docs.anthropic.com/en/api.md',          description: 'Anthropic Claude API reference' },
  'stripe-api':        { url: 'https://docs.stripe.com/api',               llmUrl: 'https://docs.stripe.com/api.md',               description: 'Stripe payments API' },
};

/**
 * Rewrite a URL to its LLM-friendly .md variant if the site supports it.
 * Returns the original URL unchanged if no rule matches.
 */
export function toLlmFriendlyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const rules = LLM_DOC_SITES[parsed.hostname];
    if (!rules) return url;

    // Already ends with .md
    if (parsed.pathname.endsWith('.md')) return url;

    for (const rule of rules) {
      if (parsed.pathname.startsWith(rule.pathPrefix)) {
        // Strip trailing slash before appending .md
        const cleanPath = parsed.pathname.endsWith('/')
          ? parsed.pathname.slice(0, -1)
          : parsed.pathname;
        parsed.pathname = cleanPath + '.md';
        return parsed.toString();
      }
    }
    return url;
  } catch {
    return url;
  }
}

/** Fetch options */
export interface FetchOptions {
  /** Max content length in characters */
  maxLength?: number;
  /** Output format */
  format?: 'markdown' | 'text' | 'html';
  /** Include metadata (title, description) */
  includeMetadata?: boolean;
  /** Timeout in ms */
  timeout?: number;
}

/** Fetch result */
export interface FetchResult {
  url: string;
  title?: string;
  description?: string;
  content: string;
  contentType: string;
  truncated: boolean;
  cached: boolean;
}

export interface WebFetchTool {
  /** Fetch a URL and return content */
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;

  /** Clear cache */
  clearCache(): void;
}

// Simple cache
interface CacheEntry {
  result: FetchResult;
  timestamp: number;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();

const DEFAULT_MAX_LENGTH = 50000;
const DEFAULT_TIMEOUT = 30000;

/**
 * Simple HTML to text conversion
 */
function htmlToText(html: string): string {
  return html
    // Remove scripts and styles
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Convert common elements
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Simple HTML to markdown conversion
 */
function htmlToMarkdown(html: string): string {
  return html
    // Remove scripts and styles
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n')
    // Bold and italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n')
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Paragraphs and breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extract metadata from HTML
 */
function extractMetadata(html: string): { title?: string; description?: string } {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
  );

  return {
    title: titleMatch ? titleMatch[1].trim() : undefined,
    description: descMatch ? descMatch[1].trim() : undefined,
  };
}

export function createWebFetchTool(): WebFetchTool {
  return {
    async fetch(url, options = {}): Promise<FetchResult> {
      const maxLength = options.maxLength || DEFAULT_MAX_LENGTH;
      const format = options.format || 'markdown';
      const timeout = options.timeout || DEFAULT_TIMEOUT;

      // Auto-rewrite to LLM-friendly .md URL if supported
      const fetchUrl = toLlmFriendlyUrl(url);
      if (fetchUrl !== url) {
        logger.debug({ original: url, rewritten: fetchUrl }, 'Rewritten to LLM-friendly URL');
      }

      const cacheKey = `${fetchUrl}:${format}:${maxLength}`;

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug({ url: fetchUrl }, 'Returning cached fetch result');
        return { ...cached.result, cached: true };
      }

      logger.info({ url: fetchUrl, format }, 'Fetching URL');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(fetchUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Clodds/1.0 (Web Fetch Tool)',
            Accept: 'text/markdown,text/html,application/xhtml+xml,text/plain,*/*',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'text/plain';
        let rawContent = await response.text();

        // Extract metadata
        let title: string | undefined;
        let description: string | undefined;
        if (options.includeMetadata && contentType.includes('html')) {
          const meta = extractMetadata(rawContent);
          title = meta.title;
          description = meta.description;
        }

        // Convert content
        let content: string;
        if (contentType.includes('html')) {
          if (format === 'markdown') {
            content = htmlToMarkdown(rawContent);
          } else if (format === 'text') {
            content = htmlToText(rawContent);
          } else {
            content = rawContent;
          }
        } else {
          content = rawContent;
        }

        // Truncate if needed
        let truncated = false;
        if (content.length > maxLength) {
          content = content.slice(0, maxLength) + '\n\n... (content truncated)';
          truncated = true;
        }

        const result: FetchResult = {
          url: fetchUrl,
          title,
          description,
          content,
          contentType,
          truncated,
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

        // Cache result
        cache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });

        return result;
      } catch (error) {
        logger.error({ error, url: fetchUrl }, 'Web fetch failed');
        throw error;
      }
    },

    clearCache() {
      cache.clear();
      logger.info('Web fetch cache cleared');
    },
  };
}
