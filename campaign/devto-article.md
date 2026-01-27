# 📝 Dev.to Article

> **Title**: How I Made My AI Agent Earn Money While Sleeping
> **Tags**: ai, web3, mcp, tutorial, showdev

---

```markdown
---
title: How I Made My AI Agent Earn Money While Sleeping
published: true
description: Building an AI agent with its own crypto wallet that can pay for services and earn yield
tags: ai, web3, mcp, tutorial
cover_image: https://raw.githubusercontent.com/nirholas/universal-crypto-mcp/main/.github/cover-devto.png
canonical_url: https://github.com/nirholas/universal-crypto-mcp
---

# How I Made My AI Agent Earn Money While Sleeping 💰🤖

Last month, I gave Claude a crypto wallet.

Today, it's earned $12.47 in yield and paid for 247 API calls—all without me lifting a finger.

Here's how I built it, and how you can too.

## The Problem

I use Claude constantly for development work. But every time I needed it to access a premium API—weather data, research papers, analytics—I had to manually handle the payment.

1. Go to API provider
2. Sign up for account
3. Enter credit card
4. Get API key
5. Configure Claude
6. Repeat for every new service

What if Claude could just... pay for things itself?

## Enter x402

HTTP 402 "Payment Required" has been a reserved status code since 1999. Nobody used it because there was no standard way to handle the payment.

Until now.

x402 is a protocol that finally gives 402 a purpose:

```
Client: GET /api/premium-data
Server: 402 Payment Required
        {
          "amount": "0.05",
          "currency": "USD",
          "address": "0x...",
          "network": "arbitrum"
        }
Client: [signs payment]
Server: 200 OK
        { "data": "..." }
```

When an AI agent hits a paywall, it can now:
1. Read the payment requirements
2. Sign a transaction from its wallet
3. Get access
4. Continue working

No human in the loop.

## Setting It Up (5 Minutes)

### Step 1: Install Universal Crypto MCP

```bash
npx @nirholas/universal-crypto-mcp
```

### Step 2: Add to Claude Desktop

Edit your Claude config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "universal-crypto": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp"],
      "env": {
        "X402_PRIVATE_KEY": "your-private-key-here",
        "X402_NETWORK": "arbitrum",
        "X402_MAX_PAYMENT": "1.00"
      }
    }
  }
}
```

### Step 3: Fund the Wallet

Ask Claude: "What's my x402 wallet address?"

Send some USDs (or USDC) to that address on Arbitrum.

### Step 4: Test It

Ask Claude: "Check my x402 balance"

You should see something like:

```
🔐 x402 Wallet Status
━━━━━━━━━━━━━━━━━━━━
💰 Balance: $50.00 USDs
📈 Yield: +$0.00 today
⛓️ Network: Arbitrum One
```

That's it. Claude now has money.

## The Magic Moment

Now here's where it gets interesting. Ask Claude to access a paid API:

```
User: Get premium satellite weather data for Tokyo
```

Claude responds:

```
🔍 Discovering providers...
   Found: PremiumWeather API ($0.05/request)

💳 Initiating x402 payment...
   Amount: $0.05 USDs
   To: 0x1234...5678

✅ Payment confirmed!
   Tx: 0xabcd...

🛰️ TOKYO SATELLITE WEATHER
━━━━━━━━━━━━━━━━━━━━━━━━━
Temperature: 22.3°C
Humidity: 68%
UV Index: 5 (Moderate)
Air Quality: Good (AQI 42)
...
```

Claude detected the paywall, paid automatically, and returned the data.

The future is here.

## The Yield Part

Here's the cherry on top: I use USDs (Sperax USD) for my AI wallet.

USDs is a stablecoin that earns ~5% APY automatically. No staking, no claiming—just holding.

So when Claude isn't spending, it's earning.

After a month:
- Started with: $50.00
- Spent on APIs: $12.38
- Yield earned: $12.47
- Current balance: $50.09

My AI agent is actually profitable. 🤯

## Safety First

I know what you're thinking: "Giving AI access to money sounds terrifying."

I thought so too. Here's how I sleep at night:

### 1. Spending Limits

```bash
X402_MAX_PAYMENT=1.00      # Max $1 per transaction
X402_DAILY_LIMIT=10.00     # Max $10 per day
```

### 2. Address Whitelisting

```bash
X402_WHITELIST="0x123...,0x456..."  # Only pay these addresses
```

### 3. Human Confirmation

For amounts over $0.50, Claude asks me first.

### 4. Full Logging

Every transaction is logged with:
- Amount
- Recipient
- Reason (what Claude was trying to do)
- Timestamp

I review these weekly. So far, Claude has been responsible. 😅

## What Else Can It Do?

x402 is just one part of Universal Crypto MCP. It comes with 380+ tools:

```
// DeFi
"Swap 100 USDC to ETH on Arbitrum"
"What's the best yield for stablecoins?"
"Supply 500 USDC to Aave"

// Security
"Is this token safe? 0x123..."
"Scan this contract for vulnerabilities"

// Analytics
"Show my portfolio across all chains"
"What's trending on DEXs?"

// Governance
"Show active proposals on Aave"
"Vote YES on proposal 123"
```

And with x402, Claude can pay for premium versions of all these services.

## Building x402-Enabled Services

Want to monetize your own API for AI agents? It's simple:

```typescript
import { paymentMiddleware } from '@nirholas/x402';

app.use(
  paymentMiddleware({
    "GET /api/data": {
      price: "0.01",        // $0.01 per request
      currency: "USD",
      network: "arbitrum"
    }
  })
);

app.get('/api/data', (req, res) => {
  // This only runs if payment received
  res.json({ data: "valuable stuff" });
});
```

That's it. Your API now accepts payments from AI agents.

## What's Next?

I'm building toward a vision where AI agents:

1. **Earn money** by providing services to other agents
2. **Spend money** on tools and data they need
3. **Invest money** in yield-generating assets
4. **Trade** with each other in marketplaces

We're at the very beginning of AI economics.

## Try It Yourself

Everything is open source:

- **GitHub**: [github.com/nirholas/universal-crypto-mcp](https://github.com/nirholas/universal-crypto-mcp)
- **npm**: `npx @nirholas/universal-crypto-mcp`
- **Docs**: [x402 Documentation](https://github.com/nirholas/universal-crypto-mcp/tree/main/x402)

If you build something cool, let me know [@nichxbt](https://x.com/nichxbt)!

---

*Have questions? Drop them in the comments. I'll answer everything.*

---

## Resources

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) - The protocol that makes this possible
- [Sperax USDs](https://sperax.io/) - The yield-bearing stablecoin I use
- [Arbitrum](https://arbitrum.io/) - Fast, cheap L2 for transactions
- [Claude Desktop](https://claude.ai/download) - The AI assistant I use

---

*If this was helpful, consider:*
- ⭐ [Starring the repo](https://github.com/nirholas/universal-crypto-mcp)
- 🐦 [Following me on X](https://x.com/nichxbt)
- 💬 Sharing your builds in the comments
```

---

## Article Metadata

- **Reading time**: ~6 minutes
- **Ideal length**: 1200-1500 words
- **Images needed**:
  - Cover image (1000x420)
  - Demo screenshot
  - Architecture diagram (optional)
  
---

## Engagement Strategy

1. **Post at optimal time**: Tuesday-Thursday, 8-10 AM EST
2. **Share on X** with link
3. **Respond to all comments** within 24 hours
4. **Cross-post link** to relevant DEV communities
5. **Add to series** if you write follow-ups

---

## Follow-up Article Ideas

1. "Building an AI Tool Marketplace with x402"
2. "5 Things I Learned Giving My AI Agent a Wallet"
3. "The Security Model for AI Economic Agents"
4. "How to Build x402-Enabled APIs in 5 Minutes"
