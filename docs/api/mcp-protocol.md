# MCP Protocol Reference

Agenti implements the Model Context Protocol (MCP) specification for AI agent tool communication. This document covers the protocol details.

## Protocol Overview

MCP uses JSON-RPC 2.0 over configurable transports (stdio, HTTP, SSE) to enable AI models to discover and invoke tools.

## Message Format

### Request

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {},
  "id": 1
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "result": {},
  "id": 1
}
```

### Error

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid request"
  },
  "id": 1
}
```

## Lifecycle

### 1. Initialization

Client sends `initialize` to establish the session:

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

Server responds with capabilities:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "agenti",
      "version": "0.1.0"
    }
  },
  "id": 1
}
```

### 2. Tool Discovery

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

Response lists all available tools with JSON Schema:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "market_data_price",
        "description": "Get current cryptocurrency price",
        "inputSchema": {
          "type": "object",
          "properties": {
            "coinId": { "type": "string", "description": "CoinGecko coin ID" },
            "currency": { "type": "string", "default": "usd" }
          },
          "required": ["coinId"]
        }
      }
    ]
  },
  "id": 2
}
```

### 3. Tool Execution

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "market_data_price",
    "arguments": {
      "coinId": "bitcoin"
    }
  },
  "id": 3
}
```

### 4. Notifications

Server can send notifications (no response expected):

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
```

## SDK Integration

Agenti uses `@modelcontextprotocol/sdk` for protocol handling:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'agenti', version: '0.1.0' },
  { capabilities: { tools: { listChanged: true } } }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: registeredTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = registeredTools.find(t => t.name === request.params.name);
  return tool.execute(request.params.arguments);
});
```

## Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |

## Protocol Version

Agenti supports MCP protocol version `2024-11-05` as defined by the `@modelcontextprotocol/sdk` package.
