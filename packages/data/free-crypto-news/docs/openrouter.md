# Using Free Crypto News with OpenRouter

Free Crypto News is an AI-powered crypto news aggregator that supports OpenRouter as a provider for AI-powered features like summarization, sentiment analysis, and claim extraction.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides a unified API to access 200+ AI models from Anthropic, OpenAI, Google, Meta, and more - all with a single API key.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Environment

Set your OpenRouter API key:

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: specify a model (defaults to meta-llama/llama-3-8b-instruct)
export OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### 3. Run the App

```bash
npm install
npm run dev
```

## Features Using OpenRouter

When OpenRouter is configured, you get:

| Feature | Description |
|---------|-------------|
| **AI Summaries** | Automatic summarization of news articles |
| **Sentiment Analysis** | AI-powered sentiment scoring of news |
| **Claim Extraction** | Extract and verify claims from articles |
| **Event Classification** | Categorize news by event type |
| **AI Debates** | Generate contrasting viewpoints on topics |

## Provider Priority

The app auto-detects available providers in this order:

1. **Groq** - If `GROQ_API_KEY` is set
2. **OpenAI** - If `OPENAI_API_KEY` is set
3. **Anthropic** - If `ANTHROPIC_API_KEY` is set
4. **OpenRouter** - If `OPENROUTER_API_KEY` is set

To force OpenRouter, only set the `OPENROUTER_API_KEY`.

## Recommended Models

For news analysis, we recommend:

| Model | Use Case |
|-------|----------|
| `anthropic/claude-sonnet-4` | Best quality analysis |
| `meta-llama/llama-3-70b-instruct` | Good balance of speed/quality |
| `meta-llama/llama-3-8b-instruct` | Fast, cost-effective (default) |
| `google/gemini-pro` | Alternative high-quality option |

## API Endpoints

The following endpoints use AI when available:

```
GET /api/ai/brief - AI-generated news briefing
GET /api/ai/debate - AI debate on a topic
POST /api/ai/counter - Counter-argument generation
POST /api/ai - General AI analysis
```

## Self-Hosting

```bash
git clone https://github.com/nirholas/free-crypto-news
cd free-crypto-news
npm install

# Set your OpenRouter key
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env.local

npm run build
npm start
```

## Resources

- [GitHub Repository](https://github.com/nirholas/free-crypto-news)
- [Live Demo](https://news.lyra.finance)
- [OpenRouter Documentation](https://openrouter.ai/docs)

## Support

- [GitHub Issues](https://github.com/nirholas/free-crypto-news/issues)
- Twitter: [@nichxbt](https://x.com/nichxbt)
