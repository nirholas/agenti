---
outline: deep
---

# Examples & Tutorials

Learn Lyra Tool Discovery through practical, runnable examples. Each tutorial builds on core concepts and provides copy-paste ready code.

## Quick Start

### Your First Discovery

Discover MCP tools in just a few lines:

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery'

const discovery = new ToolDiscovery()
const results = await discovery.discover({
  sources: ['github'],
  limit: 5
})

console.log(`Found ${results.length} tools!`)
```

### Using the CLI

The fastest way to get started:

```bash
# Install globally
pnpm add -g @nirholas/lyra-tool-discovery

# Set up your AI provider
export ANTHROPIC_API_KEY="sk-ant-..."

# Discover tools
lyra-discover discover --sources github --limit 10
```

## Example Categories

### 🚀 Getting Started

| Example | Description | Difficulty |
|---------|-------------|------------|
| [Basic Discovery](./basic-discovery) | Your first discovery script | ⭐ Beginner |
| [Analyze Single Repo](./basic-discovery#single-repo) | Deep-dive into one repository | ⭐ Beginner |
| [Dry Run Mode](./basic-discovery#dry-run) | Test without AI costs | ⭐ Beginner |

### ⚙️ Configuration

| Example | Description | Difficulty |
|---------|-------------|------------|
| [Custom AI Provider](./custom-ai) | Configure OpenAI or Anthropic | ⭐⭐ Intermediate |
| [Model Selection](./custom-ai#models) | Choose specific models | ⭐⭐ Intermediate |
| [Environment Setup](./custom-ai#environment) | Configure via env vars | ⭐ Beginner |

### 📦 Advanced Usage

| Example | Description | Difficulty |
|---------|-------------|------------|
| [Batch Processing](./batch-processing) | Process multiple repos | ⭐⭐ Intermediate |
| [Error Handling](./batch-processing#errors) | Handle failures gracefully | ⭐⭐ Intermediate |
| [Pipeline Integration](./batch-processing#pipeline) | Full discovery pipeline | ⭐⭐⭐ Advanced |

### 🔄 Automation

| Example | Description | Difficulty |
|---------|-------------|------------|
| [GitHub Actions](./github-actions) | Automated discovery workflows | ⭐⭐ Intermediate |
| [Scheduled Discovery](./github-actions#scheduled) | Daily/weekly runs | ⭐⭐ Intermediate |
| [PR Creation](./github-actions#pr) | Auto-create PRs | ⭐⭐⭐ Advanced |

## Running Examples Locally

All examples are in the `/examples` directory:

```bash
# Clone the repo
git clone https://github.com/nirholas/lyra-tool-discovery
cd lyra-tool-discovery

# Install dependencies
pnpm install

# Set up AI provider
export ANTHROPIC_API_KEY="sk-ant-..."

# Run any example
npx tsx examples/01-basic-discovery.ts
```

### Available npm Scripts

```bash
# Basic examples
pnpm example:basic     # 01-basic-discovery.ts
pnpm example:repo      # 02-analyze-single-repo.ts
pnpm example:npm       # 03-analyze-npm-package.ts

# Configuration examples
pnpm example:ai        # 04-custom-ai-provider.ts

# Advanced examples
pnpm example:batch     # 05-batch-processing.ts
pnpm example:filter    # 06-filter-by-template.ts
pnpm example:json      # 07-json-output.ts
pnpm example:dry       # 08-dry-run-mode.ts

# Integration examples
pnpm example:search    # 09-custom-search-queries.ts
pnpm example:pipeline  # 10-pipeline-integration.ts
pnpm example:errors    # 11-error-handling.ts
pnpm example:action    # 12-github-action-script.ts
```

## Example Output

### Basic Discovery Output

```
🔮 Lyra Tool Discovery - Basic Example

Searching GitHub for MCP servers...

🔍 Discovering tools from: github
  Found 5 from github

📊 Total discovered: 5 tools
🔌 MCP-compatible: 5 tools

🤖 AI Provider: anthropic (claude-sonnet-4-20250514)

🤖 Analyzing: mcp-server-github...
  Template: mcp-stdio
  Reasoning: npm package with bin entry, runs locally via npx

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
    },
    "description": "GitHub API access via MCP",
    "avatar": "🐙"
  }
}
```

## Prerequisites Checklist

Before running examples, ensure you have:

- [ ] Node.js 18+ installed
- [ ] pnpm (or npm/yarn) installed
- [ ] AI API key configured:
  - `OPENAI_API_KEY` for OpenAI
  - `ANTHROPIC_API_KEY` for Anthropic
- [ ] (Optional) `GITHUB_TOKEN` for higher rate limits

## Getting Help

- 📖 [Full Documentation](/guide/)
- 💬 [GitHub Discussions](https://github.com/nirholas/lyra-tool-discovery/discussions)
- 🐛 [Report Issues](https://github.com/nirholas/lyra-tool-discovery/issues)

## Next Steps

Ready to dive in? Start with the [Basic Discovery Tutorial](./basic-discovery).
