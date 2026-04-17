const CACHE = new Map<string, { value: unknown; expires: number }>()
const TTL = 5_000

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = CACHE.get(key)
  if (entry && entry.expires > Date.now()) return Promise.resolve(entry.value as T)
  return fn().then((value) => {
    CACHE.set(key, { value, expires: Date.now() + TTL })
    return value
  })
}

async function gecko<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.coingecko.com/api/v3${path}`)
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function llama<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.llama.fi${path}`)
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export interface CoinPrice {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  market_cap: number
  total_volume: number
}

export interface TrendingCoin {
  id: string
  symbol: string
  name: string
  market_cap_rank: number
}

export interface ProtocolTvl {
  name: string
  tvl: number
  change_1d: number
  change_7d: number
}

export interface TopProtocol {
  name: string
  slug: string
  tvl: number
  chain: string
}

export interface NewsItem {
  title: string
  url: string
  source: string
  published_at: string
  summary?: string
}

export interface OhlcvCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CoinSearchResult {
  id: string
  symbol: string
  name: string
  market_cap_rank: number | null
  thumb: string
}

export interface GlobalStats {
  total_market_cap_usd: number
  total_volume_usd: number
  btc_dominance: number
  eth_dominance: number
  active_cryptocurrencies: number
  markets: number
  market_cap_change_percentage_24h: number
}

export function getCoinPrice(coinId: string, currency = 'usd'): Promise<CoinPrice> {
  return cached(`price:${coinId}:${currency}`, async (): Promise<CoinPrice> => {
    const data = await gecko<CoinPrice[]>(
      `/coins/markets?vs_currency=${currency}&ids=${encodeURIComponent(coinId)}&order=market_cap_desc&per_page=1`
    )
    if (!data.length) throw new Error(`Coin not found: ${coinId}`)
    return data[0]!
  })
}

export function getTrendingCoins(limit = 10): Promise<TrendingCoin[]> {
  return cached(`trending:${limit}`, async () => {
    const data = await gecko<{ coins: Array<{ item: { id: string; symbol: string; name: string; market_cap_rank: number } }> }>(
      '/search/trending'
    )
    return data.coins.slice(0, limit).map(({ item }) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      market_cap_rank: item.market_cap_rank,
    }))
  })
}

export function getProtocolTvl(protocol: string): Promise<ProtocolTvl> {
  return cached(`protocol:${protocol}`, async () => {
    const data = await llama<{ name: string; tvl: number; change_1d: number; change_7d: number }>(
      `/protocol/${encodeURIComponent(protocol)}`
    )
    return {
      name: data.name,
      tvl: data.tvl,
      change_1d: data.change_1d ?? 0,
      change_7d: data.change_7d ?? 0,
    }
  })
}

export function getTopProtocols(limit = 20): Promise<TopProtocol[]> {
  return cached(`top-protocols:${limit}`, async () => {
    const data = await llama<Array<{ name: string; slug: string; tvl: number; chain: string }>>(
      '/protocols'
    )
    return data.slice(0, limit).map((p) => ({
      name: p.name,
      slug: p.slug,
      tvl: p.tvl,
      chain: p.chain,
    }))
  })
}

export function getCryptoNews(query?: string, limit = 10): Promise<NewsItem[]> {
  const key = `news:${query ?? ''}:${limit}`
  return cached(key, async () => {
    const params = new URLSearchParams({ public: 'true', limit: String(Math.min(limit, 50)) })
    if (query) params.set('currencies', query)
    const res = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=public&${params}`)
    if (!res.ok) {
      // Fallback: CoinGecko news via /news endpoint (no auth)
      const fallback = await gecko<Array<{ title: string; url: string; author: string; updated_at: string; description: string }>>(
        `/news?per_page=${Math.min(limit, 50)}`
      )
      return fallback.slice(0, limit).map((item) => ({
        title: item.title,
        url: item.url,
        source: item.author ?? 'CoinGecko',
        published_at: item.updated_at,
        summary: item.description,
      }))
    }
    const data = (await res.json()) as { results: Array<{ title: string; url: string; source: { title: string }; published_at: string }> }
    return data.results.slice(0, limit).map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source?.title ?? 'CryptoPanic',
      published_at: item.published_at,
    }))
  })
}

export function getOhlcv(coinId: string, days = 7): Promise<OhlcvCandle[]> {
  return cached(`ohlcv:${coinId}:${days}`, async () => {
    // CoinGecko OHLC returns [timestamp, open, high, low, close]
    const raw = await gecko<Array<[number, number, number, number, number]>>(
      `/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=${days}`
    )
    // Volume comes from market_chart; use 0 as placeholder (OHLC endpoint lacks it)
    return raw.map(([timestamp, open, high, low, close]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume: 0,
    }))
  })
}

export function searchCoins(query: string): Promise<CoinSearchResult[]> {
  return cached(`search:${query}`, async () => {
    const data = await gecko<{ coins: Array<{ id: string; symbol: string; name: string; market_cap_rank: number | null; thumb: string }> }>(
      `/search?query=${encodeURIComponent(query)}`
    )
    return data.coins.slice(0, 20).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      market_cap_rank: c.market_cap_rank,
      thumb: c.thumb,
    }))
  })
}

export function getGlobalStats(): Promise<GlobalStats> {
  return cached('global', async () => {
    const data = await gecko<{
      data: {
        total_market_cap: Record<string, number>
        total_volume: Record<string, number>
        market_cap_percentage: Record<string, number>
        active_cryptocurrencies: number
        markets: number
        market_cap_change_percentage_24h_usd: number
      }
    }>('/global')
    const d = data.data
    return {
      total_market_cap_usd: d.total_market_cap['usd'] ?? 0,
      total_volume_usd: d.total_volume['usd'] ?? 0,
      btc_dominance: d.market_cap_percentage['btc'] ?? 0,
      eth_dominance: d.market_cap_percentage['eth'] ?? 0,
      active_cryptocurrencies: d.active_cryptocurrencies,
      markets: d.markets,
      market_cap_change_percentage_24h: d.market_cap_change_percentage_24h_usd,
    }
  })
}
