# SSE API Reference

When running in SSE mode (`--sse`), Agenti uses Server-Sent Events for streaming MCP communication.

## Starting SSE Mode

```bash
npm start -- --sse
# or
npm start -- -s
```

Default: `http://localhost:3000`

## Connection Flow

### 1. Establish SSE Connection

```bash
curl -N http://localhost:3000/sse
```

The server responds with an SSE stream and sends a connection event:

```
event: endpoint
data: /messages?sessionId=abc123
```

### 2. Send Messages

Use the endpoint URL from the connection event to send JSON-RPC messages:

```bash
curl -X POST "http://localhost:3000/messages?sessionId=abc123" \
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

### 3. Receive Responses

Responses arrive on the SSE stream:

```
event: message
data: {"jsonrpc":"2.0","result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"agenti","version":"0.1.0"}},"id":1}
```

## SSE Event Types

| Event | Description |
|-------|-------------|
| `endpoint` | Connection established, provides message endpoint URL |
| `message` | JSON-RPC response to a request |
| `error` | Server error notification |

## Session Management

Each SSE connection creates a session:
- Sessions are identified by `sessionId` query parameter
- Sessions persist as long as the SSE connection is open
- Closing the SSE connection terminates the session
- Each session maintains its own tool state

## JavaScript Client Example

```javascript
// Establish SSE connection
const eventSource = new EventSource('http://localhost:3000/sse');

let messageEndpoint = '';

eventSource.addEventListener('endpoint', (event) => {
  messageEndpoint = event.data;
  // Now we can send messages
  sendMessage({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1,
  });
});

eventSource.addEventListener('message', (event) => {
  const response = JSON.parse(event.data);
  console.log('Received:', response);
});

async function sendMessage(message) {
  await fetch(`http://localhost:3000${messageEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
}
```

## When to Use SSE

SSE mode is primarily for:
- Browser-based MCP clients
- Environments where stdio isn't available
- Applications needing server-push capabilities
- Legacy clients that don't support the newer HTTP streamable transport

For most use cases, **stdio** (Claude Desktop, Cursor) or **HTTP** (ChatGPT) are preferred.

## Configuration

```env
PORT=3000           # Server port
HOST=0.0.0.0        # Bind address
AUTH_TOKEN=secret    # Optional auth token
```
