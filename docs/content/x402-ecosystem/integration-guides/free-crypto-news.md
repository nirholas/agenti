# free-crypto-news Integration Guide

> Add premium tier with x402 paywall to nirholas/free-crypto-news

## Overview

The `free-crypto-news` repository (20⭐) provides a free crypto news API. This guide shows how to add a premium tier using x402 payments, enabling micropayments for premium news sources.

## Installation

```bash
cd free-crypto-news
npm install @nirholas/x402-ecosystem
```

## Integration Steps

### 1. Create Premium Tier Configuration

```typescript
// src/premium/tiers.ts
import { createPremiumTier, PricingStrategy } from "@nirholas/x402-ecosystem/premium";

export const newsTiers = createPremiumTier({
  free: {
    rateLimit: 100,
    ratePeriod: "day",
    features: [
      "basic-news",
      "24h-delay",
      "top-10-sources",
    ],
  },
  basic: {
    price: "4.99",
    period: "monthly",
    rateLimit: 1000,
    ratePeriod: "day",
    features: [
      "basic-news",
      "1h-delay",
      "all-free-sources",
      "email-alerts",
    ],
  },
  premium: {
    price: "0.001", // $0.001 per news item
    period: "per-request",
    features: [
      "all-news",
      "real-time",
      "premium-sources",
      "sentiment-analysis",
      "ai-summaries",
    ],
  },
  enterprise: {
    price: "99.99",
    period: "monthly",
    rateLimit: 100000,
    ratePeriod: "day",
    features: [
      "all-features",
      "dedicated-support",
      "custom-filters",
      "webhooks",
      "api-priority",
    ],
  },
});

// Pricing strategy for premium tier
export const premiumPricing = PricingStrategy.tiered([
  { maxRequests: 100, price: "0.001" },   // First 100: $0.001 each
  { maxRequests: 1000, price: "0.0005" }, // Next 900: $0.0005 each
  { maxRequests: 10000, price: "0.0001" }, // Beyond: $0.0001 each
]);
```

### 2. Create Paywall Middleware

```typescript
// src/middleware/x402-paywall.ts
import { PaywallBuilder, PricingStrategy } from "@nirholas/x402-ecosystem/premium";
import type { Request, Response, NextFunction } from "express";

// Environment configuration
const RECIPIENT_ADDRESS = process.env.NEWS_PAYMENT_ADDRESS as `0x${string}`;

/**
 * x402 Paywall middleware for premium endpoints
 */
export function createNewsPaywall() {
  const paywall = new PaywallBuilder()
    .forEndpoint("/api/v1/premium/*")
    .withPrice("0.001")
    .withToken("USDC")
    .withRecipient(RECIPIENT_ADDRESS)
    .withDescription("Premium crypto news - real-time access")
    .withRateLimit(10000, "day")
    .build();
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for x402 payment header
    const paymentHeader = req.headers["x-402-payment"];
    
    if (!paymentHeader) {
      // Return 402 Payment Required with payment details
      return res.status(402).json({
        error: "Payment Required",
        message: "This endpoint requires x402 payment",
        paymentDetails: {
          amount: paywall.price,
          token: paywall.token,
          recipient: paywall.recipient,
          network: "eip155:8453", // Base
          facilitator: "https://x402.org/facilitator",
        },
        x402: {
          version: "1.0",
          paymentRequired: true,
        },
      });
    }
    
    // Verify payment (simplified - real implementation uses facilitator)
    // In production, verify with x402 facilitator service
    next();
  };
}

/**
 * Tiered pricing based on request count
 */
export function createTieredPaywall() {
  const pricing = PricingStrategy.tiered([
    { maxRequests: 100, price: "0.001" },
    { maxRequests: 1000, price: "0.0005" },
    { maxRequests: 10000, price: "0.0001" },
  ]);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers["x-user-id"] as string;
    const requestCount = getUserRequestCount(userId);
    
    const price = pricing({
      userId,
      requestCount,
      endpoint: req.path,
    });
    
    // Set price for this request
    req.x402Price = price;
    next();
  };
}

function getUserRequestCount(userId: string): number {
  // Implement request counting
  return 0;
}

declare global {
  namespace Express {
    interface Request {
      x402Price?: string;
    }
  }
}
```

### 3. Create Premium News Endpoints

```typescript
// src/routes/premium.ts
import { Router } from "express";
import { createNewsPaywall, createTieredPaywall } from "../middleware/x402-paywall.js";
import { fetchPremiumNews, generateAISummary } from "../services/news.js";

const router = Router();

// Apply paywall to all premium routes
router.use(createNewsPaywall());

/**
 * GET /api/v1/premium/news
 * Real-time premium news feed
 */
router.get("/news", async (req, res) => {
  const { topic, limit = 20, sources } = req.query;
  
  const news = await fetchPremiumNews({
    topic: topic as string,
    limit: parseInt(limit as string),
    sources: sources ? (sources as string).split(",") : undefined,
    includePaywalled: true, // Include news from premium sources
  });
  
  res.json({
    success: true,
    count: news.length,
    data: news,
    tier: "premium",
    cost: req.x402Price ?? "0.001",
  });
});

/**
 * GET /api/v1/premium/news/:id/summary
 * AI-generated summary of news article
 */
router.get("/news/:id/summary", async (req, res) => {
  const { id } = req.params;
  
  const summary = await generateAISummary(id);
  
  res.json({
    success: true,
    data: {
      id,
      summary: summary.text,
      sentiment: summary.sentiment,
      keyPoints: summary.keyPoints,
      relatedTopics: summary.relatedTopics,
    },
    tier: "premium",
    cost: "0.002", // AI summary costs more
  });
});

/**
 * GET /api/v1/premium/sentiment
 * Real-time market sentiment analysis
 */
router.get("/sentiment", async (req, res) => {
  const { asset, timeframe = "24h" } = req.query;
  
  // Fetch sentiment from premium sources
  const sentiment = await fetchSentimentAnalysis(asset as string, timeframe as string);
  
  res.json({
    success: true,
    data: sentiment,
    tier: "premium",
    cost: "0.005",
  });
});

export default router;

async function fetchSentimentAnalysis(asset: string, timeframe: string) {
  // Implement sentiment analysis
  return {
    asset,
    timeframe,
    score: 0.65,
    trend: "bullish",
    sources: 42,
  };
}
```

### 4. Update Main App

```typescript
// src/app.ts
import express from "express";
import freeRoutes from "./routes/free.js";
import premiumRoutes from "./routes/premium.js";
import { registerX402Ecosystem } from "@nirholas/x402-ecosystem";

const app = express();

app.use(express.json());

// Free tier routes (existing)
app.use("/api/v1", freeRoutes);

// Premium tier routes (new)
app.use("/api/v1/premium", premiumRoutes);

// Health check with tier info
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    tiers: {
      free: { available: true, rateLimit: "100/day" },
      premium: { available: true, pricing: "pay-per-request" },
    },
    x402: {
      enabled: true,
      facilitator: "https://x402.org/facilitator",
    },
  });
});

export default app;
```

### 5. Create Revenue Splitter

Split revenue between content providers:

```typescript
// src/revenue/splitter.ts
import type { Address } from "@nirholas/x402-ecosystem";

interface RevenueRecipient {
  address: Address;
  percentage: number;
  label: string;
}

/**
 * Configure revenue split for news content
 */
export const newsRevenueSplit: RevenueRecipient[] = [
  {
    address: "0x..." as Address, // Content aggregator
    percentage: 40,
    label: "content-providers",
  },
  {
    address: "0x..." as Address, // Platform
    percentage: 30,
    label: "platform",
  },
  {
    address: "0x..." as Address, // Development fund
    percentage: 20,
    label: "development",
  },
  {
    address: "0x..." as Address, // Community treasury
    percentage: 10,
    label: "treasury",
  },
];

/**
 * Calculate payment distribution
 */
export function calculateDistribution(
  totalAmount: string,
  recipients: RevenueRecipient[]
): Map<Address, string> {
  const total = parseFloat(totalAmount);
  const distribution = new Map<Address, string>();
  
  for (const recipient of recipients) {
    const amount = (total * recipient.percentage / 100).toFixed(6);
    distribution.set(recipient.address, amount);
  }
  
  return distribution;
}
```

### 6. Register with Tool Marketplace

```typescript
// src/marketplace-registration.ts
import { ToolMarketplace } from "@nirholas/x402-ecosystem";

const marketplace = new ToolMarketplace();

export async function registerNewsService() {
  await marketplace.registerTool({
    name: "free-crypto-news-premium",
    description: "Real-time crypto news with sentiment analysis and AI summaries",
    endpoint: "https://news.nirholas.dev/api/v1/premium",
    price: "0.001",
    category: "Data",
    owner: process.env.NEWS_PAYMENT_ADDRESS as `0x${string}`,
    metadata: {
      rateLimit: "10000/day",
      sources: 50,
      features: ["real-time", "sentiment", "ai-summaries"],
    },
  });
  
  console.log("✅ Registered with x402 Tool Marketplace");
}
```

## API Documentation

### Premium Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/v1/premium/news` | $0.001 | Real-time news feed |
| `GET /api/v1/premium/news/:id/summary` | $0.002 | AI summary |
| `GET /api/v1/premium/sentiment` | $0.005 | Sentiment analysis |

### Payment Headers

```http
GET /api/v1/premium/news HTTP/1.1
Host: news.nirholas.dev
X-402-Payment: <payment-token>
X-402-Network: eip155:8453
```

### 402 Response

```json
{
  "error": "Payment Required",
  "paymentDetails": {
    "amount": "0.001",
    "token": "USDC",
    "recipient": "0x...",
    "network": "eip155:8453",
    "facilitator": "https://x402.org/facilitator"
  }
}
```

## Example Client Usage

```typescript
import { PayableAgent } from "@nirholas/x402-ecosystem";

const agent = new PayableAgent({
  privateKey: process.env.X402_PRIVATE_KEY,
  maxDailySpend: "1.00",
});

// Fetch premium news
const news = await agent.payForService(
  "https://news.nirholas.dev/api/v1/premium/news?topic=ethereum"
);

console.log(`Fetched ${news.count} premium news items`);
console.log(`Cost: $${news.cost}`);
```

## Testing

```typescript
// test/premium.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Premium News API", () => {
  it("should return 402 without payment", async () => {
    const res = await request(app)
      .get("/api/v1/premium/news")
      .expect(402);
    
    expect(res.body.error).toBe("Payment Required");
    expect(res.body.paymentDetails.amount).toBe("0.001");
  });
  
  it("should return news with valid payment", async () => {
    const res = await request(app)
      .get("/api/v1/premium/news")
      .set("X-402-Payment", "valid-payment-token")
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.tier).toBe("premium");
  });
});
```

## Environment Variables

```bash
# Payment recipient address
NEWS_PAYMENT_ADDRESS=0x...

# x402 configuration
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_NETWORK=eip155:8453

# Premium tier settings
PREMIUM_DEFAULT_PRICE=0.001
PREMIUM_RATE_LIMIT=10000
```

## Next Steps

1. Clone free-crypto-news repository
2. Add @nirholas/x402-ecosystem dependency
3. Create premium tier configuration
4. Add paywall middleware
5. Create premium endpoints
6. Register with Tool Marketplace
7. Update documentation

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 100 req/day, 24h delay, basic sources |
| Basic | $4.99/mo | 1000 req/day, 1h delay, all free sources |
| Premium | $0.001/req | Unlimited, real-time, all sources, AI |
| Enterprise | $99.99/mo | 100k req/day, priority, webhooks |

## Related Links

- [x402-ecosystem package](../../packages/x402-ecosystem/)
- [Premium Tier API](../api/premium.md)
- [free-crypto-news repository](https://github.com/nirholas/free-crypto-news)
