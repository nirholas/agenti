# Using MCP Notify with OpenRouter

MCP Notify is a notification service for MCP servers, enabling AI agents to send alerts via various channels (email, Slack, Discord, webhooks).

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models. MCP Notify works with any OpenRouter-powered AI client.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Your AI Client

```json
{
  "modelProvider": {
    "type": "openrouter",
    "apiKey": "sk-or-v1-your-key-here"
  }
}
```

### 3. Add MCP Notify Server

```json
{
  "mcpServers": {
    "notify": {
      "command": "npx",
      "args": ["-y", "@nirholas/mcp-notify"],
      "env": {
        "SLACK_WEBHOOK_URL": "https://hooks.slack.com/...",
        "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/..."
      }
    }
  }
}
```

### 4. Start Using

Ask your AI:
- "Send a Slack message about the ETH price alert"
- "Notify me on Discord when the transaction completes"
- "Email me a summary of today's trades"

## Available Tools

| Tool | Description |
|------|-------------|
| `send_slack` | Send Slack messages |
| `send_discord` | Send Discord messages |
| `send_email` | Send emails |
| `send_webhook` | Generic webhook POST |

## Resources

- [GitHub](https://github.com/nirholas/mcp-notify)
- [OpenRouter Docs](https://openrouter.ai/docs)
