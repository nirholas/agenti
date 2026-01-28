# Using Universal Crypto MCP with OpenRouter

Universal Crypto MCP is a comprehensive MCP server for cryptocurrency operations across multiple blockchains and protocols.

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

### 3. Add Universal Crypto MCP Server

```json
{
  "mcpServers": {
    "universal-crypto": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp"]
    }
  }
}
```

## Available Tools

Comprehensive crypto operations including:
- Multi-chain balance checks
- Token swaps
- DeFi protocols
- NFT operations
- Security analysis

## Resources

- [GitHub](https://github.com/nirholas/universal-crypto-mcp)
- [OpenRouter Docs](https://openrouter.ai/docs)
