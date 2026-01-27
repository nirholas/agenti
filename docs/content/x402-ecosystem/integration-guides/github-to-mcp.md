# GitHub-to-MCP x402 Integration

> Convert any GitHub repo to MCP server - automatic tool generation, API wrap.

## Overview

**Repository:** [nirholas/github-to-mcp](https://github.com/nirholas/github-to-mcp)  
**MCP Registry:** `io.github.nirholas/github-to-mcp`  
**x402 Use Case:** Premium conversions, private repos, enterprise features

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/github-to-mcp
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { GitHubToMCP } from '@nirholas/github-to-mcp';

// Repo complexity pricing
const conversionPricing = PricingStrategy.tiered([
  { threshold: 10, priceUsd: 0 },       // Free: < 10 files
  { threshold: 50, priceUsd: 0.10 },    // $0.10: 10-50 files
  { threshold: 200, priceUsd: 0.50 },   // $0.50: 50-200 files
  { threshold: 1000, priceUsd: 2.00 },  // $2.00: 200-1000 files
  { threshold: Infinity, priceUsd: 10 } // $10: monorepos
]);

const converter = new PaywallBuilder()
  .service('github-to-mcp')
  .pricing(conversionPricing)
  .feature('private-repo', 0.25)     // +$0.25 for private repos
  .feature('auto-docs', 0.15)        // +$0.15 for documentation
  .feature('type-inference', 0.20)   // +$0.20 for TypeScript types
  .feature('test-generation', 0.50)  // +$0.50 for test scaffolds
  .build();
```

## Conversion Service

```typescript
// Convert GitHub repo to MCP server
async function convertRepo(repoUrl: string, options: ConvertOptions = {}) {
  const analysis = await GitHubToMCP.analyze(repoUrl);
  
  // Calculate base cost
  let cost = conversionPricing.calculate({ usage: analysis.fileCount });
  
  // Add feature costs
  if (analysis.isPrivate) cost += 0.25;
  if (options.generateDocs) cost += 0.15;
  if (options.inferTypes) cost += 0.20;
  if (options.generateTests) cost += 0.50;
  
  if (cost > 0) {
    await converter.charge(cost, { repo: repoUrl, analysis, options });
  }
  
  return GitHubToMCP.convert(repoUrl, options);
}
```

## Analysis Output

```typescript
interface RepoAnalysis {
  fileCount: number;
  languages: string[];
  hasApi: boolean;
  hasCli: boolean;
  endpoints: EndpointInfo[];
  functions: FunctionInfo[];
  suggestedTools: ToolSuggestion[];
  complexity: 'simple' | 'medium' | 'complex' | 'monorepo';
  estimatedCost: number;
}
```

## Premium Features

| Feature | Free | Premium |
|---------|------|---------|
| Public repos (<10 files) | ✅ | ✅ |
| Basic tool extraction | ✅ | ✅ |
| Private repos | ❌ | +$0.25 |
| Auto documentation | ❌ | +$0.15 |
| TypeScript inference | ❌ | +$0.20 |
| Test generation | ❌ | +$0.50 |
| Monorepo support | ❌ | $10+ |
| CI/CD integration | ❌ | +$1.00 |

## Batch Conversion

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['github-to-mcp'],
  dailyLimit: 50
});

// Convert multiple repos
async function batchConvert(repos: string[]) {
  const analyses = await Promise.all(
    repos.map(r => GitHubToMCP.analyze(r))
  );
  
  const totalCost = analyses.reduce((sum, a) => 
    sum + conversionPricing.calculate({ usage: a.fileCount }), 0
  );
  
  // 25% batch discount
  const discountedCost = totalCost * 0.75;
  
  await agent.pay({
    service: 'github-to-mcp',
    amount: discountedCost,
    description: `Batch convert ${repos.length} repos`
  });
  
  return GitHubToMCP.batchConvert(repos);
}
```

## Output Templates

```typescript
// Generated MCP server structure
const outputTemplate = {
  'package.json': '// Dependencies and scripts',
  'src/index.ts': '// MCP server entry point',
  'src/tools.ts': '// Generated tool definitions',
  'src/handlers.ts': '// Tool implementation handlers',
  'README.md': '// Auto-generated documentation',
  'tsconfig.json': '// TypeScript configuration'
};
```

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // GitHub-to-MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + GitHub API
};
```

## MCP Tool Registration

```typescript
server.tool('convert_github_to_mcp', {
  description: 'Convert GitHub repository to MCP server',
  inputSchema: z.object({
    repoUrl: z.string().url(),
    generateDocs: z.boolean().default(true),
    inferTypes: z.boolean().default(true),
    generateTests: z.boolean().default(false)
  }),
  handler: async (params) => {
    return convertRepo(params.repoUrl, params);
  }
});
```
