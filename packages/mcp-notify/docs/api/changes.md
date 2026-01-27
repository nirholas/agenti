# Changes API

Query detected changes in the MCP Registry.

## List Changes

```http
GET /api/v1/changes
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `change_type` | string | - | Filter: `new`, `updated`, `removed` |
| `server_name` | string | - | Filter by server name (partial match) |
| `namespace` | string | - | Filter by namespace prefix |
| `since` | string | - | ISO 8601 timestamp (changes after) |
| `until` | string | - | ISO 8601 timestamp (changes before) |

### Response

```json
{
  "changes": [
    {
      "id": "chg_xyz789",
      "server_name": "@anthropic/claude-mcp",
      "change_type": "updated",
      "previous_version": "1.2.0",
      "new_version": "1.3.0",
      "field_changes": [
        {
          "field": "version",
          "old_value": "1.2.0",
          "new_value": "1.3.0"
        },
        {
          "field": "description",
          "old_value": "Claude MCP integration",
          "new_value": "Claude MCP integration with vision support"
        }
      ],
      "server": {
        "name": "@anthropic/claude-mcp",
        "display_name": "Claude MCP",
        "description": "Claude MCP integration with vision support",
        "version": "1.3.0",
        "repository": {
          "url": "https://github.com/anthropic/claude-mcp",
          "source": "github"
        },
        "packages": [
          {
            "registry_type": "npm",
            "name": "@anthropic/claude-mcp",
            "url": "https://www.npmjs.com/package/@anthropic/claude-mcp"
          }
        ]
      },
      "detected_at": "2026-01-05T10:30:00Z"
    }
  ],
  "total": 156,
  "limit": 50,
  "offset": 0
}
```

---

## Get Change

```http
GET /api/v1/changes/{id}
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Change ID |

### Response

Returns full change object with complete server snapshot.

---

## Change Statistics

```http
GET /api/v1/changes/stats
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `24h` | Time period: `1h`, `24h`, `7d`, `30d` |

### Response

```json
{
  "period": "24h",
  "start": "2026-01-04T12:00:00Z",
  "end": "2026-01-05T12:00:00Z",
  "summary": {
    "total_changes": 42,
    "new_servers": 15,
    "updated_servers": 25,
    "removed_servers": 2
  },
  "by_hour": [
    {
      "hour": "2026-01-05T10:00:00Z",
      "new": 3,
      "updated": 5,
      "removed": 0
    }
  ],
  "top_namespaces": [
    {
      "namespace": "@anthropic",
      "count": 8
    },
    {
      "namespace": "@openai",
      "count": 6
    }
  ],
  "trending_keywords": [
    {
      "keyword": "vision",
      "count": 12
    },
    {
      "keyword": "tools",
      "count": 8
    }
  ]
}
```

---

## Change Types

| Type | Description |
|------|-------------|
| `new` | Server added to registry |
| `updated` | Server metadata or version changed |
| `removed` | Server removed from registry |

---

## Field Changes

For `updated` changes, `field_changes` contains what changed:

| Field | Description |
|-------|-------------|
| `version` | Package version |
| `description` | Server description |
| `display_name` | Display name |
| `repository` | Repository URL |
| `packages` | Package registry entries |
| `tools` | Available tools |
| `prompts` | Available prompts |
| `resources` | Available resources |

---

## Examples

### Get New Servers from Last Week

```bash
curl "https://watch.mcpregistry.dev/api/v1/changes?change_type=new&since=2026-01-01T00:00:00Z" \
  -H "X-API-Key: your-api-key"
```

### Get Updates for Specific Namespace

```bash
curl "https://watch.mcpregistry.dev/api/v1/changes?namespace=@anthropic&change_type=updated" \
  -H "X-API-Key: your-api-key"
```

### Get Statistics for Last 7 Days

```bash
curl "https://watch.mcpregistry.dev/api/v1/changes/stats?period=7d" \
  -H "X-API-Key: your-api-key"
```
