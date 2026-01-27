# API Reference

Complete API documentation for MCP Notify.

## Overview

The MCP Notify API is a RESTful API that allows you to programmatically manage subscriptions, query changes, and interact with the registry monitoring service.

**Base URL**: `https://watch.mcpregistry.dev/api/v1` (hosted) or `http://localhost:8080/api/v1` (self-hosted)

## Authentication

All API requests require authentication using an API key passed in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" https://watch.mcpregistry.dev/api/v1/subscriptions
```

To obtain an API key, create a user account and generate a key from the dashboard settings.

## Rate Limiting

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Pro | 600 | 100 |
| Enterprise | Unlimited | - |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| GET | `/metrics` | Prometheus metrics |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | List all subscriptions |
| POST | `/subscriptions` | Create subscription |
| GET | `/subscriptions/{id}` | Get subscription |
| PUT | `/subscriptions/{id}` | Update subscription |
| DELETE | `/subscriptions/{id}` | Delete subscription |
| POST | `/subscriptions/{id}/pause` | Pause subscription |
| POST | `/subscriptions/{id}/resume` | Resume subscription |
| POST | `/subscriptions/{id}/test` | Send test notification |

### Changes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/changes` | List detected changes |
| GET | `/changes/{id}` | Get change details |
| GET | `/changes/stats` | Change statistics |

### Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/servers` | List all tracked servers |
| GET | `/servers/{name}` | Get server details |
| GET | `/servers/search` | Search servers |

### Feeds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feed/rss` | RSS feed of changes |
| GET | `/feed/atom` | Atom feed of changes |

## Detailed Documentation

- [Subscriptions API](./subscriptions.md)
- [Changes API](./changes.md)
- [Servers API](./servers.md)
- [Webhooks](./webhooks.md)

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
- **JSON**: `/api/v1/openapi.json`
- **YAML**: `/api/openapi.yaml` (in repository)

You can use this spec to generate client libraries in any language using tools like:
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Swagger Codegen](https://swagger.io/tools/swagger-codegen/)

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid subscription name",
    "details": {
      "field": "name",
      "reason": "must be between 1 and 255 characters"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## SDKs & Libraries

Official client libraries:

| Language | Package | Status |
|----------|---------|--------|
| Go | `github.com/nirholas/mcp-notify/pkg/client` | ✅ Available |
| TypeScript | `@mcp-notify/client` | 🔜 Coming Soon |
| Python | `mcp-notify` | 🔜 Coming Soon |

## Examples

### Create a Discord Subscription

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "My MCP Alerts",
    "filters": {
      "keywords": ["ai", "llm"]
    },
    "channels": [{
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/..."
      }
    }]
  }'
```

### List Recent Changes

```bash
curl "https://watch.mcpregistry.dev/api/v1/changes?limit=10&change_type=new" \
  -H "X-API-Key: your-api-key"
```

### Subscribe to RSS Feed

```bash
# No authentication required for RSS
curl https://watch.mcpregistry.dev/api/v1/feed/rss
```
