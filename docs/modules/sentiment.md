# Sentiment Module

The sentiment module provides social media sentiment analysis, community metrics, and market psychology indicators for cryptocurrencies.

## Data Sources

| Source | Data Type | Update Frequency |
|--------|-----------|-----------------|
| LunarCrush | Social metrics, sentiment scores | Real-time |
| Fear & Greed Index | Market sentiment | Daily |
| Social platforms | Twitter/X, Reddit, Telegram mentions | Hourly |

## Tools

### Sentiment Scores
- `sentiment_score` - Overall sentiment score for a token (0-100)
- `sentiment_social_volume` - Social media mention volume
- `sentiment_social_engagement` - Engagement metrics (likes, shares, comments)
- `sentiment_galaxy_score` - LunarCrush Galaxy Score (composite metric)

### Market Psychology
- `sentiment_fear_greed` - Crypto Fear & Greed Index (0=Extreme Fear, 100=Extreme Greed)
- `sentiment_fear_greed_history` - Historical Fear & Greed values
- `sentiment_market_mood` - Overall market sentiment summary

### Social Analytics
- `sentiment_trending_topics` - Trending crypto topics on social media
- `sentiment_influencers` - Top crypto influencers by engagement
- `sentiment_social_dominance` - Token's share of total crypto social volume

## Input Schemas

### sentiment_score

```typescript
z.object({
  coinId: z.string().describe('Token symbol or CoinGecko ID'),
  timeframe: z.enum(['24h', '7d', '30d']).default('24h'),
})
```

### sentiment_fear_greed

```typescript
z.object({
  days: z.number().min(1).max(365).default(1).describe('Number of days of history'),
})
```

## Response Format

### Sentiment Score
```json
{
  "success": true,
  "data": {
    "token": "bitcoin",
    "sentimentScore": 72,
    "label": "bullish",
    "socialVolume": 125000,
    "socialEngagement": 890000,
    "galaxyScore": 68,
    "trendDirection": "rising",
    "timeframe": "24h"
  }
}
```

### Fear & Greed
```json
{
  "success": true,
  "data": {
    "value": 65,
    "label": "Greed",
    "previousValue": 58,
    "change": 7,
    "timestamp": "2024-01-15T00:00:00Z"
  }
}
```

## Sentiment Scale

| Range | Label | Market Implication |
|-------|-------|-------------------|
| 0-20 | Extreme Fear | Potential buying opportunity |
| 21-40 | Fear | Market pessimism |
| 41-60 | Neutral | Balanced sentiment |
| 61-80 | Greed | Market optimism |
| 81-100 | Extreme Greed | Potential correction ahead |

## Common Workflows

### Contrarian Analysis
1. Check `sentiment_fear_greed` for market extremes
2. Compare with `sentiment_score` for specific tokens
3. Cross-reference with `indicator_rsi` for technical confirmation
4. Identify potential reversal opportunities

### Social Momentum
1. Track `sentiment_social_volume` for rising mentions
2. Monitor `sentiment_trending_topics` for new narratives
3. Analyze `sentiment_influencers` for key opinion leader activity
