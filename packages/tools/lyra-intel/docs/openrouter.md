# Using Lyra Intel with OpenRouter

Lyra Intel is an AI-powered code analysis tool that provides intelligent code review, bug detection, and refactoring suggestions. It supports OpenRouter for flexible model selection.

## What is OpenRouter?

[OpenRouter](https://openrouter.ai) provides unified access to 200+ AI models through a single API.

## Setup

### 1. Get Your OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Generate an API key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)

### 2. Configure

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: specify model
export OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### 3. Use

```python
from lyra_intel import AIAnalyzer, AIConfig

config = AIConfig(
    provider="openrouter",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="anthropic/claude-sonnet-4"
)

analyzer = AIAnalyzer(config)
result = await analyzer.analyze_code(code)
```

## AI Features

| Feature | Description |
|---------|-------------|
| **Code Review** | Comprehensive code analysis |
| **Bug Detection** | Find potential bugs and issues |
| **Security Scan** | Identify security vulnerabilities |
| **Refactoring** | Suggest code improvements |
| **Documentation** | Generate code documentation |
| **Test Generation** | Create test cases |

## Supported Providers

```python
from lyra_intel import OpenRouterProvider, get_provider

# Auto-select provider based on env vars
provider = get_provider(config)

# Or explicitly use OpenRouter
provider = OpenRouterProvider(config)
```

## Recommended Models for Code Analysis

| Model | Strength |
|-------|----------|
| `anthropic/claude-sonnet-4` | Best for complex code review |
| `openai/gpt-4o` | Great for security analysis |
| `deepseek/deepseek-coder` | Specialized for code |

## Resources

- [GitHub](https://github.com/nirholas/lyra-intel)
- [OpenRouter Docs](https://openrouter.ai/docs)
