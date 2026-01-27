# OpenBare API Reference

Complete API documentation for all OpenBare components.

---

## Server API

### Endpoints

#### `GET /`

Server information and status.

**Response:**
```json
{
  "status": "ok",
  "name": "OpenBare Server",
  "version": "1.0.0",
  "node_id": "us-east-abc123",
  "region": "us-east",
  "uptime_seconds": 86400,
  "requests_served": 150000,
  "healthy": true,
  "bare_endpoint": "/bare/",
  "documentation": "https://github.com/nirholas/openbare"
}
```

---

#### `GET /health`

Health check for load balancers and monitoring.

**Response (200 - Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T12:00:00.000Z",
  "node": {
    "id": "us-east-abc123",
    "region": "us-east",
    "version": "1.0.0"
  },
  "checks": {
    "memory": {
      "healthy": true,
      "heapUsedMB": 45,
      "heapTotalMB": 128,
      "heapUsedPercent": "35.2"
    },
    "eventLoop": {
      "healthy": true,
      "lagMs": 2
    },
    "bareServer": {
      "healthy": true,
      "lastTest": 1705492800000
    }
  },
  "metrics": {
    "uptime_seconds": 86400,
    "requests_total": 150000,
    "requests_per_minute": 250,
    "active_connections": 15,
    "error_rate": "0.05%"
  }
}
```

**Response (503 - Unhealthy):**
```json
{
  "status": "unhealthy",
  "checks": {
    "memory": { "healthy": false },
    "bareServer": { "healthy": false }
  }
}
```

---

#### `GET /status`

Detailed metrics and configuration.

**Response:**
```json
{
  "node": {
    "id": "us-east-abc123",
    "region": "us-east",
    "version": "1.0.0",
    "url": "https://bare.example.com"
  },
  "metrics": {
    "uptime_seconds": 86400,
    "requests": {
      "total": 150000,
      "successful": 149500,
      "failed": 500,
      "per_minute": 250,
      "by_method": {
        "GET": 120000,
        "POST": 25000,
        "OPTIONS": 5000
      },
      "by_status": {
        "2xx": 145000,
        "3xx": 2000,
        "4xx": 2500,
        "5xx": 500
      }
    },
    "bytes": {
      "received": 1073741824,
      "sent": 10737418240,
      "total": 11811160064
    },
    "latency": {
      "average_ms": 125,
      "min_ms": 15,
      "max_ms": 2500
    },
    "connections": {
      "active": 15,
      "peak": 150
    }
  },
  "health": {
    "status": "healthy",
    "lastCheck": 1705492800000
  },
  "registration": {
    "registered": true,
    "registrationId": "us-east-abc123",
    "lastHeartbeat": 1705492800000,
    "lastHeartbeatSuccess": true
  },
  "config": {
    "rate_limit": "100 req/60s",
    "registry_url": "https://registry.openbare.dev"
  }
}
```

---

#### `GET /info`

Node information for registry.

**Response:**
```json
{
  "node_id": "us-east-abc123",
  "region": "us-east",
  "owner": "admin@example.com",
  "version": "1.0.0",
  "capabilities": ["bare-v3", "websocket"],
  "bare_path": "/bare/",
  "url": "https://bare.example.com"
}
```

---

#### `* /bare/*`

Bare Server protocol endpoint. See [Bare Protocol](#bare-protocol) section.

---

## Registry API

### Endpoints

#### `GET /nodes`

List all healthy nodes.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `region` | string | Filter by region |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "nodes": [
    {
      "id": "us-east-abc123",
      "url": "https://bare1.example.com",
      "region": "us-east",
      "status": "healthy",
      "avg_latency": 50,
      "version": "1.0.0",
      "last_heartbeat": "2026-01-17T12:00:00.000Z"
    },
    {
      "id": "eu-west-def456",
      "url": "https://bare2.example.com",
      "region": "eu-west",
      "status": "healthy",
      "avg_latency": 75,
      "version": "1.0.0",
      "last_heartbeat": "2026-01-17T12:00:00.000Z"
    }
  ],
  "total": 2,
  "healthy": 2
}
```

---

#### `GET /nodes/random`

Get a random healthy node.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `region` | string | Prefer nodes from region |

**Response:**
```json
{
  "id": "us-east-abc123",
  "url": "https://bare1.example.com",
  "region": "us-east"
}
```

---

#### `POST /nodes/register`

Register a new node.

**Request Body:**
```json
{
  "url": "https://bare.example.com",
  "nodeId": "my-node-1",
  "region": "us-east",
  "owner": "admin@example.com",
  "version": "1.0.0",
  "capabilities": ["bare-v3", "websocket"]
}
```

**Response (201):**
```json
{
  "id": "my-node-1",
  "registered": true,
  "message": "Node registered successfully"
}
```

---

#### `DELETE /nodes/:id`

Unregister a node.

**Response (200):**
```json
{
  "id": "my-node-1",
  "unregistered": true
}
```

---

#### `POST /nodes/:id/heartbeat`

Send heartbeat to keep node active.

**Request Body:**
```json
{
  "status": "healthy",
  "metrics": {
    "uptime_seconds": 3600,
    "requests_total": 1000,
    "requests_per_minute": 50
  },
  "timestamp": "2026-01-17T12:00:00.000Z"
}
```

**Response (200):**
```json
{
  "received": true,
  "next_heartbeat_in": 30
}
```

---

#### `GET /stats`

Network-wide statistics.

**Response:**
```json
{
  "network": {
    "total_nodes": 50,
    "healthy_nodes": 48,
    "regions": ["us-east", "us-west", "eu-west", "asia-pacific"],
    "total_requests_24h": 10000000
  },
  "performance": {
    "avg_latency": 75,
    "p50_latency": 50,
    "p95_latency": 200,
    "p99_latency": 500
  }
}
```

---

## Client API

### Constructor

```javascript
import { OpenBareClient } from '@openbare/client';

const client = new OpenBareClient({
  // Direct server list
  servers: ['https://bare1.com', 'https://bare2.com'],
  
  // Or auto-discover from registry
  registry: 'https://registry.openbare.dev',
  
  // Options
  timeout: 10000,        // Request timeout (ms)
  retries: 3,            // Max retries per request
  healthCheckInterval: 30000  // Health check interval (ms)
});
```

### Methods

#### `client.fetch(url, options)`

Fetch a URL through the proxy network.

```javascript
const response = await client.fetch('https://google.com', {
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0...'
  }
});

console.log(response.status);      // 200
console.log(await response.text());
```

---

#### `client.addServer(url, priority?)`

Add a server to the pool.

```javascript
client.addServer('https://bare3.com', 1); // Priority 1 = high
```

---

#### `client.removeServer(url)`

Remove a server from the pool.

```javascript
client.removeServer('https://bare3.com');
```

---

#### `client.testServer(url)`

Test a server's latency.

```javascript
const result = await client.testServer('https://bare1.com');
// { url: 'https://bare1.com', latency: 50, healthy: true }
```

---

#### `client.testAllServers()`

Test all servers and sort by latency.

```javascript
const results = await client.testAllServers();
// [
//   { url: 'https://bare1.com', latency: 50, healthy: true },
//   { url: 'https://bare2.com', latency: 75, healthy: true }
// ]
```

---

#### `client.getHealthyServers()`

Get list of healthy servers.

```javascript
const healthy = client.getHealthyServers();
// ['https://bare1.com', 'https://bare2.com']
```

---

## Bare Protocol

The Bare Server protocol (TompHTTP v3) specification.

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Bare-URL` | Yes | Target URL to fetch |
| `X-Bare-Headers` | No | JSON-encoded headers to send |
| `X-Bare-Forward-Headers` | No | Headers to forward from client |
| `X-Bare-Pass-Headers` | No | Headers to pass unchanged |
| `X-Bare-Pass-Status` | No | Status codes to pass through |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Bare-Status` | Original response status code |
| `X-Bare-Status-Text` | Original status text |
| `X-Bare-Headers` | JSON-encoded response headers |

### Example Request

```http
GET /bare/v3/ HTTP/1.1
Host: bare.example.com
X-Bare-URL: https://www.google.com/
X-Bare-Headers: {"Accept":"text/html","User-Agent":"Mozilla/5.0"}
```

### Example Response

```http
HTTP/1.1 200 OK
X-Bare-Status: 200
X-Bare-Status-Text: OK
X-Bare-Headers: {"content-type":"text/html","content-length":"12345"}
Content-Type: text/html

<!doctype html>...
```

### WebSocket Upgrade

```http
GET /bare/v3/ HTTP/1.1
Host: bare.example.com
Upgrade: websocket
Connection: Upgrade
X-Bare-URL: wss://echo.websocket.org/
X-Bare-Headers: {}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_URL` | 400 | Invalid target URL |
| `TARGET_ERROR` | 502 | Target server error |
| `TIMEOUT` | 504 | Request timeout |
| `INTERNAL_ERROR` | 500 | Server error |
