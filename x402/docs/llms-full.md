<!-- universal-crypto-mcp | @nichxbt | 0xN1CH -->

# x402 LLMs Full Documentation

<!-- Maintained by nicholas | ID: 0.4.14.3 -->

> **Source:** [docs.x402.org/llms-full.txt](https://docs.x402.org/llms-full.txt)
> 
> This is the complete documentation for x402, formatted for LLM consumption.

---

## Welcome to x402

x402 is the open payment standard that enables services to charge for access to their APIs and content directly over HTTP. It is built around the HTTP `402 Payment Required` status code and allows clients to programmatically pay for resources without accounts, sessions, or credential management.

With x402, any web service can require payment before serving a response, using crypto-native payments for speed, privacy, and efficiency.

### Why Use x402?

x402 addresses key limitations of existing payment systems:

* **High fees and friction** with traditional credit cards and fiat payment processors
* **Incompatibility with machine-to-machine payments**, such as AI agents  
* **Lack of support for micropayments**, making it difficult to monetize usage-based services

### Who is x402 for?

* **Sellers:** Service providers who want to monetize their APIs or content. x402 enables direct, programmatic payments from clients with minimal setup.
* **Buyers:** Human developers and AI agents seeking to access paid services without accounts or manual payment flows.

### What Can You Build?

* API services paid per request
* AI agents that autonomously pay for API access
* Paywalls for digital content
* Microservices and tooling monetized via microtransactions
* Proxy services that aggregate and resell API capabilities

---

## Core Concepts

### HTTP 402 Payment Required

HTTP 402 is a standard HTTP response status code indicating that payment is required to access a resource. In x402:

* Informs clients that payment is required
* Communicates payment details (amount, currency, destination)
* Provides information needed to complete payment programmatically

#### Payment Headers (V2)

* **`PAYMENT-SIGNATURE`**: Base64-encoded payment payload from client
* **`PAYMENT-RESPONSE`**: Base64-encoded settlement response from server

### Client / Server Model

The x402 protocol defines clear roles:

* **Client (Buyer)**: Entity wanting to pay for a resource
* **Resource Server (Seller)**: HTTP server providing the API/resource
* **Facilitator**: Server that verifies and settles payments

### The Facilitator

The facilitator is a trusted service that:

1. Verifies payment signatures
2. Settles payments on-chain
3. Returns confirmation to the resource server

Default testnet facilitator: `https://x402.org/facilitator`

---

## Quick Start for Buyers

### Prerequisites

* A crypto wallet with USDC (EVM-compatible)
* Node.js, Go, or Python
* An x402-compatible service to connect to

### Installation

```bash
# Node.js (fetch)
npm install @x402/fetch @x402/evm

# Node.js (axios)
npm install @x402/axios @x402/evm

# Go
go get github.com/coinbase/x402/go

# Python
pip install "x402[httpx]"
```

### Basic Usage (TypeScript)

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Create signer from private key
const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

// Create x402 client and register EVM scheme
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// Wrap fetch with payment handling
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make request - payment is handled automatically!
const response = await fetchWithPayment("https://api.example.com/paid-endpoint");
const data = await response.json();
```

---

## Quick Start for Sellers

### Prerequisites

* A crypto wallet to receive funds
* Node.js, Go, or Python
* An existing API or server

### Installation

```bash
# Express
npm install @x402/express @x402/core @x402/evm

# Next.js
npm install @x402/next @x402/core @x402/evm

# Hono
npm install @x402/hono @x402/core @x402/evm

# Go
go get github.com/coinbase/x402/go

# FastAPI
pip install "x402[fastapi]"
```

### Basic Usage (Express)

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = express();
const payTo = "0xYourAddress";

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});

// Create resource server and register EVM scheme
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

// Add payment middleware
app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [{
          scheme: "exact",
          price: "$0.001",
          network: "eip155:84532", // Base Sepolia
          payTo,
        }],
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    server,
  ),
);

// Your endpoint
app.get("/weather", (req, res) => {
  res.send({ weather: "sunny", temperature: 70 });
});

app.listen(4021);
```

---

## MCP Server Integration

x402 can be integrated with Model Context Protocol (MCP) servers to enable AI agents like Claude to make paid API requests.

### How It Works

1. Claude calls an MCP tool
2. MCP server makes request to paid API
3. If 402 received, MCP server auto-handles payment
4. Paid data returned to Claude

### Implementation

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

const api = wrapAxiosWithPayment(axios.create({ baseURL: "http://localhost:4021" }), client);

const server = new McpServer({ name: "x402 MCP", version: "2.0.0" });

server.tool("get-weather", "Get paid weather data", {}, async () => {
  const res = await api.get("/weather");
  return { content: [{ type: "text", text: JSON.stringify(res.data) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "x402": {
      "command": "pnpm",
      "args": ["--silent", "-C", "/path/to/mcp-server", "dev"],
      "env": {
        "EVM_PRIVATE_KEY": "0x...",
        "RESOURCE_SERVER_URL": "http://localhost:4021"
      }
    }
  }
}
```

---

## Network Support

### EVM Networks (CAIP-2 Format)

| Network | CAIP-2 ID | Token |
|---------|-----------|-------|
| Base Mainnet | eip155:8453 | USDC |
| Base Sepolia | eip155:84532 | USDC |
| Ethereum Mainnet | eip155:1 | USDC |
| Arbitrum One | eip155:42161 | USDC |
| Polygon | eip155:137 | USDC |

### Solana Networks

| Network | CAIP-2 ID | Token |
|---------|-----------|-------|
| Solana Mainnet | solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp | USDC |
| Solana Devnet | solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 | USDC |

---

## Payment Schemes

### Exact Scheme

The `exact` scheme is the primary payment scheme in x402:

* Client pays exact amount specified
* Payment settled on-chain via facilitator
* Supports EVM and Solana

### Payment Flow

1. Client requests resource
2. Server returns 402 with `PAYMENT-REQUIRED` header
3. Client creates and signs payment
4. Client retries with `PAYMENT-SIGNATURE` header
5. Server verifies via facilitator
6. Server returns resource with `PAYMENT-RESPONSE` header

---

## Wallet Integration

### EVM Wallets

```typescript
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
```

### Solana Wallets

```typescript
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const signer = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SOLANA_PRIVATE_KEY!)
);
```

---

## API Reference

### Payment Required Response

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded JSON>
```

Payment Required payload:

```json
{
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "price": "1000", // in smallest unit (e.g., USDC with 6 decimals)
    "payTo": "0x...",
    "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }],
  "description": "API access",
  "mimeType": "application/json",
  "resource": "/api/endpoint"
}
```

### Payment Signature Header

```
PAYMENT-SIGNATURE: <base64-encoded JSON>
```

Contains signed authorization for the payment.

### Payment Response Header

```
PAYMENT-RESPONSE: <base64-encoded JSON>
```

Contains settlement confirmation from facilitator.

---

## Error Handling

Common error scenarios:

* **402 Payment Required**: Payment needed, check `PAYMENT-REQUIRED` header
* **400 Bad Request**: Invalid payment signature
* **402 Insufficient Funds**: Wallet balance too low
* **500 Settlement Failed**: Payment couldn't be settled on-chain

---

## Resources

* **GitHub**: https://github.com/coinbase/x402
* **Documentation**: https://docs.x402.org
* **Website**: https://x402.org
* **Discord**: https://discord.gg/cdp
* **npm packages**: @x402/core, @x402/evm, @x402/svm, @x402/express, @x402/axios, @x402/fetch

---

*This documentation is provided under the Apache-2.0 license. x402 is an open standard maintained by the community.*


<!-- EOF: @nichxbt | ucm:0xN1CH -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->