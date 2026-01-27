# AIAnalyzer Class

The AI analysis engine that determines plugin templates and generates configurations.

## Import

```typescript
import { AIAnalyzer } from '@nirholas/lyra-tool-discovery';
```

## Constructor

```typescript
new AIAnalyzer(config?: AIConfig)
```

### Parameters

```typescript
interface AIConfig {
  provider?: 'openai' | 'anthropic';
  apiKey?: string;
  model?: string;
}
```

### Examples

```typescript
// Auto-detect provider
const analyzer = new AIAnalyzer();

// Explicit configuration
const analyzer = new AIAnalyzer({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'
});

// With custom API key
const analyzer = new AIAnalyzer({
  provider: 'openai',
  apiKey: process.env.MY_OPENAI_KEY,
  model: 'gpt-4o'
});
```

## Methods

### analyzeAndDecide()

Analyze a discovered tool and determine the best template.

```typescript
analyzeAndDecide(tool: DiscoveredTool): Promise<TemplateDecision>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tool` | `DiscoveredTool` | Tool to analyze |

#### Returns

```typescript
interface TemplateDecision {
  template: PluginTemplate;
  reasoning: string;
  config: CustomPlugin | PluginIndexEntry;
}

type PluginTemplate = 
  | 'basic'
  | 'default'
  | 'markdown'
  | 'openapi'
  | 'settings'
  | 'standalone'
  | 'mcp-http'
  | 'mcp-stdio';
```

#### Example

```typescript
import { AIAnalyzer, GitHubSource } from '@nirholas/lyra-tool-discovery';

const github = new GitHubSource();
const analyzer = new AIAnalyzer({ provider: 'anthropic' });

// Get a tool
const tools = await github.searchMCPServers(1);
const tool = tools[0];

// Analyze it
const decision = await analyzer.analyzeAndDecide(tool);

console.log(`Template: ${decision.template}`);
console.log(`Reasoning: ${decision.reasoning}`);
console.log(`Config:`, decision.config);
```

---

### generateQuickImport()

Generate MCP Quick Import JSON for a template decision.

```typescript
generateQuickImport(decision: TemplateDecision): string | null
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `decision` | `TemplateDecision` | Template decision with MCP config |

#### Returns

`string | null` - JSON string for quick import, or null if not an MCP plugin.

#### Example

```typescript
const decision = await analyzer.analyzeAndDecide(tool);

const quickImport = analyzer.generateQuickImport(decision);

if (quickImport) {
  console.log('📋 Quick Import JSON:');
  console.log(quickImport);
  
  // Parse it
  const config = JSON.parse(quickImport);
  console.log('MCP Servers:', Object.keys(config.mcpServers));
}
```

#### Output Format (HTTP)

```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://api.example.com/mcp",
      "auth": {
        "type": "bearer",
        "token": "${API_KEY}"
      }
    }
  }
}
```

#### Output Format (STDIO)

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@scope/mcp-server"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

---

### getProviderInfo()

Get information about the configured AI provider.

```typescript
getProviderInfo(): { provider: AIProvider; model: string }
```

#### Example

```typescript
const analyzer = new AIAnalyzer({ provider: 'anthropic' });
const info = analyzer.getProviderInfo();

console.log(`Provider: ${info.provider}`);  // 'anthropic'
console.log(`Model: ${info.model}`);        // 'claude-sonnet-4-20250514'
```

## Helper Function

### getAvailableProviders()

Check which AI providers have API keys configured.

```typescript
import { getAvailableProviders } from '@nirholas/lyra-tool-discovery';

const providers = getAvailableProviders();
// ['anthropic'] or ['openai'] or ['anthropic', 'openai'] or []
```

## Provider Detection Logic

The analyzer auto-detects providers in this order:

```typescript
function detectProvider(): AIProvider {
  // 1. Check explicit AI_PROVIDER env var
  if (process.env.AI_PROVIDER === 'openai') return 'openai';
  if (process.env.AI_PROVIDER === 'anthropic') return 'anthropic';
  
  // 2. Use the one with API key (if only one)
  if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return 'openai';
  }
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return 'anthropic';
  }
  
  // 3. Prefer OpenAI if both available
  if (process.env.OPENAI_API_KEY) return 'openai';
  
  // 4. Fall back to Anthropic
  return 'anthropic';
}
```

## Model Selection

Default models by provider:

| Provider | Default Model |
|----------|--------------|
| OpenAI | `gpt-4o` |
| Anthropic | `claude-sonnet-4-20250514` |

Override with `AI_MODEL` env var or `model` config option.

## AI Prompt Structure

The analyzer uses a structured prompt:

```typescript
const ANALYSIS_PROMPT = `You are analyzing a discovered tool...

${TEMPLATE_DESCRIPTIONS}

Tool Information:
{TOOL_INFO}

Respond with valid JSON only:
{
  "template": "one of 8 templates",
  "reasoning": "explanation",
  "config": { /* plugin config */ }
}
`;
```

The tool info includes:
- Name, description, source URL
- README content (truncated to 2000 chars)
- package.json highlights
- MCP config hints
- Type indicators (hasMCP, hasOpenAPI, etc.)

## Complete Example

```typescript
import { 
  AIAnalyzer, 
  GitHubSource, 
  getAvailableProviders 
} from '@nirholas/lyra-tool-discovery';

async function analyzeRepository(owner: string, repo: string) {
  // Check providers
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new Error('No AI providers configured');
  }
  
  // Use Anthropic if available, else OpenAI
  const provider = providers.includes('anthropic') ? 'anthropic' : 'openai';
  
  const github = new GitHubSource();
  const analyzer = new AIAnalyzer({ provider });
  
  console.log(`Using ${analyzer.getProviderInfo().model}`);
  
  // Fetch repo as tool
  const tool = await github.getRepo(owner, repo);
  if (!tool) {
    throw new Error('Repository not found');
  }
  
  // Analyze
  const decision = await analyzer.analyzeAndDecide(tool);
  
  // Generate quick import if MCP
  const quickImport = analyzer.generateQuickImport(decision);
  
  return {
    tool,
    decision,
    quickImport
  };
}

// Usage
const result = await analyzeRepository('modelcontextprotocol', 'servers');
console.log(result.decision.template);
```

## Error Handling

```typescript
try {
  const decision = await analyzer.analyzeAndDecide(tool);
} catch (error) {
  if (error.message.includes('No AI client')) {
    // API key not configured
  } else if (error.message.includes('parsing failed')) {
    // AI returned invalid JSON
    console.error('AI response parsing failed');
  } else if (error.message.includes('rate limit')) {
    // Rate limited
    await sleep(60000);
    return analyzer.analyzeAndDecide(tool);
  }
}
```

## Next Steps

- [Types](/api/types) - Full type definitions
- [ToolDiscovery](/api/tool-discovery) - Main class
- [Examples](/examples/) - Usage examples
