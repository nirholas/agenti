# Social Module

The social module provides tools for monitoring crypto social media activity, community metrics, and influencer analytics.

## Data Sources

| Platform | Data Available | Via |
|----------|---------------|-----|
| Twitter/X | Posts, engagement, followers | LunarCrush, direct API |
| Reddit | Posts, comments, sentiment | LunarCrush |
| Telegram | Group activity, member counts | Community data |
| Discord | Server activity | Community data |

## Tools

### Social Monitoring
- `social_mentions` - Token mentions across social platforms
- `social_trending` - Trending tokens on social media
- `social_feed` - Social media feed for a token or topic
- `social_hashtags` - Trending crypto hashtags

### Influencer Analytics
- `social_influencers` - Top crypto influencers by category
- `social_influencer_profile` - Detailed influencer metrics
- `social_influencer_posts` - Recent posts from an influencer
- `social_influencer_impact` - Measure price impact of influencer posts

### Community Metrics
- `social_community_size` - Community size across platforms
- `social_community_growth` - Community growth rate
- `social_engagement_rate` - Overall engagement metrics
- `social_active_contributors` - Most active community members

### News Integration
- `social_news_feed` - Crypto news aggregation
- `social_news_sentiment` - News sentiment analysis
- `social_breaking_news` - Breaking crypto news alerts

## Input Schemas

### social_mentions

```typescript
z.object({
  token: z.string().describe('Token symbol'),
  platform: z.enum(['twitter', 'reddit', 'telegram', 'all']).default('all'),
  timeframe: z.enum(['1h', '4h', '24h', '7d']).default('24h'),
})
```

### social_influencers

```typescript
z.object({
  category: z.enum(['defi', 'nft', 'trading', 'general']).default('general'),
  sortBy: z.enum(['followers', 'engagement', 'accuracy']).default('engagement'),
  limit: z.number().default(20),
})
```

## Response Format

### Social Mentions
```json
{
  "success": true,
  "data": {
    "token": "SOL",
    "totalMentions": 15420,
    "platforms": {
      "twitter": 8500,
      "reddit": 4200,
      "telegram": 2720
    },
    "sentiment": {
      "positive": 62,
      "neutral": 28,
      "negative": 10
    },
    "topPosts": [
      {
        "platform": "twitter",
        "author": "@cryptoanalyst",
        "text": "...",
        "engagement": 5400,
        "sentiment": "positive"
      }
    ]
  }
}
```

## Packages

The social module works with:
- `packages/social/xactions` - Twitter/X automation and posting
- `packages/xactions-premium` - Premium x402-gated social features

## Common Workflows

### Narrative Detection
1. Monitor `social_trending` for emerging narratives
2. Track `social_mentions` velocity for tokens in the trend
3. Analyze `social_influencers` driving the narrative
4. Cross-reference with on-chain data for validation

### Community Due Diligence
1. Check `social_community_size` for project maturity
2. Analyze `social_community_growth` for organic vs artificial growth
3. Review `social_engagement_rate` for community health
4. Monitor `social_active_contributors` for development activity
