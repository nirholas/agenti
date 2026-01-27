# Custom AI Configuration

Configure AI providers, select models, and optimize for cost and performance.

## Goal

Learn how to configure different AI providers and models for optimal results.

## Provider Selection

### Anthropic (Claude)

```typescript
import { ToolDiscovery } from '@nirholas/lyra-tool-discovery';

const discovery = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'  // Default
});

// Alternative models
const haiku = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307'  // Faster, cheaper
});

const opus = new ToolDiscovery({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229'  // Most capable
});
```

### OpenAI (GPT)

```typescript
const discovery = new ToolDiscovery({
  provider: 'openai',
  model: 'gpt-4o'  // Default
});

// Alternative models
const turbo = new ToolDiscovery({
  provider: 'openai',
  model: 'gpt-4-turbo'  // Vision capable
});

const fast = new ToolDiscovery({
  provider: 'openai',
  model: 'gpt-3.5-turbo'  // Fastest, cheapest
});
```

## Custom API Keys

```typescript
// Use specific API key (not from env)
const discovery = new ToolDiscovery({
  provider: 'anthropic',
  apiKey: 'sk-ant-custom-key...',
  model: 'claude-sonnet-4-20250514'
});
```

## Dynamic Provider Selection

```typescript
import { 
  ToolDiscovery, 
  getAvailableProviders 
} from '@nirholas/lyra-tool-discovery';

function createDiscovery() {
  const available = getAvailableProviders();
  
  if (available.length === 0) {
    throw new Error('No AI providers configured');
  }
  
  // Prefer Anthropic for better reasoning
  const provider = available.includes('anthropic') 
    ? 'anthropic' 
    : 'openai';
  
  return new ToolDiscovery({ provider });
}
```

## Cost Optimization

### Two-Stage Analysis

Use a cheap model for initial filtering, then a better model for final analysis:

```typescript
import { ToolDiscovery, AIAnalyzer, GitHubSource } from '@nirholas/lyra-tool-discovery';

async function costOptimizedDiscovery(limit: number) {
  const github = new GitHubSource();
  
  // Stage 1: Quick screening with cheap model
  const screener = new AIAnalyzer({
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307'
  });
  
  // Stage 2: Detailed analysis with better model
  const analyzer = new AIAnalyzer({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514'
  });
  
  // Get tools
  const tools = await github.searchMCPServers(limit * 2);
  
  console.log('📊 Stage 1: Quick screening...');
  
  const candidates = [];
  for (const tool of tools) {
    try {
      const decision = await screener.analyzeAndDecide(tool);
      
      // Only keep MCP tools for detailed analysis
      if (decision.template.startsWith('mcp-')) {
        candidates.push({ tool, quickDecision: decision });
      }
    } catch (e) {
      // Skip failed tools
    }
    
    if (candidates.length >= limit) break;
  }
  
  console.log(`\n✅ Found ${candidates.length} MCP candidates`);
  console.log('\n📊 Stage 2: Detailed analysis...');
  
  const results = [];
  for (const { tool } of candidates) {
    const decision = await analyzer.analyzeAndDecide(tool);
    results.push({ tool, decision });
  }
  
  return results;
}

// Usage
const results = await costOptimizedDiscovery(10);
```

### Batch with Cheaper Model

```typescript
async function batchWithCheapModel() {
  // Use GPT-3.5 for bulk processing
  const discovery = new ToolDiscovery({
    provider: 'openai',
    model: 'gpt-3.5-turbo'
  });
  
  const results = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 100  // Process many with cheap model
  });
  
  return results;
}
```

## Model Comparison

### Test Different Models

```typescript
import { AIAnalyzer, GitHubSource } from '@nirholas/lyra-tool-discovery';

async function compareModels(owner: string, repo: string) {
  const github = new GitHubSource();
  const tool = await github.getRepo(owner, repo);
  
  if (!tool) {
    throw new Error('Repository not found');
  }
  
  const models = [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'openai', model: 'gpt-3.5-turbo' },
    { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
  ] as const;
  
  console.log(`\nAnalyzing: ${owner}/${repo}\n`);
  
  for (const config of models) {
    const analyzer = new AIAnalyzer(config);
    const start = Date.now();
    
    try {
      const decision = await analyzer.analyzeAndDecide(tool);
      const elapsed = Date.now() - start;
      
      console.log(`${config.provider}/${config.model}:`);
      console.log(`  Template: ${decision.template}`);
      console.log(`  Time: ${elapsed}ms`);
      console.log(`  Reasoning: ${decision.reasoning.slice(0, 100)}...`);
      console.log();
    } catch (error) {
      console.log(`${config.provider}/${config.model}: FAILED`);
      console.log(`  ${error}`);
      console.log();
    }
  }
}

// Usage
await compareModels('modelcontextprotocol', 'servers');
```

## Environment-Based Configuration

```typescript
function getAIConfig() {
  const env = process.env.NODE_ENV;
  
  if (env === 'production') {
    return {
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-20250514'
    };
  }
  
  if (env === 'test') {
    return {
      provider: 'openai' as const,
      model: 'gpt-3.5-turbo'  // Cheap for testing
    };
  }
  
  // Development: use what's available
  const providers = getAvailableProviders();
  return {
    provider: providers[0] || 'anthropic' as const
  };
}

const discovery = new ToolDiscovery(getAIConfig());
```

## Rate Limit Handling

```typescript
import { AIAnalyzer } from '@nirholas/lyra-tool-discovery';

class RateLimitedAnalyzer {
  private analyzer: AIAnalyzer;
  private lastCall = 0;
  private minInterval = 1000; // 1 second between calls
  
  constructor(config: { provider: 'openai' | 'anthropic' }) {
    this.analyzer = new AIAnalyzer(config);
  }
  
  async analyze(tool: any) {
    // Throttle requests
    const now = Date.now();
    const wait = Math.max(0, this.minInterval - (now - this.lastCall));
    
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    
    this.lastCall = Date.now();
    
    // Retry on rate limit
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.analyzer.analyzeAndDecide(tool);
      } catch (error: any) {
        if (error.message?.includes('rate limit')) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Rate limited, waiting ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}
```

## Next Steps

- [Batch Processing](/examples/batch-processing) - Process many tools
- [GitHub Actions](/examples/github-actions) - Automated workflows
- [AI Providers Guide](/guide/ai-providers) - Detailed provider docs
