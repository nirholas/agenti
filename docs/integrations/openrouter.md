# OpenRouter Integration

Guide for using Agenti with OpenRouter for multi-model AI access to blockchain tools.

## Overview

OpenRouter provides access to multiple AI models (Claude, GPT-4, Llama, Mistral, etc.) through a unified API. Agenti can be used with OpenRouter-powered applications to give any AI model crypto capabilities.

## Architecture

```
Your App -> OpenRouter API -> AI Model (Claude/GPT-4/etc.)
                                  |
                                  v
                            Agenti MCP Server
                                  |
                                  v
                          Blockchain / DeFi / Data
```

## Setup

### 1. Start Agenti

```bash
npx @nirholas/agenti --http
```

### 2. Configure Your Application

Use OpenRouter's API with tool/function calling:

```typescript
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Get Agenti's tool definitions
const toolsResponse = await fetch('http://localhost:3000/tools');
const { tools } = await toolsResponse.json();

// Convert to OpenAI function format
const functions = tools.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  },
}));

// Use with any model via OpenRouter
const response = await openrouter.chat.completions.create({
  model: 'anthropic/claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'What is the price of Bitcoin?' }],
  tools: functions,
});
```

### 3. Handle Tool Calls

```typescript
// When the model calls an Agenti tool
if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    const result = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        },
        id: 1,
      }),
    });

    const data = await result.json();
    // Feed result back to the model
  }
}
```

## Supported Models via OpenRouter

Any model with tool/function calling support works:

| Model | Provider | Tool Calling |
|-------|----------|-------------|
| Claude 4 Sonnet | Anthropic | Yes |
| Claude 4 Opus | Anthropic | Yes |
| GPT-4o | OpenAI | Yes |
| Llama 3.1 | Meta | Yes |
| Mistral Large | Mistral | Yes |
| Gemini Pro | Google | Yes |

## Benefits of OpenRouter + Agenti

- **Model flexibility** - Switch AI models without changing tool setup
- **Cost optimization** - Use cheaper models for simple queries
- **Fallback** - Automatic failover between AI providers
- **Unified billing** - Single API key for multiple models

## Environment Variables

```env
# OpenRouter
OPENROUTER_API_KEY=your_key

# Agenti
PRIVATE_KEY=0x...
PORT=3000
AUTH_TOKEN=your_token
```
