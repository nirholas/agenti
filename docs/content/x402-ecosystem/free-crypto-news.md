# 📰 free-crypto-news Integration Guide

> Add premium tiers to the free crypto news API using x402

## Overview

**Repository**: https://github.com/nirholas/free-crypto-news (20⭐)

free-crypto-news provides RSS/Atom feeds and a JSON API. This guide adds premium features while keeping the core service free.

## Premium Features

| Feature | Price | Description |
|---------|-------|-------------|
| Real-time Firehose | $0.10/day | WebSocket feed, <1s latency |
| AI Summaries | $0.001/summary | GPT-powered article summaries |
| Breaking Alerts | $0.05/day | Push notifications |
| Deep Archive | $0.01/query | Full historical search |
| Custom Feeds | $0.50/month | Personalized keyword feeds |

## Installation

```bash
cd free-crypto-news
npm install @nirholas/universal-crypto-mcp @nirholas/x402-ecosystem
```

## Step 1: Define Premium Tiers

Create `src/tiers.ts`:

```typescript
import { createPremiumTier } from "@nirholas/x402-ecosystem/premium";

export const NEWS_TIERS = createPremiumTier({
  free: {
    features: ["rss", "json-api", "30-day-archive"],
    rateLimit: 100,
    ratePeriod: "day",
  },
  
  basic: {
    price: "4.99",
    period: "monthly",
    features: ["rss", "json-api", "90-day-archive", "ai-summaries"],
    rateLimit: 1000,
    ratePeriod: "day",
  },
  
  premium: {
    price: "19.99", 
    period: "monthly",
    features: ["all", "firehose", "alerts", "custom-feeds", "api-priority"],
    rateLimit: 10000,
    ratePeriod: "day",
  },
  
  payAsYouGo: {
    price: "0.001",
    period: "per-request",
    features: ["ai-summaries", "deep-archive"],
  },
});

export const FEATURE_PRICES = {
  "ai-summary": "0.001",
  "deep-archive-query": "0.01",
  "firehose-day": "0.10",
  "breaking-alerts-day": "0.05",
  "custom-feed-month": "0.50",
};
```

## Step 2: Add x402 Middleware

Create `src/middleware/x402.ts`:

```typescript
import express from "express";
import { 
  x402Paywall,
  x402DynamicPaywall,
  dynamicPrice,
} from "@nirholas/universal-crypto-mcp";
import { FEATURE_PRICES } from "../tiers";

const RECIPIENT = process.env.PAYMENT_ADDRESS as `0x${string}`;

/**
 * Paywall for AI summaries - $0.001 per summary
 */
export const summaryPaywall = x402Paywall({
  price: FEATURE_PRICES["ai-summary"],
  recipient: RECIPIENT,
  description: "AI-powered article summary",
});

/**
 * Paywall for archive queries - $0.01 per query
 */
export const archivePaywall = x402Paywall({
  price: FEATURE_PRICES["deep-archive-query"],
  recipient: RECIPIENT,
  description: "Deep archive search query",
});

/**
 * Dynamic paywall based on data size
 */
export const firehosePaywall = x402DynamicPaywall({
  pricing: dynamicPrice({
    basePrice: FEATURE_PRICES["firehose-day"],
    // Discount for longer subscriptions
    modifiers: [
      { condition: (ctx) => ctx.duration >= 7, multiplier: 0.9 },
      { condition: (ctx) => ctx.duration >= 30, multiplier: 0.8 },
    ],
  }),
  recipient: RECIPIENT,
  description: "Real-time news firehose",
});

/**
 * Revenue sharing for content
 */
export const contentPaywall = (sourceAddress: `0x${string}`) => 
  x402Paywall({
    price: "0.001",
    recipient: RECIPIENT,
    revenueSplit: [
      { address: sourceAddress, percent: 70 },  // Content source
      { address: RECIPIENT, percent: 30 },       // Platform
    ],
    description: "Premium content access",
  });
```

## Step 3: Update API Routes

Modify `src/routes/api.ts`:

```typescript
import express from "express";
import { 
  summaryPaywall, 
  archivePaywall,
  firehosePaywall,
} from "../middleware/x402";

const router = express.Router();

// ============================================================
// FREE ENDPOINTS (unchanged)
// ============================================================

router.get("/news/latest", async (req, res) => {
  const news = await getLatestNews(50);
  res.json({ news, tier: "free" });
});

router.get("/rss", async (req, res) => {
  const rss = await generateRSS();
  res.type("application/rss+xml").send(rss);
});

// ============================================================
// PREMIUM ENDPOINTS (with x402)
// ============================================================

/**
 * AI Summary - $0.001 per article
 */
router.get(
  "/news/:id/summary",
  summaryPaywall,  // Requires payment
  async (req, res) => {
    const article = await getArticle(req.params.id);
    const summary = await generateAISummary(article);
    
    res.json({
      articleId: req.params.id,
      summary,
      keyPoints: summary.keyPoints,
      sentiment: summary.sentiment,
      tier: "premium",
    });
  }
);

/**
 * Deep Archive Search - $0.01 per query
 */
router.get(
  "/archive/search",
  archivePaywall,
  async (req, res) => {
    const { query, from, to, sources } = req.query;
    
    const results = await searchArchive({
      query: query as string,
      dateRange: { from, to },
      sources: sources?.split(","),
    });
    
    res.json({
      query,
      results,
      count: results.length,
      tier: "premium",
    });
  }
);

/**
 * Real-time Firehose - $0.10/day
 */
router.get(
  "/firehose/subscribe",
  firehosePaywall,
  async (req, res) => {
    // Return WebSocket endpoint after payment
    const wsToken = generateWSToken(req.paymentProof);
    
    res.json({
      websocket: `wss://news.api.com/firehose?token=${wsToken}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      tier: "premium",
    });
  }
);

export default router;
```

## Step 4: Add MCP Tools

Create `src/mcp/server.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerX402 } from "@nirholas/universal-crypto-mcp";
import { z } from "zod";

const server = new McpServer({
  name: "free-crypto-news",
  version: "2.0.0",
});

// Register x402 payment tools
registerX402(server);

// ============================================================
// FREE TOOLS
// ============================================================

server.tool(
  "news_latest",
  "Get latest crypto news (free)",
  { limit: z.number().optional() },
  async ({ limit }) => {
    const news = await fetch(`https://api.news.com/news/latest?limit=${limit ?? 10}`);
    return { content: [{ type: "text", text: await news.text() }] };
  }
);

// ============================================================
// PREMIUM TOOLS (instruct to use x402_pay_request)
// ============================================================

server.tool(
  "news_summarize",
  "Get AI summary of an article ($0.001). Use x402_pay_request to access this premium endpoint.",
  { 
    articleId: z.string().describe("Article ID to summarize"),
  },
  async ({ articleId }) => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          instruction: "Use x402_pay_request to call this premium endpoint",
          url: `https://api.news.com/news/${articleId}/summary`,
          cost: "$0.001",
          method: "GET",
        }),
      }],
    };
  }
);

server.tool(
  "news_archive_search",
  "Search historical news archive ($0.01/query). Use x402_pay_request for premium access.",
  {
    query: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
  },
  async ({ query, from, to }) => {
    const params = new URLSearchParams({ query });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          instruction: "Use x402_pay_request to access premium archive",
          url: `https://api.news.com/archive/search?${params}`,
          cost: "$0.01",
          method: "GET",
        }),
      }],
    };
  }
);

export { server };
```

## Step 5: Revenue Tracking

Create `src/analytics/revenue.ts`:

```typescript
import { X402Analytics, createFileAnalytics } from "@nirholas/universal-crypto-mcp";

const analytics = createFileAnalytics("./data/revenue.json");

export async function trackRevenue(payment: {
  amount: string;
  feature: string;
  source?: string;
}) {
  await analytics.record({
    type: "payment_received",
    amount: payment.amount,
    metadata: {
      feature: payment.feature,
      contentSource: payment.source,
    },
  });
}

export async function getRevenueReport(period: "day" | "week" | "month") {
  const stats = await analytics.getStats(period);
  
  return {
    period,
    totalRevenue: stats.total,
    byFeature: stats.byMetadata("feature"),
    topSources: stats.byMetadata("contentSource").slice(0, 10),
    transactions: stats.count,
  };
}

// Weekly payout to content sources
export async function distributeRevenue() {
  const week = await analytics.getStats("week");
  const bySource = week.byMetadata("contentSource");
  
  // 70% goes to content sources
  for (const [source, amount] of Object.entries(bySource)) {
    const payout = parseFloat(amount) * 0.7;
    // Queue payout via x402 batch payment
  }
}
```

## Testing

```bash
# Start server with x402
export PAYMENT_ADDRESS=0x...
export X402_CHAIN=arbitrum-sepolia
npm run dev

# Test free endpoint
curl http://localhost:3000/api/news/latest

# Test premium endpoint (will return 402)
curl http://localhost:3000/api/news/123/summary
# Response: HTTP 402 Payment Required
```

## Pricing Summary

| Endpoint | Price | Revenue Split |
|----------|-------|---------------|
| `/news/latest` | Free | - |
| `/rss` | Free | - |
| `/news/:id/summary` | $0.001 | 100% platform |
| `/archive/search` | $0.01 | 100% platform |
| `/firehose/subscribe` | $0.10/day | 100% platform |
| Premium content | $0.001 | 70% source / 30% platform |

## Next Steps

1. ✅ Install dependencies
2. ✅ Define premium tiers
3. ✅ Add x402 middleware
4. ✅ Update API routes
5. ✅ Add MCP tools
6. 🔲 Set up revenue tracking
7. 🔲 Deploy to production

---

**Marketing**: "The news stays free. Premium features pay for themselves."
