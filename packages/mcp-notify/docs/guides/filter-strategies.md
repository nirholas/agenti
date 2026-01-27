# Filter Strategies

Master subscription filtering to get exactly the notifications you need.

## How Filters Work

Filters determine which changes trigger notifications:

- **No filters** = All changes
- **Multiple filter types** = AND logic between types
- **Multiple values in a type** = OR logic within type

---

## Filter Types

### Namespaces

Match servers by organization/namespace prefix:

```json
{
  "filters": {
    "namespaces": ["@anthropic", "@openai", "@google"]
  }
}
```

**Matching:**
- ✅ `@anthropic/claude-mcp`
- ✅ `@openai/gpt-tools`
- ❌ `@community/my-tool`

**Wildcard support:**
```json
{
  "filters": {
    "namespaces": ["@anthropic/*", "@*/official"]
  }
}
```

### Keywords

Match against server name, description, and tool names:

```json
{
  "filters": {
    "keywords": ["database", "sql", "postgres", "mysql"]
  }
}
```

**Matching:**
- ✅ Server named "postgres-mcp"
- ✅ Server with description "SQL database tools"
- ✅ Server with tool named "query_database"
- ❌ Server with no database-related content

**Case-insensitive:**
- `"Database"` matches `"database"`, `"DATABASE"`, `"DataBase"`

### Change Types

Filter by the type of change:

```json
{
  "filters": {
    "change_types": ["new", "updated"]
  }
}
```

| Type | Description |
|------|-------------|
| `new` | Server added to registry |
| `updated` | Server metadata changed |
| `removed` | Server removed from registry |

---

## Common Patterns

### Track New Servers Only

Get notified about new additions without update noise:

```json
{
  "name": "New Servers Alert",
  "filters": {
    "change_types": ["new"]
  }
}
```

### Track Specific Organization

Follow a company's MCP ecosystem:

```json
{
  "name": "Anthropic Tracker",
  "filters": {
    "namespaces": ["@anthropic"]
  }
}
```

### Topic-Based Alerts

Track a technology area:

```json
{
  "name": "AI/ML Tools",
  "filters": {
    "keywords": [
      "ai", "ml", "machine learning",
      "llm", "gpt", "claude", "gemini",
      "embedding", "vector", "neural"
    ]
  }
}
```

### Critical Updates Only

Only get notified for important changes:

```json
{
  "name": "Critical Only",
  "filters": {
    "namespaces": ["@anthropic", "@openai"],
    "change_types": ["updated", "removed"]
  }
}
```

### Development Stack

Track servers relevant to your tech stack:

```json
{
  "name": "Node.js Ecosystem",
  "filters": {
    "keywords": [
      "node", "nodejs", "npm", "javascript", "typescript",
      "express", "fastify", "nest"
    ]
  }
}
```

---

## Multiple Subscriptions Strategy

Create focused subscriptions instead of one broad one:

### By Priority

```json
// High priority - immediate Discord
{
  "name": "Critical: Official Providers",
  "filters": {
    "namespaces": ["@anthropic", "@openai"]
  },
  "channels": [{"type": "discord", "config": {...}}]
}

// Medium priority - Slack
{
  "name": "Watchlist: Interesting Tools",
  "filters": {
    "keywords": ["database", "api", "auth"]
  },
  "channels": [{"type": "slack", "config": {...}}]
}

// Low priority - daily email digest
{
  "name": "FYI: All Changes",
  "filters": {},
  "channels": [{"type": "email", "config": {"digest": "daily"}}]
}
```

### By Team

```json
// Frontend team
{
  "name": "Frontend Updates",
  "filters": {
    "keywords": ["react", "vue", "frontend", "ui", "component"]
  },
  "channels": [{"type": "slack", "config": {"webhook_url": "https://hooks.slack.com/frontend"}}]
}

// Backend team
{
  "name": "Backend Updates",
  "filters": {
    "keywords": ["api", "database", "auth", "server", "backend"]
  },
  "channels": [{"type": "slack", "config": {"webhook_url": "https://hooks.slack.com/backend"}}]
}
```

---

## Combining Filters

### AND Logic Between Types

```json
{
  "filters": {
    "namespaces": ["@anthropic"],  // AND
    "keywords": ["tools"],          // AND
    "change_types": ["new"]         // = All three must match
  }
}
```

Matches: New servers from @anthropic containing "tools"

### OR Logic Within Types

```json
{
  "filters": {
    "keywords": ["database", "sql", "postgres"]  // Any of these
  }
}
```

Matches: Servers containing "database" OR "sql" OR "postgres"

---

## Testing Filters

### Check What Would Match

Use the CLI to test filters against recent changes:

```bash
# See all changes first
mcp-notify-cli changes list --limit 100 --output json > all-changes.json

# Then filter locally
cat all-changes.json | jq '.changes[] | select(.server_name | contains("anthropic"))'
```

### Send Test Notification

After creating subscription, test it:

```bash
mcp-notify-cli subscriptions test your-subscription-id
```

---

## Anti-Patterns to Avoid

### ❌ Too Broad

```json
{
  "filters": {}  // Gets EVERYTHING
}
```

Better: Use at least one filter or email digest for catch-all.

### ❌ Too Narrow

```json
{
  "filters": {
    "namespaces": ["@very-specific-org"],
    "keywords": ["very-specific-term"],
    "change_types": ["removed"]
  }
}
```

May never trigger. Start broader and narrow down.

### ❌ Duplicate Coverage

Multiple subscriptions matching the same changes = duplicate notifications.

Better: Design non-overlapping subscriptions or use multiple channels in one subscription.

---

## Next Steps

- [Discord Setup](./discord-setup.md) - Configure Discord notifications
- [Custom Webhooks](./custom-webhooks.md) - Build integrations
- [CLI Usage](./cli-usage.md) - Power user workflows
