# Subscriptions API

Manage notification subscriptions for MCP Registry changes.

## List Subscriptions

```http
GET /api/v1/subscriptions
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `status` | string | - | Filter by status: `active`, `paused` |

### Response

```json
{
  "subscriptions": [
    {
      "id": "sub_abc123",
      "name": "My DeFi Alerts",
      "description": "Track DeFi-related MCP servers",
      "status": "active",
      "filters": {
        "namespaces": ["defi", "finance"],
        "keywords": ["swap", "trading"],
        "change_types": ["new", "updated"]
      },
      "channels": [
        {
          "type": "discord",
          "config": {
            "webhook_url": "https://discord.com/api/webhooks/***"
          }
        }
      ],
      "stats": {
        "notifications_sent": 42,
        "last_triggered": "2026-01-05T10:30:00Z"
      },
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-05T10:30:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

## Create Subscription

```http
POST /api/v1/subscriptions
```

### Request Body

```json
{
  "name": "My DeFi Alerts",
  "description": "Track DeFi-related MCP servers",
  "filters": {
    "namespaces": ["defi", "finance"],
    "keywords": ["swap", "trading", "liquidity"],
    "change_types": ["new", "updated", "removed"]
  },
  "channels": [
    {
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/123/abc",
        "username": "MCP Watch Bot"
      }
    },
    {
      "type": "email",
      "config": {
        "email": "alerts@example.com",
        "digest": "daily"
      }
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Subscription name (1-255 chars) |
| `description` | string | ❌ | Optional description (max 1000 chars) |
| `filters` | object | ❌ | Filter criteria (empty = all changes) |
| `filters.namespaces` | string[] | ❌ | Server namespace prefixes to match |
| `filters.keywords` | string[] | ❌ | Keywords in name/description |
| `filters.change_types` | string[] | ❌ | `new`, `updated`, `removed` |
| `channels` | array | ✅ | At least one notification channel |

### Channel Types

| Type | Required Config |
|------|-----------------|
| `discord` | `webhook_url` |
| `slack` | `webhook_url` |
| `email` | `email`, optional `digest` |
| `webhook` | `url`, optional `secret` |
| `telegram` | `bot_token`, `chat_id` |
| `teams` | `webhook_url` |

### Response

```json
{
  "id": "sub_abc123",
  "name": "My DeFi Alerts",
  "api_key": "sk_live_xxxxx",
  "created_at": "2026-01-05T12:00:00Z"
}
```

> ⚠️ The `api_key` is only returned on creation. Store it securely.

---

## Get Subscription

```http
GET /api/v1/subscriptions/{id}
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Subscription ID |

### Response

Returns full subscription object (see List response).

---

## Update Subscription

```http
PUT /api/v1/subscriptions/{id}
```

### Request Body

All fields are optional. Only provided fields are updated.

```json
{
  "name": "Updated Name",
  "filters": {
    "keywords": ["new", "keywords"]
  },
  "channels": [
    {
      "type": "slack",
      "config": {
        "webhook_url": "https://hooks.slack.com/services/..."
      }
    }
  ]
}
```

### Response

Returns updated subscription object.

---

## Delete Subscription

```http
DELETE /api/v1/subscriptions/{id}
```

### Response

```json
{
  "deleted": true,
  "id": "sub_abc123"
}
```

---

## Pause Subscription

Temporarily stop notifications without deleting.

```http
POST /api/v1/subscriptions/{id}/pause
```

### Response

```json
{
  "id": "sub_abc123",
  "status": "paused",
  "paused_at": "2026-01-05T12:00:00Z"
}
```

---

## Resume Subscription

Resume a paused subscription.

```http
POST /api/v1/subscriptions/{id}/resume
```

### Response

```json
{
  "id": "sub_abc123",
  "status": "active",
  "resumed_at": "2026-01-05T12:00:00Z"
}
```

---

## Test Subscription

Send a test notification to verify channel configuration.

```http
POST /api/v1/subscriptions/{id}/test
```

### Response

```json
{
  "success": true,
  "channels": [
    {
      "type": "discord",
      "status": "sent",
      "message": "Test notification delivered"
    },
    {
      "type": "email",
      "status": "sent",
      "message": "Test email queued"
    }
  ]
}
```

---

## Filter Matching

Filters use OR logic within arrays and AND logic between filter types:

```json
{
  "filters": {
    "namespaces": ["defi", "nft"],
    "keywords": ["swap"],
    "change_types": ["new"]
  }
}
```

This matches:
- New servers (`change_types: new`)
- AND in namespace `defi` OR `nft`
- AND containing keyword `swap`

### Empty Filters

Omitting a filter category matches all:

```json
{
  "filters": {
    "change_types": ["new"]
  }
}
```

Matches ALL new servers (no namespace/keyword filtering).

### Wildcard Matching

Namespaces support prefix matching:

```json
{
  "filters": {
    "namespaces": ["@anthropic/*", "@openai/*"]
  }
}
```

Matches all servers from `@anthropic` and `@openai` organizations.
