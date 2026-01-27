---
outline: deep
---

# Basic Discovery Tutorial

This tutorial walks you through discovering MCP tools using Lyra Tool Discovery. By the end, you'll understand how to search GitHub and npm for MCP servers and get AI-powered template recommendations.

## What You'll Learn

- Setting up Lyra Tool Discovery
- Running your first discovery
- Understanding the output
- Analyzing specific repositories
- Using dry-run mode

## Prerequisites

Before starting, ensure you have:

1. **Node.js 18+** installed
2. **An AI API key** (OpenAI or Anthropic)
3. **pnpm** (or npm/yarn)

## Step 1: Installation

Install Lyra Tool Discovery globally:

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

:::

Verify the installation:

```bash
lyra-discover --version
# Output: 0.1.0
```

## Step 2: Configure AI Provider

Set up your AI provider by exporting an API key:

::: code-group

```bash [Anthropic (Recommended)]
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

```bash [OpenAI]
export OPENAI_API_KEY="sk-proj-..."
```

:::

Verify your configuration:

```bash
lyra-discover providers
```

Expected output:

```
🤖 AI Provider Configuration

Available providers (based on env vars):
  ✅ anthropic

Override with env vars or CLI flags:
  AI_PROVIDER=openai|anthropic
  AI_MODEL=gpt-4o|claude-sonnet-4-20250514|etc.
  --provider openai --model gpt-4o
```

## Step 3: Your First Discovery

### Using the CLI

Run a basic discovery:

```bash
lyra-discover discover --sources github --limit 3
```

This will:
1. Search GitHub for MCP-related repositories
2. Analyze each with AI
3. Determine the best plugin template
4. Output the configuration

### Expected Output

```
🔍 Discovering tools from: github
  Found 5 from github

📊 Total discovered: 5 tools
🔌 MCP-compatible: 3 tools

🤖 AI Provider: anthropic (claude-sonnet-4-20250514)

🤖 Analyzing: mcp-server-filesystem...
  Template: mcp-stdio
  Reasoning: Local filesystem access tool with bin entry

🤖 Analyzing: mcp-server-github...
  Template: mcp-stdio  
  Reasoning: GitHub API via CLI, uses npx

🤖 Analyzing: mcp-weather-api...
  Template: mcp-http
  Reasoning: Remote weather service with HTTP endpoint

✅ Analyzed 3 tools

📦 Generated Configs:

--- mcp-server-filesystem ---
Template: mcp-stdio
Config: {
  "identifier": "mcp-server-filesystem",
  "customParams": {
    "mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

## Step 4: Programmatic Usage

Create a script for more control:

```typescript
// basic-discovery.ts
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery'

async function main() {
  console.log('🔮 Lyra Tool Discovery\n')

  // Create discovery instance
  const discovery = new ToolDiscovery()

  // Discover tools
  const results = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 5
  })

  // Process results
  for (const result of results) {
    console.log(`📦 ${result.tool.name}`)
    console.log(`   Template: ${result.decision.template}`)
    console.log(`   Reason: ${result.decision.reasoning}`)
    console.log(`   URL: ${result.tool.sourceUrl}`)
    console.log()
  }

  console.log(`✅ Discovered ${results.length} tools`)
}

main().catch(console.error)
```

Run with:

```bash
npx tsx basic-discovery.ts
```

## Step 5: Analyze a Single Repository {#single-repo}

To analyze a specific GitHub repository:

### CLI Method

```bash
lyra-discover analyze-repo modelcontextprotocol servers
```

### Programmatic Method

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery'

async function analyzeRepo() {
  const discovery = new ToolDiscovery()
  
  const result = await discovery.analyzeGitHubRepo(
    'modelcontextprotocol',  // owner
    'servers'                 // repo name
  )
  
  console.log('Template:', result.decision.template)
  console.log('Config:', JSON.stringify(result.generated.pluginConfig, null, 2))
}

analyzeRepo()
```

## Step 6: Dry Run Mode {#dry-run}

Test discovery without making AI API calls (no cost):

```bash
lyra-discover discover --sources github --limit 10 --dry-run
```

Output shows what would be analyzed:

```
🔍 Discovering tools from: github
  Found 10 from github

📊 Total discovered: 10 tools
🔌 MCP-compatible: 8 tools

[DRY RUN] Would analyze: mcp-server-github
  Source: github
  URL: https://github.com/modelcontextprotocol/servers
  MCP: Yes

[DRY RUN] Would analyze: mcp-server-sqlite
  Source: github
  URL: https://github.com/example/mcp-sqlite
  MCP: Yes

... (8 more)
```

This is useful for:
- Testing your setup
- Seeing what's available before committing to AI costs
- Debugging search queries

## Understanding the Output

### Template Types

Lyra assigns one of 8 templates:

| Template | Meaning |
|----------|---------|
| `mcp-stdio` | Local MCP server via command line |
| `mcp-http` | Remote MCP server via HTTP |
| `openapi` | REST API with OpenAPI spec |
| `basic` | Simple API endpoint |
| `default` | Plugin with settings UI |
| `markdown` | Rich text output |
| `settings` | User preferences |
| `standalone` | Full React application |

### Config Structure

For MCP plugins:

```json
{
  "identifier": "plugin-name",
  "customParams": {
    "mcp": {
      "type": "stdio",        // or "http"
      "command": "npx",       // for stdio
      "args": ["-y", "pkg"],  // for stdio
      "url": "https://..."    // for http
    },
    "description": "Plugin description",
    "avatar": "🔌"
  }
}
```

For standard plugins:

```json
{
  "identifier": "plugin-name",
  "manifest": "https://example.com/manifest.json",
  "author": "Author Name",
  "meta": {
    "title": "Plugin Title",
    "description": "Description",
    "tags": ["tag1", "tag2"]
  }
}
```

## Common Modifications

### Change AI Provider

```bash
# Use OpenAI instead of Anthropic
lyra-discover discover --provider openai --sources github --limit 5
```

### Use a Specific Model

```bash
# Use GPT-4 Turbo
lyra-discover discover --provider openai --model gpt-4-turbo --limit 5

# Use Claude 3.5 Sonnet
lyra-discover discover --provider anthropic --model claude-sonnet-4-20250514 --limit 5
```

### Search npm Only

```bash
lyra-discover discover --sources npm --limit 10
```

### Increase Results

```bash
lyra-discover discover --sources github,npm --limit 50
```

## Troubleshooting

### "No API keys found"

Ensure you've exported your API key:

```bash
echo $ANTHROPIC_API_KEY  # Should show your key
```

### "Rate limit exceeded"

- Add a GitHub token: `export GITHUB_TOKEN="ghp_..."`
- Reduce the `--limit` value
- Wait and try again

### No MCP tools found

- Try different sources: `--sources npm`
- The search queries might need adjustment
- Some tools may not be tagged properly

## Next Steps

- [Custom AI Configuration](./custom-ai) - Fine-tune your AI provider
- [Batch Processing](./batch-processing) - Process multiple repos
- [GitHub Actions](./github-actions) - Automate discovery

## Complete Example Code

See the full example at [examples/01-basic-discovery.ts](https://github.com/nirholas/lyra-tool-discovery/blob/main/examples/01-basic-discovery.ts).
