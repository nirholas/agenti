# Discord Setup Guide

Configure Discord webhook notifications for MCP Registry changes.

## Prerequisites

- A Discord server where you have **Manage Webhooks** permission
- An MCP Notify account or self-hosted instance

---

## Step 1: Create a Discord Webhook

1. Open your Discord server
2. Right-click the channel where you want notifications
3. Click **Edit Channel** → **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Give it a name like "MCP Watch"
6. Click **Copy Webhook URL**

Your webhook URL looks like:
```
https://discord.com/api/webhooks/1234567890/abcdefghijklmnop
```

> ⚠️ Keep this URL secret! Anyone with it can post to your channel.

---

## Step 2: Create a Subscription

### Via Dashboard

1. Go to **Subscriptions** → **New Subscription**
2. Enter a name like "MCP Discord Alerts"
3. Under **Channels**, click **Add Channel** → **Discord**
4. Paste your webhook URL
5. (Optional) Customize the bot username and avatar
6. Click **Create**

### Via API

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "MCP Discord Alerts",
    "channels": [{
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop",
        "username": "MCP Watch Bot",
        "avatar_url": "https://example.com/bot-avatar.png"
      }
    }]
  }'
```

### Via CLI

```bash
mcp-notify-cli subscriptions create \
  --name "MCP Discord Alerts" \
  --discord-webhook "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop"
```

---

## Step 3: Test the Integration

Send a test notification to verify it works:

```bash
mcp-notify-cli subscriptions test your-subscription-id
```

You should see a message appear in your Discord channel.

---

## Notification Format

Discord notifications use rich embeds:

```
🆕 New MCP Server: @anthropic/claude-tools
────────────────────────────────────────
Official Claude tools integration

Version: 1.0.0
Packages: npm • pypi
Repository: View on GitHub

MCP Notify • Just now
```

### Colors

| Change Type | Color | Emoji |
|-------------|-------|-------|
| New Server | 🟢 Green | 🆕 |
| Updated | 🔵 Blue | 📝 |
| Removed | 🔴 Red | 🗑️ |

---

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `webhook_url` | Discord webhook URL | Required |
| `username` | Bot display name | "MCP Notify" |
| `avatar_url` | Bot avatar image URL | Default avatar |

### Custom Bot Identity

```json
{
  "type": "discord",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "username": "My MCP Bot",
    "avatar_url": "https://your-site.com/bot-avatar.png"
  }
}
```

---

## Best Practices

### Use a Dedicated Channel

Create a channel like `#mcp-updates` specifically for notifications to avoid cluttering other channels.

### Set Up Filters

Don't subscribe to everything - use filters to reduce noise:

```json
{
  "filters": {
    "keywords": ["relevant", "topics"],
    "change_types": ["new"]
  }
}
```

### Multiple Webhooks

For different teams or topics, create separate subscriptions with different webhooks:

```json
[
  {
    "name": "AI Team Alerts",
    "filters": {"keywords": ["ai", "ml"]},
    "channels": [{"type": "discord", "config": {"webhook_url": "https://discord.com/api/webhooks/ai-team/..."}}]
  },
  {
    "name": "DevOps Alerts",
    "filters": {"keywords": ["deploy", "ci", "docker"]},
    "channels": [{"type": "discord", "config": {"webhook_url": "https://discord.com/api/webhooks/devops/..."}}]
  }
]
```

---

## Troubleshooting

### Notifications Not Appearing

1. **Check webhook URL** - Ensure it's correct and not expired
2. **Check permissions** - Bot needs permission to post in the channel
3. **Test the webhook** - Use the test endpoint to verify
4. **Check subscription status** - Ensure it's not paused

### Rate Limiting

Discord has rate limits (30 messages/minute). If you're getting many changes, consider:
- Using more specific filters
- Using email digests instead for high-volume alerts

### Webhook Deleted

If you delete the webhook in Discord, notifications will fail. Create a new webhook and update your subscription.

---

## Next Steps

- [Slack Setup](./slack-setup.md) - Add Slack notifications
- [Filter Strategies](./filter-strategies.md) - Reduce notification noise
- [Custom Webhooks](./custom-webhooks.md) - Build custom integrations
