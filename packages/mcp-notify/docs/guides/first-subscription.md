# Your First Subscription

Learn how to create a subscription that matches your needs.

## Understanding Subscriptions

A subscription defines:
1. **Filters** - Which changes you care about
2. **Channels** - How you want to be notified

## Creating via Web Dashboard

1. Go to `https://watch.mcpregistry.dev/dashboard`
2. Click **"New Subscription"**
3. Fill in the form:
   - **Name**: Give it a descriptive name
   - **Filters**: Choose what to track
   - **Channels**: Add notification methods
4. Click **"Create"**

---

## Creating via API

### Basic Subscription (All Changes)

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "All MCP Changes",
    "channels": [{
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/123/abc"
      }
    }]
  }'
```

### Filtered Subscription

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "AI Tool Updates",
    "description": "Track AI and ML related MCP servers",
    "filters": {
      "keywords": ["ai", "ml", "llm", "gpt", "claude"],
      "change_types": ["new", "updated"]
    },
    "channels": [{
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/123/abc"
      }
    }]
  }'
```

---

## Creating via CLI

```bash
# Simple subscription
mcp-notify-cli subscriptions create \
  --name "My Alerts" \
  --discord-webhook "https://discord.com/api/webhooks/..."

# With filters
mcp-notify-cli subscriptions create \
  --name "AI Updates" \
  --keywords "ai,ml,llm" \
  --change-types "new,updated" \
  --discord-webhook "https://discord.com/api/webhooks/..."
```

---

## Filter Examples

### Track Specific Organization

```json
{
  "filters": {
    "namespaces": ["@anthropic", "@openai"]
  }
}
```

### New Servers Only

```json
{
  "filters": {
    "change_types": ["new"]
  }
}
```

### Keyword Matching

```json
{
  "filters": {
    "keywords": ["database", "sql", "postgres"]
  }
}
```

### Combined Filters

Filters use AND logic between categories, OR within:

```json
{
  "filters": {
    "namespaces": ["@anthropic", "@openai"],
    "keywords": ["chat", "assistant"],
    "change_types": ["new", "updated"]
  }
}
```

This matches:
- New OR updated servers
- From @anthropic OR @openai
- Containing "chat" OR "assistant"

---

## Multiple Channels

Send to multiple destinations:

```json
{
  "name": "Multi-Channel Alerts",
  "channels": [
    {
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/..."
      }
    },
    {
      "type": "slack",
      "config": {
        "webhook_url": "https://hooks.slack.com/services/..."
      }
    },
    {
      "type": "email",
      "config": {
        "email": "team@example.com",
        "digest": "hourly"
      }
    }
  ]
}
```

---

## Testing Your Subscription

After creating, send a test notification:

```bash
curl -X POST "https://watch.mcpregistry.dev/api/v1/subscriptions/{id}/test" \
  -H "X-API-Key: your-api-key"
```

Or via CLI:

```bash
mcp-notify-cli subscriptions test my-subscription-id
```

---

## Managing Subscriptions

### List All

```bash
mcp-notify-cli subscriptions list
```

### Pause

```bash
mcp-notify-cli subscriptions pause my-subscription-id
```

### Resume

```bash
mcp-notify-cli subscriptions resume my-subscription-id
```

### Delete

```bash
mcp-notify-cli subscriptions delete my-subscription-id
```

---

## Next Steps

- [Discord Setup](./discord-setup.md) - Detailed Discord configuration
- [Filter Strategies](./filter-strategies.md) - Advanced filtering
- [Custom Webhooks](./custom-webhooks.md) - Build integrations
