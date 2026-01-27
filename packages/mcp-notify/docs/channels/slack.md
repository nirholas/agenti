---
title: Slack Notifications
description: Set up Slack webhook notifications for MCP Registry changes
icon: fontawesome/brands/slack
tags:
  - channels
  - slack
---

# Slack Notifications

Get Block Kit formatted notifications in your Slack workspace.

## Quick Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name it "MCP Watch" and select your workspace
4. Go to **Incoming Webhooks** → Enable it
5. Click **Add New Webhook to Workspace**
6. Select a channel and click **Allow**
7. Copy the webhook URL

### 2. Create Subscription

=== "CLI"

    ```bash
    mcp-notify-cli subscribe slack \
      --webhook-url "https://hooks.slack.com/services/T00/B00/xxx" \
      --name "MCP Registry Alerts"
    ```

=== "API"

    ```bash
    curl -X POST http://localhost:8080/api/v1/subscriptions \
      -H "Content-Type: application/json" \
      -d '{
        "name": "MCP Registry Alerts",
        "channels": [{
          "type": "slack",
          "config": {
            "webhook_url": "https://hooks.slack.com/services/T00/B00/xxx"
          }
        }]
      }'
    ```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `webhook_url` | string | ✅ | Slack webhook URL |
| `channel` | string | ❌ | Override default channel |
| `username` | string | ❌ | Custom bot username |
| `icon_emoji` | string | ❌ | Custom bot emoji |

### Full Example

```json
{
  "type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/...",
    "channel": "#mcp-alerts",
    "username": "MCP Watch",
    "icon_emoji": ":bell:"
  }
}
```

## Message Format

Slack notifications use Block Kit for rich formatting:

```
🆕 New MCP Server Added

*awesome-database-tool* has been added to the MCP Registry!

• Version: `1.2.0`
• Repository: github.com/example/awesome-database-tool
• License: MIT

[View in Registry] [View on GitHub]
```

## Rate Limits

- **30 requests per minute** per webhook
- Automatic retry with backoff

## Troubleshooting

??? question "Webhook not working?"

    1. Verify the URL starts with `https://hooks.slack.com/`
    2. Re-add the webhook to your workspace
    3. Check the app hasn't been uninstalled

??? question "Messages going to wrong channel?"

    Use the `channel` config option to override:
    
    ```json
    {
      "type": "slack",
      "config": {
        "webhook_url": "...",
        "channel": "#correct-channel"
      }
    }
    ```
