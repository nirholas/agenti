# Using Binance.US MCP with OpenRouter

Binance.US MCP is a Model Context Protocol server for the Binance.US exchange, designed for US-based traders.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models. Use it with any MCP-compatible AI client.

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

### 3. Add Binance.US MCP Server

```json
{
  "mcpServers": {
    "binance-us": {
      "command": "npx",
      "args": ["-y", "@nirholas/binance-us-mcp"],
      "env": {
        "BINANCE_US_API_KEY": "your-api-key",
        "BINANCE_US_SECRET_KEY": "your-secret"
      }
    }
  }
}
```

### 4. Start Using

Ask your AI about Binance.US markets, prices, and trading.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_price` | Current price for trading pairs |
| `get_orderbook` | Order book data |
| `get_balances` | Account balances |
| `place_order` | Place orders |
| `get_trades` | Trade history |

## Resources

- [GitHub](https://github.com/nirholas/binance-us-mcp)
- [Binance.US API](https://docs.binance.us/)
- [OpenRouter Docs](https://openrouter.ai/docs)
