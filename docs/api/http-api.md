# HTTP API Reference

When running in HTTP mode (`--http`), Agenti exposes a RESTful API for MCP communication.

## Starting HTTP Mode

```bash
npm start -- --http
# or
npm start -- -h
```

Default: `http://localhost:3000`

## Endpoints

### POST /mcp

Main MCP JSON-RPC endpoint for tool discovery and execution.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>  (if AUTH_TOKEN is configured)
```

**Request Body:** JSON-RPC 2.0 message

#### Initialize Session

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": { "tools": {} },
      "clientInfo": { "name": "my-client", "version": "1.0" }
    },
    "id": 1
  }'
```

#### List Tools

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'
```

#### Call a Tool

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "market_data_price",
      "arguments": { "coinId": "bitcoin" }
    },
    "id": 3
  }'
```

### GET /health

Health check endpoint.

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600,
  "tools": 380
}
```

### GET /tools

List all available tools (convenience endpoint, not part of MCP spec).

```bash
curl http://localhost:3000/tools
```

**Response:**
```json
{
  "tools": [
    {
      "name": "market_data_price",
      "description": "Get current cryptocurrency price",
      "category": "market-data"
    }
  ],
  "count": 380
}
```

## Authentication

When `AUTH_TOKEN` is set, all requests require a Bearer token:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your_secret_token" \
  -H "Content-Type: application/json" \
  -d '...'
```

Unauthenticated requests receive:
```json
{ "error": "Unauthorized", "status": 401 }
```

## CORS

Configure allowed origins via `CORS_ORIGINS` environment variable:

```env
CORS_ORIGINS=https://your-app.com,https://another-app.com
```

Default: `*` (all origins allowed)

## Rate Limiting

```env
RATE_LIMIT_MAX=100       # Max requests per window
RATE_LIMIT_WINDOW=60000  # Window in milliseconds (1 minute)
```

Rate-limited requests receive:
```json
{ "error": "Too Many Requests", "status": 429, "retryAfter": 60 }
```

## ChatGPT Developer Mode

HTTP mode enables ChatGPT Developer Mode integration. The server accepts the same JSON-RPC format that ChatGPT uses for tool calling.

## Error Responses

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Invalid JSON-RPC request |
| 401 | Missing or invalid auth token |
| 404 | Unknown tool name |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
