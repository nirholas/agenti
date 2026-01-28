# Using GitHub-to-MCP with OpenRouter

GitHub-to-MCP automatically generates MCP servers from GitHub repositories. Use the generated servers with any OpenRouter-powered AI client.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models through a single API.

## How It Works

1. **Generate** an MCP server from any GitHub repo
2. **Connect** the server to your AI client
3. **Use** with any OpenRouter model

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Generate an MCP Server

```bash
npx @nirholas/github-to-mcp https://github.com/some/library -o ./my-mcp
```

### 3. Use with OpenRouter

Configure your AI client:

```json
{
  "modelProvider": {
    "type": "openrouter",
    "apiKey": "sk-or-v1-your-key-here"
  },
  "mcpServers": {
    "my-mcp": {
      "command": "node",
      "args": ["./my-mcp/dist/index.js"]
    }
  }
}
```

## Example

Generate an MCP server for the Stripe SDK:

```bash
npx @nirholas/github-to-mcp https://github.com/stripe/stripe-node
```

Now your AI can use Stripe's full API via MCP tools!

## AI-Enhanced Generation (Optional)

For smarter tool extraction, set an OpenRouter key:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx @nirholas/github-to-mcp https://github.com/some/repo --ai-enhanced
```

## Resources

- [GitHub](https://github.com/nirholas/github-to-mcp)
- [OpenRouter Docs](https://openrouter.ai/docs)
