# Getting Started

This guide will walk you through installing Lyra Tool Discovery and running your first discovery.

## Installation

::: code-group

```bash [pnpm]
pnpm add -g @nirholas/lyra-tool-discovery
```

```bash [npm]
npm install -g @nirholas/lyra-tool-discovery
```

```bash [yarn]
yarn global add @nirholas/lyra-tool-discovery
```

```bash [bun]
bun add -g @nirholas/lyra-tool-discovery
```

:::

Verify the installation:

```bash
lyra-discover --version
```

## Environment Setup

Lyra requires an AI provider API key. Set up at least one:

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
```

Get your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Anthropic

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Get your key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

### Optional: GitHub Token

For higher rate limits when searching GitHub:

```bash
export GITHUB_TOKEN="ghp_..."
```

Create a token at [github.com/settings/tokens](https://github.com/settings/tokens)

::: tip
Lyra auto-detects which provider to use based on available environment variables. If both are set, OpenAI is used by default. Override with `--provider anthropic`.
:::

## Check Provider Status

Verify your AI provider configuration:

```bash
lyra-discover providers
```

Expected output:

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

## Your First Discovery

### Dry Run (No AI Costs)

Start with a dry run to see what tools would be discovered:

```bash
lyra-discover discover --dry-run --limit 3
```

This searches GitHub and npm but skips AI analysis:

```
🔍 Discovering tools from: github, npm
  Found 5 from github
  Found 5 from npm

📊 Total discovered: 10 tools
🔌 MCP-compatible: 8 tools

[DRY RUN] Would analyze: mcp-server-github
  Source: github
  URL: https://github.com/modelcontextprotocol/servers
  MCP: Yes

[DRY RUN] Would analyze: @modelcontextprotocol/server-filesystem
  Source: npm
  URL: https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem
  MCP: Yes
```

### Full Discovery

Run with AI analysis:

```bash
lyra-discover discover --sources github --limit 3
```

Output:

```
🔍 Discovering tools from: github
  Found 5 from github

📊 Total discovered: 5 tools
🔌 MCP-compatible: 5 tools

🤖 AI Provider: anthropic (claude-sonnet-4-20250514)

🤖 Analyzing: mcp-server-github...
  Template: mcp-stdio
  Reasoning: This is an npm package that runs locally via npx

✅ Analyzed 3 tools

📦 Generated Configs:

--- mcp-server-github ---
Template: mcp-stdio
Config: {
  "identifier": "mcp-server-github",
  "customParams": {
    "mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "description": "GitHub API access via MCP"
  }
}
```

## Analyze a Specific Repository

Analyze a single GitHub repository:

```bash
lyra-discover analyze-repo modelcontextprotocol servers
```

Output:

```
🔍 Fetching modelcontextprotocol/servers...
🤖 Analyzing...

✅ Analysis complete:
  Template: mcp-stdio
  Reasoning: Official MCP servers collection with multiple STDIO-based tools

📋 Quick Import JSON:
{
  "mcpServers": {
    "mcp-servers": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
  }
}
```

## Analyze an npm Package

Analyze a specific npm package:

```bash
lyra-discover analyze-npm @anthropic-ai/mcp-server-langchain
```

## Understanding the Output

Each discovered tool produces:

| Field | Description |
|-------|-------------|
| `template` | One of 8 plugin templates |
| `reasoning` | AI's explanation for the choice |
| `config` | Ready-to-use plugin configuration |

### Template Types

| Template | When Used |
|----------|-----------|
| `mcp-http` | Tool has an HTTP MCP endpoint |
| `mcp-stdio` | npm package runs via npx/node |
| `openapi` | Has OpenAPI/Swagger spec |
| `standalone` | Needs complex React UI |
| `markdown` | Outputs formatted text |
| `basic` | Simple API endpoint |
| `default` | Needs settings UI |
| `settings` | Stores user preferences |

## Next Steps

- [Configuration](/guide/configuration) - Customize discovery behavior
- [AI Providers](/guide/ai-providers) - Configure OpenAI vs Anthropic
- [CLI Commands](/cli/commands) - Full command reference
- [Examples](/examples/) - Real-world usage examples
