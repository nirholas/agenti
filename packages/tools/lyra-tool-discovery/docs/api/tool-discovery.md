# ToolDiscovery Class

The main class for discovering and analyzing MCP tools.

## Import

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';
```

## Constructor

```typescript
new ToolDiscovery(aiConfig?: AIConfig)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `aiConfig` | `AIConfig` | Optional AI configuration |

### AIConfig

```typescript
interface AIConfig {
  provider?: 'openai' | 'anthropic';
  apiKey?: string;
  model?: string;
}
```

### Examples

```typescript
// Auto-detect provider from env vars
const discovery = new ToolDiscovery();

// Explicit provider
const discovery = new ToolDiscovery({
  provider: 'anthropic'
});

// Full configuration
const discovery = new ToolDiscovery({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.MY_OPENAI_KEY
});
```

## Methods

### discover()

Search for MCP tools across configured sources.

```typescript
discover(options?: DiscoveryOptions): Promise<DiscoveryResult[]>
```

#### DiscoveryOptions

```typescript
interface DiscoveryOptions {
  sources?: DiscoverySource[];  // Default: ['github', 'npm']
  limit?: number;                // Default: 10
  dryRun?: boolean;              // Default: false
  outputDir?: string;            // Output directory for files
}

type DiscoverySource = 'github' | 'npm' | 'smithery' | 'mcp-directory';
```

#### Returns

```typescript
interface DiscoveryResult {
  tool: DiscoveredTool;
  decision: TemplateDecision;
  generated: {
    pluginConfig: CustomPlugin | PluginIndexEntry;
    files?: Record<string, string>;
  };
}
```

#### Examples

```typescript
// Basic discovery
const results = await discovery.discover();

// With options
const results = await discovery.discover({
  sources: ['github'],
  limit: 20
});

// Dry run (no AI analysis)
const results = await discovery.discover({
  sources: ['github', 'npm'],
  limit: 50,
  dryRun: true
});

// Process results
for (const result of results) {
  console.log(`${result.tool.name}: ${result.decision.template}`);
  console.log(`Reasoning: ${result.decision.reasoning}`);
}
```

---

### analyzeGitHubRepo()

Analyze a specific GitHub repository.

```typescript
analyzeGitHubRepo(owner: string, repo: string): Promise<DiscoveryResult | null>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | `string` | Repository owner |
| `repo` | `string` | Repository name |

#### Returns

`DiscoveryResult | null` - Analysis result or null if not found.

#### Examples

```typescript
// Analyze a repository
const result = await discovery.analyzeGitHubRepo(
  'modelcontextprotocol',
  'servers'
);

if (result) {
  console.log(`Template: ${result.decision.template}`);
  console.log(`Reasoning: ${result.decision.reasoning}`);
  console.log(`Config:`, result.generated.pluginConfig);
} else {
  console.log('Repository not found');
}
```

---

### analyzeNpmPackage()

Analyze a specific npm package.

```typescript
analyzeNpmPackage(name: string): Promise<DiscoveryResult | null>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Package name (with or without scope) |

#### Returns

`DiscoveryResult | null` - Analysis result or null if not found.

#### Examples

```typescript
// Scoped package
const result = await discovery.analyzeNpmPackage(
  '@modelcontextprotocol/server-filesystem'
);

// Unscoped package
const result = await discovery.analyzeNpmPackage('mcp-server-sqlite');

if (result) {
  const config = result.generated.pluginConfig;
  console.log(`Plugin ID: ${config.identifier}`);
}
```

## Complete Example

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

async function main() {
  // Initialize with Anthropic
  const discovery = new ToolDiscovery({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514'
  });

  // Discover from all sources
  console.log('🔍 Discovering tools...');
  const results = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 10
  });

  console.log(`Found ${results.length} tools\n`);

  // Group by template
  const byTemplate = new Map<string, typeof results>();
  for (const result of results) {
    const template = result.decision.template;
    if (!byTemplate.has(template)) {
      byTemplate.set(template, []);
    }
    byTemplate.get(template)!.push(result);
  }

  // Report
  for (const [template, tools] of byTemplate) {
    console.log(`\n📦 ${template} (${tools.length} tools):`);
    for (const { tool, decision } of tools) {
      console.log(`  - ${tool.name}`);
      console.log(`    ${decision.reasoning}`);
    }
  }

  // Generate configs
  const mcpConfigs = results
    .filter(r => r.decision.template.startsWith('mcp-'))
    .map(r => r.generated.pluginConfig);

  console.log('\n📋 MCP Configs:', JSON.stringify(mcpConfigs, null, 2));
}

main().catch(console.error);
```

## Error Handling

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

async function safeDiscover() {
  const discovery = new ToolDiscovery();

  try {
    const results = await discovery.discover({ limit: 10 });
    return results;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('No API key')) {
        console.error('❌ Missing API key');
        console.log('Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
        return [];
      }
      
      if (error.message.includes('rate limit')) {
        console.error('⏳ Rate limited, waiting...');
        await new Promise(r => setTimeout(r, 60000));
        return discovery.discover({ limit: 10 });
      }
      
      if (error.message.includes('404')) {
        console.error('🔍 Resource not found');
        return [];
      }
    }
    
    throw error; // Re-throw unknown errors
  }
}
```

## Next Steps

- [AIAnalyzer](/api/ai-analyzer) - AI analyzer class
- [Types](/api/types) - Type definitions
- [Examples](/examples/) - Usage examples
