# Lyra Tool Discovery Examples

Runnable examples demonstrating various features of Lyra Tool Discovery.

## Prerequisites

```bash
# Clone the repository
git clone https://github.com/nirholas/lyra-tool-discovery.git
cd lyra-tool-discovery

# Install dependencies
pnpm install

# Build the project
pnpm build

# Set up AI provider (choose one)
export OPENAI_API_KEY="sk-..."
# OR
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Running Examples

```bash
# Run any example with tsx
npx tsx examples/basic-discovery.ts

# Or use the npm scripts
pnpm example:basic
pnpm example:batch
pnpm example:json
```

## Examples Index

| Example | File | Description |
|---------|------|-------------|
| Basic Discovery | [basic-discovery.ts](basic-discovery.ts) | Simple discovery from GitHub |
| Analyze Repo | [analyze-single-repo.ts](analyze-single-repo.ts) | Deep analyze one GitHub repository |
| Analyze npm | [analyze-npm-package.ts](analyze-npm-package.ts) | Analyze an npm package |
| Custom AI | [custom-ai-provider.ts](custom-ai-provider.ts) | Configure OpenAI/Anthropic explicitly |
| Batch Processing | [batch-processing.ts](batch-processing.ts) | Process multiple repos with rate limiting |
| Filter by Template | [filter-by-template.ts](filter-by-template.ts) | Filter and group results by template |
| JSON Output | [json-output.ts](json-output.ts) | Output to JSON, save to file |
| Dry Run | [dry-run-mode.ts](dry-run-mode.ts) | Preview without AI calls |
| Custom Search | [custom-search-queries.ts](custom-search-queries.ts) | Custom GitHub/npm queries |
| Pipeline | [pipeline-integration.ts](pipeline-integration.ts) | Full discovery pipeline |
| Error Handling | [11-error-handling.ts](11-error-handling.ts) | Handle API errors gracefully |
| GitHub Actions | [12-github-action-script.ts](12-github-action-script.ts) | Script for CI/CD workflows |

## Expected Output

### Basic Discovery

```
🔮 Lyra Tool Discovery - Basic Example

🤖 AI Provider: anthropic (claude-sonnet-4-20250514)
🔍 Discovering tools from: github
  Found 5 from github

📊 Total discovered: 5 tools
🔌 MCP-compatible: 5 tools

🤖 Analyzing: anthropics/mcp-server...
  Template: mcp-http
  Reasoning: This is an MCP server with HTTP endpoint...

📦 anthropics/mcp-server
   Template: mcp-http
   Confidence: 0.95
   URL: https://github.com/anthropics/mcp-server

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Discovery complete! Found 5 MCP-compatible tools.
```

### JSON Output

```bash
# Pretty JSON to stdout
npx tsx examples/json-output.ts

# Compact JSON
npx tsx examples/json-output.ts --compact

# Save to file
npx tsx examples/json-output.ts --output data/results.json

# Stream as NDJSON
npx tsx examples/json-output.ts --stream
```

### Batch Processing

```
🔮 Lyra Tool Discovery - Batch Processing

📋 Processing 5 repositories...

[1/5] 🔍 Analyzing modelcontextprotocol/servers...
[1/5] ✅ Success: mcp-stdio
[1/5] ⏳ Waiting 1500ms...

[2/5] 🔍 Analyzing anthropics/anthropic-cookbook...
[2/5] ✅ Success: basic
...

═══════════════════════════════════════════════════════════
📊 BATCH PROCESSING RESULTS
═══════════════════════════════════════════════════════════

📈 Statistics:
   Total processed: 5
   Succeeded: 4
   Failed: 1
   Duration: 12.34s
   Avg time/repo: 2.47s
```

## Using in Your Projects

### Programmatic API

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery'

const discovery = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'
})

const results = await discovery.discover({
  sources: ['github', 'npm'],
  limit: 10
})

for (const result of results) {
  console.log(result.tool.name, result.decision.template)
}
```

### CLI

```bash
# Basic discovery
lyra-discover discover --sources github,npm --limit 10

# Analyze specific repo
lyra-discover analyze-repo anthropics mcp-server

# Analyze npm package
lyra-discover analyze-npm @modelcontextprotocol/server-filesystem

# Dry run (no AI calls)
lyra-discover discover --dry-run
```

## Cost Considerations

Each AI analysis call costs approximately:

| Provider | Model | Cost per Tool |
|----------|-------|---------------|
| OpenAI | gpt-4o-mini | ~$0.001-0.002 |
| OpenAI | gpt-4o | ~$0.01-0.02 |
| Anthropic | claude-3-haiku | ~$0.001 |
| Anthropic | claude-sonnet-4-20250514 | ~$0.01 |

**Tips to reduce costs:**
- Use `--dry-run` to preview without AI calls
- Start with small `--limit` values
- Use cheaper models for bulk analysis
- Cache results to avoid re-analyzing

## Troubleshooting

### No AI providers found

```
❌ No API keys found!
Set OPENAI_API_KEY or ANTHROPIC_API_KEY
```

**Solution:** Export your API key in the terminal or add to `.env` file.

### Rate limit exceeded

```
❌ GitHub API rate limit exceeded
```

**Solution:** Wait for the rate limit to reset, or use a GitHub token:
```bash
export GITHUB_TOKEN=ghp_...
```

### Package/repo not found

```
❌ Repository owner/repo not found
```

**Solution:** Check the repository exists and is public.

## Contributing

Found an issue or have an idea for a new example? Please open an issue or PR!

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
