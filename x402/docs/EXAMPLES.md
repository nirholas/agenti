# x402 Real-World Examples

> Practical examples of AI agents using x402 payments.

---

## Overview

These examples demonstrate how AI agents can use x402 to:

- Pay for premium API access
- Sell their own services
- Participate in multi-agent marketplaces

---

## Example 1: AI Agent Paying for Weather API

### Scenario

An AI assistant needs premium weather data for a detailed forecast.

### Flow

```
User: "What's the weather forecast for Tokyo this week?"

Claude: I'll get the premium weather data for you.

[Claude calls x402_pay_request internally]
[Pays $0.01 to weather API]
[Receives detailed 7-day forecast]

Claude: Here's the detailed forecast for Tokyo:
        Monday: 72°F, Sunny
        Tuesday: 68°F, Partly cloudy
        ...
```

### Code

```typescript
// MCP Tool Call
const result = await x402_pay_request({
  url: "https://api.weather.io/v2/forecast?city=tokyo&days=7",
  method: "GET",
  maxPayment: "0.10"  // Max 10 cents
});

// Response
{
  "success": true,
  "status": 200,
  "data": {
    "city": "Tokyo",
    "forecast": [
      { "day": "Monday", "temp": 72, "conditions": "Sunny" },
      { "day": "Tuesday", "temp": 68, "conditions": "Partly cloudy" },
      ...
    ]
  },
  "paymentMade": "0x1234...abcd"
}
```

### Server Side (Weather API)

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";

const app = express();

app.use(paymentMiddleware({
  "GET /v2/forecast": {
    accepts: [{
      scheme: "exact",
      price: "$0.01",
      network: "eip155:8453",  // Base
      payTo: "0xWeatherAPIWallet...",
    }],
    description: "7-day weather forecast",
  },
}, server));

app.get("/v2/forecast", (req, res) => {
  const { city, days } = req.query;
  // Generate forecast...
  res.json({ city, forecast: [...] });
});
```

---

## Example 2: AI Agent Paying for Image Generation

### Scenario

An AI agent needs to generate a custom image for a user.

### Flow

```
User: "Create an image of a sunset over mountains"

Claude: I'll generate that image for you.

[Claude calls x402_pay_request to image API]
[Pays $0.05 per image]
[Receives generated image URL]

Claude: Here's your generated image: [displays image]
```

### Code

```typescript
// MCP Tool Call
const result = await x402_pay_request({
  url: "https://api.imageai.io/generate",
  method: "POST",
  body: JSON.stringify({
    prompt: "sunset over mountains, photorealistic, 4k",
    size: "1024x1024"
  }),
  headers: {
    "Content-Type": "application/json"
  },
  maxPayment: "0.10"
});

// Response
{
  "success": true,
  "status": 200,
  "data": {
    "imageUrl": "https://cdn.imageai.io/generated/abc123.png",
    "prompt": "sunset over mountains, photorealistic, 4k",
    "size": "1024x1024"
  },
  "paymentMade": "0x5678...efgh"
}
```

### Pricing Models

Different image APIs might use different pricing:

| Quality | Resolution | Price |
|---------|------------|-------|
| Standard | 512x512 | $0.02 |
| HD | 1024x1024 | $0.05 |
| 4K | 2048x2048 | $0.10 |
| Custom | Variable | $0.15+ |

---

## Example 3: AI Agent Selling Its Own Services

### Scenario

Build an AI agent that charges for code review services.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User's Agent   │────▶│ Code Review API │────▶│ Claude Review   │
│  (MCP Client)   │     │  (x402 Server)  │     │    Service      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │  x402 payment         │
        │  $0.10 per review     │
```

### Server Implementation

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const anthropic = new Anthropic();

app.use(express.json());

// Payment middleware
app.use(paymentMiddleware({
  "POST /review": {
    accepts: [{
      scheme: "exact",
      price: "$0.10",
      network: "eip155:8453",
      payTo: process.env.WALLET_ADDRESS!,
    }],
    description: "AI code review service",
  },
}, server));

// Code review endpoint
app.post("/review", async (req, res) => {
  const { code, language } = req.body;
  
  const review = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Review this ${language} code for bugs, security issues, and improvements:\n\n${code}`
    }]
  });
  
  res.json({
    review: review.content[0].text,
    language,
    linesReviewed: code.split('\n').length
  });
});

app.listen(3000);
```

### Client Usage

```typescript
const result = await x402_pay_request({
  url: "https://api.codereviewer.ai/review",
  method: "POST",
  body: JSON.stringify({
    code: `
      function authenticate(user, password) {
        if (user == "admin" && password == "admin123") {
          return true;
        }
        return false;
      }
    `,
    language: "javascript"
  }),
  headers: { "Content-Type": "application/json" },
  maxPayment: "0.20"
});

// Response
{
  "review": "## Security Issues Found\n\n1. **Hardcoded Credentials** - Never store passwords in code...",
  "language": "javascript",
  "linesReviewed": 7
}
```

---

## Example 4: Multi-Agent Payment Marketplace

### Scenario

Create a marketplace where multiple AI agents can buy and sell services.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI Agent Marketplace                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │  Translator │     │   Analyst   │     │  Generator  │          │
│   │   Agent     │     │    Agent    │     │    Agent    │          │
│   │  $0.05/req  │     │  $0.15/req  │     │  $0.10/req  │          │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘          │
│          │                   │                   │                  │
│          └───────────────────┼───────────────────┘                  │
│                              │                                      │
│                     ┌────────┴────────┐                             │
│                     │   Orchestrator  │                             │
│                     │     Agent       │                             │
│                     └────────┬────────┘                             │
│                              │                                      │
│                     ┌────────┴────────┐                             │
│                     │   User Agent    │                             │
│                     │  (MCP Client)   │                             │
│                     └─────────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Registry Contract (Conceptual)

```typescript
// Agent registry for discovery
const agentRegistry = {
  "translator-agent": {
    endpoint: "https://translator.agents.io/translate",
    price: "$0.05",
    capabilities: ["translate", "detect-language"],
    languages: ["en", "es", "fr", "de", "ja", "zh"]
  },
  "analyst-agent": {
    endpoint: "https://analyst.agents.io/analyze",
    price: "$0.15",
    capabilities: ["sentiment", "summarize", "extract-entities"]
  },
  "generator-agent": {
    endpoint: "https://generator.agents.io/generate",
    price: "$0.10",
    capabilities: ["text", "code", "email"]
  }
};
```

### Orchestrator Agent

```typescript
// Orchestrator that chains multiple agent calls
async function processComplexRequest(userRequest: string) {
  const results = [];
  
  // 1. Analyze the request
  const analysis = await x402_pay_request({
    url: "https://analyst.agents.io/analyze",
    method: "POST",
    body: JSON.stringify({ text: userRequest, task: "extract-intent" }),
    maxPayment: "0.15"
  });
  
  // 2. Based on intent, call appropriate agents
  if (analysis.data.intent === "translate") {
    const translation = await x402_pay_request({
      url: "https://translator.agents.io/translate",
      method: "POST",
      body: JSON.stringify({
        text: analysis.data.content,
        targetLanguage: analysis.data.targetLanguage
      }),
      maxPayment: "0.05"
    });
    results.push(translation.data);
  }
  
  // 3. Generate final response
  const response = await x402_pay_request({
    url: "https://generator.agents.io/generate",
    method: "POST",
    body: JSON.stringify({
      template: "response",
      data: results
    }),
    maxPayment: "0.10"
  });
  
  return {
    response: response.data,
    totalCost: "0.30",  // 0.15 + 0.05 + 0.10
    agentsUsed: 3
  };
}
```

---

## Example 5: Pay-Per-Query Database

### Scenario

A decentralized database that charges per query.

### Flow

```
User: "Find all transactions over $10k in the last month"

Agent: [Calls database API with x402 payment]
       [Pays $0.001 per row returned]
       
Database: Scans 1,000,000 rows
          Returns 500 matching rows
          Cost: $0.50 (500 × $0.001)
```

### Implementation

```typescript
// Dynamic pricing based on results
app.use(paymentMiddleware({
  "POST /query": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",  // Base price
      network: "eip155:42161",  // Arbitrum (low fees)
      payTo: "0xDatabaseWallet...",
    }],
    description: "Query execution ($0.001 per row)",
    // Dynamic pricing handled in endpoint
  },
}, server));

app.post("/query", async (req, res) => {
  const { sql, maxRows } = req.body;
  
  // Execute query with limit
  const results = await db.query(sql, { limit: maxRows || 1000 });
  
  // Calculate actual cost
  const cost = results.length * 0.001;
  
  res.json({
    results,
    rowCount: results.length,
    cost: `$${cost.toFixed(4)}`,
    query: sql
  });
});
```

---

## Example 6: Real-Time Data Streams

### Scenario

Subscribe to real-time crypto price feeds with per-message payments.

### Flow

```
Agent: Subscribe to BTC/USD feed
       [Initial payment: $0.10 for 1 hour]
       
Feed: Sends price updates every second
      BTC: $50,123.45
      BTC: $50,124.12
      ...
      
Agent: Receives 3,600 updates
       Cost: ~$0.003 per update
```

### WebSocket with x402

```typescript
import WebSocket from "ws";

// Client side
async function subscribeToPriceFeed(pair: string) {
  // 1. Pay for subscription
  const subscription = await x402_pay_request({
    url: "https://feed.crypto.io/subscribe",
    method: "POST",
    body: JSON.stringify({
      pair,
      duration: 3600  // 1 hour
    }),
    maxPayment: "0.10"
  });
  
  // 2. Connect to WebSocket with token
  const ws = new WebSocket(subscription.data.wsUrl, {
    headers: {
      "Authorization": `Bearer ${subscription.data.token}`
    }
  });
  
  ws.on("message", (data) => {
    const price = JSON.parse(data);
    console.log(`${pair}: $${price.value}`);
  });
  
  return ws;
}
```

---

## Example 7: AI Research Assistant

### Scenario

An AI agent that aggregates paid research from multiple sources.

### Workflow

```
User: "Research the impact of AI on healthcare costs"

Agent:
  1. Search academic papers (arXiv API - free)
  2. Get premium market research ($1.00)
  3. Access healthcare statistics ($0.50)
  4. Generate comprehensive report ($0.10)
  
  Total cost: $1.60
```

### Implementation

```typescript
async function conductResearch(topic: string) {
  const sources = [];
  let totalCost = 0;
  
  // 1. Free sources first
  const arxiv = await fetch(`https://arxiv.org/api/query?search=${topic}`);
  sources.push({ source: "arXiv", data: await arxiv.json(), cost: 0 });
  
  // 2. Premium market research
  const marketResearch = await x402_pay_request({
    url: "https://api.marketresearch.io/report",
    method: "POST",
    body: JSON.stringify({ topic, depth: "comprehensive" }),
    maxPayment: "1.50"
  });
  sources.push({ 
    source: "Market Research", 
    data: marketResearch.data, 
    cost: 1.00 
  });
  totalCost += 1.00;
  
  // 3. Healthcare statistics
  const stats = await x402_pay_request({
    url: "https://api.healthstats.gov/query",
    method: "POST",
    body: JSON.stringify({ 
      query: `${topic} spending trends 2020-2025` 
    }),
    maxPayment: "0.75"
  });
  sources.push({ 
    source: "Health Statistics", 
    data: stats.data, 
    cost: 0.50 
  });
  totalCost += 0.50;
  
  // 4. Generate report
  const report = await x402_pay_request({
    url: "https://api.reportgen.ai/create",
    method: "POST",
    body: JSON.stringify({ 
      topic, 
      sources: sources.map(s => s.data) 
    }),
    maxPayment: "0.15"
  });
  totalCost += 0.10;
  
  return {
    report: report.data,
    sources: sources.length,
    totalCost: `$${totalCost.toFixed(2)}`
  };
}
```

---

## Best Practices

### 1. Set Appropriate Payment Limits

```typescript
// For cheap APIs (weather, simple queries)
maxPayment: "0.10"

// For medium APIs (image gen, analysis)
maxPayment: "0.50"

// For expensive APIs (research, bulk data)
maxPayment: "2.00"
```

### 2. Estimate Before Paying

```typescript
// Check cost first
const estimate = await x402_estimate({ url });
if (parseFloat(estimate.price) > budget) {
  return "This request exceeds budget";
}
```

### 3. Handle Payment Failures Gracefully

```typescript
try {
  const result = await x402_pay_request({ url, maxPayment: "0.10" });
  return result.data;
} catch (error) {
  if (error.message.includes("exceeds maximum")) {
    return "This service costs more than expected. Proceed? (costs $X)";
  }
  if (error.message.includes("Insufficient funds")) {
    return "Wallet needs more funds. Current balance: $X";
  }
  throw error;
}
```

### 4. Log All Payments

```typescript
// Keep audit trail
const payment = await x402_pay_request({ ... });
console.log({
  timestamp: new Date().toISOString(),
  url: payment.url,
  cost: payment.cost,
  txHash: payment.paymentMade
});
```

---

## Try It Yourself

1. **Start with free/testnet**
   - Use Base Sepolia testnet
   - Get free USDC from faucets

2. **Build a simple paid API**
   - Express + x402 middleware
   - Charge $0.001 per request

3. **Create an agent that uses it**
   - Add x402_pay_request to your MCP
   - Test the full flow

---

<p align="center">
  <b>💰 Give Claude Money!</b><br>
  <code>npx @nirholas/universal-crypto-mcp</code>
</p>
