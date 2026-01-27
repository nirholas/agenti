---
title: MCP Server Tools Reference
description: Complete reference for MCP Notify tools
icon: material/tools
---

# Tools Reference

Complete reference for tools provided by the `mcp-notify-mcp` server.

## search_servers

Search for MCP servers by name or description.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Search query (name or description) |
| `limit` | integer | ❌ | Maximum results (default: 10) |

### Example

```json
{
  "name": "search_servers",
  "arguments": {
    "query": "database",
    "limit": 5
  }
}
```

### Response

```json
{
  "servers": [
    {
      "name": "postgres",
      "description": "PostgreSQL database integration",
      "version": "1.0.0",
      "repository_url": "https://github.com/..."
    }
  ],
  "total": 5
}
```

---

## get_server

Get detailed information about a specific MCP server.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | ✅ | Server name |

### Example

```json
{
  "name": "get_server",
  "arguments": {
    "name": "filesystem"
  }
}
```

### Response

```json
{
  "name": "filesystem",
  "description": "Basic file system operations",
  "version": "1.2.0",
  "repository": {
    "url": "https://github.com/modelcontextprotocol/servers",
    "stars": 1234,
    "forks": 56
  },
  "license": "MIT",
  "links": {
    "homepage": "https://...",
    "documentation": "https://..."
  }
}
```

---

## list_servers

List all servers in the MCP Registry.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | ❌ | Maximum results (default: 50) |
| `offset` | integer | ❌ | Pagination offset (default: 0) |

### Example

```json
{
  "name": "list_servers",
  "arguments": {
    "limit": 20,
    "offset": 0
  }
}
```

### Response

```json
{
  "servers": [...],
  "total": 127,
  "limit": 20,
  "offset": 0
}
```

---

## get_stats

Get MCP Registry statistics.

### Parameters

None.

### Example

```json
{
  "name": "get_stats",
  "arguments": {}
}
```

### Response

```json
{
  "total_servers": 127,
  "changes_today": 5,
  "changes_this_week": 23,
  "new_servers_this_week": 8,
  "most_active_categories": [
    "database",
    "filesystem",
    "api"
  ]
}
```
