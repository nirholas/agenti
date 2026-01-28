# Using Agenti with OpenRouter

Agenti is a Universal MCP Server that provides 380+ blockchain/DeFi tools for AI agents. Since it's an MCP server, it works with any AI client that supports OpenRouter.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides a unified API to access 200+ AI models from Anthropic, OpenAI, Google, Meta, and more - all with a single API key.

## Setup with Claude Desktop + OpenRouter

### 1. Get Your OpenRouter API Key

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Add credits at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
3. Generate an API key

### 2. Configure Claude Desktop for OpenRouter

In your Claude Desktop settings, configure OpenRouter as your model provider:

```json
{
  "modelProvider": {
    "type": "openrouter",
    "apiKey": "sk-or-v1-your-key-here",
    "model": "anthropic/claude-sonnet-4"
  }
}
```

### 3. Add Agenti MCP Server

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["-y", "@nirholas/agenti"]
    }
  }
}
```

### 4. Start Using Blockchain Tools

Once configured, you can ask Claude (powered by any OpenRouter model) to:

- "What's the ETH balance of vitalik.eth?"
- "Get the current gas prices on Ethereum"
- "Analyze the security of this token: 0x..."
- "Show me the top DeFi protocols by TVL"

## Setup with Other AI Clients

### Cursor / VS Code with Continue

Configure your AI provider to use OpenRouter, then add the MCP server:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx", 
      "args": ["-y", "@nirholas/agenti"]
    }
  }
}
```

### Programmatic Usage

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import OpenAI from 'openai';

// Use OpenRouter for the AI
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Connect to Agenti MCP for blockchain tools
const mcp = new Client({ name: 'my-app' });
await mcp.connect(transport);

// Get available tools
const tools = await mcp.listTools();

// Use OpenRouter AI with Agenti's blockchain tools
const response = await openrouter.chat.completions.create({
  model: 'anthropic/claude-sonnet-4',
  messages: [{ role: 'user', content: 'Get ETH price' }],
  tools: tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema }
  }))
});
```

## Available Tools

Agenti provides 380+ tools across these categories:

| Category | Tools | Examples |
|----------|-------|----------|
| **Wallet** | 50+ | Balance checks, transaction history, ENS resolution |
| **DeFi** | 100+ | Uniswap, Aave, Compound, Curve operations |
| **NFT** | 40+ | Collection data, ownership, metadata |
| **Security** | 30+ | Token audits, contract verification, honeypot detection |
| **Market Data** | 60+ | Prices, charts, volume, sentiment |
| **Multi-chain** | 20+ networks | Ethereum, Base, Arbitrum, Polygon, Solana, etc. |

## Supported Networks

Works with 20+ networks including:
- Ethereum, Base, Arbitrum, Optimism, Polygon
- BNB Chain, Avalanche, Fantom
- Solana, NEAR, Cosmos
- And more...

## Environment Variables (Optional)

For enhanced features, you can set:

```bash
# For write operations (transactions)
PRIVATE_KEY=0x...

# For premium data APIs
COINGECKO_API_KEY=...
DEFILLAMA_API_KEY=...
```

## Resources

- [GitHub Repository](https://github.com/nirholas/agenti)
- [Full Documentation](https://agenti.dev)
- [MCP Protocol Spec](https://spec.modelcontextprotocol.io/)
- [OpenRouter Documentation](https://openrouter.ai/docs)

## Support

- [GitHub Issues](https://github.com/nirholas/agenti/issues)
- Twitter: [@nichxbt](https://x.com/nichxbt)
