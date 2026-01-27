# ⚡ XActions Premium - x402 Paid Features

> Transform XActions into a monetized Twitter automation service with micropayments.

## 🎯 Overview

XActions Premium adds x402 payments to the popular XActions Twitter automation toolkit (58⭐). AI agents can now pay for enhanced features using USDC stablecoin payments on multiple EVM chains.

### Pricing Model

| Tier | Description | Price |
|------|-------------|-------|
| 🆓 **Free** | Basic scraping, 100 requests/day | $0 |
| 💳 **Pay-as-you-go** | Per-operation pricing | $0.001 - $0.01 |
| 📅 **Subscription** | Auto-engagement bot | $0.10/day |

### Premium Features

| Feature | Price | Description |
|---------|-------|-------------|
| 🚀 Rate Limit Bypass | $0.01/100 requests | Proxy network for higher throughput |
| 🎭 Sentiment Analysis | $0.001/tweet | AI-powered sentiment scoring |
| 📊 Engagement Prediction | $0.005/prediction | Predict tweet performance |
| 🤖 Auto-Engagement Bot | $0.10/day | Hands-free growth automation |

## 🛠️ Installation

```bash
npm install @nirholas/xactions-premium viem
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createXActionsPaymentClient } from '@nirholas/xactions-premium';

// Initialize with your wallet
const client = await createXActionsPaymentClient({
  privateKey: process.env.X402_PRIVATE_KEY,
  sessionCookie: process.env.X_AUTH_TOKEN,
  network: 'base-sepolia', // Use 'base' for mainnet
});

// Analyze sentiment ($0.001/tweet)
const sentiment = await client.analyzeSentiment([
  "This product is amazing! 🚀",
  "I'm really disappointed with the service",
]);
console.log(sentiment);
// [
//   { tweet: "...", sentiment: "positive", score: 0.85, confidence: 0.92 },
//   { tweet: "...", sentiment: "negative", score: -0.72, confidence: 0.88 }
// ]

// Predict engagement ($0.005)
const prediction = await client.predictEngagement(
  "🚀 Just launched our new AI feature! Check it out..."
);
console.log(prediction);
// {
//   predictedLikes: 142,
//   predictedRetweets: 23,
//   optimalPostTime: "2026-01-27T14:00:00Z",
//   viralPotential: "medium"
// }

// Subscribe to auto-engagement ($0.10/day)
const subscription = await client.subscribeAutoEngagement(7); // 7 days
```

### MCP Server Integration

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  createXActionsPaymentClient, 
  registerPremiumTools,
  PREMIUM_TOOLS 
} from '@nirholas/xactions-premium';

// Create MCP server
const server = new Server({
  name: 'xactions-premium',
  version: '1.0.0',
});

// Initialize payment client
const client = await createXActionsPaymentClient({
  privateKey: process.env.X402_PRIVATE_KEY,
});

// Register premium tools
registerPremiumTools(server, client);

// Now AI agents can use:
// - xactions_premium_sentiment
// - xactions_premium_predict
// - xactions_premium_rate_limit
// - xactions_subscribe_bot
// - xactions_subscription_status
```

### Claude Desktop Configuration

Add to `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "xactions-premium": {
      "command": "node",
      "args": ["/path/to/xactions-premium-server.js"],
      "env": {
        "X402_PRIVATE_KEY": "0x...",
        "X_AUTH_TOKEN": "your_twitter_auth_token",
        "X402_NETWORK": "base-sepolia"
      }
    }
  }
}
```

## 💳 x402 Payment Flow

```
┌─────────────┐                         ┌─────────────┐
│  AI Agent   │                         │   XActions  │
│  (Claude)   │                         │   Premium   │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       │  1. Request: Analyze sentiment        │
       │ ────────────────────────────────────► │
       │                                       │
       │  2. 402 Payment Required              │
       │     Price: $0.001 × 10 tweets         │
       │ ◄──────────────────────────────────── │
       │                                       │
       │  3. Sign USDC payment (EIP-3009)      │
       │     ...                               │
       │                                       │
       │  4. Retry with X-Payment header       │
       │ ────────────────────────────────────► │
       │                                       │
       │  5. 200 OK + Results                  │
       │ ◄──────────────────────────────────── │
```

## 📊 Available MCP Tools

### `xactions_premium_sentiment`

Analyze sentiment of tweets using AI.

```
💰 Price: $0.001/tweet
📊 Bulk discounts: 10% off 100+, 20% off 500+, 30% off 1000+
```

**Parameters:**
- `tweets`: Array of tweet texts to analyze
- OR `username`: Analyze recent tweets from a user
- `tweetCount`: Number of tweets (default: 50)

### `xactions_premium_predict`

Predict engagement before posting.

```
💰 Price: $0.005/prediction
```

**Parameters:**
- `tweet`: Tweet content to analyze
- `postTime`: Optional scheduled time (ISO format)

### `xactions_premium_optimal_times`

Get best times to post based on your audience.

```
💰 Price: $0.01/analysis
```

**Parameters:**
- `username`: Your Twitter username

### `xactions_premium_audience`

Deep audience demographics analysis.

```
💰 Price: $0.02/analysis
```

**Parameters:**
- `username`: Twitter username to analyze

### `xactions_premium_rate_limit`

Purchase rate limit bypass credits.

```
💰 Price: $0.01/100 requests
```

**Parameters:**
- `requestCount`: Number of requests (min: 100)

### `xactions_subscribe_bot`

Subscribe to auto-engagement automation.

```
💰 Price: $0.10/day
```

**Parameters:**
- `days`: Subscription length (1-30)
- `targetHashtags`: Array of hashtags to target
- `targetAccounts`: Array of accounts to target

### `xactions_subscription_status`

Check your current subscription.

**Parameters:** None

## 🌐 Supported Networks

| Network | Chain ID | USDC Address | Gas Cost |
|---------|----------|--------------|----------|
| Base Sepolia (Testnet) | 84532 | `0x036CbD...` | Free |
| Base Mainnet | 8453 | `0x833589...` | ~$0.01 |
| Ethereum | 1 | `0xA0b869...` | ~$5-50 |
| Arbitrum | 42161 | `0xaf88d0...` | ~$0.10 |

### Getting Testnet USDC

1. Visit [Circle Faucet](https://faucet.circle.com/)
2. Connect your wallet
3. Request testnet USDC on Base Sepolia

## 🔧 Server-Side Setup

To deploy the premium API endpoints:

```typescript
import express from 'express';
import { createPremiumRouter } from '@nirholas/xactions-premium/server';
import { x402Middleware } from './x402-middleware.js';

const app = express();

// Add x402 payment middleware
app.use('/api/premium', x402Middleware);

// Mount premium routes
app.use('/api/premium', createPremiumRouter());

app.listen(3001, () => {
  console.log('XActions Premium API running on :3001');
});
```

## 📈 Revenue Potential

With 58⭐ and growing user base:

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| Daily Active Users | 50 | 200 | 500 |
| Avg. Spend/User/Day | $0.05 | $0.15 | $0.30 |
| Daily Revenue | $2.50 | $30 | $150 |
| Monthly Revenue | $75 | $900 | $4,500 |

## 🤖 Example AI Agent Prompts

Once configured, AI agents can interact naturally:

```
"Analyze the sentiment of @elonmusk's last 50 tweets"

"Before I post this tweet, predict how it will perform: 
'🚀 Just shipped our new AI feature! Thread incoming...'"

"Subscribe me to auto-engagement for 7 days, targeting 
#AI and #Crypto hashtags"

"Who are my most engaged followers? Show me audience demographics."
```

## 🔐 Security

- Private keys are never transmitted to servers
- Payments use EIP-3009 (TransferWithAuthorization) - no token approvals needed
- Each payment is cryptographically signed
- Testnet available for development

## 📚 API Reference

See full API documentation at [xactions.app/docs/premium](https://xactions.app/docs/premium)

## 📄 License

MIT © [nich (@nichxbt)](https://github.com/nirholas)

---

<p align="center">
  <b>XActions Premium</b> - Monetize Twitter automation with x402 micropayments
  <br>
  <a href="https://github.com/nirholas/XActions">GitHub</a> •
  <a href="https://xactions.app">Website</a> •
  <a href="https://x402.org">x402 Protocol</a>
</p>
