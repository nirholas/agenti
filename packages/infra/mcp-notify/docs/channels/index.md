---
title: Notification Channels
description: All supported notification channels for MCP Notify
icon: material/bell
---

# Notification Channels

MCP Notify supports 7 notification channels to keep you informed about registry changes.

<div class="grid cards" markdown>

-   :fontawesome-brands-discord:{ .lg .middle } __Discord__

    ---

    Rich embeds with server details, version info, and direct links

    [:octicons-arrow-right-24: Setup Guide](discord.md)

-   :fontawesome-brands-slack:{ .lg .middle } __Slack__

    ---

    Interactive messages with Block Kit formatting

    [:octicons-arrow-right-24: Setup Guide](slack.md)

-   :material-email:{ .lg .middle } __Email__

    ---

    Immediate alerts or daily/weekly digest summaries

    [:octicons-arrow-right-24: Setup Guide](email.md)

-   :fontawesome-brands-telegram:{ .lg .middle } __Telegram__

    ---

    Bot notifications to channels or groups

    [:octicons-arrow-right-24: Setup Guide](telegram.md)

-   :fontawesome-brands-microsoft:{ .lg .middle } __Microsoft Teams__

    ---

    Adaptive Cards with full Teams integration

    [:octicons-arrow-right-24: Setup Guide](teams.md)

-   :material-webhook:{ .lg .middle } __Webhooks__

    ---

    Generic HTTP webhooks for custom integrations

    [:octicons-arrow-right-24: Setup Guide](webhooks.md)

-   :material-rss:{ .lg .middle } __RSS/Atom Feeds__

    ---

    Subscribe with any feed reader

    [:octicons-arrow-right-24: Setup Guide](rss.md)

</div>

## Channel Comparison

| Feature | Discord | Slack | Email | Telegram | Teams | Webhook | RSS |
|---------|:-------:|:-----:|:-----:|:--------:|:-----:|:-------:|:---:|
| Real-time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Digest mode | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Rich formatting | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Action buttons | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Custom styling | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| No server required | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |

## Rate Limits

All channels are subject to rate limiting to prevent abuse:

| Channel | Default Limit | Burst |
|---------|---------------|-------|
| Discord | 30/minute | 5 |
| Slack | 30/minute | 5 |
| Email | 10/minute | 2 |
| Telegram | 30/second | 10 |
| Teams | 30/minute | 5 |
| Webhook | 60/minute | 10 |
| RSS | N/A | N/A |

## Multiple Channels

You can add multiple channels to a single subscription:

```bash
curl -X POST http://localhost:8080/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Multi-Channel Alerts",
    "channels": [
      {
        "type": "discord",
        "config": { "webhook_url": "..." }
      },
      {
        "type": "email",
        "config": { "email": "...", "digest": "daily" }
      }
    ]
  }'
```

!!! tip "Best Practice"
    Use immediate notifications (Discord, Slack) for critical alerts and 
    email digests for daily summaries.
