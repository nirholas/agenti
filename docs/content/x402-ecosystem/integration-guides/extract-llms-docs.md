# Extract LLMs Docs x402 Integration

> Extract llms.txt from any docs site - Mintlify, Docusaurus, GitBook parser.

## Overview

**Repository:** [nirholas/extract-llms-docs](https://github.com/nirholas/extract-llms-docs)  
**MCP Registry:** `io.github.nirholas/extract-llms-docs`  
**x402 Use Case:** Premium bulk extraction, recurring updates, private docs

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/extract-llms-docs
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { DocsExtractor } from '@nirholas/extract-llms-docs';

// Usage-based pricing
const extractionPricing = PricingStrategy.resourceBased({
  'single-page': 0,           // Free: single page
  'site-small': 0.05,         // $0.05: < 50 pages
  'site-medium': 0.15,        // $0.15: 50-200 pages
  'site-large': 0.50,         // $0.50: 200-1000 pages
  'site-enterprise': 2.00,    // $2.00: 1000+ pages
  'private-docs': 0.25,       // +$0.25: authenticated docs
  'recurring-daily': 5.00,    // $5/month: daily updates
  'recurring-weekly': 2.00,   // $2/month: weekly updates
  'custom-parser': 1.00       // $1.00: custom site parser
});

const extractor = new PaywallBuilder()
  .service('extract-llms-docs')
  .pricing(extractionPricing)
  .build();
```

## Site Extraction

```typescript
// Extract llms.txt from documentation site
async function extractDocs(url: string, options: ExtractOptions = {}) {
  // Estimate page count
  const pageCount = await DocsExtractor.estimatePages(url);
  
  // Determine tier
  let tier: string;
  if (pageCount <= 1) tier = 'single-page';
  else if (pageCount <= 50) tier = 'site-small';
  else if (pageCount <= 200) tier = 'site-medium';
  else if (pageCount <= 1000) tier = 'site-large';
  else tier = 'site-enterprise';
  
  let cost = extractionPricing.getPrice(tier);
  
  // Add premium features
  if (options.authenticated) {
    cost += extractionPricing.getPrice('private-docs');
  }
  if (options.customParser) {
    cost += extractionPricing.getPrice('custom-parser');
  }
  
  if (cost > 0) {
    await extractor.charge(cost, { url, pageCount, options });
  }
  
  return DocsExtractor.extract(url, options);
}
```

## Supported Platforms

| Platform | Auto-Detect | Free Pages | Notes |
|----------|-------------|------------|-------|
| Mintlify | ✅ | 10 | Full nav parsing |
| Docusaurus | ✅ | 10 | Sidebar extraction |
| GitBook | ✅ | 10 | API + scraping |
| ReadMe | ✅ | 10 | API integration |
| Notion | ✅ | 5 | Requires auth |
| Confluence | ⚠️ | 5 | Enterprise only |
| Custom | ❌ | 1 | +$1 parser fee |

## Recurring Extraction

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  dailyLimit: 20 // $20/day
});

// Set up recurring extraction
async function setupRecurringExtraction(sites: string[], frequency: 'daily' | 'weekly') {
  const tier = frequency === 'daily' ? 'recurring-daily' : 'recurring-weekly';
  const monthlyCost = sites.length * extractionPricing.getPrice(tier);
  
  // Subscribe via agent
  return agent.subscribe({
    service: 'extract-llms-docs',
    plan: tier,
    sites,
    monthlyCost,
    onUpdate: async (site, llmsTxt) => {
      // Handle updated docs
      await updateKnowledgeBase(site, llmsTxt);
    }
  });
}
```

## Batch Extraction

```typescript
// Bulk extraction for multiple sites
async function batchExtract(urls: string[]) {
  const estimates = await Promise.all(
    urls.map(url => DocsExtractor.estimatePages(url))
  );
  
  const totalPages = estimates.reduce((a, b) => a + b, 0);
  const totalCost = calculateBatchCost(estimates);
  
  // 20% discount for batch
  const discountedCost = totalCost * 0.8;
  
  await extractor.charge(discountedCost, { 
    type: 'batch',
    urls,
    totalPages 
  });
  
  return DocsExtractor.batchExtract(urls);
}
```

## Output Formats

```typescript
// Premium output formats
const outputOptions = {
  'llms.txt': { cost: 0, description: 'Standard llms.txt' },
  'markdown': { cost: 0, description: 'Combined markdown' },
  'json': { cost: 0.02, description: 'Structured JSON' },
  'embeddings': { cost: 0.10, description: 'Pre-computed embeddings' },
  'vector-db': { cost: 0.25, description: 'Ready for Pinecone/Weaviate' }
};
```

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.65,      // Extract LLMs maintainer
  ecosystem: 0.25,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + compute costs
};
```

## MCP Tool Registration

```typescript
server.tool('extract_llms_txt', {
  description: 'Extract llms.txt from documentation site',
  inputSchema: z.object({
    url: z.string().url(),
    format: z.enum(['llms.txt', 'markdown', 'json']).default('llms.txt'),
    maxPages: z.number().max(1000).optional()
  }),
  handler: async (params) => {
    return extractDocs(params.url, { 
      format: params.format,
      maxPages: params.maxPages 
    });
  }
});
```
