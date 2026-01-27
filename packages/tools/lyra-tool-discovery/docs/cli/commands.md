# CLI Commands

Complete reference for all Lyra Tool Discovery CLI commands.

## discover

Search for MCP tools and APIs across configured sources.

### Syntax

```bash
lyra-discover discover [options]
```

### Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--sources` | `-s` | string | `github,npm` | Comma-separated sources |
| `--limit` | `-l` | number | `5` | Max tools to discover |
| `--dry-run` | `-d` | boolean | `false` | List tools without AI analysis |
| `--provider` | `-p` | string | auto | AI provider: `openai` or `anthropic` |
| `--model` | `-m` | string | auto | AI model to use |

### Examples

```bash
# Basic discovery
lyra-discover discover

# GitHub only, 10 tools
lyra-discover discover --sources github --limit 10

# Dry run to preview
lyra-discover discover --dry-run --limit 20

# Use specific AI provider
lyra-discover discover --provider anthropic --model claude-sonnet-4-20250514

# Full example
lyra-discover discover \
  --sources github,npm \
  --limit 15 \
  --provider openai \
  --model gpt-4o
```

### Output

```
🔍 Discovering tools from: github, npm
  Found 5 from github
  Found 5 from npm

📊 Total discovered: 10 tools
🔌 MCP-compatible: 8 tools

🤖 AI Provider: anthropic (claude-sonnet-4-20250514)

🤖 Analyzing: mcp-server-github...
  Template: mcp-stdio
  Reasoning: npm package with bin entry, uses MCP SDK

✅ Analyzed 5 tools

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
    }
  }
}
```

### Dry Run Output

```bash
lyra-discover discover --dry-run --limit 3
```

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

---

## analyze-repo

Analyze a specific GitHub repository.

### Syntax

```bash
lyra-discover analyze-repo <owner> <repo> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `owner` | GitHub repository owner |
| `repo` | GitHub repository name |

### Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--provider` | `-p` | string | auto | AI provider |
| `--model` | `-m` | string | auto | AI model |

### Examples

```bash
# Analyze official MCP servers
lyra-discover analyze-repo modelcontextprotocol servers

# Use specific provider
lyra-discover analyze-repo anthropics anthropic-quickstarts \
  --provider openai --model gpt-4o
```

### Output

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

---

## analyze-npm

Analyze a specific npm package.

### Syntax

```bash
lyra-discover analyze-npm <package> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `package` | npm package name (with or without scope) |

### Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--provider` | `-p` | string | auto | AI provider |
| `--model` | `-m` | string | auto | AI model |

### Examples

```bash
# Analyze scoped package
lyra-discover analyze-npm @modelcontextprotocol/server-filesystem

# Analyze unscoped package
lyra-discover analyze-npm mcp-server-sqlite

# With specific model
lyra-discover analyze-npm @anthropics/mcp-server \
  --provider anthropic --model claude-sonnet-4-20250514
```

### Output

```
🔍 Fetching @modelcontextprotocol/server-filesystem...
🤖 Analyzing...

✅ Analysis complete:
  Template: mcp-stdio
  Reasoning: npm package with bin entry for local file access

📋 Quick Import JSON:
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    }
  }
}
```

---

## providers

Show available AI providers and configuration.

### Syntax

```bash
lyra-discover providers
```

### Output (Both Configured)

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

### Output (None Configured)

```
🤖 AI Provider Configuration

Available providers (based on env vars):
  ⚠️  No API keys found!

Set one of these environment variables:
  - OPENAI_API_KEY     → Use OpenAI (gpt-4o, gpt-4-turbo, etc.)
  - ANTHROPIC_API_KEY  → Use Anthropic (claude-sonnet-4-20250514, etc.)
```

---

## templates

List available plugin templates.

### Syntax

```bash
lyra-discover templates
```

### Output

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     plugin.delivery Plugin Templates                          ║
╠════════════╦════════════╦═══════════════════════════════════╦════════════════╣
║ Template   ║ Type       ║ Description                       ║ Use Case       ║
╠════════════╬════════════╬═══════════════════════════════════╬════════════════╣
║ basic      ║ Default    ║ Standard plugin with API          ║ Simple lookups ║
║ default    ║ Default    ║ Plugin with settings UI           ║ Configurable   ║
║ markdown   ║ Markdown   ║ Rich text output                  ║ Reports        ║
║ openapi    ║ OpenAPI    ║ Auto-generated from spec          ║ Existing APIs  ║
║ settings   ║ Default    ║ Plugin with user preferences      ║ Personalized   ║
║ standalone ║ Standalone ║ Full React application            ║ Interactive UI ║
╠════════════╬════════════╬═══════════════════════════════════╬════════════════╣
║ mcp-http   ║ MCP        ║ Streamable HTTP MCP server        ║ Remote MCP     ║
║ mcp-stdio  ║ MCP        ║ STDIO-based MCP server            ║ Local npm MCP  ║
╚════════════╩════════════╩═══════════════════════════════════╩════════════════╝

MCP Templates:
  - mcp-http:  For remote MCP servers accessible via HTTP URL
  - mcp-stdio: For npm packages that run locally via npx

Standard Templates:
  - basic:      Simple API endpoint, no UI
  - default:    Has settings/configuration UI
  - markdown:   Outputs rich formatted text
  - openapi:    Generated from OpenAPI/Swagger spec
  - settings:   Stores user preferences
  - standalone: Full React app for complex UIs
```

## Error Handling

### Missing API Key

```bash
lyra-discover discover
# Error: No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY
```

### Repository Not Found

```bash
lyra-discover analyze-repo nonexistent fake-repo
# 🔍 Fetching nonexistent/fake-repo...
# Repository not found
```

### Rate Limit

```bash
lyra-discover discover --limit 100
# Error: GitHub API rate limit exceeded. Set GITHUB_TOKEN for higher limits.
```

## Next Steps

- [Configuration](/cli/configuration) - Config file reference
- [Output Formats](/cli/output) - Working with JSON output
- [Examples](/examples/) - Real-world examples
