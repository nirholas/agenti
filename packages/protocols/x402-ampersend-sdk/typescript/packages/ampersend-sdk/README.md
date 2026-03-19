# @ampersend_ai/ampersend-sdk

TypeScript SDK for integrating [x402](https://github.com/coinbase/x402) payment capabilities into MCP (Model Context Protocol) and HTTP applications.

## Quick Start

```typescript
import { createAmpersendMcpClient } from "@ampersend_ai/ampersend-sdk"

// Create client (one-liner setup)
const client = await createAmpersendMcpClient({
  smartAccountAddress: "0x...",
  sessionKeyPrivateKey: "0x...",
  serverUrl: "http://localhost:8000/mcp",
})

const result = await client.callTool("my_tool", { arg: "value" })
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

## Package Exports

```typescript
import { ... } from "@ampersend_ai/ampersend-sdk"                  // Main
import { ... } from "@ampersend_ai/ampersend-sdk/x402"             // Core x402
import { ... } from "@ampersend_ai/ampersend-sdk/x402/http"        // HTTP client
import { ... } from "@ampersend_ai/ampersend-sdk/mcp/client"       // MCP client
import { ... } from "@ampersend_ai/ampersend-sdk/mcp/proxy"        // MCP proxy
import { ... } from "@ampersend_ai/ampersend-sdk/smart-account"    // Smart accounts
import { ... } from "@ampersend_ai/ampersend-sdk/mcp/server/fastmcp" // FastMCP
```

## Documentation

**→ [Complete TypeScript SDK Documentation](../../README.md)**

### Module-Specific Docs

- [HTTP Client API](./src/x402/http/README.md)
- [MCP Client API](./src/mcp/client/README.md)
- [MCP Proxy API](./src/mcp/proxy/README.md)
- [FastMCP Example](../../examples/fastmcp-x402-server/README.md)

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Lint & format
pnpm lint
pnpm format:fix

# Type check
pnpm typecheck
```

## Learn More

- [TypeScript SDK Guide](../../README.md)
- [x402 Specification](https://github.com/coinbase/x402)
- [MCP Protocol](https://modelcontextprotocol.io)
