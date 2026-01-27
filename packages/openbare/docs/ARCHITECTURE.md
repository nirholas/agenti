# OpenBare Architecture

This document provides a technical deep-dive into how OpenBare works.

## System Overview

OpenBare is a decentralized web proxy network consisting of four main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                        │
│   (Ultraviolet, SperaxOS Browser, Custom Apps)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @openbare/client                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ ServerPool   │  │ BareFetch    │  │ Discovery    │           │
│  │ - health     │  │ - encode     │  │ - registry   │           │
│  │ - latency    │  │ - decode     │  │ - refresh    │           │
│  │ - failover   │  │ - headers    │  │ - cache      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ @openbare/    │     │ @openbare/    │     │ @openbare/    │
│ server        │     │ edge          │     │ server        │
│ (Node.js)     │     │ (CF Workers)  │     │ (Docker)      │
│               │     │               │     │               │
│ Region: US    │     │ Region: EU    │     │ Region: Asia  │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │ @openbare/registry│
                    │ - Node discovery  │
                    │ - Health tracking │
                    │ - Metrics agg.    │
                    └───────────────────┘
```

## The Bare Server Protocol

OpenBare implements the TompHTTP Bare Server v3 protocol, which is the standard for web proxy servers in the Ultraviolet ecosystem.

### Request Flow

```
1. Client wants to fetch https://google.com

2. Client encodes the request:
   - URL: xor_encode("https://google.com") → "encoded_string"
   - Headers: JSON.stringify({...}) → base64

3. Client sends to bare server:
   GET /bare/v3/ HTTP/1.1
   X-Bare-URL: https://google.com
   X-Bare-Headers: {"Accept": "text/html", ...}

4. Bare server:
   - Parses X-Bare-* headers
   - Fetches https://google.com
   - Strips X-Frame-Options, CSP headers
   - Returns response with X-Bare-* response headers

5. Client decodes and returns to application
```

### Protocol Headers

**Request Headers:**
| Header | Description |
|--------|-------------|
| `X-Bare-URL` | Target URL to fetch |
| `X-Bare-Headers` | JSON-encoded headers to send |
| `X-Bare-Forward-Headers` | Headers to forward from client |
| `X-Bare-Pass-Headers` | Headers to pass through unchanged |
| `X-Bare-Pass-Status` | Status codes to pass through |

**Response Headers:**
| Header | Description |
|--------|-------------|
| `X-Bare-Status` | Original response status code |
| `X-Bare-Status-Text` | Original status text |
| `X-Bare-Headers` | JSON-encoded response headers |

## Client Failover Logic

The client maintains a pool of servers and implements intelligent failover:

```javascript
class ServerPool {
  servers = [
    { url: 'https://bare1.com', latency: 50, healthy: true },
    { url: 'https://bare2.com', latency: 120, healthy: true },
    { url: 'https://bare3.com', latency: 80, healthy: false },
  ];

  // Get best available server
  getBest() {
    return this.servers
      .filter(s => s.healthy)
      .sort((a, b) => a.latency - b.latency)[0];
  }

  // Fetch with automatic failover
  async fetch(url, options) {
    for (const server of this.getHealthyServers()) {
      try {
        return await this.bareFetch(server, url, options);
      } catch (err) {
        this.markUnhealthy(server);
        continue; // Try next server
      }
    }
    throw new Error('All servers failed');
  }
}
```

### Health Checking

Servers are checked periodically:

```javascript
async function checkHealth(server) {
  const start = Date.now();
  try {
    const res = await fetch(server.url + '/health', { timeout: 5000 });
    server.latency = Date.now() - start;
    server.healthy = res.ok;
  } catch {
    server.healthy = false;
  }
}
```

## Registry Service

The registry maintains a directory of public nodes:

### Database Schema

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  region TEXT,
  owner TEXT,
  version TEXT,
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat DATETIME,
  status TEXT DEFAULT 'unknown',
  avg_latency INTEGER,
  total_requests INTEGER DEFAULT 0
);

CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_region ON nodes(region);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nodes` | GET | List healthy nodes |
| `/nodes/register` | POST | Register a node |
| `/nodes/:id` | DELETE | Unregister a node |
| `/nodes/:id/heartbeat` | POST | Send heartbeat |

### Health Checking Loop

```javascript
// Runs every 30 seconds
async function healthCheckLoop() {
  const nodes = await db.getAllNodes();
  
  for (const node of nodes) {
    const healthy = await checkNodeHealth(node.url);
    
    if (!healthy) {
      node.failureCount++;
      if (node.failureCount >= 3) {
        await db.markUnhealthy(node.id);
      }
    } else {
      node.failureCount = 0;
      await db.markHealthy(node.id);
    }
  }
}
```

## Edge Deployment (Cloudflare Workers)

The edge version runs on Cloudflare's global network:

### Advantages

- **300+ locations** - Requests served from nearest edge
- **<50ms latency** - Global average response time
- **Auto-scaling** - Handles any traffic level
- **Free tier** - 100K requests/day free

### Implementation

```javascript
// Cloudflare Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/bare/')) {
      return handleBareRequest(request);
    }
    
    return new Response(JSON.stringify({
      status: 'ok',
      edge_location: request.cf?.colo
    }));
  }
};
```

## Security Model

### What OpenBare Does:
- Strips X-Frame-Options headers
- Strips CSP frame-ancestors
- Forwards cookies (same-site context)
- Proxies WebSocket connections

### What OpenBare Doesn't Do:
- Store or log request content
- Modify response bodies
- Execute JavaScript
- Track users

### Rate Limiting

```javascript
const limiter = rateLimit({
  windowMs: 60000,  // 1 minute
  max: 100,         // 100 requests per window
  keyGenerator: (req) => req.ip
});
```

## Metrics Collection

Each node collects metrics:

```javascript
const metrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    per_minute: []
  },
  bytes: {
    received: 0,
    sent: 0
  },
  latency: {
    average: 0,
    p50: 0,
    p95: 0,
    p99: 0
  },
  connections: {
    active: 0,
    peak: 0
  }
};
```

## WebSocket Support

OpenBare fully supports WebSocket proxying:

```
Client                    Bare Server              Target
  │                           │                       │
  │  WS Upgrade Request       │                       │
  │  X-Bare-URL: wss://...    │                       │
  │ ─────────────────────────>│                       │
  │                           │  WS Upgrade Request   │
  │                           │ ─────────────────────>│
  │                           │                       │
  │                           │  WS Upgrade Response  │
  │                           │ <─────────────────────│
  │  WS Upgrade Response      │                       │
  │ <─────────────────────────│                       │
  │                           │                       │
  │  WS Frames (bidirectional)                        │
  │ <═══════════════════════════════════════════════> │
```

## Performance Optimization

### Connection Pooling

The server maintains connection pools to frequently-accessed origins:

```javascript
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000
});
```

### Response Streaming

Large responses are streamed, not buffered:

```javascript
async function handleRequest(req, res) {
  const upstream = await fetch(targetUrl);
  
  // Stream response body
  upstream.body.pipe(res);
}
```

### Caching Headers

Appropriate caching headers are set:

```javascript
res.setHeader('Cache-Control', 'no-store'); // Don't cache proxied content
res.setHeader('X-Bare-Cache', 'MISS');      // Cache status indicator
```
