# Notification Channels

MCP Notify supports multiple notification channels to deliver alerts about MCP Registry changes. This guide covers configuration and best practices for each channel.

## Table of Contents

- [Discord](#discord)
- [Slack](#slack)
- [Email](#email)
- [Webhook](#webhook)
- [Telegram](#telegram)
- [Microsoft Teams](#microsoft-teams)
- [RSS Feed](#rss-feed)
- [Best Practices](#best-practices)

---

## Discord

Send rich embed notifications to Discord channels via webhooks.

### Setup

1. **Create Webhook in Discord:**
   - Open Server Settings → Integrations → Webhooks
   - Click "New Webhook"
   - Select the channel for notifications
   - Copy the webhook URL

2. **Configure in MCP Watch:**

```json
{
  "type": "discord",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/123456789/abcdefg..."
  }
}
```

### Message Format

![Discord notification example](../assets/discord-notification.png)

Discord notifications include:
- **Title**: Server name and change type
- **Color**: Green (new), blue (updated), red (removed)
- **Fields**: Version changes, description, repository link
- **Timestamp**: When the change was detected

### Advanced Options

```json
{
  "type": "discord",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/...",
    "username": "MCP Watch Bot",
    "avatar_url": "https://example.com/avatar.png",
    "thread_id": "123456789"
  }
}
```

| Option | Description |
|--------|-------------|
| `username` | Custom bot username (optional) |
| `avatar_url` | Custom bot avatar (optional) |
| `thread_id` | Post to specific thread (optional) |

---

## Slack

Send Block Kit formatted messages to Slack channels.

### Setup

1. **Create Incoming Webhook:**
   - Go to [Slack API Apps](https://api.slack.com/apps)
   - Create a new app or select existing
   - Go to "Incoming Webhooks" → Enable
   - Add New Webhook to Workspace
   - Select the channel
   - Copy the webhook URL

2. **Configure in MCP Watch:**

```json
{
  "type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T.../B.../xxx..."
  }
}
```

### Message Format

Slack notifications use Block Kit for rich formatting:

```
┌─────────────────────────────────────┐
│ 🆕 New MCP Server                   │
│                                     │
│ io.github.user/my-mcp-server        │
│                                     │
│ Description: A useful server for... │
│ Version: 1.0.0                      │
│                                     │
│ [View in Registry] [Repository]     │
└─────────────────────────────────────┘
```

### Advanced Options

```json
{
  "type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/...",
    "channel": "#mcp-updates",
    "username": "MCP Watch",
    "icon_emoji": ":robot_face:"
  }
}
```

---

## Email

Receive notifications via email with HTML formatting.

### Setup

1. **Configure in MCP Watch:**

```json
{
  "type": "email",
  "config": {
    "to": "user@example.com"
  }
}
```

2. **For Multiple Recipients:**

```json
{
  "type": "email",
  "config": {
    "to": ["user1@example.com", "user2@example.com"]
  }
}
```

### Message Format

Emails include:
- **Subject**: "[MCP Watch] New Server: io.github.user/my-server"
- **HTML Body**: Formatted with server details and links
- **Plain Text**: Fallback for text-only clients

### Digest Mode

Instead of immediate notifications, receive a digest:

```json
{
  "type": "email",
  "config": {
    "to": "user@example.com",
    "digest": "daily",
    "digest_time": "09:00"
  }
}
```

| Digest Option | Description |
|---------------|-------------|
| `immediate` | Send immediately (default) |
| `hourly` | Aggregate hourly |
| `daily` | Daily summary at specified time |
| `weekly` | Weekly summary on Monday |

### Email Preferences

```json
{
  "type": "email",
  "config": {
    "to": "user@example.com",
    "include_details": true,
    "include_diff": true,
    "format": "html"
  }
}
```

---

## Webhook

Send notifications to any HTTP endpoint.

### Setup

```json
{
  "type": "webhook",
  "config": {
    "url": "https://your-server.com/webhook",
    "method": "POST",
    "secret": "your-signing-secret"
  }
}
```

### Payload Format

```json
{
  "event": "server.updated",
  "timestamp": "2024-01-15T12:00:00Z",
  "change": {
    "id": "uuid",
    "server_name": "io.github.user/my-mcp-server",
    "change_type": "updated",
    "previous_version": "1.0.0",
    "new_version": "1.1.0",
    "field_changes": [
      {
        "field": "version_detail.version",
        "old_value": "1.0.0",
        "new_value": "1.1.0"
      }
    ]
  },
  "server": {
    "name": "io.github.user/my-mcp-server",
    "description": "A useful MCP server",
    "repository": {...},
    "version_detail": {...}
  },
  "subscription": {
    "id": "subscription-uuid",
    "name": "My Subscription"
  }
}
```

### Request Headers

```
Content-Type: application/json
User-Agent: MCP-Watch/1.0
X-Request-ID: uuid
X-Signature: sha256=abc123...
X-Timestamp: 1704067200
```

### Signature Verification

Verify webhook authenticity using HMAC-SHA256:

**Python:**
```python
import hmac
import hashlib

def verify(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

**Node.js:**
```javascript
const crypto = require('crypto');

function verify(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === `sha256=${expected}`;
}
```

**Go:**
```go
func Verify(payload, signature, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(payload))
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

### Advanced Options

```json
{
  "type": "webhook",
  "config": {
    "url": "https://your-server.com/webhook",
    "method": "POST",
    "secret": "your-secret",
    "headers": {
      "Authorization": "Bearer token123"
    },
    "timeout": 30,
    "retry_count": 5
  }
}
```

---

## Telegram

Send notifications to Telegram chats or channels.

### Setup

1. **Create a Bot:**
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Send `/newbot` and follow instructions
   - Copy the bot token

2. **Get Chat ID:**
   - Add your bot to a group/channel
   - Send a message to the group
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find your chat_id in the response

3. **Configure in MCP Watch:**

```json
{
  "type": "telegram",
  "config": {
    "bot_token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chat_id": "-1001234567890"
  }
}
```

### Message Format

```
🆕 New MCP Server

📦 io.github.user/my-mcp-server

📝 A useful server for data processing

📌 Version: 1.0.0

🔗 Repository | 📦 npm
```

### Advanced Options

```json
{
  "type": "telegram",
  "config": {
    "bot_token": "...",
    "chat_id": "-1001234567890",
    "parse_mode": "HTML",
    "disable_notification": false,
    "thread_id": 123
  }
}
```

---

## Microsoft Teams

Send Adaptive Cards to Microsoft Teams channels.

### Setup

1. **Create Incoming Webhook:**
   - In Teams, go to the channel
   - Click "..." → Connectors
   - Find "Incoming Webhook" → Configure
   - Name it and copy the URL

2. **Configure in MCP Watch:**

```json
{
  "type": "teams",
  "config": {
    "webhook_url": "https://outlook.office.com/webhook/..."
  }
}
```

### Card Format

Teams notifications use Adaptive Cards:

```
┌─────────────────────────────────────┐
│ [MCP Watch Icon]                    │
│                                     │
│ New MCP Server                      │
│ io.github.user/my-mcp-server        │
│                                     │
│ Version: 1.0.0                      │
│ Description: A useful server...     │
│                                     │
│ [View] [Repository] [NPM Package]   │
└─────────────────────────────────────┘
```

---

## RSS Feed

Subscribe to changes via RSS without creating an account.

### Endpoints

| Feed | URL |
|------|-----|
| All changes | `/api/v1/feeds/rss` |
| Filtered | `/api/v1/feeds/rss?namespace=io.github.*` |
| Atom format | `/api/v1/feeds/atom` |

### Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `namespace` | Filter by namespace glob | `io.github.*` |
| `keywords` | Comma-separated keywords | `ai,llm,gpt` |
| `types` | Change types to include | `new,updated` |
| `limit` | Number of items | `50` |

### Example Feed URL

```
https://watch.mcpregistry.dev/api/v1/feeds/rss?namespace=io.github.*&keywords=ai,automation&types=new,updated
```

### Using in Feed Readers

Add the feed URL to your preferred reader:
- **Feedly**: Click "+" → Paste URL
- **Inoreader**: Feeds → Add → Paste URL
- **Thunderbird**: File → Subscribe → Paste URL

---

## Best Practices

### 1. Use Specific Filters

Don't subscribe to all changes. Use filters to receive relevant updates:

```json
{
  "filters": {
    "namespaces": ["io.github.your-org/*"],
    "keywords": ["your-keyword"],
    "change_types": ["new", "updated"]
  }
}
```

### 2. Configure Multiple Channels

Set up redundant channels for critical subscriptions:

```json
{
  "channels": [
    {"type": "slack", "config": {...}},
    {"type": "email", "config": {...}}
  ]
}
```

### 3. Use Digests for Non-Urgent Updates

Reduce notification fatigue with digests:

```json
{
  "type": "email",
  "config": {
    "digest": "daily",
    "digest_time": "09:00"
  }
}
```

### 4. Secure Your Webhooks

Always configure and verify webhook signatures:

```json
{
  "type": "webhook",
  "config": {
    "url": "https://...",
    "secret": "strong-random-secret"
  }
}
```

### 5. Test Before Going Live

Use the test endpoint to verify your setup:

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions/{id}/test \
  -H "X-API-Key: your-key"
```

### 6. Monitor Delivery Status

Check notification status in the dashboard:

- Success rate per channel
- Failed deliveries
- Retry status

### 7. Handle Rate Limits

Each channel has specific rate limits:

| Channel | Rate Limit |
|---------|------------|
| Discord | 30/minute per webhook |
| Slack | 1/second per webhook |
| Telegram | 30/second per bot |
| Email | Varies by provider |

MCP Watch automatically handles rate limiting with queuing.

---

## Troubleshooting

### Discord

**Issue**: Webhook returns 401 Unauthorized
- **Fix**: Check if webhook URL is still valid in Discord settings

**Issue**: Messages not appearing
- **Fix**: Ensure bot has permission to post in channel

### Slack

**Issue**: "channel_not_found" error
- **Fix**: Re-add webhook to correct channel

**Issue**: Messages truncated
- **Fix**: Reduce message content or use attachment format

### Email

**Issue**: Emails going to spam
- **Fix**: Add sender to allowlist, check SPF/DKIM records

**Issue**: Not receiving emails
- **Fix**: Check spam folder, verify email address

### Webhook

**Issue**: Signature mismatch
- **Fix**: Ensure you're using raw body for verification

**Issue**: Timeout errors
- **Fix**: Increase timeout or optimize endpoint

### Telegram

**Issue**: "Chat not found" error
- **Fix**: Ensure bot is added to chat and has message permission

**Issue**: "Forbidden: bot is not a member"
- **Fix**: Add bot to channel as admin
