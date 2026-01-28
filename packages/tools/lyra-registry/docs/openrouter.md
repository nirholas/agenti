# Using Lyra Registry with OpenRouter

Lyra Registry is a curated registry of MCP servers and AI tools. Browse and discover tools to use with your OpenRouter-powered AI.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models through a single API.

## Using the Registry

### 1. Browse Tools

Visit the registry to discover MCP servers:
- [Lyra Registry](https://registry.lyra.finance)

### 2. Connect with Your AI

Use any discovered MCP server with your OpenRouter-powered AI client:

```json
{
  "modelProvider": {
    "type": "openrouter",
    "apiKey": "sk-or-v1-your-key-here"
  },
  "mcpServers": {
    "discovered-tool": {
      "command": "npx",
      "args": ["-y", "@discovered/mcp-server"]
    }
  }
}
```

## Features

| Feature | Description |
|---------|-------------|
| **Search** | Find MCP servers by category |
| **Install** | One-click install configurations |
| **Ratings** | Community ratings and reviews |
| **Updates** | Track new and updated tools |

## Resources

- [GitHub](https://github.com/nirholas/lyra-registry)
- [OpenRouter Docs](https://openrouter.ai/docs)
