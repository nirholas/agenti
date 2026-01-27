# CLI Configuration

Configure the Lyra CLI through config files, environment variables, or command-line flags.

## Configuration Precedence

Values are resolved in this order (highest priority first):

1. **CLI flags** - `--provider`, `--model`, etc.
2. **Environment variables** - `AI_PROVIDER`, `AI_MODEL`, etc.
3. **Config file** - `discovery.config.json`
4. **Defaults** - Built-in fallbacks

## Configuration File

Create `discovery.config.json` in your project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/nirholas/lyra-tool-discovery/main/schema.json",
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 2000
  },
  "discovery": {
    "sources": ["github", "npm"],
    "limit": 10,
    "filters": {
      "minStars": 10,
      "requireMCP": true,
      "excludeArchived": true
    }
  },
  "github": {
    "queries": [
      "mcp server in:name,description,readme",
      "@modelcontextprotocol in:readme"
    ],
    "sort": "stars",
    "order": "desc"
  },
  "npm": {
    "queries": [
      "mcp server",
      "@modelcontextprotocol"
    ]
  },
  "output": {
    "format": "json",
    "pretty": true
  }
}
```

## Environment Variables

### AI Configuration

```bash
# AI Provider (overrides config file)
export AI_PROVIDER="anthropic"   # or "openai"

# AI Model (overrides default for provider)
export AI_MODEL="claude-sonnet-4-20250514"

# API Keys (required)
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Source Configuration

```bash
# GitHub token for higher rate limits
export GITHUB_TOKEN="ghp_..."
```

### Using .env Files

Create a `.env` file:

```bash
# .env
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-20250514
ANTHROPIC_API_KEY=sk-ant-api03-...
GITHUB_TOKEN=ghp_...
```

Load with your preferred method:

```bash
# Using dotenv
source .env && lyra-discover discover

# Using direnv
# .envrc will auto-load

# Using node
node -r dotenv/config node_modules/.bin/lyra-discover discover
```

## Config File Schema

### `ai` Section

```json
{
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 2000
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `provider` | `"openai" \| "anthropic"` | auto | AI provider |
| `model` | `string` | auto | Model identifier |
| `maxTokens` | `number` | `2000` | Max response tokens |

### `discovery` Section

```json
{
  "discovery": {
    "sources": ["github", "npm"],
    "limit": 10,
    "filters": {
      "minStars": 10,
      "requireMCP": true,
      "excludeArchived": true
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sources` | `string[]` | `["github", "npm"]` | Sources to search |
| `limit` | `number` | `10` | Max tools |
| `filters.minStars` | `number` | `0` | Min GitHub stars |
| `filters.requireMCP` | `boolean` | `false` | Only MCP tools |
| `filters.excludeArchived` | `boolean` | `true` | Skip archived |

### `github` Section

```json
{
  "github": {
    "queries": [
      "mcp server in:name,description,readme",
      "modelcontextprotocol in:name,description"
    ],
    "sort": "stars",
    "order": "desc"
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `queries` | `string[]` | (see defaults) | Search queries |
| `sort` | `string` | `"stars"` | Sort field |
| `order` | `"asc" \| "desc"` | `"desc"` | Sort order |

### `npm` Section

```json
{
  "npm": {
    "queries": [
      "mcp server",
      "@modelcontextprotocol"
    ]
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `queries` | `string[]` | (see defaults) | Search queries |

### `output` Section

```json
{
  "output": {
    "format": "json",
    "pretty": true,
    "file": "./results.json"
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `format` | `"json"` | `"json"` | Output format |
| `pretty` | `boolean` | `true` | Pretty print |
| `file` | `string` | stdout | Output file |

## Example Configurations

### Minimal

```json
{
  "discovery": {
    "limit": 5
  }
}
```

### OpenAI with GPT-4

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

### GitHub Only, High Quality

```json
{
  "discovery": {
    "sources": ["github"],
    "limit": 50,
    "filters": {
      "minStars": 100,
      "requireMCP": true
    }
  },
  "github": {
    "queries": [
      "mcp server stars:>100",
      "@modelcontextprotocol in:readme stars:>50"
    ]
  }
}
```

### Custom Queries

```json
{
  "github": {
    "queries": [
      "langchain mcp in:readme",
      "llama tool server",
      "ai agent mcp"
    ]
  },
  "npm": {
    "queries": [
      "@langchain/mcp",
      "llama-mcp"
    ]
  }
}
```

## CLI Flags Override

All config file and env settings can be overridden with CLI flags:

```bash
# Override provider and model
lyra-discover discover --provider openai --model gpt-4-turbo

# Override sources and limit
lyra-discover discover --sources github --limit 25

# Full override
lyra-discover discover \
  --sources npm \
  --limit 10 \
  --provider anthropic \
  --model claude-3-haiku-20240307
```

## Validation

The CLI validates configuration on startup:

```bash
# Invalid provider
lyra-discover discover --provider gpt
# Error: Invalid provider "gpt". Use "openai" or "anthropic"

# Missing API key
lyra-discover discover
# Error: No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY
```

## Next Steps

- [Output Formats](/cli/output) - Working with CLI output
- [Commands](/cli/commands) - Full command reference
- [Examples](/examples/) - Real-world usage
