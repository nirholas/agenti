# Servers API

Query MCP servers tracked from the registry.

## List Servers

```http
GET /api/v1/servers
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Maximum results (1-500) |
| `offset` | integer | 0 | Pagination offset |
| `namespace` | string | - | Filter by namespace prefix |
| `sort` | string | `name` | Sort by: `name`, `updated`, `created` |
| `order` | string | `asc` | Order: `asc`, `desc` |

### Response

```json
{
  "servers": [
    {
      "name": "@anthropic/claude-mcp",
      "display_name": "Claude MCP",
      "description": "Official Claude MCP integration",
      "version": "1.3.0",
      "repository": {
        "url": "https://github.com/anthropic/claude-mcp",
        "source": "github"
      },
      "packages": [
        {
          "registry_type": "npm",
          "name": "@anthropic/claude-mcp",
          "version": "1.3.0",
          "url": "https://www.npmjs.com/package/@anthropic/claude-mcp"
        }
      ],
      "first_seen": "2025-06-15T00:00:00Z",
      "last_updated": "2026-01-05T10:30:00Z"
    }
  ],
  "total": 1250,
  "limit": 100,
  "offset": 0
}
```

---

## Get Server

```http
GET /api/v1/servers/{name}
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Server name (URL encoded) |

### Example

```bash
curl "https://watch.mcpregistry.dev/api/v1/servers/%40anthropic%2Fclaude-mcp" \
  -H "X-API-Key: your-api-key"
```

### Response

```json
{
  "name": "@anthropic/claude-mcp",
  "display_name": "Claude MCP",
  "description": "Official Claude MCP integration with vision support",
  "version": "1.3.0",
  "repository": {
    "url": "https://github.com/anthropic/claude-mcp",
    "source": "github",
    "stars": 1250,
    "forks": 89
  },
  "packages": [
    {
      "registry_type": "npm",
      "name": "@anthropic/claude-mcp",
      "version": "1.3.0",
      "url": "https://www.npmjs.com/package/@anthropic/claude-mcp"
    },
    {
      "registry_type": "pypi",
      "name": "claude-mcp",
      "version": "1.3.0",
      "url": "https://pypi.org/project/claude-mcp/"
    }
  ],
  "tools": [
    {
      "name": "analyze_image",
      "description": "Analyze an image using Claude's vision capabilities"
    },
    {
      "name": "generate_text",
      "description": "Generate text using Claude"
    }
  ],
  "prompts": [
    {
      "name": "code_review",
      "description": "Review code for bugs and improvements"
    }
  ],
  "resources": [],
  "metadata": {
    "author": "Anthropic",
    "license": "MIT",
    "homepage": "https://anthropic.com/claude"
  },
  "first_seen": "2025-06-15T00:00:00Z",
  "last_updated": "2026-01-05T10:30:00Z",
  "change_history": [
    {
      "id": "chg_xyz789",
      "change_type": "updated",
      "detected_at": "2026-01-05T10:30:00Z"
    },
    {
      "id": "chg_abc456",
      "change_type": "updated",
      "detected_at": "2026-01-02T14:20:00Z"
    }
  ]
}
```

---

## Search Servers

```http
GET /api/v1/servers/search
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | ✅ | Search query (min 2 chars) |
| `limit` | integer | ❌ | Maximum results (default 20) |

### Response

```json
{
  "query": "claude",
  "results": [
    {
      "name": "@anthropic/claude-mcp",
      "display_name": "Claude MCP",
      "description": "Official Claude MCP integration",
      "score": 0.95
    },
    {
      "name": "@community/claude-tools",
      "display_name": "Claude Tools",
      "description": "Community tools for Claude",
      "score": 0.72
    }
  ],
  "total": 2
}
```

### Search Behavior

The search matches against:
- Server name
- Display name
- Description
- Package names
- Tool names

Results are ranked by relevance score.

---

## Examples

### List All Servers by Recent Updates

```bash
curl "https://watch.mcpregistry.dev/api/v1/servers?sort=updated&order=desc&limit=20" \
  -H "X-API-Key: your-api-key"
```

### Get All Servers in a Namespace

```bash
curl "https://watch.mcpregistry.dev/api/v1/servers?namespace=@anthropic" \
  -H "X-API-Key: your-api-key"
```

### Search for AI-Related Servers

```bash
curl "https://watch.mcpregistry.dev/api/v1/servers/search?q=artificial+intelligence" \
  -H "X-API-Key: your-api-key"
```
