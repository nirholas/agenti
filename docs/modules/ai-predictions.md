# AI Predictions Module

The AI predictions module provides access to prediction markets, forecast analytics, and AI-driven market insights.

## Data Sources

| Source | Type | Coverage |
|--------|------|----------|
| Polymarket | Prediction markets | Crypto, politics, sports, events |
| AI Models | Price forecasts | Top 100 tokens |
| On-chain data | Behavioral analysis | All supported chains |

## Tools

### Prediction Markets
- `predictions_polymarket_markets` - Active Polymarket markets
- `predictions_polymarket_market_detail` - Detailed market data (odds, volume, liquidity)
- `predictions_polymarket_positions` - User positions on Polymarket
- `predictions_polymarket_trending` - Trending prediction markets

### AI Forecasts
- `predictions_price_forecast` - AI price prediction for a token
- `predictions_trend_analysis` - Multi-factor trend analysis
- `predictions_risk_score` - AI risk assessment for a token or protocol

### On-Chain Signals
- `predictions_smart_money` - Smart money flow analysis
- `predictions_accumulation_zones` - Identify accumulation/distribution zones
- `predictions_network_growth` - Network growth and adoption metrics

## Input Schemas

### predictions_polymarket_markets

```typescript
z.object({
  category: z.enum(['crypto', 'politics', 'sports', 'science', 'all']).default('crypto'),
  status: z.enum(['active', 'resolved', 'all']).default('active'),
  sortBy: z.enum(['volume', 'liquidity', 'newest']).default('volume'),
  limit: z.number().default(20),
})
```

### predictions_price_forecast

```typescript
z.object({
  coinId: z.string().describe('Token symbol or CoinGecko ID'),
  timeframe: z.enum(['24h', '7d', '30d', '90d']),
  includeConfidence: z.boolean().default(true),
})
```

## Response Format

### Price Forecast
```json
{
  "success": true,
  "data": {
    "token": "bitcoin",
    "currentPrice": 43250,
    "forecast": {
      "timeframe": "7d",
      "predicted": 45100,
      "confidence": 0.72,
      "range": { "low": 41000, "high": 48000 },
      "factors": [
        { "name": "momentum", "signal": "bullish", "weight": 0.3 },
        { "name": "sentiment", "signal": "neutral", "weight": 0.2 },
        { "name": "onchain", "signal": "bullish", "weight": 0.25 },
        { "name": "macro", "signal": "neutral", "weight": 0.25 }
      ]
    },
    "disclaimer": "AI predictions are not financial advice. Past performance does not guarantee future results."
  }
}
```

## Disclaimer

All predictions and forecasts are for informational purposes only. They should not be considered financial advice. Cryptocurrency markets are highly volatile and unpredictable. Always conduct your own research before making investment decisions.

## Common Workflows

### Market Research
1. Check `predictions_polymarket_trending` for market sentiment
2. Review `predictions_price_forecast` for tokens of interest
3. Validate with `predictions_smart_money` flow analysis
4. Cross-reference with technical indicators module
