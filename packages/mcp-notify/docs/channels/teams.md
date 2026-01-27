---
title: Microsoft Teams Notifications
description: Set up Microsoft Teams notifications with Adaptive Cards
icon: fontawesome/brands/microsoft
tags:
  - channels
  - teams
---

# Microsoft Teams Notifications

Send rich Adaptive Card notifications to Microsoft Teams channels.

## Quick Setup

### 1. Create an Incoming Webhook

1. In Teams, go to the channel you want notifications in
2. Click **⋯** (More options) → **Connectors**
3. Find **Incoming Webhook** and click **Configure**
4. Name it "MCP Watch" and optionally upload an image
5. Click **Create** and copy the webhook URL

### 2. Create Subscription

=== "CLI"

    ```bash
    mcp-notify-cli subscribe teams \
      --webhook-url "https://outlook.office.com/webhook/..." \
      --name "MCP Alerts"
    ```

=== "API"

    ```bash
    curl -X POST http://localhost:8080/api/v1/subscriptions \
      -H "Content-Type: application/json" \
      -d '{
        "name": "MCP Alerts",
        "channels": [{
          "type": "teams",
          "config": {
            "webhook_url": "https://outlook.office.com/webhook/..."
          }
        }]
      }'
    ```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `webhook_url` | string | ✅ | Teams incoming webhook URL |

## Message Format

Teams notifications use Adaptive Cards:

```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "type": "AdaptiveCard",
      "version": "1.4",
      "body": [
        {
          "type": "TextBlock",
          "size": "Large",
          "weight": "Bolder",
          "text": "🆕 New MCP Server Added"
        },
        {
          "type": "FactSet",
          "facts": [
            { "title": "Server", "value": "awesome-database-tool" },
            { "title": "Version", "value": "1.2.0" },
            { "title": "License", "value": "MIT" }
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "View in Registry",
          "url": "https://registry.modelcontextprotocol.io"
        }
      ]
    }
  }]
}
```

## Rate Limits

- **30 messages per minute** per webhook
- Automatic retry with backoff

## Troubleshooting

??? question "Webhook not working?"

    1. Verify URL starts with `https://outlook.office.com/webhook/`
    2. Check the connector hasn't been removed
    3. Ensure you have permission to add connectors

??? question "Cards not rendering?"

    Teams has Adaptive Card limitations:
    
    - Maximum card size: 28 KB
    - Use version 1.4 or lower for compatibility
