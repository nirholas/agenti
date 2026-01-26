# 💰 x402 Payment Protocol Integration

> **For: [Universal Crypto MCP](https://github.com/nirholas/universal-crypto-mcp)**

## 💰 Give Claude Money!

```bash
npx @nirholas/universal-crypto-mcp
```

x402 is an open standard for internet-native payments built on HTTP 402. This integration enables AI agents to autonomously pay for API access.

**Target Repository:** https://github.com/nirholas/universal-crypto-mcp

## 🚀 Quick Start

### For Buyers (AI Agents Making Payments)

```typescript
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import axios from "axios";

// Create wallet signer
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// Create x402 client with EVM support
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// Wrap axios - payments handled automatically!
const api = wrapAxiosWithPayment(axios.create({ baseURL: "https://api.example.com" }), client);

// This will auto-pay if API returns 402
const response = await api.get("/paid-endpoint");
```

### For Sellers (APIs Receiving Payments)

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = express();

const facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const server = new x402ResourceServer(facilitator);
registerExactEvmScheme(server);

app.use(paymentMiddleware({
  "GET /api/data": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: "eip155:8453",  // Base Mainnet
      payTo: "0xYourAddress",
    }],
    description: "Premium API data",
  },
}, server));

app.get("/api/data", (req, res) => {
  res.json({ data: "premium content" });
});
```

## 📦 Installation

```bash
# Core packages
npm install @x402/core @x402/evm @x402/svm

# For HTTP clients
npm install @x402/axios @x402/fetch

# For servers
npm install @x402/express @x402/hono @x402/next

# Wallet support
npm install viem @solana/kit @scure/base
```

## 🔗 Supported Networks (CAIP-2 Format)

### EVM Networks

| Network | CAIP-2 ID | Token |
|---------|-----------|-------|
| Base Mainnet | `eip155:8453` | USDC |
| Base Sepolia | `eip155:84532` | USDC |
| Ethereum | `eip155:1` | USDC |
| Arbitrum One | `eip155:42161` | USDC |
| Polygon | `eip155:137` | USDC |
| Optimism | `eip155:10` | USDC |
| BNB Chain | `eip155:56` | USDC |

### Solana Networks

| Network | CAIP-2 ID | Token |
|---------|-----------|-------|
| Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | USDC |
| Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | USDC |

## 🤖 MCP Server Integration

Enable Claude and other AI agents to pay for APIs:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { x402Client, wrapAxiosWithPayment } from "@x402/axios";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const client = new x402Client();
registerExactEvmScheme(client, { signer });

const api = wrapAxiosWithPayment(axios.create({ baseURL: process.env.API_URL }), client);

const server = new McpServer({ name: "x402-mcp", version: "2.0.0" });

server.tool("get-paid-data", "Fetch premium data (auto-pays)", {}, async () => {
  const res = await api.get("/premium");
  return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["@nirholas/universal-crypto-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0x...",
        "RESOURCE_SERVER_URL": "https://api.example.com"
      }
    }
  }
}
```

## 📄 How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude / Agent │────▶│   MCP Server    │────▶│  x402 API       │
│                 │     │  (x402 client)  │     │  (paid endpoint)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  1. Call tool         │  2. GET /api          │
        │                       │                       │
        │                       │  3. 402 + payment req │
        │                       │◀──────────────────────│
        │                       │                       │
        │                       │  4. Sign payment      │
        │                       │                       │
        │                       │  5. Retry w/ payment  │
        │                       │──────────────────────▶│
        │                       │                       │
        │                       │  6. 200 + data        │
        │                       │◀──────────────────────│
        │                       │                       │
        │  7. Return response   │                       │
        │◀──────────────────────│                       │
```

## 🔧 Environment Variables

```bash
# Required for buyers
EVM_PRIVATE_KEY=0x...        # EVM wallet private key
SVM_PRIVATE_KEY=...          # Solana wallet (optional)

# Required for sellers
EVM_ADDRESS=0x...            # Receiving address
FACILITATOR_URL=https://x402.org/facilitator

# Network selection
DEFAULT_NETWORK=eip155:8453  # Base Mainnet
```

## 📚 Documentation

- [MCP Server Guide](./docs/guides/mcp-server-with-x402.md)
- [Quickstart for Buyers](./docs/getting-started/quickstart-for-buyers.mdx)
- [Quickstart for Sellers](./docs/getting-started/quickstart-for-sellers.mdx)
- [LLMs Full Documentation](./docs/llms-full.md)
- [CAIP-2 Network IDs](./docs/CAIP-2.md)
- [Core Concepts](./docs/core-concepts/)

## 🔗 Resources

- **x402 Protocol**: https://x402.org
- **Documentation**: https://docs.x402.org
- **GitHub**: https://github.com/coinbase/x402
- **Discord**: https://discord.gg/cdp

## ⚖️ License

x402 is licensed under Apache-2.0. See [LICENSE](./LICENSE) for details.

---

**💰 Give Claude Money!**

```bash
npx @nirholas/universal-crypto-mcp
```
