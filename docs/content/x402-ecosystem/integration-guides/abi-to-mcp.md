# ABI-to-MCP x402 Integration

> Convert any smart contract ABI into an AI-ready MCP server with premium tiers.

## Overview

**Repository:** [nirholas/abi-to-mcp](https://github.com/nirholas/abi-to-mcp)  
**MCP Registry:** `io.github.nirholas/abi-to-mcp`  
**x402 Use Case:** Premium tier for complex ABIs, batch conversions, verified contracts

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/abi-to-mcp
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { ABIConverter } from '@nirholas/abi-to-mcp';

// Tiered pricing based on ABI complexity
const abiPricing = PricingStrategy.tiered([
  { threshold: 10, priceUsd: 0 },      // Free: < 10 functions
  { threshold: 50, priceUsd: 0.05 },   // Basic: 10-50 functions
  { threshold: 200, priceUsd: 0.25 },  // Pro: 50-200 functions
  { threshold: Infinity, priceUsd: 1 } // Enterprise: 200+ functions
]);

// Create paywall for ABI conversion
const converter = new PaywallBuilder()
  .service('abi-to-mcp')
  .pricing(abiPricing)
  .feature('verified-source', 0.10)  // +$0.10 for verified source fetch
  .feature('documentation', 0.15)    // +$0.15 for auto-docs
  .build();

// Usage
async function convertABI(address: string, chain: string, options: ConvertOptions) {
  const functionCount = await getFunctionCount(address, chain);
  const price = abiPricing.calculate({ usage: functionCount });
  
  // Process payment via x402
  await converter.charge(price, { address, chain });
  
  return ABIConverter.generate(address, chain, options);
}
```

## Premium Features

| Feature | Free | Premium ($0.05+) |
|---------|------|------------------|
| Basic ABI parsing | ✅ | ✅ |
| Read functions | ✅ | ✅ |
| Write functions | ❌ | ✅ |
| Event decoding | ❌ | ✅ |
| Verified source | ❌ | ✅ |
| Auto documentation | ❌ | ✅ |
| Batch conversion | ❌ | ✅ |

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // ABI-to-MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 protocol
};
```

## MCP Tool Registration

```typescript
import { registerX402Ecosystem } from '@nirholas/x402-ecosystem/mcp';

server.tool('convert_abi_premium', {
  description: 'Convert ABI to MCP server (premium features)',
  inputSchema: z.object({
    address: z.string(),
    chain: z.enum(['ethereum', 'arbitrum', 'base', 'polygon']),
    includeEvents: z.boolean().optional(),
    generateDocs: z.boolean().optional()
  }),
  handler: async (params) => {
    return converter.execute(params);
  }
});
```
