# OpenBare Registry

A directory service for community bare server nodes. This registry allows node operators to register their bare servers and clients to discover healthy nodes.

## Features

- **Node Registration**: Register bare server nodes with region and contact info
- **Health Checking**: Automatic background health checks every 30 seconds
- **Latency Tracking**: Track and sort nodes by response latency
- **Rate Limiting**: Prevent abuse with registration rate limits
- **CORS Enabled**: Browser-friendly API for client-side usage
- **Cacheable**: Public endpoints include cache headers

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with auto-reload
npm run dev
```

### Docker

```bash
# Build image
docker build -t openbare-registry .

# Run container
docker run -d \
  -p 3000:3000 \
  -v openbare-data:/app/data \
  --name openbare-registry \
  openbare-registry
```

### Docker Compose

```yaml
version: '3.8'
services:
  registry:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - registry-data:/app/data
    environment:
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  registry-data:
```

## API Reference

### Base URL

```
http://localhost:3000
```

### Endpoints

#### GET /
Returns API information and available endpoints.

**Response:**
```json
{
  "name": "OpenBare Registry",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

---

#### POST /nodes/register
Register a new bare server node.

**Request Body:**
```json
{
  "url": "https://bare.example.com",
  "region": "us-east",
  "owner": "YourName",
  "contact": "email@example.com"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Node URL (http/https) |
| region | string | Yes | Geographic region |
| owner | string | Yes | Node operator name (2-100 chars) |
| contact | string | No | Contact info (max 200 chars) |

**Valid Regions:**
- `us-east`, `us-west`, `us-central`
- `eu-west`, `eu-central`, `eu-east`
- `asia-east`, `asia-southeast`, `asia-south`
- `australia`, `south-america`, `africa`
- `other`

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Node registered successfully",
  "nodeId": 42,
  "status": "pending",
  "note": "Your node will be marked as healthy after passing health checks."
}
```

**Errors:**
- `400` - Validation failed
- `409` - Duplicate URL
- `429` - Rate limit exceeded (5 per hour per IP)

---

#### DELETE /nodes/:id
Unregister a node.

**Response:**
```json
{
  "success": true,
  "message": "Node unregistered successfully"
}
```

---

#### GET /nodes
List all healthy nodes.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| region | string | Filter by region |

**Response:**
```json
{
  "count": 15,
  "region": "all",
  "nodes": [
    {
      "id": 1,
      "url": "https://bare.example.com",
      "region": "us-east",
      "owner": "NodeOperator",
      "avg_latency": 45,
      "last_heartbeat": "2025-01-17T12:00:00.000Z"
    }
  ]
}
```

**Cache:** 10 seconds

---

#### GET /nodes/random
Get a random healthy node.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| region | string | Filter by region |

**Response:**
```json
{
  "id": 7,
  "url": "https://bare.example.com",
  "region": "eu-west",
  "owner": "NodeOperator",
  "avg_latency": 52
}
```

**Cache:** 5 seconds

---

#### GET /nodes/fastest
Get nodes sorted by latency (fastest first).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 10 | Max nodes to return (max 100) |

**Response:**
```json
{
  "count": 10,
  "nodes": [
    {
      "id": 3,
      "url": "https://fast-bare.example.com",
      "region": "us-west",
      "owner": "FastNode",
      "avg_latency": 23,
      "last_heartbeat": "2025-01-17T12:00:00.000Z"
    }
  ]
}
```

**Cache:** 10 seconds

---

#### POST /nodes/:id/heartbeat
Send a heartbeat to keep node active.

**Response:**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "status": "healthy"
}
```

**Note:** Nodes without heartbeat for 2 minutes are marked unhealthy. Nodes without heartbeat for 5 minutes are removed.

---

#### GET /stats
Get network statistics.

**Response:**
```json
{
  "timestamp": "2025-01-17T12:00:00.000Z",
  "totalNodes": 50,
  "healthyNodes": 42,
  "unhealthyNodes": 8,
  "averageLatency": 67,
  "regions": [
    { "region": "us-east", "count": 15 },
    { "region": "eu-west", "count": 12 }
  ],
  "recentChecks": {
    "total": 500,
    "successful": 485,
    "successRate": 97
  }
}
```

**Cache:** 30 seconds

---

#### GET /regions
List valid regions.

**Response:**
```json
{
  "regions": ["us-east", "us-west", "us-central", ...]
}
```

**Cache:** 1 hour

---

#### GET /health
Health check endpoint for the registry service itself.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-17T12:00:00.000Z"
}
```

## Node Operator Guide

### Registering Your Node

1. Deploy your bare server
2. Register with the registry:

```bash
curl -X POST http://registry.example.com/nodes/register \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-bare-server.com",
    "region": "us-east",
    "owner": "YourName",
    "contact": "optional@email.com"
  }'
```

3. Save the returned `nodeId`

### Sending Heartbeats

Send heartbeats every 60 seconds to stay active:

```bash
# Replace 42 with your nodeId
curl -X POST http://registry.example.com/nodes/42/heartbeat
```

### Heartbeat Script Example

```bash
#!/bin/bash
NODE_ID=42
REGISTRY_URL="http://registry.example.com"

while true; do
  curl -s -X POST "$REGISTRY_URL/nodes/$NODE_ID/heartbeat"
  sleep 60
done
```

### Unregistering

```bash
curl -X DELETE http://registry.example.com/nodes/42
```

## Client Usage

### JavaScript Example

```javascript
// Get a random node
const response = await fetch('https://registry.example.com/nodes/random');
const node = await response.json();
console.log('Using bare server:', node.url);

// Get fastest nodes
const fastestResponse = await fetch('https://registry.example.com/nodes/fastest?limit=5');
const { nodes } = await fastestResponse.json();

// Filter by region
const euNodes = await fetch('https://registry.example.com/nodes?region=eu-west');
```

### With Fallback

```javascript
async function getBareServer(preferredRegion = null) {
  const params = preferredRegion ? `?region=${preferredRegion}` : '';
  
  try {
    const response = await fetch(`https://registry.example.com/nodes/random${params}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Registry unavailable, using fallback');
  }
  
  // Fallback to known working server
  return { url: 'https://fallback-bare.example.com' };
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment mode |
| DB_PATH | ./registry.db | SQLite database path |

## Security Considerations

- **Rate Limiting**: Registrations are limited to 5 per hour per IP
- **URL Validation**: Only http/https URLs accepted; private IPs blocked in production
- **No Duplicate URLs**: Each URL can only be registered once
- **Automatic Cleanup**: Inactive nodes are automatically removed

## License

MIT License - See LICENSE file for details
