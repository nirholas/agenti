# AI Providers

Lyra Tool Discovery uses AI to analyze discovered tools and select the best plugin template. It supports both OpenAI and Anthropic as AI providers.

## Supported Providers

### OpenAI

| Model | Description | Cost |
|-------|-------------|------|
| `gpt-4o` | Latest GPT-4 Omni (default) | $$ |
| `gpt-4-turbo` | GPT-4 Turbo with vision | $$$ |
| `gpt-4` | Original GPT-4 | $$$$ |
| `gpt-3.5-turbo` | Fast and affordable | $ |

### Anthropic

| Model | Description | Cost |
|-------|-------------|------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 (default) | $$ |
| `claude-3-haiku-20240307` | Fast and affordable | $ |
| `claude-3-opus-20240229` | Most capable | $$$$ |

## Configuration

### Environment Variables

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Force specific provider
export AI_PROVIDER="anthropic"

# Override model
export AI_MODEL="claude-sonnet-4-20250514"
```

### CLI Flags

```bash
# Use OpenAI
lyra-discover discover --provider openai --model gpt-4o

# Use Anthropic
lyra-discover discover --provider anthropic --model claude-sonnet-4-20250514
```

### Programmatic Configuration

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

const discovery = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.MY_ANTHROPIC_KEY // optional override
});
```

## Auto-Detection Logic

When no provider is explicitly specified, Lyra auto-detects based on environment:

```typescript
function detectProvider(): AIProvider {
  // 1. Check explicit setting
  if (process.env.AI_PROVIDER === 'openai') return 'openai';
  if (process.env.AI_PROVIDER === 'anthropic') return 'anthropic';
  
  // 2. Auto-detect from available keys
  if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return 'openai';
  }
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return 'anthropic';
  }
  
  // 3. Default to OpenAI if both available
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  
  // 4. Fall back to Anthropic
  return 'anthropic';
}
```

Check your configuration:

```bash
lyra-discover providers
```

Output:
```
🤖 AI Provider Configuration

Available providers (based on env vars):
  ✅ openai
  ✅ anthropic

Override with env vars or CLI flags:
  AI_PROVIDER=openai|anthropic
  AI_MODEL=gpt-4o|claude-sonnet-4-20250514|etc.
  --provider openai --model gpt-4o
```

## Model Comparison

### Accuracy

Both providers produce excellent results for template selection. In testing:

| Task | OpenAI GPT-4o | Anthropic Claude Sonnet |
|------|---------------|------------------|
| Template selection | 95% | 96% |
| Config generation | 92% | 94% |
| Reasoning quality | Excellent | Excellent |

### Speed

| Provider | Model | Avg Response Time |
|----------|-------|-------------------|
| OpenAI | gpt-4o | ~2.5s |
| OpenAI | gpt-4-turbo | ~4s |
| OpenAI | gpt-3.5-turbo | ~1s |
| Anthropic | claude-sonnet-4-20250514 | ~3s |
| Anthropic | claude-3-haiku | ~1s |
| Anthropic | claude-3-opus | ~8s |

### Cost Considerations

Per 1000 tools analyzed (approximate):

| Provider | Model | Input | Output | Total |
|----------|-------|-------|--------|-------|
| OpenAI | gpt-4o | $0.50 | $1.50 | ~$2.00 |
| OpenAI | gpt-3.5-turbo | $0.05 | $0.15 | ~$0.20 |
| Anthropic | claude-sonnet-4-20250514 | $0.30 | $1.50 | ~$1.80 |
| Anthropic | claude-3-haiku | $0.025 | $0.125 | ~$0.15 |

::: tip Cost Optimization
For batch processing of many tools, consider:
1. Use `--dry-run` first to filter candidates
2. Use `gpt-3.5-turbo` or `claude-3-haiku` for initial screening
3. Re-analyze uncertain results with a more capable model
:::

## Rate Limiting

Both providers have rate limits:

### OpenAI Rate Limits

| Tier | RPM | TPM |
|------|-----|-----|
| Free | 3 | 40,000 |
| Tier 1 | 500 | 200,000 |
| Tier 2+ | 5,000+ | 2,000,000+ |

### Anthropic Rate Limits

| Tier | RPM | TPM |
|------|-----|-----|
| Build | 50 | 40,000 |
| Scale | 4,000 | 400,000 |

Lyra automatically handles rate limit errors with exponential backoff:

```typescript
// Internal retry logic
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

## Error Handling

Common errors and solutions:

### Invalid API Key

```
Error: 401 Unauthorized - Invalid API key
```

**Solution:** Verify your API key is correct and active.

### Rate Limit Exceeded

```
Error: 429 Too Many Requests
```

**Solution:** Wait and retry, or upgrade your API tier.

### Model Not Found

```
Error: Model 'gpt-5' not found
```

**Solution:** Use a valid model name from the supported list.

### Insufficient Credits

```
Error: 402 Payment Required
```

**Solution:** Add credits to your API account.

## Recommendations

| Use Case | Recommended Setup |
|----------|-------------------|
| Production batch | Anthropic Claude Sonnet |
| Development/testing | OpenAI GPT-3.5 Turbo |
| Highest accuracy | OpenAI GPT-4 or Claude Opus |
| Lowest cost | Anthropic Claude Haiku |
| Fastest response | OpenAI GPT-3.5 or Claude Haiku |

## Next Steps

- [Discovery Sources](/guide/sources) - Configure GitHub and npm
- [Configuration](/guide/configuration) - Full configuration reference
- [API Reference](/api/ai-analyzer) - AIAnalyzer class documentation
