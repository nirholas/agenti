# Configuration

Lyra Tool Discovery can be configured through environment variables, CLI flags, and configuration files.

## Configuration Precedence

Configuration values are resolved in this order (highest to lowest priority):

1. **CLI flags** - `--provider`, `--model`, etc.
2. **Environment variables** - `AI_PROVIDER`, `AI_MODEL`, etc.
3. **Configuration file** - `discovery.config.json`
4. **Default values** - Built-in defaults

## Environment Variables

### AI Provider Configuration

| Variable | Description | Values |
|----------|-------------|--------|
| `AI_PROVIDER` | Force specific AI provider | `openai`, `anthropic` |
| `AI_MODEL` | Override default model | `gpt-4o`, `claude-sonnet-4-20250514`, etc. |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |

### Source Configuration

| Variable | Description | Values |
|----------|-------------|--------|
| `GITHUB_TOKEN` | GitHub API token | `ghp_...` |

### Example `.env` file

```bash
# AI Provider (auto-detected if not set)
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-20250514

# API Keys
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...

# GitHub (for higher rate limits)
GITHUB_TOKEN=ghp_...
```

## Configuration File

Create a `discovery.config.json` in your project root:

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
  "output": {
    "format": "json",
    "directory": "./discovered",
    "generateFiles": true
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
  }
}
```

## Configuration Schema

### `ai` Section

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `provider` | `string` | auto | `openai` or `anthropic` |
| `model` | `string` | auto | Model identifier |
| `maxTokens` | `number` | `2000` | Max tokens for AI response |

### `discovery` Section

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sources` | `string[]` | `["github", "npm"]` | Sources to search |
| `limit` | `number` | `10` | Max tools to discover |
| `filters.minStars` | `number` | `0` | Minimum GitHub stars |
| `filters.requireMCP` | `boolean` | `false` | Only MCP-compatible |
| `filters.excludeArchived` | `boolean` | `true` | Skip archived repos |

### `output` Section

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `format` | `string` | `json` | Output format |
| `directory` | `string` | `./` | Output directory |
| `generateFiles` | `boolean` | `false` | Generate plugin files |

### `github` Section

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `queries` | `string[]` | (see below) | Search queries |
| `sort` | `string` | `stars` | Sort field |
| `order` | `string` | `desc` | Sort order |

Default GitHub queries:
```json
[
  "mcp server in:name,description,readme",
  "modelcontextprotocol in:name,description",
  "@modelcontextprotocol in:readme",
  "mcp-server in:name"
]
```

### `npm` Section

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `queries` | `string[]` | (see below) | Search queries |

Default npm queries:
```json
[
  "mcp server",
  "@modelcontextprotocol",
  "mcp-server"
]
```

## CLI Flag Reference

All CLI flags override config file and environment variables:

```bash
lyra-discover discover \
  --sources github,npm \
  --limit 20 \
  --provider anthropic \
  --model claude-sonnet-4-20250514 \
  --dry-run
```

| Flag | Alias | Description |
|------|-------|-------------|
| `--sources` | `-s` | Comma-separated sources |
| `--limit` | `-l` | Max tools to discover |
| `--provider` | `-p` | AI provider |
| `--model` | `-m` | AI model |
| `--dry-run` | `-d` | Skip AI analysis |

## Example Configurations

### Minimal (uses defaults and env vars)

```json
{
  "discovery": {
    "limit": 5
  }
}
```

### OpenAI with GPT-4 Turbo

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4-turbo"
  }
}
```

### GitHub Only with Filters

```json
{
  "discovery": {
    "sources": ["github"],
    "limit": 50,
    "filters": {
      "minStars": 100,
      "requireMCP": true
    }
  }
}
```

### Custom Queries for Niche Tools

```json
{
  "github": {
    "queries": [
      "langchain mcp in:name,readme",
      "llama mcp server"
    ]
  },
  "npm": {
    "queries": [
      "@langchain/mcp"
    ]
  }
}
```

## Validation

Lyra validates your configuration on startup. Common errors:

```bash
# Missing API key
Error: No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY

# Invalid provider
Error: Invalid AI provider "gpt". Must be "openai" or "anthropic"

# Invalid model
Error: Model "claude-2" not supported. Available: claude-sonnet-4-20250514, claude-3-haiku-20240307
```

## Next Steps

- [AI Providers](/guide/ai-providers) - Detailed provider configuration
- [Discovery Sources](/guide/sources) - Configure GitHub and npm sources
- [CLI Reference](/cli/) - Full command documentation
