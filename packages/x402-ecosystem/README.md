# @nirholas/x402-ecosystem

> Shared x402 payment utilities for the nirholas ecosystem - enabling AI agents to pay and get paid 🤖💰

## 🚀 Quick Start

```bash
npm install @nirholas/x402-ecosystem
```

```typescript
import { PayableAgent, ToolMarketplace, YieldProjector } from "@nirholas/x402-ecosystem";

// Create a payment-capable AI agent
const agent = new PayableAgent({
  privateKey: process.env.X402_PRIVATE_KEY,
  maxDailySpend: "50.00", // Max $50/day
});

// Make paid API requests
const result = await agent.payForService("https://api.premium.com/data");
```

## 📦 What's Included

### 🤖 PayableAgent

Base class for AI agents with payment capabilities:

```typescript
import { PayableAgent } from "@nirholas/x402-ecosystem/agent";

const agent = new PayableAgent({
  privateKey: process.env.X402_PRIVATE_KEY,
  chain: "eip155:42161", // Arbitrum
  maxDailySpend: "100.00",
  maxPaymentPerRequest: "1.00",
  approvedServices: ["api.example.com"],
});

// Check capabilities
const caps = agent.getCapabilities();
console.log(`Can pay: ${caps.canPay}, Daily remaining: $${caps.dailyLimitRemaining}`);

// Make payments
const data = await agent.payForService("https://api.example.com/premium");
```

### 🏪 Tool Marketplace

Decentralized marketplace for AI tools:

```typescript
import { ToolMarketplace, createToolListing } from "@nirholas/x402-ecosystem/marketplace";

const marketplace = new ToolMarketplace();

// Register a tool
await marketplace.registerTool({
  name: "weather-premium",
  description: "Real-time weather with hourly forecasts",
  endpoint: "https://weather.example.com/api",
  price: "0.001",
  owner: "0x...",
  revenueSplit: [
    { address: "0x...", percentage: 80 },  // Creator
    { address: "0x...", percentage: 20 },  // Platform
  ],
});

// Discover tools
const tools = await marketplace.discoverTools({ 
  maxPrice: "0.01",
  category: "Weather",
});
```

### 💎 Premium Tiers

Add paid tiers to your services:

```typescript
import { createPremiumTier, PaywallBuilder, PricingStrategy } from "@nirholas/x402-ecosystem/premium";

// Define tiers
const tiers = createPremiumTier({
  free: { 
    rateLimit: 100, 
    features: ["basic"] 
  },
  premium: { 
    price: "0.01",
    features: ["advanced", "real-time", "priority"],
  },
  enterprise: {
    price: "99.99",
    period: "monthly",
    features: ["all", "dedicated-support"],
  },
});

// Build a paywall
const paywall = new PaywallBuilder()
  .forEndpoint("/api/premium/*")
  .withPricingStrategy(PricingStrategy.tiered([
    { maxRequests: 100, price: "0.001" },
    { maxRequests: 1000, price: "0.0005" },
  ]))
  .withRecipient("0x...")
  .build();
```

### 📈 Yield Tracking

Track and project USDs yield earnings:

```typescript
import { YieldProjector, YieldingWallet } from "@nirholas/x402-ecosystem/yield";

// Project yield
const projection = YieldProjector.project("1000.00", { months: 12 });
console.log(`
  Initial: $${projection.initialBalance}
  After 1 year: $${projection.projectedBalance}
  Yield earned: $${projection.totalYield}
  APY: ${projection.apy}%
`);

// Calculate required balance for target yield
const required = YieldProjector.balanceForMonthlyYield("50.00");
console.log(`Need $${required} USDs to earn $50/month`);
```

### 🔗 MCP Integration

Register all tools with an MCP server:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerX402Ecosystem } from "@nirholas/x402-ecosystem";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

registerX402Ecosystem(server, {
  enableMarketplace: true,
  enableYield: true,
  enablePremium: true,
});
```

## 🌐 Supported Networks

| Network | CAIP-2 ID | Default Token |
|---------|-----------|---------------|
| Arbitrum | `eip155:42161` | USDs |
| Base | `eip155:8453` | USDC |
| Ethereum | `eip155:1` | USDC |
| Polygon | `eip155:137` | USDC |
| Optimism | `eip155:10` | USDC |
| BSC | `eip155:56` | USDC |
| Solana | `solana:5eykt4U...` | USDC |

## 💰 Why USDs?

[Sperax USDs](https://sperax.io) is a yield-bearing stablecoin on Arbitrum with ~5% APY:

- **Auto-yield**: Balance grows automatically through rebasing
- **No staking required**: Just hold USDs to earn
- **AI-friendly**: Perfect for agent wallets that hold funds

"AI agents don't just GET paid - they EARN while they wait!"

## 🔧 Environment Variables

```bash
# Required
X402_PRIVATE_KEY=0x...          # EVM wallet private key

# Optional
X402_CHAIN=eip155:42161         # Default chain (Arbitrum)
X402_MAX_DAILY_SPEND=100.00     # Daily spending limit
X402_MAX_PAYMENT=1.00           # Per-request limit
X402_APPROVED_SERVICES=api.example.com,other.api.com
X402_ENABLE_YIELD=true          # Auto-convert to USDs
X402_DEBUG=false                # Debug logging
```

## 📚 Related Packages

- [@nirholas/universal-crypto-mcp](https://github.com/nirholas/universal-crypto-mcp) - Full MCP server
- [@x402/core](https://github.com/coinbase/x402) - Core x402 protocol
- [@x402/evm](https://github.com/coinbase/x402) - EVM payment support

## 📄 License

Apache-2.0 - see [LICENSE](LICENSE)

---

**Give Claude Money! 🤖💰**

```bash
npx @nirholas/universal-crypto-mcp
```
