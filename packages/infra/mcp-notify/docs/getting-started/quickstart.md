---
title: Quick Start
description: Get your first MCP Registry notification in 5 minutes
icon: material/clock-fast
---

# Quick Start

Get your first notification in under 5 minutes!

## 1. Install the CLI

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest
```

## 2. Check Recent Changes

See what's been happening in the MCP Registry:

```bash
# View changes from the last 24 hours
mcp-notify-cli changes --since 24h

# View only new servers
mcp-notify-cli changes --type new

# Output as JSON
mcp-notify-cli changes --output json
```

## 3. Watch in Real-Time

Monitor changes as they happen:

```bash
mcp-notify-cli watch
```

!!! tip "Watch Mode"
    The watch command polls the registry every 5 minutes by default. 
    Use `--interval 1m` to poll more frequently.

## 4. Create Your First Subscription

=== ":material-discord: Discord"

    ```bash
    mcp-notify-cli subscribe discord \
      --webhook-url "https://discord.com/api/webhooks/YOUR_WEBHOOK" \
      --name "MCP Alerts"
    ```

=== ":material-slack: Slack"

    ```bash
    mcp-notify-cli subscribe slack \
      --webhook-url "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
      --name "MCP Alerts"
    ```

=== ":material-email: Email"

    ```bash
    mcp-notify-cli subscribe email \
      --email "you@example.com" \
      --name "MCP Daily Digest" \
      --digest daily
    ```

=== ":material-webhook: Webhook"

    ```bash
    mcp-notify-cli subscribe webhook \
      --url "https://your-server.com/webhook" \
      --name "My Integration"
    ```

## 5. Add Filters (Optional)

Get only the changes you care about:

```bash
mcp-notify-cli subscribe discord \
  --webhook-url "https://discord.com/api/webhooks/..." \
  --name "AI Tools Only" \
  --keywords "ai,llm,gpt,claude" \
  --change-types "new,updated"
```

## Example Output

When a new MCP server is added, you'll receive a notification like this:

<div class="result" markdown>

**🆕 New MCP Server: awesome-mcp-tool**

A new server has been added to the MCP Registry!

| Field | Value |
|-------|-------|
| **Name** | awesome-mcp-tool |
| **Version** | 1.0.0 |
| **Description** | An awesome tool for AI assistants |
| **Repository** | github.com/example/awesome-mcp-tool |

[View in Registry →](https://registry.modelcontextprotocol.io)

</div>

## What's Next?

<div class="grid cards" markdown>

-   :material-filter:{ .lg .middle } __Learn about filters__

    Create sophisticated filter rules

    [:octicons-arrow-right-24: Filtering Guide](first-subscription.md)

-   :material-bell:{ .lg .middle } __Explore channels__

    Set up Discord, Slack, Telegram, and more

    [:octicons-arrow-right-24: Notification Channels](../channels/index.md)

-   :material-api:{ .lg .middle } __Use the API__

    Build custom integrations

    [:octicons-arrow-right-24: API Reference](../api/index.md)

-   :material-robot:{ .lg .middle } __AI Integration__

    Add to Claude Desktop

    [:octicons-arrow-right-24: MCP Server Setup](../mcp-server/index.md)

</div>
