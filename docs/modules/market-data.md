# Market Data Module

The market data module provides real-time and historical cryptocurrency pricing, volume, and market cap data from multiple aggregated sources.

## Data Sources

| Source | Coverage | Rate Limits |
|--------|----------|-------------|
| CoinGecko | 10,000+ coins | Free: 30 req/min |
| CoinStats | 5,000+ coins | Free tier available |
| TradingView | Major pairs | Via vendor integration |

## Tools

### Price Data
- `market_data_price` - Current price for a token (USD, BTC, ETH pairs)
- `market_data_prices_batch` - Batch price queries for multiple tokens
- `market_data_price_history` - Historical OHLCV data with configurable intervals

### Market Overview
- `market_data_global` - Global crypto market statistics (total market cap, volume, dominance)
- `market_data_trending` - Currently trending coins
- `market_data_top_gainers` - Top gaining tokens by percentage
- `market_data_top_losers` - Top losing tokens by percentage

### Token Details
- `market_data_token_info` - Comprehensive token information (description, links, categories)
- `market_data_market_chart` - Price chart data with customizable timeframes
- `market_data_token_markets` - Exchange-level market data for a token

### Volume & Liquidity
- `market_data_volume_24h` - 24-hour trading volume
- `market_data_exchanges` - Exchange volume rankings

## Input Schemas

### market_data_price

```typescript
z.object({
  coinId: z.string().describe('CoinGecko coin ID (e.g., "bitcoin", "ethereum")'),
  currency: z.string().default('usd').describe('Target currency'),
  includeMarketCap: z.boolean().default(false),
  include24hChange: z.boolean().default(false),
})
```

### market_data_price_history

```typescript
z.object({
  coinId: z.string(),
  days: z.number().min(1).max(365).describe('Number of days of history'),
  interval: z.enum(['hourly', 'daily']).default('daily'),
  currency: z.string().default('usd'),
})
```

## Response Format

```json
{
  "success": true,
  "data": {
    "price": 43250.00,
    "currency": "usd",
    "marketCap": 847000000000,
    "change24h": 2.35,
    "volume24h": 28500000000,
    "lastUpdated": "2024-01-15T12:00:00Z"
  }
}
```

## Usage Examples

### Get Bitcoin Price
```
"What is the current price of Bitcoin?"
→ Calls market_data_price with coinId: "bitcoin"
```

### Compare Multiple Tokens
```
"Compare the prices of ETH, SOL, and AVAX"
→ Calls market_data_prices_batch with coinIds: ["ethereum", "solana", "avalanche-2"]
```

### Historical Analysis
```
"Show me Bitcoin's price over the last 30 days"
→ Calls market_data_price_history with coinId: "bitcoin", days: 30
```

## Rate Limiting

The module implements automatic rate limiting and caching:
- Prices are cached for 30 seconds
- Historical data is cached for 5 minutes
- Batch requests are optimized to minimize API calls
- Automatic retry with exponential backoff on rate limit errors
