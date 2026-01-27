# MCP Protocol

Understanding the Model Context Protocol.

## What is MCP?

The **Model Context Protocol (MCP)** is an open standard created by Anthropic that enables AI assistants to interact with external tools and data. It provides a standardized way for AI models to:

- **Call tools** - Execute functions with parameters
- **Access resources** - Read external data
- **Use prompts** - Follow predefined templates

## Protocol Architecture

```
┌─────────────────────┐      JSON-RPC       ┌─────────────────────┐
│                     │ ←────────────────→  │                     │
│    AI Assistant     │                     │    MCP Server       │
│  (Claude, Cursor)   │                     │  (GitHub to MCP)    │
│                     │                     │                     │
└─────────────────────┘                     └─────────────────────┘
        │                                           │
        │  1. List available tools                  │
        │  2. Call tool with params                 │
        │  3. Receive results                       │
        │                                           │
```

## Communication

MCP uses **JSON-RPC 2.0** over various transports:

### Stdio Transport

Process-based communication via stdin/stdout:

```
AI Client → stdin → MCP Server
AI Client ← stdout ← MCP Server
```

Used by Claude Desktop, Cursor, and other desktop applications.

### HTTP Transport

Network-based communication:

```
AI Client → HTTP POST → MCP Server
AI Client ← HTTP Response ← MCP Server
```

Used by web applications and networked deployments.

## Core Messages

### tools/list

List all available tools:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "read_file",
        "description": "Read the contents of a file",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" }
          },
          "required": ["path"]
        }
      }
    ]
  }
}
```

### tools/call

Execute a tool:

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "src/index.ts"
    }
  },
  "id": 2
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "export function main() { ... }"
      }
    ]
  }
}
```

## Tool Definition

Tools are defined with JSON Schema:

```typescript
interface Tool {
  /** Unique tool name */
  name: string;
  
  /** Human-readable description */
  description?: string;
  
  /** JSON Schema for input parameters */
  inputSchema: {
    type: "object";
    properties?: Record<string, JSONSchema>;
    required?: string[];
  };
}
```

### Example Tool

```json
{
  "name": "search_code",
  "description": "Search for code patterns in the repository",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query"
      },
      "path": {
        "type": "string",
        "description": "Limit search to this path"
      },
      "caseSensitive": {
        "type": "boolean",
        "description": "Case-sensitive search",
        "default": false
      }
    },
    "required": ["query"]
  }
}
```

## Tool Results

Tool results can contain multiple content types:

### Text Content

```json
{
  "content": [
    {
      "type": "text",
      "text": "File contents here..."
    }
  ]
}
```

### Image Content

```json
{
  "content": [
    {
      "type": "image",
      "data": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
  ]
}
```

### Resource Content

```json
{
  "content": [
    {
      "type": "resource",
      "resource": {
        "uri": "file:///path/to/file",
        "text": "Content..."
      }
    }
  ]
}
```

## Server Capabilities

MCP servers declare their capabilities:

```json
{
  "capabilities": {
    "tools": {},
    "resources": {},
    "prompts": {}
  }
}
```

### Tools Capability

Indicates the server provides callable tools.

### Resources Capability

Indicates the server provides readable resources (not used by GitHub to MCP).

### Prompts Capability

Indicates the server provides prompt templates (not used by GitHub to MCP).

## Client Integration

### Claude Desktop

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server.mjs"]
    }
  }
}
```

### Programmatic Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'my-client',
  version: '1.0.0',
});

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/server.mjs'],
});

await client.connect(transport);

// List tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool('read_file', {
  path: 'README.md'
});
```

## Error Handling

MCP uses standard JSON-RPC error codes:

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid parameters |
| -32603 | Internal error | Server error |

### Tool-Specific Errors

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "details": "Required parameter 'path' is missing"
    }
  }
}
```

## Security Considerations

### Input Validation

Always validate tool inputs:

```typescript
async function executeReadFile({ path }) {
  // Prevent directory traversal
  if (path.includes('..')) {
    throw new Error('Invalid path');
  }
  
  // Limit to allowed directories
  if (!path.startsWith('src/')) {
    throw new Error('Access denied');
  }
  
  return fs.readFile(path, 'utf-8');
}
```

### Rate Limiting

Consider implementing rate limits for expensive operations.

### Authentication

For sensitive tools, implement authentication checks.

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/) - Full protocol spec
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Official SDK
- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Example servers

---

## See Also

- [How It Works](how-it-works.md) - GitHub to MCP flow
- [Tool Types](tool-types.md) - Generated tools
- [MCP Server API](../api/mcp-server.md) - Server implementation
