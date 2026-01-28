# Using AI Agents Library with OpenRouter

AI Agents Library is a curated collection of AI agent frameworks, tools, and resources. Use it to discover and build agents powered by OpenRouter.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models - perfect for building flexible AI agents.

## Why OpenRouter for AI Agents?

| Benefit | Description |
|---------|-------------|
| **Model Variety** | Access Claude, GPT-4, Llama, and more |
| **Cost Control** | Route to cheaper models when appropriate |
| **No Lock-in** | Switch providers without code changes |
| **Failover** | Automatic fallback if a provider is down |

## Getting Started

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Browse Agent Frameworks

Explore the library to find agent frameworks that support OpenRouter:
- [AI Agents Library](https://agents.lyra.finance)

### 3. Build Your Agent

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Use with any agent framework
```

## Featured Frameworks

| Framework | OpenRouter Support |
|-----------|-------------------|
| LangChain | ✅ Native support |
| AutoGPT | ✅ Via OpenAI compatibility |
| CrewAI | ✅ Via LiteLLM |
| Semantic Kernel | ✅ Custom connector |

## Resources

- [GitHub](https://github.com/nirholas/ai-agents-library)
- [OpenRouter Docs](https://openrouter.ai/docs)
