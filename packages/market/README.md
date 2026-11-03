# @agenti/market

Market, news, DeFi, derivatives and on-chain data for AI agents: 59 typed, read-only tools over the free [cryptocurrency.cv](https://cryptocurrency.cv) API. No API key required. Ported from `nirholas/cryptocurrency.cv/mcp`.

These tools are registered automatically by `@agenti/mcp`. Use them directly too:

```ts
import { TOOLS, createToolContext, configFromEnv } from "@agenti/market"

const ctx = createToolContext(configFromEnv())
const tool = TOOLS.find((t) => t.name === "get_fear_greed")!
console.log(await tool.run({}, ctx))
```

Environment: `CRYPTO_NEWS_API_BASE` (default https://cryptocurrency.cv), `CRYPTO_NEWS_API_KEY` (optional, raises limits), `CRYPTO_NEWS_TIMEOUT_MS`.

## Tools

### News

| Tool | Route | What it does |
|---|---|---|
| `get_latest_news` | `GET /api/news` | Latest crypto headlines from 300+ sources (CoinDesk, The Block, Decrypt, Bloomberg, Reuters and more) |
| `get_breaking_news` | `GET /api/breaking` | Breaking crypto news from the last few hours, ranked by urgency |
| `search_news` | `GET /api/search` | Full-text search across every indexed article |
| `get_article` | `GET /api/articles?id= | GET /api/article?url=` | Fetch one article |
| `get_archive` | `GET /api/archive` | Query the historical news archive by date range, ticker, source, sentiment or keyword |
| `get_archive_stats` | `GET /api/archive?stats=true` | Coverage statistics for the historical archive: article counts, date range, sources and categories |
| `get_regulatory_news` | `GET /api/regulatory` | Regulatory and legal developments: SEC, CFTC, MiCA, court rulings, enforcement |
| `get_portfolio_news` | `GET /api/portfolio` | News for a specific set of holdings, optionally with live prices for each coin |
| `get_daily_digest` | `GET /api/digest` | A compiled digest of the most important stories over the last 6, 12 or 24 hours, in full, brief or newsletter form |
| `list_categories` | `GET /api/news/categories` | Every news category the API understands, with article counts |

### Analysis

| Tool | Route | What it does |
|---|---|---|
| `get_trending_topics` | `GET /api/trending` | Topics trending across the news flow right now, each tagged bullish, bearish or neutral with sample headlines |
| `get_narratives` | `GET /api/narratives` | The narratives currently driving coverage (e.g |
| `get_sentiment` | `GET /api/sentiment` | AI sentiment for one asset or the whole market: score, confidence, and the headlines that drove it |
| `analyze_news` | `GET /api/analyze` | Recent articles with topic classification and sentiment labels, filterable by topic or sentiment |
| `get_trading_signals` | `GET /api/signals` | News-derived trading signals with direction, confidence and the evidence behind each |
| `get_social_sentiment` | `GET /api/social/sentiment` | Aggregate social-media sentiment (X, Reddit, Telegram) across the market |

### Market

| Tool | Route | What it does |
|---|---|---|
| `get_fear_greed` | `GET /api/fear-greed` | Crypto Fear & Greed Index (0 = extreme fear, 100 = extreme greed) with daily history |
| `get_market_overview` | `GET /api/global` | Total market cap, 24h volume, BTC/ETH dominance, active coins and market-cap change |
| `get_coin_prices` | `GET /api/prices` | Live USD prices with 24h change for any list of CoinGecko coin ids |
| `get_top_coins` | `GET /api/market/coins` | Ranked coin table: price, market cap, volume, supply, 24h/7d change |
| `get_coin_detail` | `GET /api/market/compare?ids=` | Detailed market data for one coin: price, market cap, volume, supply, ATH, 24h/7d/30d change |
| `compare_coins` | `GET /api/market/compare` | Side-by-side comparison of 2 to 25 coins: price, market cap, volume, performance |
| `get_ohlc` | `GET /api/ohlc` | Open/high/low/close candles for one coin over 1 to 365 days |
| `get_price_chart` | `GET /api/charts` | Price, market cap and volume time series for one coin over a named range (1h to all-time) |
| `get_top_gainers` | `GET /api/market/gainers` | Best-performing coins over 1h, 24h or 7d |
| `get_top_losers` | `GET /api/market/losers` | Worst-performing coins over 1h, 24h or 7d |
| `search_coins` | `GET /api/market/search` | Resolve a name, symbol or partial string to CoinGecko coin ids |
| `get_market_dominance` | `GET /api/market/dominance` | Market-cap dominance split across BTC, ETH, stablecoins and the rest |

### DeFi

| Tool | Route | What it does |
|---|---|---|
| `get_defi_overview` | `GET /api/defi/summary` | DeFi total value locked summary: overall TVL, top protocols and chains, 24h/7d changes |
| `get_defi_yields` | `GET /api/defi/yields` | Yield opportunities with APY, TVL, chain and project |
| `get_stablecoins` | `GET /api/stablecoins` | Stablecoin market caps, peg status and 24h/7d supply changes, optionally broken down by chain |
| `get_dex_volumes` | `GET /api/dex-volumes` | Decentralised exchange trading volumes by protocol, optionally for one chain |
| `get_layer2_data` | `GET /api/l2` | TVL, activity and stats for Ethereum layer 2 networks (Arbitrum, Base, Optimism, zkSync and more) |
| `get_gas_prices` | `GET /api/gas` | Current Ethereum gas prices (slow/standard/fast in gwei), base fee and congestion |

### Derivatives

| Tool | Route | What it does |
|---|---|---|
| `get_funding_rates` | `GET /api/funding` | Perpetual futures funding rates across Binance, Bybit, OKX and Hyperliquid, with cross-exchange spreads |
| `get_liquidations` | `GET /api/liquidations` | Recent forced liquidations across exchanges: totals, long/short split and largest events |
| `get_derivatives` | `GET /api/derivatives` | Perpetual and futures tickers: open interest, volume, funding and basis across major venues |
| `get_options_data` | `GET /api/options` | Options market for BTC or ETH: dashboard, flow, volatility surface, max pain or gamma views |
| `get_orderbook` | `GET /api/trading/orderbook` | Order book depth (bids, asks, spread, liquidity) for a pair on one or more exchanges |
| `get_arbitrage` | `GET /api/trading/arbitrage` | Cross-exchange price spreads for a symbol, ranked by spread or estimated profit |

### On-chain

| Tool | Route | What it does |
|---|---|---|
| `get_whale_alerts` | `GET /api/whale-alerts` | Large on-chain transfers between wallets and exchanges, with USD value and direction, across major chains |
| `get_exchange_flows` | `GET /api/onchain/exchange-flows` | Net inflow/outflow of an asset to and from centralised exchanges, a classic accumulation or distribution signal |
| `get_token_unlocks` | `GET /api/unlocks` | Upcoming token unlock schedules with amounts, USD value and share of circulating supply |
| `get_events_calendar` | `GET /api/events` | Upcoming crypto events: conferences, hard forks, mainnet launches, token unlocks, macro dates |
| `get_airdrops` | `GET /api/airdrops` | Upcoming, active and ended airdrops with eligibility notes and estimated value |

### Reference

| Tool | Route | What it does |
|---|---|---|
| `get_exchanges` | `GET /api/exchanges` | Exchange directory ranked by trust score or volume: 24h volume, trust score, year established, country |
| `list_sources` | `GET /api/sources` | Every news source the aggregator indexes, with ids (usable as the source argument elsewhere), tiers and feed URLs |
| `get_source_health` | `GET /api/health` | Health of the API and each upstream feed: status, latency, last successful fetch, failing sources |
| `get_macro_indicators` | `GET /api/macro` | Macro backdrop for crypto: rates, CPI, DXY, equities and their correlation with BTC |
| `get_glossary` | `GET /api/glossary` | Look up a crypto term or browse a glossary category |

### AI

| Tool | Route | What it does |
|---|---|---|
| `summarize_news` | `GET /api/summarize` | AI-written summary of the latest articles, optionally for one source, as a brief, detailed prose or bullet points |
| `ask_crypto` | `POST /api/ask` | Ask a natural-language question about crypto news and markets; the answer is grounded in current articles and cites its sources |
| `get_ai_brief` | `GET /api/ai/brief` | AI-generated daily market brief: price action, sentiment, key stories and what to watch |

### Feeds & Discovery

| Tool | Route | What it does |
|---|---|---|
| `get_rss_feeds` | `GET /api/rss | GET /api/atom | GET /api/opml` | RSS, Atom and OPML feed URLs for the news categories |
| `list_endpoints` | `GET /api/openapi.json` | Discover the REST API behind these tools: the live OpenAPI path list (optionally filtered) plus the endpoint each MCP tool maps to |

### Provenance

| Tool | Route | What it does |
|---|---|---|
| `get_stories` | `GET /api/stories` | The news collapsed into events instead of headlines |
| `get_story` | `GET /api/stories/{id}` | Everything known about a single clustered story: the originating outlet, every outlet that followed in order, the lag for each, and the terms that grouped them as evidence |
| `get_source_leaderboard` | `GET /api/sources/leaderboard` | Ranks news outlets by how often they published first across the current window, with median lag when they followed |
| `get_source_feed_health` | `GET /api/sources/health` | Per-source liveness for the RSS layer: success rate, latency, last error and last successful fetch |
