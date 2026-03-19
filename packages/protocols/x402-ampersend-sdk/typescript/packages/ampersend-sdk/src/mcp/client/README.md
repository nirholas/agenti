# MCP x402 Client

TypeScript MCP client with transparent x402 payment handling.

## Overview

Extends the MCP Client to automatically handle HTTP 402 payment responses using the x402 micropayment protocol.

**→ [Complete Documentation](../../../../README.md)**

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

## API Reference

### X402McpClient

```typescript
class X402McpClient {
  constructor(options: X402McpClientOptions)

  async connect(): Promise<void>
  async close(): Promise<void>

  async callTool(name: string, arguments: Record<string, unknown>): Promise<any>
  async readResource(uri: string): Promise<any>
  async listTools(): Promise<Tool[]>
  async listResources(): Promise<Resource[]>
}
```

### X402McpClientOptions

```typescript
interface X402McpClientOptions {
  serverUrl: string
  treasurer: X402Treasurer
  clientInfo?: ClientInfo
  mcpOptions?: ClientOptions
}
```

### X402Middleware

```typescript
class X402Middleware {
  constructor(options: { treasurer: X402Treasurer })

  async onMessage(request: JSONRPCRequest, response: JSONRPCMessage): Promise<JSONRPCRequest | null>
}
```

Returns retry request if payment is required and approved, otherwise `null`.

## Features

- **Zero Breaking Changes**: Drop-in replacement for MCP Client
- **Transparent Payment Handling**: 402 errors trigger treasurer for payment decisions
- **HTTP Transport Only**: Handles payments for HTTP-based transports
- **Multiple Error Formats**: Supports MCP JSON-RPC errors and FastMCP UserError responses
- **X402Treasurer Pattern**: Interface-based payment authorization with lifecycle tracking

## Learn More

- [TypeScript SDK Guide](../../../../README.md)
- [Architecture & Payment Flow](../../../../README.md#mcp-client-architecture)
- [Treasurer Documentation](../../../../README.md#x402treasurer)
