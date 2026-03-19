# TypeScript SDK - Ampersend

TypeScript SDK for integrating [x402](https://github.com/coinbase/x402) payment capabilities into MCP (Model Context Protocol) and HTTP applications. Supports client, proxy, and server implementations with EOA and Smart Account wallets.

## Installation

```bash
pnpm install

# Build all
pnpm build
```

## Quick Start

### MCP Client

```typescript
import { createAmpersendMcpClient } from "@ampersend_ai/ampersend-sdk"

// Create client (one-liner setup)
const client = await createAmpersendMcpClient({
  smartAccountAddress: "0x...",
  sessionKeyPrivateKey: "0x...",
  serverUrl: "http://localhost:8000/mcp",
})

const result = await client.callTool("my_tool", { arg: "value" })
await client.close()
```

### MCP Proxy

```bash
# Configure environment
export BUYER_PRIVATE_KEY=0x...

# Start proxy
pnpm --filter ampersend-sdk proxy:dev

# Connect to: http://localhost:3000/mcp?target=http://original-server:8000/mcp
```

### FastMCP Server

```typescript
import { withX402Payment } from "@ampersend_ai/ampersend-sdk/mcp/server/fastmcp"
import { FastMCP } from "fastmcp"

const mcp = new FastMCP("my-server")

mcp.addTool({
  name: "paid_tool",
  description: "A tool that requires payment",
  schema: z.object({ query: z.string() }),
  execute: withX402Payment({
    onExecute: async ({ args }) => {
      return { scheme: "erc20", amount: "1000000" }
    },
    onPayment: async ({ payment, requirements }) => {
      return { success: true }
    },
  })(async (args, context) => {
    return "result"
  }),
})
```

### HTTP Client

```typescript
import { createAmpersendHttpClient } from "@ampersend_ai/ampersend-sdk"
import { x402Client } from "@x402/core/client"
import { wrapFetchWithPayment } from "@x402/fetch"

const client = createAmpersendHttpClient({
  client: new x402Client(),
  smartAccountAddress: "0x...",
  sessionKeyPrivateKey: "0x...",
})

const fetchWithPay = wrapFetchWithPayment(fetch, client)
const response = await fetchWithPay("https://paid-api.example.com/resource")
```

## Core Concepts

### X402Treasurer

Handles payment authorization decisions and status tracking. Use `createAmpersendTreasurer()` for production with spend limits and monitoring.

### Wallets

- **AccountWallet** - For EOA (Externally Owned Accounts)
- **SmartAccountWallet** - For ERC-4337 smart accounts with ERC-1271 signatures

### Payment Flow

1. Client makes request → Server returns 402 with payment requirements
2. Treasurer authorizes payment → Payment injected into request metadata
3. Request retried with payment → Server verifies and processes

## Environment Variables

```bash
# EOA Mode
BUYER_PRIVATE_KEY=0x...

# Smart Account Mode
BUYER_SMART_ACCOUNT_ADDRESS=0x...
BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY=0x...
BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS=0x...
```

## Package Exports

```typescript
import { ... } from "@ampersend_ai/ampersend-sdk"                  // Main
import { ... } from "@ampersend_ai/ampersend-sdk/x402"             // Core x402
import { ... } from "@ampersend_ai/ampersend-sdk/x402/http"        // HTTP client
import { ... } from "@ampersend_ai/ampersend-sdk/mcp/client"       // MCP client
import { ... } from "@ampersend_ai/ampersend-sdk/mcp/proxy"        // Proxy
import { ... } from "@ampersend_ai/ampersend-sdk/smart-account"    // Smart accounts
import { ... } from "@ampersend_ai/ampersend-sdk/mcp/server/fastmcp" // FastMCP
```

## Module Documentation

Detailed implementation guides:

- **[HTTP Client](./packages/ampersend-sdk/src/x402/http/README.md)** - HTTP x402 client adapter
- **[MCP Client](./packages/ampersend-sdk/src/mcp/client/README.md)** - MCP client with payment retry logic
- **[MCP Proxy](./packages/ampersend-sdk/src/mcp/proxy/README.md)** - MCP proxy server architecture
- **[SDK Package](./packages/ampersend-sdk/README.md)** - Package overview

## Development

```bash
# Build
pnpm --filter ampersend-sdk build

# Test
pnpm --filter ampersend-sdk test

# Lint & format
pnpm --filter ampersend-sdk lint
pnpm --filter ampersend-sdk format:fix
```

## Testing

For local testing without Ampersend API:

```typescript
import { AccountWallet } from "@ampersend_ai/ampersend-sdk"
import { NaiveTreasurer } from "@ampersend_ai/ampersend-sdk/x402/treasurers"

const wallet = new AccountWallet("0x...")
const treasurer = new NaiveTreasurer(wallet) // Auto-approves all payments
```

**Note:** NaiveTreasurer has no spend limits. Use for testing only.

## Learn More

- [x402 Specification](https://github.com/coinbase/x402)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Repository Root](../README.md)
