# 🔗 x402 Ecosystem Integration Guides

> Integrate x402 payments into your repository

## Quick Integration

The fastest way to add x402 payments to any repo:

```typescript
import { registerX402 } from "@nirholas/universal-crypto-mcp";

// In your MCP server setup
registerX402(server);
```

That's it! Your server now has full x402 payment capabilities.

## Integration Guides by Repository

### 1. [defi-agents](./defi-agents.md) (10⭐)
Add payment capabilities to agent specifications.

### 2. [AI-Agents-Library](./ai-agents-library.md) (9⭐)
Create payment-capable agent templates.

### 3. [plugin.delivery](./plugin-delivery.md) (9⭐)
Add x402 pricing to plugins.

### 4. [lyra-registry](./lyra-registry.md) (9⭐)
Add pricing metadata to tool registry.

### 5. [free-crypto-news](./free-crypto-news.md) (20⭐)
Add premium tiers to news API.

### 6. [XActions](./xactions.md) (58⭐)
Premium Twitter automation features.

### 7. [lstm-bitcoin-prediction](./lstm-prediction.md) (11⭐)
Monetize ML predictions.

### 8. [UCAI](./ucai.md) (12⭐)
Smart contract AI payments.

## Universal Integration Pattern

Every repo follows this pattern:

```typescript
// 1. Install dependencies
// npm install @nirholas/universal-crypto-mcp

// 2. Import and register
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerX402 } from "@nirholas/universal-crypto-mcp";

const server = new McpServer({
  name: "your-server",
  version: "1.0.0",
});

// 3. Register x402 (adds payment tools)
registerX402(server);

// 4. Your existing tools work as before
server.tool("your_tool", "Description", {}, async () => {
  // ...
});
```

## Adding Paid Features

Wrap any feature with x402 payment requirement:

```typescript
import { 
  registerX402,
  x402Paywall,
  fixedPrice,
} from "@nirholas/universal-crypto-mcp";

// Register x402 first
registerX402(server);

// Then add your paid tool
server.tool(
  "premium_feature",
  "A premium feature that costs $0.01",
  { query: z.string() },
  async ({ query }) => {
    // The x402_pay_request tool handles payment automatically
    // when AI agents call premium APIs
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ result: "premium data" }),
      }],
    };
  }
);
```

## Environment Setup

All repos need these environment variables:

```bash
# Required for payments
X402_PRIVATE_KEY=0x...          # Wallet private key

# Optional configuration
X402_CHAIN=arbitrum             # Default: arbitrum
X402_MAX_PAYMENT=1.00           # Max per request
X402_ENABLE_GASLESS=true        # Use gasless payments
X402_FACILITATOR_URL=https://...
```

## Revenue Sharing

Use the RevenueSplitter for multi-party payments:

```typescript
import { createDynamicPaymentGate } from "@nirholas/universal-crypto-mcp";

const paymentGate = createDynamicPaymentGate({
  revenueSplit: [
    { address: "0x...", percent: 70 },  // Tool creator
    { address: "0x...", percent: 20 },  // Platform
    { address: "0x...", percent: 10 },  // Protocol
  ],
});
```

## Next Steps

1. Choose your integration guide above
2. Follow the step-by-step instructions
3. Test on Arbitrum Sepolia testnet
4. Deploy to mainnet

---

**Questions?** Open an issue at [universal-crypto-mcp](https://github.com/nirholas/universal-crypto-mcp/issues)
