# Integrate: Market Data MCP Tools

status: complete

## Source repos
- https://github.com/nirholas/crypto-market-data (CoinGecko + DeFiLlama MCP)
- https://github.com/nirholas/crypto-data-aggregator (aggregator with 200+ protocols, x402)
- https://github.com/nirholas/cryptocurrency.cv (200+ news sources, LLM-friendly, MCP-ready)

## Goal
Add 8 market data tools to `packages/mcp/src/server.ts` so AI agents can get
live prices, trending tokens, DeFi TVL, and news without any API keys.

All three source repos use public/free API tiers (CoinGecko free, DeFiLlama free,
cryptocurrency.cv free). No auth required.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/crypto-market-data /tmp/crypto-market-data
git clone https://github.com/nirholas/crypto-data-aggregator /tmp/crypto-data-aggregator
git clone https://github.com/nirholas/cryptocurrency.cv /tmp/cryptocurrency.cv
```
Read key files:
- `/tmp/crypto-market-data/mcp-server/src/index.ts`
- `/tmp/crypto-data-aggregator/src/lib/` (cache, fetcher, API clients)
- `/tmp/cryptocurrency.cv/` (news endpoint structure)

### 2. Create `packages/sdk/src/market-data.ts`
A thin data-fetching layer (no MCP, no framework deps):

```ts
/** Live price for a coin by CoinGecko ID or symbol. */
export async function getCoinPrice(coinId: string, currency?: string): Promise<{
  id: string; symbol: string; name: string
  current_price: number; price_change_percentage_24h: number
  market_cap: number; total_volume: number
}>

/** Top N trending coins from CoinGecko. */
export async function getTrendingCoins(limit?: number): Promise<Array<{
  id: string; symbol: string; name: string; market_cap_rank: number
}>>

/** DeFiLlama TVL for a protocol slug. */
export async function getProtocolTvl(protocol: string): Promise<{
  name: string; tvl: number; change_1d: number; change_7d: number
}>

/** Top DeFi protocols by TVL. */
export async function getTopProtocols(limit?: number): Promise<Array<{
  name: string; slug: string; tvl: number; chain: string
}>>

/** Latest crypto news headlines (from cryptocurrency.cv or similar free source). */
export async function getCryptoNews(query?: string, limit?: number): Promise<Array<{
  title: string; url: string; source: string; published_at: string; summary?: string
}>>

/** OHLCV candles for a coin. */
export async function getOhlcv(coinId: string, days?: number): Promise<Array<{
  timestamp: number; open: number; high: number; low: number; close: number; volume: number
}>>
```

Use simple `fetch` with a 5-second TTL in-process cache (Map + Date). No Redis dep.

### 3. Add 8 tools to `packages/mcp/src/server.ts`

Add these tools after the existing 5 (create_wallet, get_balance, pay, create_invoice, check_payment):

| Tool name | Description |
|---|---|
| `get_coin_price` | Get current price, 24h change, market cap for any coin |
| `get_trending_coins` | Top trending coins right now on CoinGecko |
| `get_protocol_tvl` | Total value locked for a DeFi protocol |
| `get_top_protocols` | Top DeFi protocols by TVL via DeFiLlama |
| `get_crypto_news` | Latest crypto news headlines |
| `get_ohlcv` | Historical price candles for charting |
| `search_coins` | Search CoinGecko for coins by name or symbol |
| `get_global_stats` | Global crypto market stats (total market cap, BTC dominance) |

Each tool uses zod schema for input, calls the corresponding `market-data.ts` function,
returns JSON text result.

### 4. Export from SDK
```ts
// packages/sdk/src/index.ts
export { getCoinPrice, getTrendingCoins, getProtocolTvl, getTopProtocols,
         getCryptoNews, getOhlcv } from './market-data.js'
```

## API endpoints to use (no auth required)
- CoinGecko: `https://api.coingecko.com/api/v3/`
  - `/coins/markets`, `/search/trending`, `/coins/{id}/ohlc`, `/global`, `/search`
- DeFiLlama: `https://api.llama.fi/`
  - `/protocols`, `/protocol/{slug}`, `/tvl/{slug}`
- News: `https://api.cryptocurrency.cv/v4/news` or Crypto Panic free tier

## Sensitivity check
All three repos use public free-tier APIs. The fetching + caching patterns are
generic. No proprietary logic. Safe to implement from scratch using the API
endpoints as reference.

## Output files
- `packages/sdk/src/market-data.ts`
- Updated `packages/mcp/src/server.ts` (8 new tools)
- Updated `packages/sdk/src/index.ts` (exports)

Mark this file's status as `complete` when done.
