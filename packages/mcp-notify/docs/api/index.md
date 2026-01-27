---
title: API Reference
description: Complete REST API documentation for MCP Notify
icon: material/api
---

# API Reference

The MCP Notify API is a RESTful API for managing subscriptions, querying changes, and interacting with the registry monitoring service.

## Base URL

```
http://localhost:8080/api/v1
```

## Authentication

API requests require authentication using an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: mcp_xxxxxxxxxxxx" http://localhost:8080/api/v1/subscriptions
```

!!! note "API Keys"
    API keys are generated when you create a subscription. Save them securely—they're only shown once!

## Endpoints Overview

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| <span class="api-method get">GET</span> | `/health` | Health check |
| <span class="api-method get">GET</span> | `/ready` | Readiness check |
| <span class="api-method get">GET</span> | `/metrics` | Prometheus metrics |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| <span class="api-method get">GET</span> | `/subscriptions` | [List subscriptions](subscriptions.md#list-subscriptions) |
| <span class="api-method post">POST</span> | `/subscriptions` | [Create subscription](subscriptions.md#create-subscription) |
| <span class="api-method get">GET</span> | `/subscriptions/{id}` | [Get subscription](subscriptions.md#get-subscription) |
| <span class="api-method put">PUT</span> | `/subscriptions/{id}` | [Update subscription](subscriptions.md#update-subscription) |
| <span class="api-method delete">DELETE</span> | `/subscriptions/{id}` | [Delete subscription](subscriptions.md#delete-subscription) |
| <span class="api-method post">POST</span> | `/subscriptions/{id}/pause` | [Pause subscription](subscriptions.md#pause-subscription) |
| <span class="api-method post">POST</span> | `/subscriptions/{id}/resume` | [Resume subscription](subscriptions.md#resume-subscription) |
| <span class="api-method post">POST</span> | `/subscriptions/{id}/test` | [Test subscription](subscriptions.md#test-subscription) |

### Changes

| Method | Endpoint | Description |
|--------|----------|-------------|
| <span class="api-method get">GET</span> | `/changes` | [List changes](changes.md#list-changes) |
| <span class="api-method get">GET</span> | `/changes/{id}` | [Get change details](changes.md#get-change) |

### Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| <span class="api-method get">GET</span> | `/servers` | [List servers](servers.md#list-servers) |
| <span class="api-method get">GET</span> | `/servers/search` | [Search servers](servers.md#search-servers) |
| <span class="api-method get">GET</span> | `/servers/{name}` | [Get server](servers.md#get-server) |

### Feeds

| Method | Endpoint | Description |
|--------|----------|-------------|
| <span class="api-method get">GET</span> | `/feeds/rss` | [RSS feed](feeds.md) |
| <span class="api-method get">GET</span> | `/feeds/atom` | [Atom feed](feeds.md) |
| <span class="api-method get">GET</span> | `/feeds/json` | [JSON feed](feeds.md) |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| <span class="api-method get">GET</span> | `/stats` | [Get statistics](statistics.md) |

## Rate Limiting

Rate limits are applied per API key:

| Limit | Value |
|-------|-------|
| Requests per minute | 60 |
| Burst | 10 |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1704456000
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request body or parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## SDKs

- [Go SDK](../sdk/index.md) - Official Go client
- OpenAPI spec available at `/api/v1/openapi.yaml`
