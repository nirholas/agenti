# API Documentation

Complete reference documentation for the MCP Notify REST API.

## Base URL

- **Production**: `https://watch.mcpregistry.dev/api/v1`
- **Local Development**: `http://localhost:8080/api/v1`

## Authentication

Most endpoints require authentication using an API key.

### API Key Header

Include your API key in the `X-API-Key` header:

```bash
curl -X GET https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "X-API-Key: your-api-key-here"
```

### Obtaining an API Key

An API key is returned when you create a subscription:

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"name": "My Subscription", "filters": {}, "channels": [...]}'

# Response includes api_key field
{
  "id": "uuid",
  "api_key": "mcp_watch_xxxxxxxxxxxxxxxx",
  ...
}
```

⚠️ **Important**: The API key is only shown once. Store it securely.

## Rate Limiting

| Tier | Requests/minute | Requests/hour |
|------|-----------------|---------------|
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Enterprise | Unlimited | Unlimited |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1704067200
```

When rate limited, you'll receive a `429 Too Many Requests` response.

---

## Endpoints

### Subscriptions

#### Create Subscription

Create a new notification subscription.

```http
POST /subscriptions
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "My DeFi Alerts",
  "description": "Notifications for DeFi-related MCP servers",
  "filters": {
    "namespaces": ["io.github.*", "com.defi.*"],
    "keywords": ["swap", "ethereum", "blockchain"],
    "change_types": ["new", "updated"]
  },
  "channels": [
    {
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/..."
      }
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My DeFi Alerts",
  "description": "Notifications for DeFi-related MCP servers",
  "filters": {
    "namespaces": ["io.github.*", "com.defi.*"],
    "keywords": ["swap", "ethereum", "blockchain"],
    "change_types": ["new", "updated"]
  },
  "channels": [...],
  "status": "active",
  "api_key": "mcp_watch_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2024-01-15T12:00:00Z",
  "updated_at": "2024-01-15T12:00:00Z"
}
```

#### List Subscriptions

List all subscriptions for the authenticated user.

```http
GET /subscriptions
X-API-Key: your-api-key
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max results (default: 50, max: 100) |
| `offset` | integer | Pagination offset |

**Response (200 OK):**

```json
{
  "subscriptions": [...],
  "total": 5
}
```

#### Get Subscription

Get details for a specific subscription.

```http
GET /subscriptions/{id}
X-API-Key: your-api-key
```

#### Update Subscription

Update an existing subscription.

```http
PUT /subscriptions/{id}
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "filters": {
    "keywords": ["new-keyword"]
  }
}
```

#### Delete Subscription

Delete a subscription.

```http
DELETE /subscriptions/{id}
X-API-Key: your-api-key
```

**Response (204 No Content)**

#### Pause Subscription

Temporarily stop notifications.

```http
POST /subscriptions/{id}/pause
X-API-Key: your-api-key
```

#### Resume Subscription

Resume a paused subscription.

```http
POST /subscriptions/{id}/resume
X-API-Key: your-api-key
```

#### Test Subscription

Send a test notification to verify channel configuration.

```http
POST /subscriptions/{id}/test
X-API-Key: your-api-key
```

---

### Changes

#### List Changes

Get recent changes from the MCP Registry.

```http
GET /changes
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `since` | datetime | Filter changes after this time (ISO 8601) |
| `server` | string | Filter by server name |
| `type` | string | Filter by change type: `new`, `updated`, `removed` |
| `limit` | integer | Max results (default: 50) |

**Response (200 OK):**

```json
{
  "changes": [
    {
      "id": "uuid",
      "server_name": "io.github.user/my-mcp-server",
      "change_type": "updated",
      "previous_version": "1.0.0",
      "new_version": "1.1.0",
      "field_changes": [
        {
          "field": "version_detail.version",
          "old_value": "1.0.0",
          "new_value": "1.1.0"
        }
      ],
      "server": {...},
      "detected_at": "2024-01-15T12:00:00Z"
    }
  ],
  "total_count": 150,
  "next_cursor": "eyJvZmZzZXQiOjUwfQ=="
}
```

#### Get Change Details

Get details for a specific change.

```http
GET /changes/{id}
```

---

### Servers

#### List Servers

Get all servers from the MCP Registry.

```http
GET /servers
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or description |

**Response (200 OK):**

```json
{
  "servers": [
    {
      "name": "io.github.user/my-mcp-server",
      "description": "A useful MCP server",
      "repository": {
        "url": "https://github.com/user/my-mcp-server",
        "source": "github"
      },
      "version_detail": {
        "version": "1.0.0",
        "is_latest": true
      },
      "packages": [
        {
          "registry_type": "npm",
          "name": "@user/my-mcp-server",
          "version": "1.0.0",
          "url": "https://www.npmjs.com/package/@user/my-mcp-server"
        }
      ],
      "remotes": [
        {
          "transport_type": "stdio",
          "url": "npx @user/my-mcp-server"
        }
      ]
    }
  ],
  "count": 523
}
```

#### Get Server Details

Get details for a specific server.

```http
GET /servers/{name}
```

---

### Feeds

#### RSS Feed

Get an RSS feed of recent changes.

```http
GET /feeds/rss
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | string | Filter by namespace pattern |
| `keywords` | string | Comma-separated keywords |

**Response (200 OK):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MCP Registry Changes</title>
    <link>https://watch.mcpregistry.dev</link>
    <item>
      <title>New: io.github.user/my-mcp-server</title>
      <description>New MCP server added to registry</description>
      <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

#### Atom Feed

Get an Atom feed of recent changes.

```http
GET /feeds/atom
```

---

### Statistics

#### Get Stats

Get service statistics.

```http
GET /stats
```

**Response (200 OK):**

```json
{
  "total_subscriptions": 1500,
  "active_subscriptions": 1200,
  "total_changes": 15000,
  "changes_last_24h": 45,
  "total_notifications": 250000,
  "last_poll_time": "2024-01-15T12:00:00Z",
  "server_count": 523
}
```

---

## Webhook Payload Format

When using webhook notifications, payloads are sent as JSON:

```json
{
  "event": "server.updated",
  "timestamp": "2024-01-15T12:00:00Z",
  "change": {
    "id": "uuid",
    "server_name": "io.github.user/my-mcp-server",
    "change_type": "updated",
    "previous_version": "1.0.0",
    "new_version": "1.1.0",
    "field_changes": [...]
  },
  "server": {
    "name": "io.github.user/my-mcp-server",
    "description": "...",
    ...
  },
  "subscription": {
    "id": "uuid",
    "name": "My Subscription"
  }
}
```

### Webhook Signature Verification

If you configured a secret, verify the signature:

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

# Usage
is_valid = verify_signature(
    request.body,
    request.headers.get("X-Signature"),
    your_secret
)
```

### Retry Behavior

Failed webhook deliveries are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts, the notification is moved to a dead letter queue.

---

## Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `invalid_request` | Malformed request body |
| 400 | `validation_error` | Field validation failed |
| 401 | `unauthorized` | Missing or invalid API key |
| 403 | `forbidden` | Access denied to resource |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Resource already exists |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Server error |

**Error Response Format:**

```json
{
  "error": "validation_error",
  "message": "Invalid filter configuration",
  "details": {
    "field": "filters.namespaces[0]",
    "issue": "Invalid glob pattern"
  }
}
```

---

## SDKs and Client Libraries

### Go

```go
import "github.com/nirholas/mcp-notify/pkg/client"

client := client.New("your-api-key")
subscriptions, err := client.Subscriptions.List(ctx)
```

### JavaScript/TypeScript

```typescript
import { MCPWatchClient } from '@mcp-notify/client';

const client = new MCPWatchClient({ apiKey: 'your-api-key' });
const changes = await client.changes.list({ since: '2024-01-01' });
```

### Python

```python
from mcp_watch import Client

client = Client(api_key="your-api-key")
subscriptions = client.subscriptions.list()
```

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

- **YAML**: `/api/v1/openapi.yaml`
- **JSON**: `/api/v1/openapi.json`
- **Swagger UI**: `/api/v1/docs`

You can import the spec into tools like Postman, Insomnia, or use it to generate clients.
