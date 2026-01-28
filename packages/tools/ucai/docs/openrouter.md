# Using UCAI with OpenRouter

UCAI (Universal Crypto AI) is an AI-powered crypto assistant that works with OpenRouter for flexible model selection.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models through a single API.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
export OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### 3. Run

```bash
npx @nirholas/ucai
```

## Features

- Real-time crypto prices
- Portfolio tracking
- DeFi analytics
- News aggregation
- AI-powered insights

## Resources

- [GitHub](https://github.com/nirholas/ucai)
- [OpenRouter Docs](https://openrouter.ai/docs)
