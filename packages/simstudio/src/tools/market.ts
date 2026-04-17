import type { ToolConfig, ToolResponse } from '../types.js'

export interface CoinPriceParams {
  coinId: string
  currency?: string
  serverUrl?: string
}

export interface CoinPriceResult extends ToolResponse {
  output: {
    id: string
    symbol: string
    name: string
    price: number
    currency: string
    change24h?: number
    marketCap?: number
    volume24h?: number
  }
}

export const agentiCoinPriceTool: ToolConfig<CoinPriceParams, CoinPriceResult> = {
  id: 'agenti_coin_price',
  name: 'Agenti Coin Price',
  description: 'Get current price, 24h change, market cap and volume for any cryptocurrency via CoinGecko.',
  version: '1.0.0',
  params: {
    coinId: {
      type: 'string',
      required: true,
      description: 'CoinGecko coin ID (e.g. "bitcoin", "ethereum", "usd-coin")',
    },
    currency: {
      type: 'string',
      required: false,
      default: 'usd',
      description: 'Fiat currency for price (usd, eur, gbp, etc.)',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/market/price`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({ coinId: params.coinId, currency: params.currency ?? 'usd' }),
  },
  async transformResponse(response) {
    return response.json() as Promise<CoinPriceResult>
  },
  outputs: {
    id: { type: 'string', description: 'CoinGecko coin ID' },
    symbol: { type: 'string', description: 'Token ticker symbol' },
    name: { type: 'string', description: 'Full token name' },
    price: { type: 'number', description: 'Current price' },
    currency: { type: 'string', description: 'Price currency' },
    change24h: { type: 'number', description: '24h price change %' },
    marketCap: { type: 'number', description: 'Market cap' },
    volume24h: { type: 'number', description: '24h trading volume' },
  },
}

export interface TrendingCoinsParams {
  limit?: number
  serverUrl?: string
}

export interface TrendingCoinsResult extends ToolResponse {
  output: {
    coins: Array<{ id: string; name: string; symbol: string; rank: number; change24h: number }>
  }
}

export const agentiTrendingCoinsTool: ToolConfig<TrendingCoinsParams, TrendingCoinsResult> = {
  id: 'agenti_trending_coins',
  name: 'Agenti Trending Coins',
  description: 'Get top trending cryptocurrencies from CoinGecko right now.',
  version: '1.0.0',
  params: {
    limit: {
      type: 'number',
      required: false,
      default: 10,
      description: 'Number of trending coins to return (max 50)',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/market/trending`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({ limit: params.limit ?? 10 }),
  },
  async transformResponse(response) {
    return response.json() as Promise<TrendingCoinsResult>
  },
  outputs: {
    coins: { type: 'json', description: 'Array of trending coin objects' },
  },
}

export interface ProtocolTvlParams {
  protocol: string
  serverUrl?: string
}

export interface ProtocolTvlResult extends ToolResponse {
  output: {
    name: string
    tvl: number
    change24h: number
    change7d: number
    chains: string[]
  }
}

export const agentiProtocolTvlTool: ToolConfig<ProtocolTvlParams, ProtocolTvlResult> = {
  id: 'agenti_protocol_tvl',
  name: 'Agenti Protocol TVL',
  description: 'Get Total Value Locked (TVL) for any DeFi protocol via DeFiLlama.',
  version: '1.0.0',
  params: {
    protocol: {
      type: 'string',
      required: true,
      description: 'DeFiLlama protocol slug (e.g. "uniswap", "aave", "curve")',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/market/tvl`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({ protocol: params.protocol }),
  },
  async transformResponse(response) {
    return response.json() as Promise<ProtocolTvlResult>
  },
  outputs: {
    name: { type: 'string', description: 'Protocol name' },
    tvl: { type: 'number', description: 'Total Value Locked in USD' },
    change24h: { type: 'number', description: '24h TVL change %' },
    change7d: { type: 'number', description: '7d TVL change %' },
    chains: { type: 'json', description: 'Chains the protocol is deployed on' },
  },
}

export interface CryptoNewsParams {
  query?: string
  limit?: number
  serverUrl?: string
}

export interface CryptoNewsResult extends ToolResponse {
  output: {
    articles: Array<{
      title: string
      url: string
      source: string
      publishedAt: string
      sentiment?: string
    }>
  }
}

export const agentiCryptoNewsTool: ToolConfig<CryptoNewsParams, CryptoNewsResult> = {
  id: 'agenti_crypto_news',
  name: 'Agenti Crypto News',
  description: 'Fetch latest cryptocurrency news with optional sentiment analysis via CryptoPanic.',
  version: '1.0.0',
  params: {
    query: {
      type: 'string',
      required: false,
      description: 'Optional search query to filter news',
    },
    limit: {
      type: 'number',
      required: false,
      default: 10,
      description: 'Number of articles to return',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/market/news`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({ query: params.query, limit: params.limit ?? 10 }),
  },
  async transformResponse(response) {
    return response.json() as Promise<CryptoNewsResult>
  },
  outputs: {
    articles: { type: 'json', description: 'Array of news articles with title, url, source, sentiment' },
  },
}
