# MCP Notify

## Never Miss an MCP Update Again

Stay informed about changes to the Model Context Protocol registry. Get instant notifications when new servers are added, existing ones are updated, or servers are removed.

### Why MCP Watch?

The MCP ecosystem is growing rapidly. New servers, tools, and integrations are being published every day. Keeping track of changes manually is impossible.

**MCP Notify** monitors the official MCP Registry and delivers notifications through your preferred channels — Discord, Slack, email, webhooks, Telegram, or Microsoft Teams.

### Get Started in Minutes

```bash
# Quick start with Docker
docker run -d -p 8080:8080 ghcr.io/nirholas/mcp-notify
```

Or use our hosted service at [watch.mcpregistry.dev](https://watch.mcpregistry.dev)

---

## Key Features

### 🔔 Multi-Channel Notifications

Receive alerts where you work:

- **Discord** — Rich embed messages in your server
- **Slack** — Block Kit formatted notifications
- **Email** — HTML and digest options
- **Webhooks** — Integrate with any system
- **Telegram** — Bot notifications to channels
- **Microsoft Teams** — Adaptive Cards

### 🎯 Smart Filtering

Don't get overwhelmed. Subscribe only to what matters:

- Filter by **namespace** (e.g., `io.github.myorg/*`)
- Filter by **keywords** in names and descriptions
- Filter by **change type** (new, updated, removed)
- Combine filters for precise targeting

### ⚡ Real-Time Detection

Changes are detected within minutes:

- Polls the registry every 5 minutes
- Compares complete snapshots
- Tracks field-level changes
- Provides full change history

### 📊 Beautiful Dashboard

Monitor everything from one place:

- View live change feed
- Manage subscriptions
- Browse registry servers
- Export change reports

### 🔒 Secure & Reliable

Built for production:

- API key authentication
- Webhook signature verification
- Rate limiting per key
- Retry with exponential backoff
- Dead letter queue for failures
