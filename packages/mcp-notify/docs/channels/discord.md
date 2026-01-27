---
title: Discord Notifications
description: Set up Discord webhook notifications for MCP Registry changes
icon: fontawesome/brands/discord
tags:
  - channels
  - discord
---

# Discord Notifications

Get rich embed notifications in your Discord server when MCP Registry changes occur.

## Quick Setup

### 1. Create a Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Choose a channel and copy the webhook URL

![Discord Webhook Setup](../assets/discord-webhook.png){ loading=lazy }

### 2. Create Subscription

=== "CLI"

    ```bash
    mcp-notify-cli subscribe discord \
      --webhook-url "https://discord.com/api/webhooks/1234567890/abcdefg" \
      --name "MCP Registry Alerts"
    ```

=== "API"

    ```bash
    curl -X POST http://localhost:8080/api/v1/subscriptions \
      -H "Content-Type: application/json" \
      -d '{
        "name": "MCP Registry Alerts",
        "channels": [{
          "type": "discord",
          "config": {
            "webhook_url": "https://discord.com/api/webhooks/1234567890/abcdefg"
          }
        }]
      }'
    ```

=== "Dashboard"

    1. Go to **Subscriptions** → **New Subscription**
    2. Select **Discord** as the channel
    3. Paste your webhook URL
    4. Click **Create**

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `webhook_url` | string | ✅ | Discord webhook URL |
| `username` | string | ❌ | Custom bot username |
| `avatar_url` | string | ❌ | Custom bot avatar URL |
| `thread_id` | string | ❌ | Post to a specific thread |

### Full Example

```json
{
  "type": "discord",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "username": "MCP Watch Bot",
    "avatar_url": "https://example.com/bot-avatar.png"
  }
}
```

## Message Format

Discord notifications use rich embeds:

<div class="result" markdown>

**🆕 New MCP Server Added**

**awesome-database-tool** has been added to the MCP Registry!

| Field | Value |
|-------|-------|
| Version | `1.2.0` |
| Repository | [github.com/example/awesome-database-tool](https://github.com) |
| License | MIT |

*Detected at 2026-01-05 10:30:00 UTC*

</div>

### Embed Colors

| Change Type | Color |
|-------------|-------|
| New server | 🟢 Green (#22c55e) |
| Updated server | 🔵 Blue (#3b82f6) |
| Removed server | 🔴 Red (#ef4444) |

## Rate Limits

Discord webhooks have the following limits:

- **30 requests per minute** per webhook
- **5 request burst** allowed
- Automatic retry with exponential backoff

!!! warning "Webhook Limits"
    Discord may rate-limit or disable webhooks that exceed limits.
    MCP Notify automatically throttles to stay within limits.

## Troubleshooting

??? question "Notifications not appearing?"

    1. Verify the webhook URL is correct
    2. Check the webhook hasn't been deleted
    3. Ensure the bot has permission to post in the channel
    4. Test with: `mcp-notify-cli subscriptions test <id>`

??? question "Getting rate limited?"

    Add filters to reduce notification volume:
    
    ```bash
    mcp-notify-cli subscribe discord \
      --webhook-url "..." \
      --change-types "new"  # Only new servers
    ```

??? question "Embed not formatting correctly?"

    Discord embed limits:
    
    - Title: 256 characters
    - Description: 4096 characters
    - Fields: 25 max
    - Total embed size: 6000 characters

## Next Steps

- [Add filters to your subscription →](../getting-started/first-subscription.md)
- [Set up additional channels →](index.md)
