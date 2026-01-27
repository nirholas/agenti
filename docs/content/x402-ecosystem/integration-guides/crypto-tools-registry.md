# Crypto Tools Registry x402 Integration

> Registry API for 800+ crypto, blockchain, DeFi, NFT, trading tools discovery.

## Overview

**Repository:** [nirholas/crypto-tools-registry](https://github.com/nirholas/crypto-tools-registry)  
**MCP Registry:** `io.github.nirholas/crypto-tools-registry`  
**x402 Use Case:** Premium tool listings, featured placements, analytics access

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/crypto-tools-registry
```

## Integration with ToolMarketplace

```typescript
import { ToolMarketplace, ToolRegistry } from '@nirholas/x402-ecosystem/marketplace';
import { CryptoToolsRegistry } from '@nirholas/crypto-tools-registry';

// Sync external registry with x402 marketplace
const marketplace = new ToolMarketplace({
  network: 'eip155:42161', // Arbitrum
  registryAddress: '0x...',
  revenueRecipient: '0x...'
});

// Import tools from crypto-tools-registry
async function syncRegistry() {
  const externalTools = await CryptoToolsRegistry.listAll();
  
  for (const tool of externalTools) {
    await marketplace.importTool({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      pricing: tool.pricing || { free: true },
      developer: tool.author
    });
  }
}
```

## Premium Listing Features

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';

// Listing tiers
const listingPricing = PricingStrategy.fixed({
  'basic-listing': 0,        // Free listing
  'verified-listing': 5,     // $5 one-time verification
  'featured-week': 25,       // $25/week featured
  'featured-month': 75,      // $75/month featured
  'premium-analytics': 10,   // $10/month analytics
  'api-access': 50           // $50/month full API
});

const registry = new PaywallBuilder()
  .service('crypto-tools-registry')
  .pricing(listingPricing)
  .build();

// Submit premium listing
async function submitFeaturedListing(tool: ToolInfo, duration: 'week' | 'month') {
  const tier = duration === 'week' ? 'featured-week' : 'featured-month';
  const price = listingPricing.getPrice(tier);
  
  await registry.charge(price, { tool: tool.id, duration });
  
  return CryptoToolsRegistry.submitFeatured(tool, duration);
}
```

## Discovery Integration

```typescript
// Premium discovery features
const discoveryService = {
  // Free: basic search
  async search(query: string) {
    return CryptoToolsRegistry.search(query, { limit: 10 });
  },
  
  // Premium: advanced filters + unlimited results
  async advancedSearch(params: AdvancedSearchParams) {
    await registry.charge(0.01, { type: 'advanced-search' });
    return CryptoToolsRegistry.advancedSearch(params);
  },
  
  // Premium: AI-powered recommendations
  async getRecommendations(context: AgentContext) {
    await registry.charge(0.05, { type: 'ai-recommendations' });
    return CryptoToolsRegistry.recommend(context);
  },
  
  // Premium: tool analytics
  async getToolAnalytics(toolId: string) {
    await registry.charge(0.02, { type: 'analytics', tool: toolId });
    return CryptoToolsRegistry.analytics(toolId);
  }
};
```

## Categories & Pricing

| Category | Tool Count | Listing Fee | Featured |
|----------|------------|-------------|----------|
| DeFi Protocols | 150+ | Free | $25/week |
| Trading Bots | 100+ | Free | $25/week |
| NFT Tools | 80+ | Free | $25/week |
| Analytics | 120+ | Free | $25/week |
| Wallets | 50+ | Free | $25/week |
| Infrastructure | 200+ | Free | $25/week |
| AI/ML | 100+ | Free | $25/week |

## Revenue Model

```typescript
const revenueSplit = {
  registry: 0.50,       // Crypto Tools Registry
  ecosystem: 0.30,      // Universal Crypto MCP
  toolDevelopers: 0.20  // Referral rewards
};
```

## MCP Tool Registration

```typescript
server.tool('discover_crypto_tools', {
  description: 'Search 800+ crypto tools with optional premium features',
  inputSchema: z.object({
    query: z.string(),
    category: z.enum(['defi', 'trading', 'nft', 'analytics', 'wallets', 'infra', 'ai']).optional(),
    premium: z.boolean().default(false)
  }),
  handler: async ({ query, category, premium }) => {
    if (premium) {
      return discoveryService.advancedSearch({ query, category });
    }
    return discoveryService.search(query);
  }
});
```
