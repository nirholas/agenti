/**
 * X/Twitter Research Skill
 *
 * Search tweets, follow threads, analyze profiles, and track watchlists
 * via Composio (zero API cost).
 *
 * Commands:
 *   /x search <query> [options]    Search recent tweets
 *   /x thread <tweet_id>           Fetch conversation thread
 *   /x profile <username>          Recent tweets from a user
 *   /x tweet <tweet_id>            Fetch a single tweet
 *   /x watchlist                   Show/manage watchlist
 */

import { createCache } from '../../../cache/index.js';

// =============================================================================
// TYPES
// =============================================================================

interface Tweet {
  id: string;
  text: string;
  author_id: string;
  username: string;
  name: string;
  created_at: string;
  conversation_id: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    impressions: number;
    bookmarks: number;
  };
  urls: string[];
  mentions: string[];
  hashtags: string[];
  tweet_url: string;
}

interface ComposioResult {
  data?: {
    data?: any[];
    includes?: { users?: any[] };
    meta?: { next_token?: string; result_count?: number };
  };
  successful?: boolean;
  error?: string;
}

// =============================================================================
// CACHE
// =============================================================================

const tweetCache = createCache<string, Tweet[]>({
  maxSize: 200,
  defaultTtl: 15 * 60 * 1000, // 15 minutes
  name: 'x-research',
});

// =============================================================================
// COMPOSIO API
// =============================================================================

const COMPOSIO_BASE = 'https://backend.composio.dev/api';
const RATE_DELAY_MS = 500;

function getComposioKey(): string {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error('COMPOSIO_API_KEY not set');
  return key;
}

function getConnectionId(): string {
  const id = process.env.COMPOSIO_CONNECTION_ID;
  if (!id) throw new Error('COMPOSIO_CONNECTION_ID not set');
  return id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseTweets(raw: any): Tweet[] {
  const data = raw?.data ?? raw;
  const tweets = Array.isArray(data) ? data : data?.data ?? [];
  if (!Array.isArray(tweets) || tweets.length === 0) return [];

  const users: Record<string, any> = {};
  const includes = raw?.includes ?? raw?.data?.includes ?? {};
  for (const u of includes?.users ?? []) {
    users[u.id] = u;
  }

  return tweets.map((t: any) => {
    const u = users[t.author_id] ?? {};
    const m = t.public_metrics ?? {};
    return {
      id: t.id,
      text: t.text,
      author_id: t.author_id,
      username: u.username ?? '?',
      name: u.name ?? '?',
      created_at: t.created_at,
      conversation_id: t.conversation_id ?? t.id,
      metrics: {
        likes: m.like_count ?? 0,
        retweets: m.retweet_count ?? 0,
        replies: m.reply_count ?? 0,
        quotes: m.quote_count ?? 0,
        impressions: m.impression_count ?? 0,
        bookmarks: m.bookmark_count ?? 0,
      },
      urls: (t.entities?.urls ?? [])
        .map((u: any) => u.expanded_url)
        .filter(Boolean),
      mentions: (t.entities?.mentions ?? [])
        .map((m: any) => m.username)
        .filter(Boolean),
      hashtags: (t.entities?.hashtags ?? [])
        .map((h: any) => h.tag)
        .filter(Boolean),
      tweet_url: `https://x.com/${u.username ?? '?'}/status/${t.id}`,
    };
  });
}

async function composioExec(action: string, params: Record<string, any>): Promise<any> {
  const key = getComposioKey();
  const connId = getConnectionId();

  const res = await fetch(`${COMPOSIO_BASE}/v2/actions/${action}/execute`, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connectedAccountId: connId,
      input: params,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Composio ${res.status}: ${body.slice(0, 200)}`);
  }

  const result = (await res.json()) as ComposioResult;
  if (result.error) {
    throw new Error(`Composio error: ${result.error}`);
  }

  return result.data ?? result;
}

function parseSince(since: string): string | null {
  const match = since.match(/^(\d+)(m|h|d)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (Number.isNaN(num)) return null;
    const unit = match[2];
    const ms =
      unit === 'm' ? num * 60_000 :
      unit === 'h' ? num * 3_600_000 :
      num * 86_400_000;
    return new Date(Date.now() - ms).toISOString();
  }

  if (since.includes('T') || since.includes('-')) {
    try {
      return new Date(since).toISOString();
    } catch {
      return null;
    }
  }

  return null;
}

async function searchTweets(
  query: string,
  opts: {
    maxResults?: number;
    pages?: number;
    sortOrder?: 'relevancy' | 'recency';
    since?: string;
  } = {},
): Promise<Tweet[]> {
  const maxResults = Math.max(Math.min(opts.maxResults ?? 100, 100), 10);
  const pages = opts.pages ?? 1;
  const sort = opts.sortOrder ?? 'relevancy';

  let allTweets: Tweet[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    const params: Record<string, any> = {
      query,
      max_results: maxResults,
      sort_order: sort,
      tweet__fields: ['created_at', 'public_metrics', 'author_id', 'conversation_id', 'entities'],
      expansions: ['author_id'],
      user__fields: ['username', 'name', 'public_metrics', 'description'],
    };

    if (opts.since) {
      const startTime = parseSince(opts.since);
      if (startTime) params.start_time = startTime;
    }

    if (nextToken) {
      params.next_token = nextToken;
    }

    const result = await composioExec('TWITTER_RECENT_SEARCH', params);
    const tweets = parseTweets(result);
    allTweets.push(...tweets);

    nextToken = result?.meta?.next_token ?? result?.data?.meta?.next_token;
    if (!nextToken) break;
    if (page < pages - 1) await sleep(RATE_DELAY_MS);
  }

  return allTweets;
}

async function fetchThread(conversationId: string, pages?: number): Promise<Tweet[]> {
  const query = `conversation_id:${conversationId}`;
  return searchTweets(query, { pages: pages ?? 2, sortOrder: 'recency' });
}

async function fetchProfile(
  username: string,
  opts: { count?: number; includeReplies?: boolean } = {},
): Promise<{ user: any; tweets: Tweet[] }> {
  const replyFilter = opts.includeReplies ? '' : ' -is:reply';
  const query = `from:${username} -is:retweet${replyFilter}`;
  const tweets = await searchTweets(query, {
    maxResults: Math.min(opts.count ?? 20, 100),
    sortOrder: 'recency',
  });

  const user =
    tweets.length > 0
      ? { username: tweets[0].username, name: tweets[0].name }
      : { username, name: username };

  return { user, tweets };
}

async function fetchTweet(tweetId: string): Promise<Tweet | null> {
  const tweets = await searchTweets(tweetId, { maxResults: 10 });
  return tweets.find((t) => t.id === tweetId) ?? tweets[0] ?? null;
}

// =============================================================================
// SORTING & FILTERING
// =============================================================================

function sortBy(tweets: Tweet[], metric: 'likes' | 'impressions' | 'retweets' | 'replies' = 'likes'): Tweet[] {
  return [...tweets].sort((a, b) => b.metrics[metric] - a.metrics[metric]);
}

function filterEngagement(
  tweets: Tweet[],
  opts: { minLikes?: number; minImpressions?: number },
): Tweet[] {
  return tweets.filter((t) => {
    if (opts.minLikes && t.metrics.likes < opts.minLikes) return false;
    if (opts.minImpressions && t.metrics.impressions < opts.minImpressions) return false;
    return true;
  });
}

function dedupe(tweets: Tweet[]): Tweet[] {
  const seen = new Set<string>();
  return tweets.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// =============================================================================
// FORMATTING
// =============================================================================

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return '?';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatTweet(t: Tweet, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : '';
  const engagement = `${compactNumber(t.metrics.likes)}L ${compactNumber(t.metrics.impressions)}I`;
  const time = timeAgo(t.created_at);

  const text = t.text.length > 200 ? t.text.slice(0, 197) + '...' : t.text;
  const cleanText = text.replace(/https:\/\/t\.co\/\S+/g, '').trim();

  let out = `${prefix}@${t.username} (${engagement} | ${time})\n${cleanText}`;

  if (t.urls.length > 0) {
    out += `\n${t.urls[0]}`;
  }
  out += `\n${t.tweet_url}`;

  return out;
}

function formatResults(tweets: Tweet[], opts: { query?: string; limit?: number } = {}): string {
  const limit = opts.limit ?? 15;
  const shown = tweets.slice(0, limit);

  let out = '';
  if (opts.query) {
    out += `"${opts.query}" -- ${tweets.length} results\n\n`;
  }

  out += shown.map((t, i) => formatTweet(t, i)).join('\n\n');

  if (tweets.length > limit) {
    out += `\n\n... +${tweets.length - limit} more`;
  }

  return out;
}

function formatTweetMarkdown(t: Tweet): string {
  const engagement = `${t.metrics.likes}L ${t.metrics.impressions}I`;
  const cleanText = t.text.replace(/https:\/\/t\.co\/\S+/g, '').trim();
  const quoted = cleanText.replace(/\n/g, '\n  > ');

  let out = `- **@${t.username}** (${engagement}) [Tweet](${t.tweet_url})\n  > ${quoted}`;

  if (t.urls.length > 0) {
    out += `\n  Links: ${t.urls.map((u) => {
      try { return `[${new URL(u).hostname}](${u})`; } catch { return u; }
    }).join(', ')}`;
  }

  return out;
}

function formatResearchMarkdown(
  query: string,
  tweets: Tweet[],
  opts: { themes?: { title: string; tweetIds: string[] }[]; queries?: string[] } = {},
): string {
  const date = new Date().toISOString().split('T')[0];

  let out = `# X Research: ${query}\n\n`;
  out += `**Date:** ${date}\n`;
  out += `**Tweets found:** ${tweets.length}\n\n`;

  if (opts.themes && opts.themes.length > 0) {
    for (const theme of opts.themes) {
      out += `## ${theme.title}\n\n`;
      const themeTweets = theme.tweetIds
        .map((id) => tweets.find((t) => t.id === id))
        .filter(Boolean) as Tweet[];
      out += themeTweets.map(formatTweetMarkdown).join('\n\n');
      out += '\n\n';
    }
  } else {
    out += `## Top Results (by engagement)\n\n`;
    out += tweets.slice(0, 30).map(formatTweetMarkdown).join('\n\n');
    out += '\n\n';
  }

  out += `---\n\n## Research Metadata\n`;
  out += `- **Query:** ${query}\n`;
  out += `- **Date:** ${date}\n`;
  out += `- **Tweets scanned:** ${tweets.length}\n`;
  out += `- **Cost:** $0 (Composio)\n`;
  if (opts.queries) {
    out += `- **Search queries:**\n`;
    for (const q of opts.queries) {
      out += `  - \`${q}\`\n`;
    }
  }

  return out;
}

function formatProfile(user: any, tweets: Tweet[]): string {
  const m = user.public_metrics ?? {};
  let out = `@${user.username} -- ${user.name}\n`;
  if (m.followers_count) {
    out += `${compactNumber(m.followers_count)} followers | ${compactNumber(m.tweet_count ?? 0)} tweets\n`;
  }
  if (user.description) {
    out += `${user.description.slice(0, 150)}\n`;
  }
  out += '\nRecent:\n\n';
  out += tweets
    .slice(0, 10)
    .map((t, i) => formatTweet(t, i))
    .join('\n\n');

  return out;
}

// =============================================================================
// WATCHLIST (in-memory, session-scoped)
// =============================================================================

const watchlist = new Map<string, { note?: string; addedAt: string }>();

// =============================================================================
// ARG PARSING HELPERS
// =============================================================================

function parseArgs(raw: string): { positional: string[]; flags: Set<string>; opts: Map<string, string> } {
  const tokens = raw.trim().split(/\s+/);
  const positional: string[] = [];
  const flags = new Set<string>();
  const opts = new Map<string, string>();

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.startsWith('--')) {
      const name = tok.slice(2);
      // Check if next token exists and isn't a flag
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        opts.set(name, tokens[i + 1]);
        i += 2;
      } else {
        flags.add(name);
        i++;
      }
    } else {
      positional.push(tok);
      i++;
    }
  }

  return { positional, flags, opts };
}

function safeParseInt(val: string | undefined, fallback: number): number {
  if (val === undefined) return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

async function handleSearch(argsStr: string): Promise<string> {
  const { positional, flags, opts } = parseArgs(argsStr);

  const sortOpt = opts.get('sort') ?? 'likes';
  const minLikes = safeParseInt(opts.get('min-likes'), 0);
  const minImpressions = safeParseInt(opts.get('min-impressions'), 0);
  const pages = Math.min(safeParseInt(opts.get('pages'), 1), 5);
  const limit = safeParseInt(opts.get('limit'), 15);
  const since = opts.get('since');
  const noReplies = flags.has('no-replies');
  const noRetweets = flags.has('no-retweets');
  const asJson = flags.has('json');
  const asMarkdown = flags.has('markdown');

  let query = positional.join(' ');
  if (!query) return 'Usage: /x search <query> [--sort likes|recent] [--since 1h|1d|7d] [--limit N] [--pages N]';

  if (!query.includes('is:retweet') && !noRetweets) {
    query += ' -is:retweet';
  }
  if (noReplies && !query.includes('is:reply')) {
    query += ' -is:reply';
  }

  // Check cache
  const cacheKey = `search:${query}|sort=${sortOpt}&pages=${pages}&since=${since ?? '7d'}`;
  const cached = tweetCache.get(cacheKey);
  let tweets: Tweet[];

  if (cached) {
    tweets = cached;
  } else {
    tweets = await searchTweets(query, {
      pages,
      sortOrder: sortOpt === 'recent' ? 'recency' : 'relevancy',
      since: since ?? undefined,
    });
    tweetCache.set(cacheKey, tweets);
  }

  // Filter
  if (minLikes > 0 || minImpressions > 0) {
    tweets = filterEngagement(tweets, {
      minLikes: minLikes > 0 ? minLikes : undefined,
      minImpressions: minImpressions > 0 ? minImpressions : undefined,
    });
  }

  // Sort
  if (sortOpt !== 'recent') {
    const metric = sortOpt as 'likes' | 'impressions' | 'retweets';
    tweets = sortBy(tweets, metric);
  }

  tweets = dedupe(tweets);

  if (tweets.length === 0) return `No tweets found for "${positional.join(' ')}".`;

  // Output format
  if (asJson) {
    return JSON.stringify(tweets.slice(0, limit), null, 2);
  }
  if (asMarkdown) {
    return formatResearchMarkdown(positional.join(' '), tweets, { queries: [query] });
  }

  const sinceLabel = since ? ` | since ${since}` : '';
  const footer = `\n\n${tweets.length} tweets | sorted by ${sortOpt} | ${pages} page(s)${sinceLabel}`;

  return formatResults(tweets, { query: positional.join(' '), limit }) + footer;
}

async function handleThread(argsStr: string): Promise<string> {
  const { positional, opts } = parseArgs(argsStr);
  const tweetId = positional[0];
  if (!tweetId) return 'Usage: /x thread <tweet_id> [--pages N]';

  const pages = Math.min(safeParseInt(opts.get('pages'), 2), 5);
  const tweets = await fetchThread(tweetId, pages);

  if (tweets.length === 0) return 'No tweets found in thread.';

  let out = `Thread (${tweets.length} tweets)\n\n`;
  out += tweets.map((t) => formatTweet(t)).join('\n\n');
  return out;
}

async function handleProfile(argsStr: string): Promise<string> {
  const { positional, flags, opts } = parseArgs(argsStr);
  const username = positional[0]?.replace(/^@/, '');
  if (!username) return 'Usage: /x profile <username> [--count N] [--replies]';

  const count = safeParseInt(opts.get('count'), 20);
  const includeReplies = flags.has('replies');

  const asJson = flags.has('json');
  const { user, tweets } = await fetchProfile(username, { count, includeReplies });

  if (asJson) {
    return JSON.stringify({ user, tweets }, null, 2);
  }
  return formatProfile(user, tweets);
}

async function handleTweet(argsStr: string): Promise<string> {
  const { positional, flags } = parseArgs(argsStr);
  const tweetId = positional[0];
  if (!tweetId) return 'Usage: /x tweet <tweet_id>';

  const tweet = await fetchTweet(tweetId);
  if (!tweet) return 'Tweet not found.';

  if (flags.has('json')) {
    return JSON.stringify(tweet, null, 2);
  }
  return formatTweet(tweet);
}

async function handleWatchlist(argsStr: string): Promise<string> {
  const parts = argsStr.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  if (sub === 'add') {
    const username = parts[1]?.replace(/^@/, '');
    if (!username) return 'Usage: /x watchlist add <username> [note]';

    const key = username.toLowerCase();
    if (watchlist.has(key)) return `@${username} already on watchlist.`;

    const note = parts.slice(2).join(' ') || undefined;
    watchlist.set(key, { note, addedAt: new Date().toISOString() });
    return `Added @${username} to watchlist.${note ? ` (${note})` : ''}`;
  }

  if (sub === 'remove' || sub === 'rm') {
    const username = parts[1]?.replace(/^@/, '');
    if (!username) return 'Usage: /x watchlist remove <username>';

    const key = username.toLowerCase();
    if (watchlist.delete(key)) {
      return `Removed @${username} from watchlist.`;
    }
    return `@${username} not found on watchlist.`;
  }

  if (sub === 'check') {
    if (watchlist.size === 0) return 'Watchlist is empty. Add accounts with: /x watchlist add <username>';

    const lines: string[] = [`Checking ${watchlist.size} watchlist accounts...\n`];

    for (const [key, entry] of watchlist) {
      try {
        const { user, tweets } = await fetchProfile(key, { count: 5 });
        const label = entry.note ? ` (${entry.note})` : '';
        lines.push(`\n--- @${key}${label} ---`);
        if (tweets.length === 0) {
          lines.push('  No recent tweets.');
        } else {
          for (const t of tweets.slice(0, 3)) {
            lines.push(formatTweet(t));
            lines.push('');
          }
        }
      } catch (e: any) {
        lines.push(`Error checking @${key}: ${e.message}`);
      }
    }
    return lines.join('\n');
  }

  // Default: show watchlist
  if (watchlist.size === 0) return 'Watchlist is empty. Add accounts with: /x watchlist add <username>';

  const lines = [`Watchlist (${watchlist.size} accounts)\n`];
  for (const [key, entry] of watchlist) {
    const note = entry.note ? ` -- ${entry.note}` : '';
    const added = entry.addedAt.split('T')[0];
    lines.push(`  @${key}${note} (added ${added})`);
  }
  return lines.join('\n');
}

function handleCache(argsStr: string): string {
  const sub = argsStr.trim().toLowerCase();
  if (sub === 'clear') {
    tweetCache.clear();
    return 'Cache cleared.';
  }
  const stats = tweetCache.stats();
  return `Cache: ${stats.size}/${stats.maxSize} entries | hit rate: ${(stats.hitRate * 100).toFixed(0)}% | hits: ${stats.hits}, misses: ${stats.misses}`;
}

// =============================================================================
// MAIN EXECUTE
// =============================================================================

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? 'help';
  const rest = parts.slice(1).join(' ');

  try {
    switch (cmd) {
      case 'search':
      case 's':
        return await handleSearch(rest);
      case 'thread':
      case 't':
        return await handleThread(rest);
      case 'profile':
      case 'p':
        return await handleProfile(rest);
      case 'tweet':
        return await handleTweet(rest);
      case 'watchlist':
      case 'wl':
        return await handleWatchlist(rest);
      case 'cache':
        return handleCache(rest);
      case 'help':
      default:
        return helpText();
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**X/Twitter Research** (via Composio)

**Commands:**
  /x search <query> [options]     Search recent tweets (last 7 days)
  /x thread <tweet_id>            Fetch full conversation thread
  /x profile <username>           Recent tweets from a user
  /x tweet <tweet_id>             Fetch a single tweet
  /x watchlist                    Show watchlist
  /x watchlist add <user> [note]  Add user to watchlist
  /x watchlist remove <user>      Remove user from watchlist
  /x watchlist check              Check recent tweets from all watchlist accounts
  /x cache clear                  Clear search cache

**Search options:**
  --sort likes|impressions|retweets|recent  (default: likes)
  --since 1h|3h|12h|1d|7d         Time filter
  --min-likes N                    Filter minimum likes
  --min-impressions N              Filter minimum impressions
  --pages N                        Pages to fetch, 1-5 (default: 1)
  --limit N                        Results to display (default: 15)
  --no-replies                     Exclude replies
  --no-retweets                    Exclude retweets
  --json                           Raw JSON output
  --markdown                       Markdown research document output

**Examples:**
  /x search "claude code"
  /x search "polymarket" --sort recent --since 1d --markdown
  /x profile elonmusk --count 5 --json
  /x watchlist add vikiival "Polymarket whale"`;
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  name: 'x-research',
  description: 'X/Twitter research via Composio — search, threads, profiles, watchlists',
  commands: ['/x', '/x-research', '/twitter'],
  handle: execute,
  requires: {
    env: ['COMPOSIO_API_KEY', 'COMPOSIO_CONNECTION_ID'],
  },
};
