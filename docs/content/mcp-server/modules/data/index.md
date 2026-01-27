<!-- universal-crypto-mcp | @nichxbt | dW5pdmVyc2FsLWNyeXB0by1tY3A= -->

# Data & Analytics Modules

<!-- Maintained by universal-crypto-mcp | ID: 14938 -->

Market data, technical analysis, research tools, and analytics integrations.

---

## CoinGecko Module

CoinGecko API integration for comprehensive crypto market data.

### Tools

| Tool | Description |
|------|-------------|
| `coingecko_search` | Search for coins on CoinGecko |
| `coingecko_get_prices` | Get current prices for coins |
| `coingecko_get_coin_info` | Get detailed coin information |
| `coingecko_get_global_data` | Get global crypto market data |
| `coingecko_get_trending` | Get trending coins |

### Examples

```
Get Bitcoin price in USD
→ coingecko_get_prices(ids: ["bitcoin"], vs_currencies: ["usd"])

Search for Ethereum-related coins
→ coingecko_search(query: "ethereum")
```

---

## DeFi Module (DefiLlama)

DefiLlama integration for DeFi analytics - TVL, yields, fees, bridges, stablecoins.

### Protocol Tools

| Tool | Description |
|------|-------------|
| `defi_get_protocols` | Get all DeFi protocols |
| `defi_get_protocol` | Get specific protocol details |
| `defi_get_protocol_tvl` | Get protocol TVL history |

### Chain Tools

| Tool | Description |
|------|-------------|
| `defi_get_chains` | Get all chains with DeFi |
| `defi_get_chain_tvl` | Get TVL for a chain |
| `defi_get_chain_protocols` | Get protocols on a chain |

### Yield Tools

| Tool | Description |
|------|-------------|
| `defi_get_yields` | Get yield farming opportunities |
| `defi_get_yield_pool` | Get specific yield pool details |

### Fee Tools

| Tool | Description |
|------|-------------|
| `defi_get_fees_overview` | Get protocol fees overview |
| `defi_get_protocol_fees` | Get fees for specific protocol |
| `defi_get_chain_fees` | Get fees by chain |

### DEX Volume Tools

| Tool | Description |
|------|-------------|
| `defi_get_dex_volume` | Get DEX trading volume |
| `defi_get_dex_protocol_volume` | Get volume for specific DEX |
| `defi_get_chain_dex_volume` | Get DEX volume by chain |

### Stablecoin Tools

| Tool | Description |
|------|-------------|
| `defi_get_stablecoins` | Get stablecoin market data |
| `defi_get_stablecoin` | Get specific stablecoin info |
| `defi_get_stablecoin_chains` | Get stablecoins by chain |

### Bridge Tools

| Tool | Description |
|------|-------------|
| `defi_get_bridges` | Get bridge protocols |
| `defi_get_bridge` | Get specific bridge details |
| `defi_get_bridge_volume` | Get bridge volume |

### Other

| Tool | Description |
|------|-------------|
| `defi_get_options_volume` | Get options trading volume |

### Examples

```
Get TVL for Uniswap
→ defi_get_protocol(protocol: "uniswap")

Find best yield opportunities
→ defi_get_yields(chain: "ethereum")
```

---

## DEX Analytics Module

DEX analytics via DexPaprika and GeckoTerminal.

### DexPaprika Tools

| Tool | Description |
|------|-------------|
| `dex_get_networks` | Get supported DEX networks |
| `dex_get_network_dexes` | Get DEXs on a network |
| `dex_get_network_pools` | Get pools on a network |
| `dex_get_dex_pools` | Get pools for a specific DEX |
| `dex_get_pool_details` | Get detailed pool information |
| `dex_get_token_details` | Get token details from DEX |
| `dex_get_token_pools` | Get pools for a token |
| `dex_get_pool_ohlcv` | Get OHLCV data for pool |
| `dex_get_pool_transactions` | Get pool transactions |
| `dex_search` | Search across DEX data |
| `dex_get_stats` | Get DEX statistics |
| `dex_get_multi_prices` | Get prices for multiple tokens |

### GeckoTerminal Tools

| Tool | Description |
|------|-------------|
| `geckoterminal_get_networks` | Get GeckoTerminal networks |
| `geckoterminal_get_dexes` | Get DEXs from GeckoTerminal |
| `geckoterminal_trending_pools` | Get trending pools |
| `geckoterminal_new_pools` | Get newly created pools |
| `geckoterminal_top_pools` | Get top pools by volume |

### Examples

```
Get trending pools on Ethereum
→ geckoterminal_trending_pools(network: "eth")

Get OHLCV for a Uniswap pool
→ dex_get_pool_ohlcv(
    network: "ethereum",
    pool_address: "0x...",
    timeframe: "1h"
  )
```

---

## Technical Indicators Module

50+ technical analysis indicators powered by the `indicatorts` library.

### Trend Indicators

| Tool | Description |
|------|-------------|
| `indicator_apo` | Absolute Price Oscillator - measures EMA differences |
| `indicator_aroon` | Aroon Indicator - identifies trend changes |
| `indicator_bop` | Balance of Power - buying vs selling pressure |
| `indicator_cfo` | Chande Forecast Oscillator - predicts price movements |
| `indicator_cci` | Commodity Channel Index - overbought/oversold |
| `indicator_dema` | Double Exponential Moving Average |
| `indicator_ema` | Exponential Moving Average |
| `indicator_mass_index` | Mass Index - identifies reversals |
| `indicator_macd` | MACD - momentum and trend direction |
| `indicator_mmax` | Moving Max - rolling maximum |
| `indicator_mmin` | Moving Min - rolling minimum |
| `indicator_msum` | Moving Sum - rolling sum |
| `indicator_psar` | Parabolic SAR - stop-and-reverse points |
| `indicator_qstick` | Qstick - buying/selling pressure |
| `indicator_kdj` | KDJ Indicator - stochastic variant |
| `indicator_sma` | Simple Moving Average |
| `indicator_tema` | Triple Exponential Moving Average |
| `indicator_trix` | Triple Exponential Average |
| `indicator_vwma` | Volume Weighted Moving Average |
| `indicator_vortex` | Vortex Indicator - trend direction |

### Momentum Indicators

| Tool | Description |
|------|-------------|
| `indicator_ao` | Awesome Oscillator - momentum using SMA |
| `indicator_chaikin_oscillator` | Chaikin Oscillator - accumulation/distribution |
| `indicator_ichimoku` | Ichimoku Cloud - comprehensive indicator |
| `indicator_ppo` | Percentage Price Oscillator |
| `indicator_pvo` | Percentage Volume Oscillator |
| `indicator_roc` | Price Rate of Change |
| `indicator_rsi` | Relative Strength Index |
| `indicator_stochastic` | Stochastic Oscillator |
| `indicator_williams_r` | Williams %R - overbought/oversold |

### Volatility Indicators

| Tool | Description |
|------|-------------|
| `indicator_acceleration_bands` | Acceleration Bands - breakout zones |
| `indicator_atr` | Average True Range - market volatility |
| `indicator_bollinger_bands` | Bollinger Bands - price volatility |
| `indicator_bbw` | Bollinger Bands Width |
| `indicator_chandelier_exit` | Chandelier Exit - trailing stop |
| `indicator_donchian_channel` | Donchian Channel - high/low range |
| `indicator_keltner_channel` | Keltner Channel - ATR bands |
| `indicator_mstd` | Moving Standard Deviation |
| `indicator_projection_oscillator` | Projection Oscillator |
| `indicator_true_range` | True Range calculation |
| `indicator_ulcer_index` | Ulcer Index - downside risk |

### Volume Indicators

| Tool | Description |
|------|-------------|
| `indicator_ad` | Accumulation/Distribution - money flow |
| `indicator_cmf` | Chaikin Money Flow - buying/selling pressure |
| `indicator_emv` | Ease of Movement - volume to price |
| `indicator_force_index` | Force Index - power behind moves |
| `indicator_mfi` | Money Flow Index - volume-weighted RSI |
| `indicator_nvi` | Negative Volume Index |
| `indicator_obv` | On-Balance Volume - cumulative volume |
| `indicator_vpt` | Volume Price Trend |
| `indicator_vwap` | Volume Weighted Average Price |

### Examples

```
Calculate RSI for Bitcoin
→ indicator_rsi(symbol: "BTC/USDT", period: 14, timeframe: "1h")

Get Bollinger Bands for Ethereum
→ indicator_bollinger_bands(symbol: "ETH/USDT", period: 20, stdDev: 2)

Calculate MACD
→ indicator_macd(symbol: "BTC/USDT", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9)
```

---

## TradingView Screener Module

TradingView-style crypto screeners for finding trading opportunities.

### Tools

| Tool | Description |
|------|-------------|
| `screener_top_gainers` | Get top gaining cryptocurrencies |
| `screener_top_losers` | Get top losing cryptocurrencies |
| `screener_bollinger_squeeze` | Find Bollinger Band squeeze setups |
| `screener_rsi_oversold` | Find RSI oversold coins (<30) |
| `screener_rsi_overbought` | Find RSI overbought coins (>70) |
| `screener_volume_spike` | Find unusual volume spikes |

### Examples

```
Find top 10 gainers
→ screener_top_gainers(limit: 10)

Find oversold coins
→ screener_rsi_oversold(threshold: 30, limit: 20)

Find Bollinger squeeze setups
→ screener_bollinger_squeeze(bbwThreshold: 0.05)
```

---

## Market Data Module (CoinStats)

Comprehensive market data from CoinStats.

### Price Tools

| Tool | Description |
|------|-------------|
| `market_get_coins` | Get comprehensive crypto data |
| `market_get_coin_by_id` | Get specific coin details |
| `market_get_coin_chart` | Get historical chart data |
| `market_get_coin_avg_price` | Get historical average price |
| `market_get_exchange_price` | Get exchange-specific price |

### Exchange Tools

| Tool | Description |
|------|-------------|
| `market_get_exchanges` | List cryptocurrency exchanges |
| `market_get_tickers` | Get trading pairs/tickers |

### Wallet Tools

| Tool | Description |
|------|-------------|
| `market_get_wallet_balance` | Get wallet balance |
| `market_get_wallet_balances_all` | Get balances across networks |
| `market_get_wallet_transactions` | Get wallet transactions |

### Other Tools

| Tool | Description |
|------|-------------|
| `market_get_blockchains` | Get supported blockchains |
| `market_get_global` | Get global market statistics |
| `market_get_news_sources` | Get news sources |
| `market_get_news` | Get crypto news |

---

## News Module

Cryptocurrency news aggregation from 7+ sources.

### Tools

| Tool | Description |
|------|-------------|
| `get_crypto_news` | Get latest crypto news from 7 sources |
| `search_crypto_news` | Search news by keywords |
| `get_defi_news` | Get DeFi-specific news |
| `get_bitcoin_news` | Get Bitcoin-specific news |
| `get_breaking_crypto_news` | Get breaking news (last 2 hours) |
| `get_crypto_news_sources` | List all news sources |

### News Sources

- CoinDesk
- CoinTelegraph
- CryptoSlate
- Decrypt
- The Block
- Bitcoin Magazine
- DeFi Pulse

### Examples

```
Get latest news
→ get_crypto_news(limit: 10)

Search for Ethereum news
→ search_crypto_news(query: "ethereum", limit: 10)
```

---

## Research Module

Web3 research tools with session management.

### Tools

| Tool | Description |
|------|-------------|
| `research_create_plan` | Create structured research plan for a token |
| `research_search` | Perform web search for research |
| `research_fetch_url` | Fetch and extract content from URL |
| `research_update_section` | Update research section status |
| `research_get_status` | Get research session status |
| `research_add_note` | Add note to research session |
| `research_generate_report` | Generate research report |

### Research Plan Sections

1. **Overview** - Basic token information
2. **Tokenomics** - Supply, distribution, vesting
3. **Team** - Founders, team background
4. **Technology** - Technical architecture
5. **Community** - Social presence, engagement
6. **Risks** - Potential risks and concerns
7. **Competition** - Competitive landscape

### Examples

```
Create research plan for Solana
→ research_create_plan(token: "Solana", symbol: "SOL")

Search for tokenomics info
→ research_search(session_id: "...", query: "Solana tokenomics supply schedule")

Generate final report
→ research_generate_report(session_id: "...")
```

---

## Rubic Module

Rubic cross-chain DEX aggregator integration.

### Tools

| Tool | Description |
|------|-------------|
| `rubic_get_supported_chains` | Get supported blockchains |
| `rubic_get_bridge_quote` | Get best cross-chain bridge quote |
| `rubic_get_bridge_quotes` | Get all available bridge routes |
| `rubic_get_cross_chain_status` | Check cross-chain tx status |

### Examples

```
Get quote to bridge USDC from Ethereum to Polygon
→ rubic_get_bridge_quote(
    fromChain: "ethereum",
    toChain: "polygon",
    fromToken: "USDC",
    amount: "100"
  )
```

---

## Social Module

Social sentiment via LunarCrush and CryptoCompare.

### Coin Metrics

| Tool | Description |
|------|-------------|
| `social_get_coin_metrics` | Get social metrics for a coin |
| `social_get_coins_list` | Get social metrics for top coins |
| `social_get_coin_time_series` | Get historical social metrics |

### Social Feed

| Tool | Description |
|------|-------------|
| `social_get_feed` | Get social posts about crypto |
| `social_get_trending_posts` | Get viral social posts |

### Influencers

| Tool | Description |
|------|-------------|
| `social_get_influencers` | Get top crypto influencers |
| `social_get_influencer` | Get influencer details |
| `social_get_influencer_posts` | Get influencer posts |

### Topics & Categories

| Tool | Description |
|------|-------------|
| `social_get_topics` | Get trending topics/narratives |
| `social_get_topic` | Get specific topic metrics |
| `social_get_categories` | Get coin categories |

### NFT Social

| Tool | Description |
|------|-------------|
| `social_get_nft_collections` | Get NFT social metrics |
| `social_get_nft_collection` | Get specific NFT collection |

### Market Sentiment

| Tool | Description |
|------|-------------|
| `social_get_market_sentiment` | Get overall market sentiment |
| `social_get_market_sentiment_history` | Get historical sentiment |

### Platform Stats

| Tool | Description |
|------|-------------|
| `social_get_reddit_stats` | Get Reddit statistics |
| `social_get_twitter_stats` | Get Twitter/X statistics |
| `social_get_github_stats` | Get GitHub activity stats |

### Examples

```
Get social metrics for Bitcoin
→ social_get_coin_metrics(coin: "bitcoin")

Get trending crypto topics
→ social_get_topics(limit: 10)

Get market sentiment
→ social_get_market_sentiment()
```

---

## Predictions Module

Prediction markets integration via Polymarket.

### Tools

| Tool | Description |
|------|-------------|
| `predictions_get_markets` | Get active prediction markets |
| `predictions_get_market` | Get market details by ID |
| `predictions_search_markets` | Search markets by keyword |
| `predictions_get_crypto_markets` | Get crypto-related markets |

### Examples

```
Get active prediction markets
→ predictions_get_markets(limit: 10)

Search for Bitcoin markets
→ predictions_search_markets(query: "bitcoin")

Get crypto-specific predictions
→ predictions_get_crypto_markets()
```
---

## WebSocket Subscriptions Module

Real-time blockchain data streams for prices, transactions, and blocks.

### Tools (8 tools)

| Tool | Description |
|------|-------------|
| `ws_subscribe_price` | Subscribe to real-time price updates |
| `ws_subscribe_wallet` | Subscribe to wallet transaction notifications |
| `ws_subscribe_blocks` | Subscribe to new block notifications |
| `ws_subscribe_pool` | Subscribe to DEX pool events (swaps, mint, burn) |
| `ws_get_subscriptions` | List all active subscriptions |
| `ws_unsubscribe` | Unsubscribe from a stream |
| `ws_get_updates` | Poll for latest subscription updates |
| `ws_pause_subscription` | Pause a subscription |

### Supported Chains

- Ethereum, BSC, Polygon, Arbitrum (EVM)
- Solana, Near, Cosmos, Sui, Aptos (Non-EVM)

### Examples

```
Subscribe to BTC price
→ ws_subscribe_price(symbol: "BTC/USDT", exchange: "binance")

Monitor wallet transactions
→ ws_subscribe_wallet(address: "0x...", chain: "ethereum")

Subscribe to new Ethereum blocks
→ ws_subscribe_blocks(chain: "ethereum")

Monitor Uniswap pool swaps
→ ws_subscribe_pool(poolAddress: "0x...", chain: "ethereum", events: ["swap"])
```

---

## Alerts Module

Create and manage alerts for blockchain events and price conditions.

### Tools (13 tools)

| Tool | Description |
|------|-------------|
| `alert_price` | Create price alert (above/below/crosses) |
| `alert_whale_movement` | Alert on large transactions |
| `alert_gas` | Create gas price alert |
| `alert_liquidity` | Alert on liquidity pool changes |
| `alert_governance` | Alert on governance proposal activity |
| `alert_contract` | Alert on contract events |
| `alert_list` | List all active alerts |
| `alert_pause` | Pause an alert |
| `alert_resume` | Resume a paused alert |
| `alert_delete` | Delete an alert |
| `alert_history` | Get triggered alert history |
| `alert_test` | Test an alert configuration |
| `alert_clear_all` | Clear all alerts |

### Examples

```
Price alert: BTC above $100k
→ alert_price(symbol: "BTC", condition: "above", targetPrice: 100000)

Whale alert: Track large ETH movements
→ alert_whale_movement(
    target: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    targetType: "token",
    minValueUSD: 1000000,
    chain: "ethereum"
  )

Gas alert: Ethereum gas below 20 Gwei
→ alert_gas(chain: "ethereum", condition: "below", targetGwei: 20)
```

---

## Wallet Analytics Module

Advanced wallet analysis including whale tracking, scoring, and behavior patterns.

### Tools (7 tools)

| Tool | Description |
|------|-------------|
| `wallet_score` | Calculate comprehensive wallet score |
| `wallet_detect_whales` | Detect whale wallets holding a token |
| `wallet_whale_movements` | Track recent large transactions |
| `wallet_label_lookup` | Identify known wallets (exchanges, protocols) |
| `wallet_analyze_portfolio` | Analyze portfolio composition |
| `wallet_get_pnl` | Calculate wallet profit/loss |
| `wallet_compare` | Compare two wallets |

### Scoring Metrics

- **Wallet Age**: How long the wallet has been active
- **Activity Score**: Transaction frequency and patterns
- **Diversity Score**: Token holdings diversification
- **DeFi Engagement**: Protocol usage depth
- **Risk Score**: Interaction with flagged addresses

### Examples

```
Score a wallet
→ wallet_score(address: "0x...", chain: "ethereum")

Find whale holders
→ wallet_detect_whales(
    tokenAddress: "0x...",
    chain: "ethereum",
    minBalance: 1000000
  )

Track whale movements in last 24h
→ wallet_whale_movements(
    chain: "ethereum",
    minValueUSD: 1000000,
    hours: 24
  )
```

---

## Portfolio Module (EVM)

Cross-chain portfolio tracking for EVM networks.

### Tools (5 tools)

| Tool | Description |
|------|-------------|
| `get_portfolio_overview` | Comprehensive portfolio overview |
| `get_token_balance` | Get balance of specific token |
| `get_portfolio_value` | Get total portfolio value in USD |
| `get_portfolio_history` | Get historical portfolio value |
| `get_portfolio_tokens` | List all tokens in portfolio |

### Supported Networks

- Ethereum, Arbitrum, Polygon, BSC, Optimism, Base, and more

### Examples

```
Get portfolio overview
→ get_portfolio_overview(address: "0x...", network: "ethereum")

Track portfolio value
→ get_portfolio_value(address: "0x...", network: "arbitrum")
```

<!-- EOF: @nichxbt | ucm:dW5pdmVyc2FsLWNyeXB0by1tY3A= -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->