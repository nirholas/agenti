/**
 * Drift BET Feed
 * Prediction markets on Solana
 *
 * Docs: https://docs.drift.trade/prediction-markets/
 */

import { EventEmitter } from 'events';
import { Market, Outcome, PriceUpdate, Platform } from '../../types';
import { logger } from '../../utils/logger';

// Drift BET API endpoints
const DEFAULT_BET_API_URL = 'https://bet.drift.trade/api';

export interface DriftFeedConfig {
  betApiUrl?: string;
  requestTimeoutMs?: number;
}

interface DriftMarket {
  marketIndex: number;
  baseAssetSymbol: string;
  marketName: string;
  status: string;
  expiryTs: number;
  probability: number;
  volume24h: number;
  openInterest: number;
  description?: string;
}

export interface DriftFeed extends EventEmitter {
  start: () => Promise<void>;
  stop: () => void;
  searchMarkets: (query: string) => Promise<Market[]>;
  getMarket: (marketIndex: string) => Promise<Market | null>;
  subscribeToMarket: (marketIndex: string) => void;
  unsubscribeFromMarket: (marketIndex: string) => void;
}

export async function createDriftFeed(config: DriftFeedConfig = {}): Promise<DriftFeed> {
  const emitter = new EventEmitter();
  let pollInterval: NodeJS.Timeout | null = null;
  const subscribedMarkets = new Set<string>();
  const priceCache = new Map<string, number>();
  const betApiUrl = config.betApiUrl || process.env.DRIFT_BET_API_URL || DEFAULT_BET_API_URL;
  const requestTimeoutMs = Math.max(1000, config.requestTimeoutMs ?? 8000);

  async function fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Drift API error: ${response.status}`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  function convertToMarket(m: DriftMarket): Market {
    const prob = m.probability;

    return {
      id: m.marketIndex.toString(),
      platform: 'drift' as Platform,
      slug: m.baseAssetSymbol.toLowerCase(),
      question: m.marketName,
      description: m.description,
      outcomes: [
        {
          id: `${m.marketIndex}-yes`,
          name: 'Yes',
          price: prob,
          volume24h: m.volume24h / 2,
        },
        {
          id: `${m.marketIndex}-no`,
          name: 'No',
          price: 1 - prob,
          volume24h: m.volume24h / 2,
        },
      ],
      volume24h: m.volume24h,
      liquidity: m.openInterest,
      endDate: m.expiryTs ? new Date(m.expiryTs * 1000) : undefined,
      resolved: m.status === 'resolved',
      tags: ['solana', 'crypto'],
      url: `https://bet.drift.trade/market/${m.marketIndex}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async function fetchMarkets(): Promise<DriftMarket[]> {
    try {
      // Drift BET API - fetch prediction markets
      const data: any = await fetchJson(`${betApiUrl}/markets`);
      if (!data || !Array.isArray(data.markets)) {
        throw new Error('Drift API error: invalid markets response');
      }
      return data.markets;
    } catch (error) {
      logger.warn({ error, betApiUrl }, 'Drift: Failed to fetch markets');
      return [];
    }
  }

  async function searchMarkets(query: string): Promise<Market[]> {
    try {
      const markets = await fetchMarkets();
      const queryLower = query.toLowerCase();

      const filtered = markets.filter(m =>
        m.marketName.toLowerCase().includes(queryLower) ||
        m.baseAssetSymbol.toLowerCase().includes(queryLower)
      );

      return filtered.map(convertToMarket);
    } catch (error) {
      logger.error('Drift: Search error', error);
      return [];
    }
  }

  async function getMarket(marketIndex: string): Promise<Market | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetch(`${betApiUrl}/markets/${marketIndex}`, { signal: controller.signal });
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(`Drift API error: ${response.status}`);
        }
        const market = await response.json() as DriftMarket;
        return convertToMarket(market);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      logger.error(`Drift: Error fetching market ${marketIndex}`, error);
      return null;
    }
  }

  async function pollPrices(): Promise<void> {
    if (subscribedMarkets.size === 0) return;

    for (const marketIndex of subscribedMarkets) {
      try {
        const market = await getMarket(marketIndex);
        if (!market) continue;

        const currentPrice = market.outcomes[0].price;
        const previousPrice = priceCache.get(marketIndex);

        if (previousPrice !== undefined && currentPrice !== previousPrice) {
          const update: PriceUpdate = {
            platform: 'drift' as Platform,
            marketId: marketIndex,
            outcomeId: `${marketIndex}-yes`,
            price: currentPrice,
            previousPrice,
            timestamp: Date.now(),
          };
          emitter.emit('price', update);
        }

        priceCache.set(marketIndex, currentPrice);
      } catch (error) {
        logger.error(`Drift: Poll error for ${marketIndex}`, error);
      }
    }
  }

  return Object.assign(emitter, {
    async start(): Promise<void> {
      const markets = await fetchMarkets();
      if (markets.length === 0) {
        logger.warn({ betApiUrl }, 'Drift BET: No markets returned; check API endpoint');
      } else {
        logger.info({ count: markets.length, betApiUrl }, 'Drift BET: Markets loaded');
      }
      // Drift doesn't have WebSocket for BET markets, poll every 10s
      pollInterval = setInterval(pollPrices, 10000);
      logger.info('Drift BET: Started (polling mode)');
      emitter.emit('connected');
    },

    stop(): void {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      logger.info('Drift BET: Stopped');
      emitter.emit('disconnected');
    },

    searchMarkets,
    getMarket,

    subscribeToMarket(marketIndex: string): void {
      subscribedMarkets.add(marketIndex);
    },

    unsubscribeFromMarket(marketIndex: string): void {
      subscribedMarkets.delete(marketIndex);
      priceCache.delete(marketIndex);
    },
  }) as DriftFeed;
}

// Re-export trading module
export { createDriftTrading } from './trading';
export type { DriftTrading, DriftTradingConfig, DriftOrder, DriftPosition, DriftBalance } from './trading';
