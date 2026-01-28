# Using Lyra Tool Discovery with OpenRouter

Lyra Tool Discovery is an AI-powered tool that discovers and analyzes MCP servers and plugins. It uses AI to determine the best integration approach for each discovered tool.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides access to 200+ AI models through a single API.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: specify model (defaults to anthropic/claude-sonnet-4)
export OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### 3. Use the CLI

```bash
npx @nirholas/lyra-tool-discovery discover https://github.com/some/mcp-server
```

## AI-Powered Features

| Feature | Description |
|---------|-------------|
| **Template Selection** | AI determines best plugin template |
| **Config Generation** | Auto-generate plugin configurations |
| **MCP Detection** | Identify MCP server capabilities |
| **Integration Analysis** | Recommend integration approach |

## Provider Support

Supports multiple AI providers:

- **OpenRouter** (200+ models)
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude)

Auto-detects based on available API keys. OpenRouter takes priority when `OPENROUTER_API_KEY` is set.

## Programmatic Usage

```typescript
import { AIAnalyzer } from '@nirholas/lyra-tool-discovery';

const analyzer = new AIAnalyzer({
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-sonnet-4'
});

const decision = await analyzer.analyzeAndDecide(discoveredTool);
console.log(decision.template); // 'mcp-http' | 'mcp-stdio' | etc.
```

## Resources

- [GitHub](https://github.com/nirholas/lyra-tool-discovery)
- [OpenRouter Docs](https://openrouter.ai/docs)
