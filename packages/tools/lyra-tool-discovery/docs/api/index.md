# API Overview

Use Lyra Tool Discovery as a library in your TypeScript or JavaScript projects.

## Installation

::: code-group

```bash [pnpm]
pnpm add @nirholas/lyra-tool-discovery
```

```bash [npm]
npm install @nirholas/lyra-tool-discovery
```

```bash [yarn]
yarn add @nirholas/lyra-tool-discovery
```

:::

## Basic Usage

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

// Create instance with AI config
const discovery = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'
});

// Discover tools
const results = await discovery.discover({
  sources: ['github', 'npm'],
  limit: 10
});

// Process results
for (const result of results) {
  console.log(`${result.tool.name}: ${result.decision.template}`);
}
```

## TypeScript Support

Lyra is written in TypeScript and provides full type definitions:

```typescript
import { 
  ToolDiscovery,
  AIAnalyzer,
  GitHubSource,
  NpmSource
} from '@nirholas/lyra-tool-discovery';

import type {
  DiscoveredTool,
  DiscoveryResult,
  TemplateDecision,
  PluginTemplate,
  AIConfig,
  DiscoveryOptions
} from '@nirholas/lyra-tool-discovery';
```

## Module Structure

```typescript
// Main entry point
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

// Individual exports
import { AIAnalyzer } from '@nirholas/lyra-tool-discovery';
import { GitHubSource } from '@nirholas/lyra-tool-discovery';
import { NpmSource } from '@nirholas/lyra-tool-discovery';

// Types
import type { DiscoveredTool } from '@nirholas/lyra-tool-discovery';
```

## Quick Examples

### Analyze a GitHub Repository

```typescript
const discovery = new ToolDiscovery();

const result = await discovery.analyzeGitHubRepo(
  'modelcontextprotocol', 
  'servers'
);

if (result) {
  console.log(`Template: ${result.decision.template}`);
  console.log(`Config: ${JSON.stringify(result.generated.pluginConfig)}`);
}
```

### Analyze an npm Package

```typescript
const discovery = new ToolDiscovery();

const result = await discovery.analyzeNpmPackage(
  '@modelcontextprotocol/server-filesystem'
);

if (result) {
  console.log(`Template: ${result.decision.template}`);
}
```

### Use AIAnalyzer Directly

```typescript
import { AIAnalyzer } from '@nirholas/lyra-tool-discovery';

const analyzer = new AIAnalyzer({
  provider: 'openai',
  model: 'gpt-4o'
});

const decision = await analyzer.analyzeAndDecide(tool);
const quickImport = analyzer.generateQuickImport(decision);
```

### Use Sources Directly

```typescript
import { GitHubSource, NpmSource } from '@nirholas/lyra-tool-discovery';

const github = new GitHubSource(process.env.GITHUB_TOKEN);
const npm = new NpmSource();

const githubTools = await github.searchMCPServers(10);
const npmTools = await npm.searchMCPServers(10);
```

## Error Handling

```typescript
try {
  const results = await discovery.discover({ limit: 10 });
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Missing API key');
  } else if (error.message.includes('rate limit')) {
    console.error('Rate limited, try again later');
  } else {
    throw error;
  }
}
```

## Environment Setup

The library reads from environment variables:

```typescript
// Required: At least one AI provider
process.env.OPENAI_API_KEY = 'sk-...';
// or
process.env.ANTHROPIC_API_KEY = 'sk-ant-...';

// Optional: GitHub token for higher rate limits
process.env.GITHUB_TOKEN = 'ghp_...';
```

Or pass directly:

```typescript
const discovery = new ToolDiscovery({
  provider: 'openai',
  apiKey: 'sk-...',  // Override env var
  model: 'gpt-4o'
});
```

## Next Steps

- [ToolDiscovery](/api/tool-discovery) - Main class reference
- [AIAnalyzer](/api/ai-analyzer) - AI analyzer reference
- [Types](/api/types) - Type definitions
