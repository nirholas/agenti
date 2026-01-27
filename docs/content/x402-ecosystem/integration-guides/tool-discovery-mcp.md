# Tool Discovery MCP x402 Integration

> AI agent discovers MCP servers from GitHub, npm - analyzes APIs, configs.

## Overview

**Repository:** [nirholas/tool-discovery-mcp](https://github.com/nirholas/tool-discovery-mcp)  
**MCP Registry:** `io.github.nirholas/tool-discovery-mcp`  
**x402 Use Case:** Premium recommendations, batch discovery, integration assistance

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/tool-discovery-mcp
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { ToolMarketplace } from '@nirholas/x402-ecosystem/marketplace';
import { ToolDiscovery } from '@nirholas/tool-discovery-mcp';

// Discovery pricing
const discoveryPricing = PricingStrategy.fixed({
  'basic-search': 0,            // Free: basic search
  'deep-analysis': 0.05,        // $0.05: detailed tool analysis
  'ai-recommendations': 0.10,   // $0.10: AI-powered recommendations
  'compatibility-check': 0.02,  // $0.02: compatibility analysis
  'batch-discovery': 0.25,      // $0.25: discover tools for use case
  'integration-guide': 0.15,    // $0.15: generate integration guide
  'monitoring': 2.00            // $2/month: new tool alerts
});

const discovery = new PaywallBuilder()
  .service('tool-discovery-mcp')
  .pricing(discoveryPricing)
  .build();
```

## Discovery Methods

```typescript
// Free: Basic search
async function searchTools(query: string) {
  return ToolDiscovery.search(query, {
    sources: ['mcp-registry', 'github', 'npm'],
    limit: 10
  });
}

// Premium: Deep analysis
async function analyzeToolDeep(toolId: string) {
  await discovery.charge(0.05, { type: 'deep-analysis', tool: toolId });
  
  return ToolDiscovery.analyze(toolId, {
    readme: true,
    apiStructure: true,
    dependencies: true,
    securityAudit: true,
    usageExamples: true,
    maintenance: true,     // Last update, issue response time
    communityHealth: true  // Stars, forks, contributors
  });
}

// Premium: AI recommendations
async function getRecommendations(context: AgentContext) {
  await discovery.charge(0.10, { type: 'ai-recommendations' });
  
  return ToolDiscovery.recommend({
    currentTools: context.installedTools,
    useCase: context.primaryUseCase,
    preferences: {
      prioritize: ['security', 'performance', 'ease-of-use'],
      avoid: context.blacklistedTools,
      budget: context.monthlyBudget
    }
  });
}
```

## Marketplace Integration

```typescript
import { ToolMarketplace } from '@nirholas/x402-ecosystem/marketplace';

// Sync discovered tools with marketplace
const marketplace = new ToolMarketplace({
  network: 'eip155:42161',
  registryAddress: '0x...'
});

async function syncDiscoveredTools() {
  // Discover new tools
  const newTools = await ToolDiscovery.findNew({
    since: Date.now() - 24 * 60 * 60 * 1000, // Last 24h
    minStars: 10,
    categories: ['crypto', 'defi', 'blockchain']
  });
  
  // Register in marketplace
  for (const tool of newTools) {
    const analysis = await ToolDiscovery.analyze(tool.id);
    
    await marketplace.registerTool({
      id: tool.id,
      name: tool.name,
      description: analysis.summary,
      category: analysis.category,
      pricing: analysis.suggestedPricing
    });
  }
  
  return { registered: newTools.length };
}
```

## Batch Discovery

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['tool-discovery-mcp'],
  dailyLimit: 10
});

// Discover all tools for a use case
async function discoverForUseCase(useCase: string) {
  await agent.pay({
    service: 'tool-discovery-mcp',
    amount: 0.25,
    description: `Discover tools for: ${useCase}`
  });
  
  return ToolDiscovery.discoverForUseCase(useCase, {
    depth: 'comprehensive',
    includeAlternatives: true,
    compareFeatures: true,
    recommendStack: true
  });
}

// Example output
const defiTools = await discoverForUseCase('defi trading bot');
// Returns: 
// - Core tools: swap, price feed, portfolio tracker
// - Optional: alerts, analytics, social signals
// - Recommended stack with pricing
```

## Compatibility Check

```typescript
// Check tool compatibility
async function checkCompatibility(toolId: string, environment: Environment) {
  await discovery.charge(0.02, { type: 'compatibility-check' });
  
  return ToolDiscovery.checkCompatibility(toolId, {
    nodeVersion: environment.nodeVersion,
    mcpVersion: environment.mcpVersion,
    existingTools: environment.installedTools,
    platform: environment.platform,
    // Returns: compatible, conflicts, required updates
  });
}
```

## Integration Guide Generation

```typescript
// Generate integration guide for a tool
async function generateIntegrationGuide(toolId: string, context: ProjectContext) {
  await discovery.charge(0.15, { type: 'integration-guide' });
  
  return ToolDiscovery.generateGuide(toolId, {
    projectType: context.projectType,
    existingStack: context.stack,
    preferredLanguage: context.language,
    format: 'markdown',
    includeExamples: true,
    includeTests: true
  });
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Basic search | ✅ (10/day) | ✅ Unlimited |
| Tool metadata | ✅ | ✅ |
| Deep analysis | ❌ | $0.05 |
| AI recommendations | ❌ | $0.10 |
| Compatibility check | ❌ | $0.02 |
| Batch discovery | ❌ | $0.25 |
| Integration guide | ❌ | $0.15 |
| New tool alerts | ❌ | $2/month |

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // Tool Discovery maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + AI costs
};
```

## MCP Tool Registration

```typescript
server.tool('discover_mcp_tools', {
  description: 'Discover MCP servers from GitHub, npm, registry',
  inputSchema: z.object({
    query: z.string().optional(),
    useCase: z.string().optional(),
    deep: z.boolean().default(false)
  }),
  handler: async (params) => {
    if (params.useCase) {
      return discoverForUseCase(params.useCase);
    }
    if (params.deep && params.query) {
      const results = await searchTools(params.query);
      return Promise.all(results.map(t => analyzeToolDeep(t.id)));
    }
    return searchTools(params.query || '');
  }
});

server.tool('get_tool_recommendations', {
  description: 'Get AI-powered tool recommendations for your agent',
  inputSchema: z.object({
    currentTools: z.array(z.string()),
    useCase: z.string(),
    budget: z.number().optional()
  }),
  handler: async (params) => {
    return getRecommendations({
      installedTools: params.currentTools,
      primaryUseCase: params.useCase,
      monthlyBudget: params.budget
    });
  }
});
```
