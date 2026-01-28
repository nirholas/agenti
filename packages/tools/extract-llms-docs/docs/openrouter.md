# Using Extract LLMs Docs with OpenRouter

Extract LLMs Docs is a tool for extracting documentation from codebases in formats optimized for LLMs (llms.txt, llms-full.txt).

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models. The extracted docs work perfectly with any OpenRouter-powered AI.

## How It Works

1. **Extract** documentation from your codebase
2. **Feed** the extracted docs to your OpenRouter-powered AI
3. **Get** accurate, context-aware responses

## Usage

```bash
npx @nirholas/extract-llms-docs --input ./src --output ./llms.txt
```

## Using Extracted Docs with OpenRouter

```typescript
import OpenAI from 'openai';
import { readFileSync } from 'fs';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const docs = readFileSync('./llms.txt', 'utf-8');

const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4',
  messages: [
    { role: 'system', content: `Project documentation:\n${docs}` },
    { role: 'user', content: 'How do I use the authentication module?' }
  ]
});
```

## Resources

- [GitHub](https://github.com/nirholas/extract-llms-docs)
- [OpenRouter Docs](https://openrouter.ai/docs)
