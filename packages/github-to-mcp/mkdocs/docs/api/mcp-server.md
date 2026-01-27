# MCP Server

The `@github-to-mcp/mcp-server` package provides the MCP server implementation.

## Installation

```bash
npm install @github-to-mcp/mcp-server
```

## Creating a Server

### Basic Usage

```typescript
import { createMcpServer } from '@github-to-mcp/mcp-server';

const server = createMcpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
  tools: [
    {
      name: 'hello_world',
      description: 'Say hello',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      },
      execute: async ({ name }) => {
        return { greeting: `Hello, ${name}!` };
      }
    }
  ]
});

await server.start();
```

### With Generated Tools

```typescript
import { createMcpServer } from '@github-to-mcp/mcp-server';
import { generateFromGithub } from '@nirholas/github-to-mcp';

const result = await generateFromGithub('https://github.com/owner/repo');

const server = createMcpServer({
  name: 'repo-mcp',
  version: '1.0.0',
  tools: result.tools.map(tool => ({
    ...tool,
    execute: createExecutor(tool),
  })),
});

await server.start();
```

---

## Server Options

### McpServerOptions

```typescript
interface McpServerOptions {
  /** Server name */
  name: string;
  
  /** Server version */
  version: string;
  
  /** Tool definitions */
  tools: ToolDefinition[];
  
  /** Transport type */
  transport?: 'stdio' | 'http';
  
  /** HTTP port (if using http transport) */
  port?: number;
  
  /** Enable logging */
  logging?: boolean;
  
  /** Custom logger */
  logger?: Logger;
}
```

---

## Transport Modes

### Stdio (Default)

For process-based communication with AI clients:

```typescript
const server = createMcpServer({
  name: 'my-server',
  transport: 'stdio',
  tools: [...]
});

await server.start();
// Communicates via stdin/stdout
```

### HTTP

For network-based communication:

```typescript
const server = createMcpServer({
  name: 'my-server',
  transport: 'http',
  port: 3000,
  tools: [...]
});

await server.start();
// Listening on http://localhost:3000
```

---

## Tool Definition

### ToolDefinition

```typescript
interface ToolDefinition {
  /** Tool name (snake_case recommended) */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** JSON Schema for input parameters */
  inputSchema: JSONSchema;
  
  /** Tool execution function */
  execute: (input: unknown, context: ToolContext) => Promise<unknown>;
}
```

### ToolContext

```typescript
interface ToolContext {
  /** Server configuration */
  config: ServerConfig;
  
  /** Logger instance */
  logger: Logger;
  
  /** Access to other tools */
  tools: Record<string, ToolDefinition>;
  
  /** Request metadata */
  request: RequestMetadata;
}
```

---

## Server Methods

### start()

Start the MCP server.

```typescript
await server.start();
```

### stop()

Stop the MCP server.

```typescript
await server.stop();
```

### addTool()

Add a tool dynamically.

```typescript
server.addTool({
  name: 'new_tool',
  description: 'A new tool',
  inputSchema: { type: 'object' },
  execute: async () => ({ result: 'ok' }),
});
```

### removeTool()

Remove a tool.

```typescript
server.removeTool('tool_name');
```

### listTools()

List all registered tools.

```typescript
const tools = server.listTools();
console.log(tools.map(t => t.name));
```

---

## Error Handling

### ToolError

Throw to return an error to the client:

```typescript
import { ToolError } from '@github-to-mcp/mcp-server';

const tool = {
  name: 'risky_operation',
  execute: async ({ path }) => {
    if (path.includes('..')) {
      throw new ToolError('Invalid path: directory traversal not allowed');
    }
    // ...
  }
};
```

### Error Codes

```typescript
enum ErrorCode {
  InvalidParams = -32602,
  InternalError = -32603,
  ToolNotFound = -32001,
  ExecutionFailed = -32002,
}
```

---

## Middleware

Add middleware for cross-cutting concerns:

```typescript
const server = createMcpServer({
  name: 'my-server',
  tools: [...],
  middleware: [
    // Logging middleware
    async (tool, input, context, next) => {
      console.log(`Calling ${tool.name} with`, input);
      const start = Date.now();
      const result = await next();
      console.log(`${tool.name} completed in ${Date.now() - start}ms`);
      return result;
    },
    
    // Caching middleware
    async (tool, input, context, next) => {
      const cacheKey = `${tool.name}:${JSON.stringify(input)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      const result = await next();
      cache.set(cacheKey, result);
      return result;
    },
  ],
});
```

---

## Protocol Compliance

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) specification:

- **JSON-RPC 2.0** communication
- **tools/list** - List available tools
- **tools/call** - Execute a tool
- **resources/list** - List resources (optional)
- **prompts/list** - List prompts (optional)

---

## See Also

- [Core API](core.md) - Main library
- [Claude Desktop](../guides/claude-desktop.md) - Integration guide
- [MCP Protocol](../concepts/mcp-protocol.md) - Protocol details
