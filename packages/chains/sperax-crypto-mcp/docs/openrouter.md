# Using Sperax Crypto MCP with OpenRouter

Sperax Crypto MCP is a Model Context Protocol server for interacting with the Sperax ecosystem and SPA/USDs tokens.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models. Works with any MCP-compatible AI client.

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

### 3. Add Sperax MCP Server

```json
{
  "mcpServers": {
    "sperax": {
      "command": "npx",
      "args": ["-y", "@nirholas/sperax-crypto-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_spa_price` | Get SPA token price |
| `get_usds_supply` | Get USDs supply |
| `get_yield_info` | Get USDs yield information |

## Resources

- [GitHub](https://github.com/nirholas/sperax-crypto-mcp)
- [Sperax](https://sperax.io)
- [OpenRouter Docs](https://openrouter.ai/docs)
