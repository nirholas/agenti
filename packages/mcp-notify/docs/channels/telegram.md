---
title: Telegram Notifications
description: Set up Telegram bot notifications for MCP Registry changes
icon: fontawesome/brands/telegram
tags:
  - channels
  - telegram
---

# Telegram Notifications

Send notifications to Telegram channels, groups, or direct messages.

## Quick Setup

### 1. Create a Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Chat ID

**For channels:**
1. Add your bot to the channel as admin
2. Send a message to the channel
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find the `chat.id` (negative number for channels)

**For groups:**
1. Add your bot to the group
2. Send a message in the group
3. Visit the getUpdates URL above
4. Find the `chat.id`

**For direct messages:**
1. Start a chat with your bot
2. Send any message
3. Visit the getUpdates URL
4. Find your `chat.id`

### 3. Create Subscription

=== "CLI"

    ```bash
    mcp-notify-cli subscribe telegram \
      --bot-token "123456789:ABCdefGHIjklMNOpqrsTUVwxyz" \
      --chat-id "-1001234567890" \
      --name "MCP Alerts"
    ```

=== "API"

    ```bash
    curl -X POST http://localhost:8080/api/v1/subscriptions \
      -H "Content-Type: application/json" \
      -d '{
        "name": "MCP Alerts",
        "channels": [{
          "type": "telegram",
          "config": {
            "bot_token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
            "chat_id": "-1001234567890"
          }
        }]
      }'
    ```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `bot_token` | string | ✅ | Telegram bot token from BotFather |
| `chat_id` | string | ✅ | Channel/group/user chat ID |
| `parse_mode` | string | ❌ | `MarkdownV2` (default) or `HTML` |
| `disable_preview` | boolean | ❌ | Disable link previews |

## Message Format

Messages use MarkdownV2 formatting:

```
🆕 *New MCP Server Added*

*awesome\-database\-tool* has been added to the MCP Registry\!

📦 Version: `1\.2\.0`
📝 Description: A database integration for AI assistants
🔗 [Repository](https://github.com/example/awesome-database-tool)

_Detected at 2026\-01\-05 10:30:00 UTC_
```

## Rate Limits

Telegram has strict rate limits:

- **30 messages per second** to the same chat
- **20 messages per minute** to the same group
- Automatic retry with exponential backoff

## Troubleshooting

??? question "Bot not sending messages?"

    1. Verify the bot token is correct
    2. Ensure the bot is added to the channel/group
    3. For channels: bot must be an admin
    4. Check the chat ID format (negative for channels)

??? question "Getting "Bad Request" errors?"

    Chat ID might be wrong. Re-fetch using:
    
    ```
    https://api.telegram.org/bot<TOKEN>/getUpdates
    ```

??? question "Messages not formatting correctly?"

    MarkdownV2 requires escaping special characters:
    `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`
