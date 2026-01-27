# serve

Start a generated MCP server.

## Usage

```bash
github-to-mcp serve <path> [options]
```

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `path` | Path to generated MCP server | Yes |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port to listen on | `3000` |
| `--stdio` | Use stdio transport instead of HTTP | `false` |
| `--verbose` | Enable verbose logging | `false` |

## Examples

### Start Server

```bash
github-to-mcp serve ./my-mcp-server
```

Output:

```
MCP Server started
  Transport: HTTP
  Port: 3000
  Tools: 12
  URL: http://localhost:3000

Press Ctrl+C to stop
```

### Custom Port

```bash
github-to-mcp serve ./my-mcp-server -p 8080
```

### Stdio Mode

For direct integration with clients that support stdio:

```bash
github-to-mcp serve ./my-mcp-server --stdio
```

This mode reads from stdin and writes to stdout, compatible with Claude Desktop's config.

## Transport Modes

### HTTP (Default)

Starts an HTTP server that accepts MCP JSON-RPC requests:

```bash
# Start server
github-to-mcp serve ./my-mcp-server -p 3000

# Test with curl
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Stdio

For direct process communication:

```bash
# Start in stdio mode
github-to-mcp serve ./my-mcp-server --stdio

# Claude Desktop config
{
  "mcpServers": {
    "my-repo": {
      "command": "github-to-mcp",
      "args": ["serve", "/path/to/my-mcp-server", "--stdio"]
    }
  }
}
```

## Health Check

When running in HTTP mode, the server provides a health endpoint:

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "server": "my-repo-mcp",
  "tools": 12,
  "uptime": 123.45
}
```

## Alternative: Direct Node

You can also run the server directly:

```bash
cd ./my-mcp-server
npm install
node server.mjs
```

Or for Python servers:

```bash
cd ./my-mcp-server
pip install -r requirements.txt
python server.py
```

## See Also

- [`generate`](generate.md) - Generate MCP server
- [Claude Desktop Integration](../guides/claude-desktop.md) - Connect to Claude
