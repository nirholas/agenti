/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Let your code tell a story 📖
 */

/**
 * React hooks for consuming market data from CoinGecko and DeFiLlama
 */

import { useState, useEffect, useCallback } from 'react';
import {
  marketData,
  TokenPrice,
  TrendingCoin,
  GlobalMarketData,
  ProtocolTVL,
  ChainTVL,
  YieldPool,
  MarketChart,
} from '../services/marketData';

// ============================================================
// TYPES
// ============================================================

interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================
// TOP COINS HOOK
// ============================================================

export function useTopCoins(limit: number = 50): UseQueryResult<TokenPrice[]> {
  const [data, setData] = useState<TokenPrice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getTopCoins(limit);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch top coins'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// PRICES HOOK
// ============================================================

export function usePrices(coinIds: string[]): UseQueryResult<Record<string, {
  usd: number;
  usd_market_cap: number;
  usd_24h_vol: number;
  usd_24h_change: number;
}>> {
  const [data, setData] = useState<Record<string, {
    usd: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    usd_24h_change: number;
  }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (coinIds.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getPrices(coinIds);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch prices'));
    } finally {
      setLoading(false);
    }
  }, [coinIds.join(',')]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// TRENDING HOOK
// ============================================================

export function useTrending(): UseQueryResult<TrendingCoin[]> {
  const [data, setData] = useState<TrendingCoin[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getTrending();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch trending'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// GLOBAL MARKET DATA HOOK
// ============================================================

export function useGlobalMarketData(): UseQueryResult<GlobalMarketData> {
  const [data, setData] = useState<GlobalMarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getGlobalData();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch global data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// MARKET CHART HOOK
// ============================================================

export function useMarketChart(coinId: string, days: number = 7): UseQueryResult<MarketChart> {
  const [data, setData] = useState<MarketChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!coinId) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getMarketChart(coinId, days);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch chart'));
    } finally {
      setLoading(false);
    }
  }, [coinId, days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// TOP PROTOCOLS HOOK (DeFiLlama)
// ============================================================

export function useTopProtocols(limit: number = 20): UseQueryResult<ProtocolTVL[]> {
  const [data, setData] = useState<ProtocolTVL[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getTopProtocols(limit);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch protocols'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// TOP CHAINS HOOK (DeFiLlama)
// ============================================================

export function useTopChains(limit: number = 20): UseQueryResult<ChainTVL[]> {
  const [data, setData] = useState<ChainTVL[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getTopChains(limit);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch chains'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// TOP YIELDS HOOK (DeFiLlama)
// ============================================================

export function useTopYields(limit: number = 20): UseQueryResult<YieldPool[]> {
  const [data, setData] = useState<YieldPool[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getTopYields(limit);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch yields'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// CHAIN DEFI HOOK (Combined protocols + yields)
// ============================================================

export function useChainDeFi(chain: string): UseQueryResult<{
  protocols: ProtocolTVL[];
  yields: YieldPool[];
}> {
  const [data, setData] = useState<{
    protocols: ProtocolTVL[];
    yields: YieldPool[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!chain) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getChainDeFiOverview(chain);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch chain DeFi data'));
    } finally {
      setLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// MARKET OVERVIEW HOOK (Everything combined)
// ============================================================

export function useMarketOverview(): UseQueryResult<{
  global: GlobalMarketData;
  topCoins: TokenPrice[];
  trending: TrendingCoin[];
  topChains: ChainTVL[];
  topProtocols: ProtocolTVL[];
}> {
  const [data, setData] = useState<{
    global: GlobalMarketData;
    topCoins: TokenPrice[];
    trending: TrendingCoin[];
    topChains: ChainTVL[];
    topProtocols: ProtocolTVL[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketData.getMarketOverview();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch market overview'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ============================================================
// LIVE PRICE TICKER HOOK (Auto-refresh)
// ============================================================

export function useLivePrices(
  coinIds: string[],
  refreshInterval: number = 30000 // 30 seconds
): UseQueryResult<Record<string, {
  usd: number;
  usd_market_cap: number;
  usd_24h_vol: number;
  usd_24h_change: number;
}>> {
  const [data, setData] = useState<Record<string, {
    usd: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    usd_24h_change: number;
  }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (coinIds.length === 0) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const result = await marketData.getPrices(coinIds);
      setData(result);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch prices'));
      setLoading(false);
    }
  }, [coinIds.join(',')]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, refreshInterval);
    return () => clearInterval(interval);
  }, [fetch, refreshInterval]);

  return { data, loading, error, refetch: fetch };
}
