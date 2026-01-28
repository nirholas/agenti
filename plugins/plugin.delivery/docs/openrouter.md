# Using Plugin.Delivery with OpenRouter

Plugin.Delivery is a platform for distributing and discovering AI plugins and MCP servers. All plugins work with OpenRouter-powered AI clients.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models through a single API.

## Using Plugins with OpenRouter

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

### 3. Install Plugins

Browse [plugin.delivery](https://plugin.delivery) and install plugins:

```json
{
  "mcpServers": {
    "plugin-name": {
      "command": "npx",
      "args": ["-y", "@plugin/mcp-server"]
    }
  }
}
```

## Plugin Categories

| Category | Description |
|----------|-------------|
| **DeFi** | Blockchain and DeFi tools |
| **Data** | Market data and analytics |
| **Social** | Social media integrations |
| **Dev Tools** | Development utilities |
| **Productivity** | Workflow automation |

## Publishing Plugins

Share your MCP server on Plugin.Delivery:

1. Create your MCP server
2. Add OpenRouter documentation
3. Submit to the registry

## Resources

- [Plugin.Delivery](https://plugin.delivery)
- [GitHub](https://github.com/nirholas/plugin-delivery)
- [OpenRouter Docs](https://openrouter.ai/docs)
