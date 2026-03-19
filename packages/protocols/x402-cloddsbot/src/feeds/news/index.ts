/**
 * News Feed - RSS and Twitter monitoring for market-moving news
 */

import { EventEmitter } from 'events';
import { XMLParser } from 'fast-xml-parser';
import { NewsItem } from '../../types';
import { logger } from '../../utils/logger';

const RSS_FEEDS = [
  { name: 'Reuters Politics', url: 'https://feeds.reuters.com/Reuters/PoliticsNews' },
  { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
  { name: 'Politico', url: 'https://www.politico.com/rss/politicopicks.xml' },
  { name: 'FiveThirtyEight', url: 'https://fivethirtyeight.com/politics/feed/' },
];

// Keywords that often move prediction markets
const MARKET_KEYWORDS = [
  // Politics
  'trump', 'biden', 'election', 'poll', 'polling', 'campaign', 'candidate',
  'republican', 'democrat', 'congress', 'senate', 'house', 'vote', 'ballot',
  'indictment', 'trial', 'verdict', 'impeach',
  // Economics
  'fed', 'federal reserve', 'rate cut', 'rate hike', 'inflation', 'cpi',
  'fomc', 'powell', 'interest rate', 'gdp', 'recession', 'employment',
  'jobs report', 'unemployment',
  // Crypto
  'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'sec', 'etf',
  // Sports
  'injury', 'injured', 'out for', 'ruled out', 'questionable',
];

export interface NewsFeed extends EventEmitter {
  start(): Promise<void>;
  stop(): void;
  getRecentNews(limit?: number): NewsItem[];
  searchNews(query: string): NewsItem[];
  getNewsForMarket(marketQuestion: string): NewsItem[];
}

interface RSSItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  'dc:creator'?: string;
  author?: string;
}

export async function createNewsFeed(config?: {
  twitter?: {
    accounts: string[];
    bearerToken?: string;
    baseUrl?: string;
    requestTimeoutMs?: number;
  };
}): Promise<NewsFeed> {
  const emitter = new EventEmitter() as NewsFeed;
  const newsCache: NewsItem[] = [];
  let pollInterval: NodeJS.Timeout | null = null;
  const parser = new XMLParser({ ignoreAttributes: false });
  const feedState = new Map<string, {
    lastFetchMs: number;
    backoffUntilMs: number;
    failures: number;
  }>();
  const MIN_FETCH_INTERVAL_MS = 60_000;
  const MAX_BACKOFF_MS = 15 * 60_000;
  const TWITTER_MIN_INTERVAL_MS = 60_000;
  const TWITTER_MAX_BACKOFF_MS = 30 * 60_000;
  const TWITTER_BASE_URL = config?.twitter?.baseUrl || process.env.X_API_BASE_URL || 'https://api.x.com/2';
  const TWITTER_BEARER_TOKEN = config?.twitter?.bearerToken ||
    process.env.X_BEARER_TOKEN ||
    process.env.TWITTER_BEARER_TOKEN;

  function getFeedState(feedName: string) {
    if (!feedState.has(feedName)) {
      feedState.set(feedName, { lastFetchMs: 0, backoffUntilMs: 0, failures: 0 });
    }
    return feedState.get(feedName)!;
  }

  function computeBackoffMs(failures: number): number {
    return Math.min(30_000 * Math.pow(2, Math.max(0, failures - 1)), MAX_BACKOFF_MS);
  }

  function computeTwitterBackoffMs(failures: number): number {
    return Math.min(60_000 * Math.pow(2, Math.max(0, failures - 1)), TWITTER_MAX_BACKOFF_MS);
  }

  async function fetchRSSFeed(feedUrl: string, feedName: string): Promise<NewsItem[]> {
    try {
      const state = getFeedState(feedName);
      const now = Date.now();

      if (now < state.backoffUntilMs) {
        return [];
      }
      if (state.lastFetchMs > 0 && now - state.lastFetchMs < MIN_FETCH_INTERVAL_MS) {
        return [];
      }

      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Clodds/1.0 News Aggregator' },
      });

      if (!response.ok) {
        state.failures += 1;
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const retrySeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
          const retryMs = Number.isFinite(retrySeconds)
            ? retrySeconds * 1000
            : computeBackoffMs(state.failures);
          state.backoffUntilMs = Date.now() + retryMs;
          logger.warn(`Rate limited by ${feedName}, backing off for ${retryMs}ms`);
        } else {
          const backoffMs = computeBackoffMs(state.failures);
          state.backoffUntilMs = Date.now() + backoffMs;
          logger.warn(`Failed to fetch ${feedName}: ${response.status}`);
        }
        return [];
      }

      const xml = await response.text();
      const result = parser.parse(xml);
      state.lastFetchMs = Date.now();
      state.failures = 0;
      state.backoffUntilMs = 0;

      const items: RSSItem[] = result?.rss?.channel?.item ||
                               result?.feed?.entry ||
                               [];

      return items.slice(0, 10).map((item, idx) => ({
        id: `${feedName}-${Date.now()}-${idx}`,
        source: feedName,
        sourceType: 'rss' as const,
        author: item['dc:creator'] || item.author,
        title: item.title || '',
        content: item.description,
        url: item.link || '',
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        relevantMarkets: findRelevantMarkets(item.title || '', item.description || ''),
      }));
    } catch (error) {
      const state = getFeedState(feedName);
      state.failures += 1;
      const backoffMs = computeBackoffMs(state.failures);
      state.backoffUntilMs = Date.now() + backoffMs;
      logger.error(`Error fetching ${feedName}:`, error);
      return [];
    }
  }

  function findRelevantMarkets(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    const matches: string[] = [];

    for (const keyword of MARKET_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }

    return [...new Set(matches)];
  }

  function isMarketMoving(item: NewsItem): boolean {
    return (item.relevantMarkets?.length || 0) >= 2;
  }

  async function pollAllFeeds(): Promise<void> {
    logger.info('Polling news feeds...');

    for (const feed of RSS_FEEDS) {
      const items = await fetchRSSFeed(feed.url, feed.name);

      for (const item of items) {
        // Check if we already have this news item
        const exists = newsCache.some(
          cached => cached.id === item.id || (cached.title === item.title && cached.source === item.source)
        );

        if (!exists) {
          newsCache.unshift(item);

          // Emit event for market-moving news
          if (isMarketMoving(item)) {
            emitter.emit('news', item);
            logger.info(`Market-moving news: ${item.title}`);
          }
        }
      }
    }

    // Keep cache at reasonable size
    while (newsCache.length > 500) {
      newsCache.pop();
    }

    await pollTwitter();
  }

  type TwitterUserResponse = { data?: { id: string; username: string } };
  type Tweet = { id: string; text: string; created_at?: string };
  type TwitterTweetsResponse = { data?: Tweet[] };

  const twitterState = new Map<string, {
    userId?: string;
    lastFetchMs: number;
    backoffUntilMs: number;
    failures: number;
    lastSeenId?: string;
  }>();

  function getTwitterState(username: string) {
    if (!twitterState.has(username)) {
      twitterState.set(username, { lastFetchMs: 0, backoffUntilMs: 0, failures: 0 });
    }
    return twitterState.get(username)!;
  }

  async function fetchTwitterResponse(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, config?.twitter?.requestTimeoutMs ?? 8000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchTwitterJson<T>(url: string): Promise<T> {
    const response = await fetchTwitterResponse(url);
    if (!response.ok) {
      throw new Error(`X API error: ${response.status}`);
    }
    return await response.json() as T;
  }

  async function resolveTwitterUserId(username: string): Promise<string | null> {
    const url = `${TWITTER_BASE_URL}/users/by/username/${encodeURIComponent(username)}`;
    const response = await fetchTwitterJson<TwitterUserResponse>(url);
    return response.data?.id ?? null;
  }

  async function fetchLatestTweets(username: string): Promise<NewsItem[]> {
    if (!TWITTER_BEARER_TOKEN) return [];

    const state = getTwitterState(username);
    const now = Date.now();
    if (now < state.backoffUntilMs) return [];
    if (state.lastFetchMs > 0 && now - state.lastFetchMs < TWITTER_MIN_INTERVAL_MS) return [];

    try {
      if (!state.userId) {
        state.userId = await resolveTwitterUserId(username) || undefined;
        if (!state.userId) {
          throw new Error(`X API error: user not found for ${username}`);
        }
      }

      const params = new URLSearchParams({
        max_results: '5',
        'tweet.fields': 'created_at',
        exclude: 'retweets,replies',
      });
      if (state.lastSeenId) {
        params.set('since_id', state.lastSeenId);
      }

      const url = `${TWITTER_BASE_URL}/users/${state.userId}/tweets?${params}`;
      const response = await fetchTwitterResponse(url);
      if (!response.ok) {
        if (response.status === 429) {
          state.failures += 1;
          const resetHeader = response.headers.get('x-rate-limit-reset');
          const resetSeconds = resetHeader ? Number.parseInt(resetHeader, 10) : NaN;
          const resetMs = Number.isFinite(resetSeconds)
            ? resetSeconds * 1000
            : Date.now() + computeTwitterBackoffMs(state.failures + 1);
          state.backoffUntilMs = resetMs;
          logger.warn(`X API rate limited for ${username}, backing off until ${new Date(resetMs).toISOString()}`);
          return [];
        }
        throw new Error(`X API error: ${response.status}`);
      }

      const data = await response.json() as TwitterTweetsResponse;
      const tweets = data.data || [];
      if (tweets.length === 0) {
        state.lastFetchMs = Date.now();
        return [];
      }

      state.lastFetchMs = Date.now();
      state.failures = 0;
      state.backoffUntilMs = 0;
      state.lastSeenId = tweets[0]?.id;

      return tweets.map((tweet) => ({
        id: `x-${tweet.id}`,
        source: `X @${username}`,
        sourceType: 'twitter' as const,
        author: username,
        title: tweet.text,
        content: tweet.text,
        url: `https://x.com/${username}/status/${tweet.id}`,
        publishedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
        relevantMarkets: findRelevantMarkets(tweet.text, tweet.text),
      }));
    } catch (error) {
      state.failures += 1;
      const backoffMs = computeTwitterBackoffMs(state.failures);
      state.backoffUntilMs = Date.now() + backoffMs;
      logger.warn({ error, username }, 'X API error fetching tweets');
      return [];
    }
  }

  async function pollTwitter(): Promise<void> {
    const accounts = config?.twitter?.accounts ?? [];
    if (!TWITTER_BEARER_TOKEN || accounts.length === 0) return;

    for (const account of accounts) {
      const items = await fetchLatestTweets(account);
      for (const item of items) {
        const exists = newsCache.some(
          cached => cached.id === item.id || (cached.title === item.title && cached.source === item.source)
        );
        if (!exists) {
          newsCache.unshift(item);
          if (isMarketMoving(item)) {
            emitter.emit('news', item);
            logger.info(`Market-moving news: ${item.title}`);
          }
        }
      }
    }
  }

  // Assign methods to emitter
  emitter.start = async () => {
    logger.info('Starting news feed...');
    await pollAllFeeds();
    // Poll every 5 minutes
    pollInterval = setInterval(pollAllFeeds, 5 * 60 * 1000);
  };

  emitter.stop = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    logger.info('News feed stopped');
  };

  emitter.getRecentNews = (limit = 20) => {
    return newsCache.slice(0, limit);
  };

  emitter.searchNews = (query: string) => {
    const queryLower = query.toLowerCase();
    return newsCache.filter(item =>
      item.title.toLowerCase().includes(queryLower) ||
      item.content?.toLowerCase().includes(queryLower)
    );
  };

  emitter.getNewsForMarket = (marketQuestion: string) => {
    const words = marketQuestion.toLowerCase().split(/\s+/);
    const significantWords = words.filter(w => w.length > 3);

    return newsCache.filter(item => {
      const text = `${item.title} ${item.content || ''}`.toLowerCase();
      return significantWords.some(word => text.includes(word));
    }).slice(0, 10);
  };

  return emitter;
}
