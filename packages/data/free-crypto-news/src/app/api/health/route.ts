import { NextResponse } from 'next/server';
import { newsCache, marketCache, aiCache, globalCache } from '@/lib/distributed-cache';
import { sentry } from '@/lib/sentry';

export const runtime = 'edge';

// System metrics for scalability monitoring
interface SystemMetrics {
  cache: {
    news: { hits: number; misses: number; staleHits: number; errors: number; backend: string };
    market: { hits: number; misses: number; staleHits: number; errors: number; backend: string };
    ai: { hits: number; misses: number; staleHits: number; errors: number; backend: string };
    global: { hits: number; misses: number; staleHits: number; errors: number; backend: string };
  };
  monitoring: {
    sentry: boolean;
    environment: string;
    release: string;
  };
}

// Comprehensive RSS source health check list (all 35+ sources)
const RSS_SOURCES = {
  // Tier 1: Major News Outlets
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  theblock: 'https://www.theblock.co/rss.xml',
  decrypt: 'https://decrypt.co/feed',
  cointelegraph: 'https://cointelegraph.com/rss',
  bitcoinmagazine: 'https://bitcoinmagazine.com/.rss/full/',
  blockworks: 'https://blockworks.co/feed',
  defiant: 'https://thedefiant.io/feed',
  // Tier 2: Established Sources
  bitcoinist: 'https://bitcoinist.com/feed/',
  cryptoslate: 'https://cryptoslate.com/feed/',
  newsbtc: 'https://www.newsbtc.com/feed/',
  cryptonews: 'https://crypto.news/feed/',
  cryptopotato: 'https://cryptopotato.com/feed/',
  // DeFi & Web3
  rekt: 'https://rekt.news/rss.xml',
  // Research & Analysis
  messari: 'https://messari.io/rss',
  ambcrypto: 'https://ambcrypto.com/feed/',
  beincrypto: 'https://beincrypto.com/feed/',
  u_today: 'https://u.today/rss',
  cryptobriefing: 'https://cryptobriefing.com/feed/',
  // Asia-Pacific
  forkast: 'https://forkast.news/feed/',
  coingape: 'https://coingape.com/feed/',
} as const;

interface SourceHealth {
  source: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastArticle?: string;
  error?: string;
}

export async function GET() {
  const startTime = Date.now();
  
  const healthChecks = await Promise.allSettled(
    Object.entries(RSS_SOURCES).map(async ([key, url]): Promise<SourceHealth> => {
      const checkStart = Date.now();
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml',
            'User-Agent': 'FreeCryptoNews/1.0 HealthCheck',
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
        
        const responseTime = Date.now() - checkStart;
        
        if (!response.ok) {
          return {
            source: key,
            status: 'down',
            responseTime,
            error: `HTTP ${response.status}`,
          };
        }
        
        const xml = await response.text();
        
        // Check if we got valid RSS
        const hasItems = xml.includes('<item>') || xml.includes('<entry>');
        const titleMatch = xml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
        
        if (!hasItems) {
          return {
            source: key,
            status: 'degraded',
            responseTime,
            error: 'No articles found in feed',
          };
        }
        
        return {
          source: key,
          status: responseTime > 5000 ? 'degraded' : 'healthy',
          responseTime,
          lastArticle: titleMatch?.[1]?.slice(0, 100),
        };
      } catch (error) {
        return {
          source: key,
          status: 'down',
          responseTime: Date.now() - checkStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );
  
  const sources = healthChecks
    .filter((r): r is PromiseFulfilledResult<SourceHealth> => r.status === 'fulfilled')
    .map(r => r.value);
  
  const healthyCount = sources.filter(s => s.status === 'healthy').length;
  const degradedCount = sources.filter(s => s.status === 'degraded').length;
  const downCount = sources.filter(s => s.status === 'down').length;
  
  // Overall status
  let overallStatus: 'healthy' | 'degraded' | 'down';
  if (healthyCount >= 5) {
    overallStatus = 'healthy';
  } else if (healthyCount >= 3) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'down';
  }
  
  // Collect system metrics
  const sentryConfig = sentry.getConfig();
  const systemMetrics: SystemMetrics = {
    cache: {
      news: newsCache.getStats(),
      market: marketCache.getStats(),
      ai: aiCache.getStats(),
      global: globalCache.getStats(),
    },
    monitoring: {
      sentry: sentryConfig.enabled,
      environment: sentryConfig.environment,
      release: sentryConfig.release,
    },
  };

  const result = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalResponseTime: Date.now() - startTime,
    summary: {
      healthy: healthyCount,
      degraded: degradedCount,
      down: downCount,
      total: sources.length,
    },
    system: systemMetrics,
    sources,
  };
  
  const statusCode = overallStatus === 'down' ? 503 : 200;
  
  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
