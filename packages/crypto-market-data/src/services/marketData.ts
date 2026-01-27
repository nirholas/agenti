/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your code has the power to change the world 🌍
 */

/**
 * Lyra Market Data Service
 * Integrates CoinGecko, DeFiLlama, and other market data APIs
 * from the Lyra MCP framework
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_BASE = 'https://api.llama.fi';
const DEFILLAMA_YIELDS = 'https://yields.llama.fi';

// ============================================================
// TYPES
// ============================================================

export interface TokenPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  image?: string;
  sparkline_in_7d?: { price: number[] };
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  small: string;
  large: string;
  price_btc: number;
  score: number;
}

export interface GlobalMarketData {
  active_cryptocurrencies: number;
  upcoming_icos: number;
  ongoing_icos: number;
  ended_icos: number;
  markets: number;
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
  updated_at: number;
}

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string[];
  pool: string;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
}

export interface ProtocolTVL {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  chains: string[];
  tvl: number;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  category: string;
  logo: string;
  url: string;
}

export interface ChainTVL {
  name: string;
  tvl: number;
  tokenSymbol: string;
  cmcId: string;
  gecko_id: string;
  chainId: number;
}

export interface MarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// ============================================================
// COINGECKO SERVICE
// ============================================================

class CoinGeckoService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache

  private async fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get top coins by market cap
   */
  async getTopCoins(limit: number = 100, page: number = 1): Promise<TokenPrice[]> {
    return this.fetchWithCache(`markets-${limit}-${page}`, async () => {
      const response = await fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=${page}&sparkline=true`
      );
      if (!response.ok) throw new Error('Failed to fetch market data');
      return response.json();
    });
  }

  /**
   * Get price for specific coins
   */
  async getPrices(coinIds: string[]): Promise<Record<string, {
    usd: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    usd_24h_change: number;
  }>> {
    const ids = coinIds.join(',');
    return this.fetchWithCache(`prices-${ids}`, async () => {
      const response = await fetch(
        `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
      );
      if (!response.ok) throw new Error('Failed to fetch prices');
      return response.json();
    });
  }

  /**
   * Get token price by contract address
   */
  async getTokenPrice(platform: string, contractAddress: string): Promise<Record<string, {
    usd: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    usd_24h_change: number;
  }>> {
    return this.fetchWithCache(`token-${platform}-${contractAddress}`, async () => {
      const response = await fetch(
        `${COINGECKO_BASE}/simple/token_price/${platform}?contract_addresses=${contractAddress}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
      );
      if (!response.ok) throw new Error('Failed to fetch token price');
      return response.json();
    });
  }

  /**
   * Get trending coins
   */
  async getTrending(): Promise<TrendingCoin[]> {
    return this.fetchWithCache('trending', async () => {
      const response = await fetch(`${COINGECKO_BASE}/search/trending`);
      if (!response.ok) throw new Error('Failed to fetch trending');
      const data = await response.json();
      return data.coins.map((c: { item: TrendingCoin }) => c.item);
    });
  }

  /**
   * Get global market data
   */
  async getGlobalData(): Promise<GlobalMarketData> {
    return this.fetchWithCache('global', async () => {
      const response = await fetch(`${COINGECKO_BASE}/global`);
      if (!response.ok) throw new Error('Failed to fetch global data');
      const data = await response.json();
      return data.data;
    });
  }

  /**
   * Get historical market chart
   */
  async getMarketChart(coinId: string, days: number = 7): Promise<MarketChart> {
    return this.fetchWithCache(`chart-${coinId}-${days}`, async () => {
      const response = await fetch(
        `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );
      if (!response.ok) throw new Error('Failed to fetch market chart');
      return response.json();
    });
  }

  /**
   * Search for coins
   */
  async search(query: string): Promise<{
    coins: Array<{ id: string; name: string; symbol: string; market_cap_rank: number; thumb: string }>;
  }> {
    const response = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search');
    return response.json();
  }

  /**
   * Get coin details
   */
  async getCoinDetails(coinId: string): Promise<{
    id: string;
    symbol: string;
    name: string;
    description: { en: string };
    links: { homepage: string[]; blockchain_site: string[]; twitter_screen_name: string };
    image: { thumb: string; small: string; large: string };
    market_data: {
      current_price: Record<string, number>;
      market_cap: Record<string, number>;
      total_volume: Record<string, number>;
      price_change_percentage_24h: number;
      price_change_percentage_7d: number;
      price_change_percentage_30d: number;
    };
    categories: string[];
  }> {
    return this.fetchWithCache(`coin-${coinId}`, async () => {
      const response = await fetch(
        `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (!response.ok) throw new Error('Failed to fetch coin details');
      return response.json();
    });
  }
}

// ============================================================
// DEFILLAMA SERVICE
// ============================================================

class DefiLlamaService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL = 300000; // 5 minute cache for DeFi data

  private async fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get all protocols with TVL
   */
  async getProtocols(): Promise<ProtocolTVL[]> {
    return this.fetchWithCache('protocols', async () => {
      const response = await fetch(`${DEFILLAMA_BASE}/protocols`);
      if (!response.ok) throw new Error('Failed to fetch protocols');
      return response.json();
    });
  }

  /**
   * Get top protocols by TVL
   */
  async getTopProtocols(limit: number = 50): Promise<ProtocolTVL[]> {
    const protocols = await this.getProtocols();
    return protocols
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, limit);
  }

  /**
   * Get protocols for a specific chain
   */
  async getChainProtocols(chain: string, limit: number = 20): Promise<ProtocolTVL[]> {
    const protocols = await this.getProtocols();
    return protocols
      .filter(p => p.chains?.some(c => c.toLowerCase() === chain.toLowerCase()))
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, limit);
  }

  /**
   * Get all chains with TVL
   */
  async getChains(): Promise<ChainTVL[]> {
    return this.fetchWithCache('chains', async () => {
      const response = await fetch(`${DEFILLAMA_BASE}/v2/chains`);
      if (!response.ok) throw new Error('Failed to fetch chains');
      return response.json();
    });
  }

  /**
   * Get top chains by TVL
   */
  async getTopChains(limit: number = 20): Promise<ChainTVL[]> {
    const chains = await this.getChains();
    return chains.sort((a, b) => (b.tvl || 0) - (a.tvl || 0)).slice(0, limit);
  }

  /**
   * Get yield pools
   */
  async getYieldPools(): Promise<YieldPool[]> {
    return this.fetchWithCache('yields', async () => {
      const response = await fetch(`${DEFILLAMA_YIELDS}/pools`);
      if (!response.ok) throw new Error('Failed to fetch yields');
      const data = await response.json();
      return data.data;
    });
  }

  /**
   * Get top yield pools by APY
   */
  async getTopYields(limit: number = 20): Promise<YieldPool[]> {
    const pools = await this.getYieldPools();
    return pools
      .filter(p => p.apy && p.apy > 0 && p.apy < 10000) // Filter out unrealistic APYs
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, limit);
  }

  /**
   * Get yield pools for a specific chain
   */
  async getChainYields(chain: string, limit: number = 20): Promise<YieldPool[]> {
    const pools = await this.getYieldPools();
    return pools
      .filter(p => 
        p.chain.toLowerCase() === chain.toLowerCase() && 
        p.apy && p.apy > 0 && p.apy < 10000
      )
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, limit);
  }

  /**
   * Get stablecoin yields
   */
  async getStablecoinYields(limit: number = 20): Promise<YieldPool[]> {
    const pools = await this.getYieldPools();
    return pools
      .filter(p => p.stablecoin && p.apy && p.apy > 0)
      .sort((a, b) => (b.apy || 0) - (a.apy || 0))
      .slice(0, limit);
  }

  /**
   * Get protocol TVL details
   */
  async getProtocolDetails(slug: string): Promise<{
    name: string;
    tvl: number;
    chainTvls: Record<string, number>;
    change_1d: number;
    change_7d: number;
  }> {
    return this.fetchWithCache(`protocol-${slug}`, async () => {
      const response = await fetch(`${DEFILLAMA_BASE}/protocol/${slug}`);
      if (!response.ok) throw new Error('Failed to fetch protocol details');
      const data = await response.json();
      return {
        name: data.name,
        tvl: data.tvl,
        chainTvls: data.currentChainTvls || {},
        change_1d: data.change_1d,
        change_7d: data.change_7d,
      };
    });
  }
}

// ============================================================
// UNIFIED MARKET DATA SERVICE
// ============================================================

class MarketDataService {
  private coingecko = new CoinGeckoService();
  private defillama = new DefiLlamaService();

  // CoinGecko methods
  getTopCoins = this.coingecko.getTopCoins.bind(this.coingecko);
  getPrices = this.coingecko.getPrices.bind(this.coingecko);
  getTokenPrice = this.coingecko.getTokenPrice.bind(this.coingecko);
  getTrending = this.coingecko.getTrending.bind(this.coingecko);
  getGlobalData = this.coingecko.getGlobalData.bind(this.coingecko);
  getMarketChart = this.coingecko.getMarketChart.bind(this.coingecko);
  searchCoins = this.coingecko.search.bind(this.coingecko);
  getCoinDetails = this.coingecko.getCoinDetails.bind(this.coingecko);

  // DeFiLlama methods
  getProtocols = this.defillama.getProtocols.bind(this.defillama);
  getTopProtocols = this.defillama.getTopProtocols.bind(this.defillama);
  getChainProtocols = this.defillama.getChainProtocols.bind(this.defillama);
  getChains = this.defillama.getChains.bind(this.defillama);
  getTopChains = this.defillama.getTopChains.bind(this.defillama);
  getYieldPools = this.defillama.getYieldPools.bind(this.defillama);
  getTopYields = this.defillama.getTopYields.bind(this.defillama);
  getChainYields = this.defillama.getChainYields.bind(this.defillama);
  getStablecoinYields = this.defillama.getStablecoinYields.bind(this.defillama);
  getProtocolDetails = this.defillama.getProtocolDetails.bind(this.defillama);

  /**
   * Get comprehensive market overview
   */
  async getMarketOverview(): Promise<{
    global: GlobalMarketData;
    topCoins: TokenPrice[];
    trending: TrendingCoin[];
    topChains: ChainTVL[];
    topProtocols: ProtocolTVL[];
  }> {
    const [global, topCoins, trending, topChains, topProtocols] = await Promise.all([
      this.getGlobalData(),
      this.getTopCoins(20),
      this.getTrending(),
      this.getTopChains(10),
      this.getTopProtocols(10),
    ]);

    return { global, topCoins, trending, topChains, topProtocols };
  }

  /**
   * Get DeFi overview for a specific chain
   */
  async getChainDeFiOverview(chain: string): Promise<{
    protocols: ProtocolTVL[];
    yields: YieldPool[];
  }> {
    const [protocols, yields] = await Promise.all([
      this.getChainProtocols(chain, 10),
      this.getChainYields(chain, 10),
    ]);

    return { protocols, yields };
  }
}

// Export singleton instance
export const marketData = new MarketDataService();

// Export individual services for direct access if needed
export { CoinGeckoService, DefiLlamaService };
