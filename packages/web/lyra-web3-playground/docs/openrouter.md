# Using Lyra Web3 Playground with OpenRouter

Lyra Web3 Playground is an interactive platform for experimenting with Web3 technologies, smart contracts, and AI-assisted development. It supports OpenRouter for AI-powered features.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides access to 200+ AI models through a unified API.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure Environment

```bash
# Server-side
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
export OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Client-side (Vite)
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 3. Run

```bash
npm install
npm run dev
```

## AI Features

With OpenRouter configured:

| Feature | Description |
|---------|-------------|
| **Contract Generation** | AI-generated Solidity contracts |
| **Code Explanation** | Understand smart contract code |
| **Test Generation** | Auto-generate contract tests |
| **Security Analysis** | AI-powered vulnerability detection |

## Example Usage

### Generate a Smart Contract

```
Prompt: "Create an ERC-20 token with minting and burning"
```

The AI will generate a complete, audited Solidity contract using your chosen OpenRouter model.

### Explain Code

```
Prompt: "Explain what this reentrancy guard does"
```

Get detailed explanations of any smart contract code.

## Provider Priority

```
OpenRouter → OpenAI
```

When `OPENROUTER_API_KEY` is set, it takes priority over direct OpenAI.

## Recommended Models

| Model | Use Case |
|-------|----------|
| `anthropic/claude-sonnet-4` | Complex contracts |
| `openai/gpt-4o` | General development |
| `deepseek/deepseek-coder` | Code-focused tasks |

## Self-Hosting

```bash
git clone https://github.com/nirholas/lyra-web3-playground
cd lyra-web3-playground
npm install
echo "OPENROUTER_API_KEY=sk-or-v1-..." > .env
npm run build && npm start
```

## Resources

- [GitHub](https://github.com/nirholas/lyra-web3-playground)
- [Live Demo](https://playground.lyra.finance)
- [OpenRouter Docs](https://openrouter.ai/docs)
