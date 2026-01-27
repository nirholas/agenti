<div align="center"> 

# 🔮 Lyra Tool Discovery

**AI-powered tool discovery for the MCP ecosystem**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![AI Powered](https://img.shields.io/badge/AI-OpenAI%20%7C%20Anthropic-blueviolet?style=flat-square)](https://openai.com)

[Documentation](https://github.com/nirholas/lyra-tool-discovery/tree/main/docs) · [CLI Reference](#-cli-reference) · [Examples](#-examples) · [Contributing](#-contributing)

</div>

---

## 📖 Overview

**Lyra Tool Discovery** is an AI-powered automation tool designed specifically for the **crypto, DeFi, blockchain, and web3 ecosystem**. It solves the painful problem of manually discovering, evaluating, and integrating MCP (Model Context Protocol) servers into your crypto-focused applications. Instead of spending hours searching GitHub, reading READMEs, and figuring out the right integration approach, Lyra does it for you in seconds.

The tool crawls multiple sources—GitHub and npm—to find crypto-related MCP servers, APIs, and plugins. It filters results to focus exclusively on **blockchain, DeFi, web3, and cryptocurrency tooling** (including Ethereum, Solana, Bitcoin, wallets, tokens, NFTs, DEXs, staking, bridges, and more). Lyra then leverages state-of-the-art AI (OpenAI GPT-4o or Anthropic Claude) to analyze each discovered tool and automatically generates ready-to-use plugin configurations.

### 🪙 Crypto Focus

Lyra is optimized for discovering tools related to:

- **Blockchain Networks** — Ethereum, Solana, Bitcoin, Layer 2s, bridges
- **DeFi Protocols** — DEXs, lending, staking, yield farming, liquidity
- **Web3 Infrastructure** — Wallets, RPC providers, indexers, oracles
- **Token Standards** — ERC-20, ERC-721, NFTs, token swaps
- **Smart Contracts** — Development, auditing, deployment tools
- **On-chain Data** — Analytics, explorers, transaction tracking

Lyra is built for **crypto MCP ecosystem developers** who need to rapidly onboard new tools, **plugin marketplace operators** like plugin.delivery who curate crypto plugins, and **automation engineers** building CI/CD pipelines for DeFi tool discovery and deployment.

This tool is a critical piece of the discovery-to-deployment pipeline: `lyra-tool-discovery` → `github-to-mcp` → `plugin.delivery` → **SperaxOS users**. By automating the discovery and classification phase, Lyra enables fully automated plugin onboarding with minimal human intervention.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🤖 Multi-Provider AI

- **OpenAI** — GPT-4o, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic** — Claude Sonnet 4, Claude Opus
- Auto-detection from environment variables
- Custom model selection via CLI or config
- Intelligent fallback between providers

</td>
<td width="50%">

### 📦 8 Plugin Templates

- `mcp-http` — Remote MCP servers (HTTP/SSE)
- `mcp-stdio` — Local MCP servers (stdio)
- `openapi` — REST API integrations
- `standalone` — Full React applications
- `markdown` — Rich text/documentation
- `default` — Configurable plugins
- `settings` — User preference plugins
- `basic` — Simple function plugins

</td>
</tr>
<tr>
<td width="50%">

### 🔍 Discovery Sources

- **GitHub** — Search repos, topics, READMEs
- **npm** — Package registry search
- 🔜 Smithery (MCP directory)
- 🔜 OpenAPI Directory
- 🔜 RapidAPI

</td>
<td width="50%">

### 🪙 Crypto Filtering

- **Keywords** — crypto, defi, blockchain, web3
- **Networks** — ethereum, solana, bitcoin
- **Protocols** — wallet, token, nft, dex, staking
- **Age Filter** — Only repos updated within 12 months
- **Smart Validation** — AI validates crypto relevance

- Full-featured command-line interface
- Node.js/TypeScript SDK for automation
- JSON output for CI/CD pipelines
- Dry-run mode for testing
- Progress indicators and rich output

</td>
</tr>
<tr>
<td width="50%">

### 🖥️ CLI & Programmatic API

- Full-featured command-line interface
- Node.js/TypeScript SDK for automation
- JSON output for CI/CD pipelines
- Dry-run mode for testing
- Progress indicators and rich output

</td>
<td width="50%">

### 🧪 Testing & Validation

- `--dry-run` mode for safe testing
- List discovered tools without AI calls
- Validate configurations before deployment
- Debug logging for troubleshooting

</td>
</tr>
<tr>
<td width="50%">

### 📤 Flexible Output

- Structured JSON for piping to other tools
- Quick Import format for SperaxOS
- Plugin manifests for plugin.delivery
- Console output with rich formatting

</td>
</tr>
</table>

---

## 🪙 Crypto Discovery Keywords

Lyra automatically filters discovery results to focus on crypto/DeFi/blockchain/web3 tools. The following keywords are used for both search queries and result validation:

<details>
<summary><strong>View all supported keywords</strong></summary>

| Category | Keywords |
|----------|----------|
| **General** | crypto, cryptocurrency, defi, blockchain, web3 |
| **Networks** | ethereum, eth, solana, sol, bitcoin, btc, chain |
| **Tokens** | token, erc20, erc721, nft |
| **DeFi** | dex, swap, staking, yield, lending, liquidity, vault, bridge |
| **Infrastructure** | wallet, protocol, onchain, on-chain, smart contract |
| **Libraries** | web3.js, ethers, viem, wagmi, rainbowkit |
| **Protocols** | uniswap, aave, compound |

</details>

Tools that don't match any of these keywords are automatically filtered out, ensuring you only discover crypto-relevant MCP servers.

### Age Filtering

By default, Lyra only discovers tools that have been updated within the **last 12 months**. This ensures you're finding actively maintained projects. Use `--max-age` to adjust:

```bash
# Only tools updated in the last 6 months
lyra-discover discover --max-age 6

# Only tools updated in the last 3 months (bleeding edge)
lyra-discover discover --max-age 3

# Tools up to 24 months old
lyra-discover discover --max-age 24
```

---

## Quick Start

### Installation

```bash
# Global install (recommended for CLI usage)
pnpm add -g @nirholas/lyra-tool-discovery

# Or with npm
npm install -g @nirholas/lyra-tool-discovery

# Or as a project dependency
pnpm add @nirholas/lyra-tool-discovery

# Or run directly with npx (no install)
npx @nirholas/lyra-tool-discovery discover --help
```

### Environment Setup

```bash
# Using OpenAI (default when both keys present)
export OPENAI_API_KEY="sk-..."

# Or using Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional: Force a specific provider
export AI_PROVIDER="anthropic"  # or "openai"

# Optional: Specify a model
export AI_MODEL="claude-sonnet-4-20250514"

# Optional: GitHub token for higher rate limits
export GITHUB_TOKEN="ghp_..."
```

### First Discovery

```bash
# Discover MCP servers from GitHub and npm
lyra-discover discover --sources github,npm --limit 10

# Run in dry-run mode (no AI calls)
lyra-discover discover --dry-run --limit 20

# Analyze a specific GitHub repository
lyra-discover analyze-repo anthropics claude-mcp

# Analyze an npm package
lyra-discover analyze-npm @modelcontextprotocol/server-github

# Check available AI providers
lyra-discover providers

# View all plugin templates
lyra-discover templates
```

---

## 📖 CLI Reference

### Global Options

| Flag | Alias | Description | Default |
|------|-------|-------------|---------|
| `--provider` | `-p` | AI provider (`openai` or `anthropic`) | Auto-detect from env |
| `--model` | `-m` | AI model to use | Provider default |
| `--version` | `-V` | Show version number | — |
| `--help` | `-h` | Show help | — |

### Commands

#### `discover`

Search for MCP tools and APIs across configured sources.

```bash
lyra-discover discover [options]
```

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--sources` | `-s` | Comma-separated sources: `github`, `npm`, `awesome-list` | `github,npm` |
| `--limit` | `-l` | Maximum tools to discover per source | `5` |
| `--max-age` | `-a` | Maximum age in months for discovered repos | `12` |
| `--dry-run` | `-d` | List tools without AI analysis | `false` |
| `--provider` | `-p` | AI provider to use | Auto-detect |
| `--model` | `-m` | AI model to use | Provider default |

**Examples:**

```bash
# Discover crypto MCP tools from GitHub only, limit 10 results
lyra-discover discover --sources github --limit 10

# Find tools updated in the last 6 months only
lyra-discover discover --max-age 6 --limit 20

# Dry run to preview what would be analyzed
lyra-discover discover --dry-run --sources npm --limit 20

# Use Anthropic Claude for analysis
lyra-discover discover --provider anthropic --model claude-sonnet-4-20250514

# Use OpenAI GPT-4o for analysis
lyra-discover discover --provider openai --model gpt-4o
```

**Example Output:**

```
🔍 Discovering crypto/DeFi/web3 tools from: github, npm
📅 Max age: 12 months
  Found 5 from github
  Found 3 from npm

📊 Total discovered: 8 tools
🪙 Crypto-related: 6 tools
🔌 MCP-compatible: 5 tools

🤖 Analyzing: mcp-server-ethereum...
  Template: mcp-stdio
  Reasoning: Has MCP SDK dependency and bin entry for local execution

✅ Analyzed 5 tools

📦 Generated Configs:

--- mcp-server-ethereum ---
Template: mcp-stdio
Config: {
  "identifier": "mcp-server-ethereum",
  "customParams": {
    "mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-server-ethereum"]
    }
  }
}
```

---

#### `analyze-repo`

Analyze a specific GitHub repository.

```bash
lyra-discover analyze-repo <owner> <repo> [options]
```

| Argument | Description |
|----------|-------------|
| `owner` | GitHub repository owner/organization |
| `repo` | Repository name |

| Option | Alias | Description |
|--------|-------|-------------|
| `--provider` | `-p` | AI provider to use |
| `--model` | `-m` | AI model to use |

**Examples:**

```bash
# Analyze the official MCP GitHub server
lyra-discover analyze-repo modelcontextprotocol servers

# Analyze with specific model
lyra-discover analyze-repo anthropics claude-mcp --model gpt-4o

# Analyze a community MCP server
lyra-discover analyze-repo punkpeye mcp-server-obsidian
```

**Example Output:**

```
🔍 Fetching modelcontextprotocol/servers...
🤖 Analyzing...

✅ Analysis complete:
  Template: mcp-stdio
  Reasoning: Repository contains multiple MCP servers with bin entries, using @modelcontextprotocol/sdk

📋 Quick Import JSON:
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

---

#### `analyze-npm`

Analyze a specific npm package.

```bash
lyra-discover analyze-npm <package> [options]
```

| Argument | Description |
|----------|-------------|
| `package` | npm package name (with or without scope) |

| Option | Alias | Description |
|--------|-------|-------------|
| `--provider` | `-p` | AI provider to use |
| `--model` | `-m` | AI model to use |

**Examples:**

```bash
# Analyze official MCP server packages
lyra-discover analyze-npm @modelcontextprotocol/server-github
lyra-discover analyze-npm @modelcontextprotocol/server-filesystem
lyra-discover analyze-npm @modelcontextprotocol/server-slack

# Analyze community packages
lyra-discover analyze-npm mcp-server-sqlite
```

---

#### `providers`

Show available AI providers based on configured environment variables.

```bash
lyra-discover providers
```

**Example Output (with keys configured):**

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

**Example Output (no keys):**

```
🤖 AI Provider Configuration

Available providers (based on env vars):
  ⚠️  No API keys found!

Set one of these environment variables:
  - OPENAI_API_KEY     → Use OpenAI (gpt-4o, gpt-4-turbo, etc.)
  - ANTHROPIC_API_KEY  → Use Anthropic (claude-sonnet-4-20250514, etc.)
```

---

#### `templates`

Display all available plugin templates with descriptions.

```bash
lyra-discover templates
```

**Output:**

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     plugin.delivery Plugin Templates                          ║
╠════════════╦════════════╦═══════════════════════════════════════════════════════╣
║ Template   ║ Type       ║ Description                   ║ Use Case           ║
╠════════════╬════════════╬═══════════════════════════════╬════════════════════╣
║ basic      ║ Default    ║ Standard plugin with API      ║ Simple data lookups║
║ default    ║ Default    ║ Plugin with settings UI       ║ Configurable tools ║
║ markdown   ║ Markdown   ║ Rich text output              ║ Formatted reports  ║
║ openapi    ║ OpenAPI    ║ Auto-generated from spec      ║ Existing APIs      ║
║ settings   ║ Default    ║ Plugin with user preferences  ║ Personalized tools ║
║ standalone ║ Standalone ║ Full React application        ║ Interactive UIs    ║
╠════════════╬════════════╬═══════════════════════════════╬════════════════════╣
║ mcp-http   ║ MCP        ║ Streamable HTTP MCP server    ║ Remote MCP tools   ║
║ mcp-stdio  ║ MCP        ║ STDIO-based MCP server        ║ Local npm MCP      ║
╚════════════╩════════════╩═══════════════════════════════╩════════════════════╝
```

---

## 🔧 Programmatic API

Use Lyra as a library in your Node.js/TypeScript projects:

```typescript
import { 
  ToolDiscovery, 
  GitHubSource, 
  NpmSource,
  AIAnalyzer 
} from '@nirholas/lyra-tool-discovery';

// Initialize with default settings (auto-detect AI provider)
const discovery = new ToolDiscovery();

// Or with specific configuration
const discovery = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY // Optional, uses env var by default
});

// Discover from all sources
const results = await discovery.discover({
  sources: ['github', 'npm'],
  limit: 20,
  dryRun: false
});

// Process results
for (const result of results) {
  console.log(`Tool: ${result.tool.name}`);
  console.log(`Template: ${result.decision.template}`);
  console.log(`Config:`, result.generated.pluginConfig);
}

// Analyze a specific GitHub repo
const repoResult = await discovery.analyzeGitHubRepo('owner', 'repo');
console.log(repoResult?.decision.template);

// Analyze a specific npm package
const npmResult = await discovery.analyzeNpmPackage('@scope/package-name');
console.log(npmResult?.decision.template);
```

### Using Individual Components

```typescript
import { GitHubSource, NpmSource, AIAnalyzer } from '@nirholas/lyra-tool-discovery';

// Use GitHub source directly
const github = new GitHubSource(process.env.GITHUB_TOKEN);
const mcpTools = await github.searchMCPServers(10);
const openApiTools = await github.searchOpenAPISpecs(10);
const specificRepo = await github.getRepo('owner', 'repo');

// Use npm source directly
const npm = new NpmSource();
const npmTools = await npm.searchMCPServers(10);
const specificPackage = await npm.getPackageAsTool('@modelcontextprotocol/server-github');

// Use AI analyzer directly
const ai = new AIAnalyzer({ provider: 'openai', model: 'gpt-4o' });
const decision = await ai.analyzeAndDecide(discoveredTool);
const quickImport = ai.generateQuickImport(decision);
```

### Type Definitions

```typescript
import type {
  // Discovery types
  DiscoveredTool,
  DiscoveryResult,
  DiscoverySource,
  
  // Template types
  PluginTemplate,
  TemplateDecision,
  
  // MCP types
  MCPConnection,
  MCPHttpConnection,
  MCPStdioConnection,
  MCPAuthConfig,
  
  // Plugin types
  CustomPlugin,
  PluginManifest,
  PluginIndexEntry,
  MCPQuickImportConfig
} from '@nirholas/lyra-tool-discovery';
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LYRA TOOL DISCOVERY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────────────┐  │
│  │    Sources     │     │  AI Analyzer   │     │   Template Engine      │  │
│  ├────────────────┤     ├────────────────┤     ├────────────────────────┤  │
│  │                │     │                │     │                        │  │
│  │ • GitHub API   │────▶│ • OpenAI       │────▶│ • basic                │  │
│  │   - Repos      │     │   - GPT-4o     │     │ • default              │  │
│  │   - Topics     │     │   - GPT-4-turbo│     │ • markdown             │  │
│  │   - READMEs    │     │                │     │ • openapi              │  │
│  │                │     │ • Anthropic    │     │ • settings             │  │
│  │ • npm Registry │     │   - Claude     │     │ • standalone           │  │
│  │   - Packages   │     │   - Sonnet     │     │ • mcp-http             │  │
│  │   - Keywords   │     │   - Opus       │     │ • mcp-stdio            │  │
│  │                │     │                │     │                        │  │
│  └────────────────┘     └────────────────┘     └────────────────────────┘  │
│          │                      │                         │                │
│          │                      │                         │                │
│          ▼                      ▼                         ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Discovery Result                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  {                                                                  │   │
│  │    tool: DiscoveredTool,     // Source metadata                     │   │
│  │    decision: TemplateDecision, // AI analysis result                │   │
│  │    generated: {                                                     │   │
│  │      pluginConfig: CustomPlugin | PluginIndexEntry                  │   │
│  │    }                                                                │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼                                       │
│                    ┌───────────────────────────────┐                       │
│                    │        Output Formats         │                       │
│                    ├───────────────────────────────┤                       │
│                    │ • JSON (for pipelines)        │                       │
│                    │ • Quick Import (SperaxOS)     │                       │
│                    │ • Plugin Manifests            │                       │
│                    │ • Console (human-readable)    │                       │
│                    └───────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Plugin Templates

Lyra analyzes tools and automatically selects from 8 plugin templates:

| Template | Transport | Type | Use Case | AI Selection Criteria |
|----------|-----------|------|----------|----------------------|
| `mcp-http` | HTTP/SSE | MCP | Remote MCP servers | Has MCP SDK + HTTP server code, publicly accessible URL |
| `mcp-stdio` | stdio | MCP | Local MCP servers | Has MCP SDK + `bin` entry in package.json, runs via npx |
| `openapi` | HTTP | OpenAPI | REST API integrations | Has OpenAPI/Swagger spec file or documentation |
| `standalone` | — | Standalone | Interactive applications | Needs complex UI, React components, data visualization |
| `markdown` | — | Markdown | Documentation/content | Outputs formatted text, reports, documentation |
| `default` | — | Default | Configurable plugins | Needs settings UI, configuration options |
| `settings` | — | Default | User preferences | Stores user preferences, personalization |
| `basic` | — | Default | Simple functions | Simple data lookups, basic API calls |

### AI Decision Priority

The AI follows this priority order when selecting templates:

1. **MCP Detection** → If tool uses `@modelcontextprotocol/sdk`:
   - Has HTTP server → `mcp-http`
   - Has bin entry → `mcp-stdio`
2. **OpenAPI Detection** → If has `openapi.json/yaml` or Swagger spec → `openapi`
3. **Complex UI** → If needs interactive dashboard → `standalone`
4. **Formatted Output** → If outputs rich text/markdown → `markdown`
5. **Configuration** → If needs user settings → `default` or `settings`
6. **Default** → Simple function → `basic`

---

## 🔗 Integration Pipeline

Lyra Tool Discovery is part of a larger automation toolchain for the SperaxOS ecosystem:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │     │                 │
│  lyra-discover  │────▶│  github-to-mcp  │────▶│ plugin.delivery │────▶│    SperaxOS     │
│                 │     │                 │     │                 │     │                 │
│  Discovery &    │     │   Conversion    │     │   Marketplace   │     │   End Users     │
│   Analysis      │     │                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Discovery** (this tool) — Finds tools on GitHub/npm, analyzes with AI, generates configs
2. **Conversion** — [github-to-mcp](https://github.com/nirholas/github-to-mcp) converts repos to MCP servers
3. **Registry** — [plugin.delivery](https://plugin.delivery) hosts the plugin marketplace
4. **Consumption** — SperaxOS users discover and install plugins

### Automated PR Workflow

You can set up a GitHub Action to automate the entire pipeline:

```yaml
# .github/workflows/discover-tools.yml
name: Discover New Tools

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  workflow_dispatch:

jobs:
  discover:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Lyra
        run: npm install -g @nirholas/lyra-tool-discovery
      
      - name: Discover new MCP servers
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          lyra-discover discover \
            --sources github,npm \
            --limit 50 \
            > discovered-tools.json
      
      - name: Create PR with new tools
        uses: peter-evans/create-pull-request@v5
        with:
          title: '🔮 New tools discovered by Lyra'
          body: 'Automated discovery run found new MCP servers and APIs.'
          branch: lyra/discovered-tools
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `AI_PROVIDER` | Force specific provider | `openai` or `anthropic` |
| `AI_MODEL` | Override default model | `gpt-4o`, `claude-sonnet-4-20250514` |
| `GITHUB_TOKEN` | GitHub token for higher rate limits | `ghp_...` |

### Configuration File (Coming Soon)

Support for `discovery.config.json`:

```json
{
  "sources": {
    "github": {
      "enabled": true,
      "searchQueries": [
        "mcp server in:name,description",
        "modelcontextprotocol in:readme",
        "@modelcontextprotocol in:readme"
      ],
      "minStars": 10
    },
    "npm": {
      "enabled": true,
      "keywords": ["mcp", "model-context-protocol", "mcp-server"],
      "scopes": ["@modelcontextprotocol"]
    }
  },
  "ai": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 4096
  },
  "output": {
    "format": "json",
    "path": "./data/discovered-tools.json",
    "includeMetadata": true
  },
  "filters": {
    "requireMCPSupport": true,
    "requireLicense": true,
    "excludeArchived": true
  }
}
```

---

## 📚 Examples

### Example 1: Discover and Save Results

```bash
# Discover tools and save to file
lyra-discover discover --sources github,npm --limit 20 > tools.json

# Parse with jq
cat tools.json | jq '.[] | {name: .tool.name, template: .decision.template}'
```

### Example 2: Batch Analyze Repositories

```bash
# Create a list of repos to analyze
repos=(
  "modelcontextprotocol/servers"
  "anthropics/claude-mcp"
  "punkpeye/mcp-server-obsidian"
)

# Analyze each repo
for repo in "${repos[@]}"; do
  owner=$(echo $repo | cut -d'/' -f1)
  name=$(echo $repo | cut -d'/' -f2)
  lyra-discover analyze-repo $owner $name
  echo "---"
done
```

### Example 3: Analyze npm Packages in CI

```typescript
// scripts/analyze-packages.ts
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

const packages = [
  '@modelcontextprotocol/server-github',
  '@modelcontextprotocol/server-filesystem',
  '@modelcontextprotocol/server-slack',
];

async function main() {
  const discovery = new ToolDiscovery({ provider: 'openai' });
  
  for (const pkg of packages) {
    const result = await discovery.analyzeNpmPackage(pkg);
    if (result) {
      console.log(JSON.stringify({
        package: pkg,
        template: result.decision.template,
        config: result.generated.pluginConfig
      }, null, 2));
    }
  }
}

main();
```

### Example 4: Custom Source Integration

```typescript
import { AIAnalyzer, type DiscoveredTool } from '@nirholas/lyra-tool-discovery';

// Create a custom discovered tool
const customTool: DiscoveredTool = {
  id: 'custom:my-tool',
  name: 'my-custom-mcp-server',
  description: 'A custom MCP server for my application',
  source: 'github',
  sourceUrl: 'https://github.com/myorg/my-tool',
  hasMCPSupport: true,
  hasNpmPackage: true,
  readme: '# My Tool\n\nAn MCP server that does X, Y, Z...',
  packageJson: {
    name: 'my-custom-mcp-server',
    bin: { 'my-mcp': './dist/cli.js' },
    dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' }
  }
};

// Analyze with AI
const ai = new AIAnalyzer({ provider: 'anthropic' });
const decision = await ai.analyzeAndDecide(customTool);
console.log(`Template: ${decision.template}`);
console.log(`Reasoning: ${decision.reasoning}`);
```

### Example 5: Dry Run with Filtering

```bash
# Discover in dry-run mode to see what would be analyzed
lyra-discover discover --dry-run --sources github --limit 50

# Output:
# [DRY RUN] Would analyze: mcp-server-github
#   Source: github
#   URL: https://github.com/modelcontextprotocol/servers
#   MCP: Yes
# [DRY RUN] Would analyze: claude-mcp
#   Source: github
#   URL: https://github.com/anthropics/claude-mcp
#   MCP: Yes
# ...
```

### Example 6: Generate Quick Import for SperaxOS

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

const discovery = new ToolDiscovery();
const result = await discovery.analyzeNpmPackage('@modelcontextprotocol/server-github');

// The quick import format can be directly pasted into SperaxOS
console.log(`Add this to your MCP configuration:`);
console.log(JSON.stringify({
  mcpServers: {
    [result.tool.name]: result.decision.config.customParams?.mcp
  }
}, null, 2));
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/nirholas/lyra-tool-discovery.git
cd lyra-tool-discovery

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run in development mode
pnpm dev discover --dry-run

# Build
pnpm build

# Run tests
pnpm test
```

### Code Style

- We use **TypeScript** with strict mode
- **ESLint** for linting
- **Prettier** for formatting
- Write **JSDoc comments** for public APIs
- Follow **conventional commits** for commit messages

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Run `pnpm build` and `pnpm test`
6. Commit with conventional commit message: `feat: add amazing feature`
7. Push to your fork: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Areas for Contribution

- 🔌 **New Sources** — Add support for Smithery, OpenAPI Directory, RapidAPI
- 🤖 **AI Providers** — Add support for Gemini, Mistral, local models
- 📝 **Documentation** — Improve examples, add tutorials
- 🧪 **Testing** — Add unit tests, integration tests
- 🐛 **Bug Fixes** — Check the issues tab

---

## 🔗 Related Projects

| Project | Description |
|---------|-------------|
| [github-to-mcp](https://github.com/nirholas/github-to-mcp) | Convert GitHub repos to MCP servers |
| [plugin.delivery](https://plugin.delivery) | Plugin marketplace for SperaxOS |
| [SperaxOS](https://sperax.io) | AI-native operating system |
| [lyra-registry](https://github.com/nirholas/lyra-registry) | Curated registry of discovered plugins |
| [UCAI](https://github.com/nirholas/ucai) | Universal Context AI framework |
| [MCP SDK](https://github.com/modelcontextprotocol/sdk) | Official Model Context Protocol SDK |

---

## 📄 License

MIT License © 2024 [nirholas](https://github.com/nirholas)

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Credits

- made by nich [Model Context Protocol](https://modelcontextprotocol.io) ecosystem
- Powered by [OpenAI](https://openai.com) and [Anthropic](https://anthropic.com)
- Inspired by the need to automate plugin discovery for SperaxOS

---

<div align="center">

**[⬆ Back to Top](#-lyra-tool-discovery)**


</div>
