# MCP x402 Proxy

HTTP proxy server that adds x402 payment capabilities to any MCP server.

## Overview

Transparent proxy that sits between MCP clients and servers, automatically handling x402 payment flows.

**→ [Complete Documentation](../../../../README.md)**

## Quick Start

```bash
# Configure environment
export BUYER_PRIVATE_KEY=0x...

# Start proxy
pnpm --filter ampersend-sdk proxy:dev

# Connect clients to:
# http://localhost:8402/mcp?target=http://original-server:8000/mcp
```

## API Reference

### ProxyServer

```typescript
class ProxyServer {
  constructor(treasurer: X402Treasurer)

  async start(port: number): Promise<void>
  async stop(): Promise<void>
}
```

### initializeProxyServer

```typescript
function initializeProxyServer(options: ProxyServerOptions): Promise<{
  server: ProxyServer
}>
```

### ProxyServerOptions

```typescript
interface ProxyServerOptions {
  transport: {
    port?: number
  }
  treasurer: X402Treasurer
}
```

### X402BridgeTransport

```typescript
class X402BridgeTransport {
  constructor(options: { leftTransport: Transport; rightTransport: Transport; treasurer: X402Treasurer })

  async start(): Promise<void>
  async close(): Promise<void>
  async handleRequest(req: Request, res: Response, body: any): Promise<void>
}
```

Bridges client and server transports with payment handling.

## CLI Usage

```bash
# Start with defaults (port 3000)
ampersend-proxy

# Custom port
ampersend-proxy --port 8080

# Development (watch mode)
pnpm --filter ampersend-sdk proxy:dev
```

## Environment Variables

**Note**: Environment variables may require a prefix depending on how the proxy is started (e.g., `TS__MCP_PROXY__` for `pnpm proxy:dev`). Use `--env-prefix ""` to disable the prefix.

### Recommended: Smart Account + Ampersend

```bash
BUYER_SMART_ACCOUNT_ADDRESS=0x...         # Smart account address
BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY=0x... # Session key
AMPERSEND_API_URL=https://api.ampersend.ai  # For spend limits
```

### Standalone Alternative: EOA

```bash
BUYER_PRIVATE_KEY=0x...  # EOA private key (no AMPERSEND_API_URL = naive mode)
```

## Features

- **Transparent Proxying**: No changes required to MCP clients or servers
- **Session Management**: Maintains state across requests
- **HTTP Transport**: Supports StreamableHTTP, SSE, WebSocket
- **Payment Retry**: Automatic retry with payment on 402 responses

## Learn More

- [TypeScript SDK Guide](../../../../README.md)
- [Proxy Architecture](../../../../README.md#mcp-proxy-architecture)
- [Treasurer Documentation](../../../../README.md#x402treasurer)
