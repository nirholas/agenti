# Transport Modes

Agenti supports three transport modes for MCP communication. Choose the right one based on your AI client and deployment environment.

## Overview

| Mode | Protocol | Use Case | Stateful |
|------|----------|----------|----------|
| stdio | Standard I/O | Claude Desktop, Cursor | Yes |
| HTTP | HTTP POST/GET | ChatGPT Developer Mode, web apps | No |
| SSE | Server-Sent Events | Legacy HTTP clients, streaming | Yes |

## stdio Mode (Default)

The default transport mode. Communication happens over standard input/output streams.

### Usage

```bash
# Default (no flags needed)
npm start
npx @nirholas/agenti
```

### How It Works

```
AI Client <--stdin/stdout--> Agenti MCP Server
```

1. AI client spawns Agenti as a subprocess
2. JSON-RPC messages are sent via stdin
3. Responses are returned via stdout
4. Connection persists for the session

### Supported Clients

- **Claude Desktop** - Native stdio support
- **Cursor** - Via MCP configuration
- **VS Code + Continue** - Via MCP extension
- **Custom clients** - Any MCP SDK client

### Configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## HTTP Mode

RESTful HTTP transport for web-based integrations. Supports ChatGPT Developer Mode.

### Usage

```bash
npm start -- --http
# or
npm start -- -h
```

### How It Works

```
AI Client --HTTP POST--> Agenti HTTP Server
         <--JSON Response--
```

1. Server listens on configured port (default 3000)
2. Clients send JSON-RPC requests via POST
3. Server responds with JSON-RPC responses
4. Each request is independent (stateless)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/mcp` | MCP JSON-RPC endpoint |
| GET | `/health` | Health check |
| GET | `/tools` | List available tools |

### Configuration

```env
PORT=3000
HOST=0.0.0.0
AUTH_TOKEN=your_secret_token
CORS_ORIGINS=*
```

### ChatGPT Developer Mode

HTTP mode enables ChatGPT Developer Mode integration. Configure the plugin manifest to point to your Agenti HTTP endpoint.

## SSE Mode (Legacy)

Server-Sent Events transport for streaming connections. Maintained for backward compatibility.

### Usage

```bash
npm start -- --sse
# or
npm start -- -s
```

### How It Works

```
AI Client --HTTP POST--> Agenti SSE Server
         <--SSE Stream-- (persistent connection)
```

1. Client establishes SSE connection via GET
2. Requests sent via POST
3. Responses streamed via SSE
4. Connection persists (stateful)

### When to Use SSE

- Legacy clients that don't support stdio
- Browser-based MCP clients
- Environments where subprocess spawning isn't available

## Choosing a Transport Mode

```
┌──────────────────────────────────────┐
│ Can your client spawn subprocesses?  │
│          ┌─Yes──> Use stdio          │
│          │                           │
│          └─No──> Need streaming?     │
│                   ┌─Yes──> Use SSE   │
│                   └─No──> Use HTTP   │
└──────────────────────────────────────┘
```

### Decision Matrix

| Requirement | Recommended Mode |
|-------------|-----------------|
| Claude Desktop | stdio |
| Cursor | stdio |
| ChatGPT Developer Mode | HTTP |
| Web application | HTTP |
| Streaming responses | SSE |
| Cloud deployment | HTTP |
| Local development | stdio |

## Port Configuration

For HTTP and SSE modes:

```env
PORT=3000        # Default port
HOST=0.0.0.0     # Bind address (0.0.0.0 for all interfaces)
```
