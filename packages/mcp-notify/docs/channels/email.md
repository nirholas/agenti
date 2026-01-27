---
title: Email Notifications
description: Set up email notifications with digest support
icon: material/email
tags:
  - channels
  - email
---

# Email Notifications

Receive email notifications with support for immediate alerts or digest summaries.

## Quick Setup

=== "CLI"

    ```bash
    # Immediate notifications
    mcp-notify-cli subscribe email \
      --email "you@example.com" \
      --name "MCP Alerts"
    
    # Daily digest
    mcp-notify-cli subscribe email \
      --email "you@example.com" \
      --name "MCP Daily Digest" \
      --digest daily
    ```

=== "API"

    ```bash
    curl -X POST http://localhost:8080/api/v1/subscriptions \
      -H "Content-Type: application/json" \
      -d '{
        "name": "MCP Daily Digest",
        "channels": [{
          "type": "email",
          "config": {
            "email": "you@example.com",
            "digest": "daily"
          }
        }]
      }'
    ```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `email` | string | ✅ | Recipient email address |
| `digest` | string | ❌ | Digest frequency (see below) |

### Digest Options

| Value | Description |
|-------|-------------|
| `immediate` | Send each change as it happens (default) |
| `hourly` | Batch changes every hour |
| `daily` | Daily summary at 9 AM UTC |
| `weekly` | Weekly summary on Mondays at 9 AM UTC |

## Server Configuration

Email requires SMTP configuration on the server:

```yaml
# config.yaml
notifications:
  email:
    enabled: true
    smtp:
      host: "smtp.example.com"
      port: 587
      username: "notifications@example.com"
      password: "${SMTP_PASSWORD}"
      from: "MCP Watch <notifications@example.com>"
      tls: true
```

### Environment Variables

```bash
export MCP_WATCH_SMTP_HOST="smtp.gmail.com"
export MCP_WATCH_SMTP_PORT="587"
export MCP_WATCH_SMTP_USERNAME="you@gmail.com"
export MCP_WATCH_SMTP_PASSWORD="app-password"
```

## Email Format

### Immediate Notification

```
Subject: 🆕 New MCP Server: awesome-database-tool

A new MCP server has been added to the registry!

Server: awesome-database-tool
Version: 1.2.0
Description: A database integration for AI assistants
Repository: https://github.com/example/awesome-database-tool

---
You're receiving this because you subscribed to MCP Notify.
Unsubscribe: https://...
```

### Daily Digest

```
Subject: 📋 MCP Registry Daily Digest - Jan 5, 2026

Here's what changed in the MCP Registry today:

NEW SERVERS (3)
• awesome-database-tool (v1.2.0)
• another-new-server (v0.1.0)
• cool-integration (v2.0.0)

UPDATED SERVERS (5)
• popular-tool: v1.0.0 → v1.1.0
• another-tool: v2.3.0 → v2.4.0
...

---
MCP Notify Daily Digest
Unsubscribe: https://...
```

## Troubleshooting

??? question "Not receiving emails?"

    1. Check spam/junk folder
    2. Verify SMTP configuration
    3. Check server logs for SMTP errors
    4. Test with: `mcp-notify-cli subscriptions test <id>`

??? question "Gmail not working?"

    Use an App Password:
    
    1. Enable 2FA on your Google account
    2. Go to Security → App passwords
    3. Generate a password for "Mail"
    4. Use that instead of your regular password
