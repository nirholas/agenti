# Ethereum Wallet MCP x402 Integration

> Generate Ethereum wallets with BIP39 mnemonics, HD paths, vanity addresses, private key backup.

## Overview

**Repository:** [nirholas/ethereum-wallet-mcp](https://github.com/nirholas/ethereum-wallet-mcp)  
**MCP Registry:** `io.github.nirholas/ethereum-wallet-mcp`  
**x402 Use Case:** Premium vanity addresses, bulk generation, secure backup services

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/ethereum-wallet-mcp
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { WalletGenerator } from '@nirholas/ethereum-wallet-mcp';

// Feature-based pricing
const walletPricing = PricingStrategy.fixed({
  'basic-wallet': 0,           // Free: single wallet
  'hd-derivation': 0,          // Free: standard HD paths
  'vanity-3char': 0.10,        // $0.10: 3-char vanity
  'vanity-4char': 0.50,        // $0.50: 4-char vanity
  'vanity-5char': 2.50,        // $2.50: 5-char vanity
  'vanity-6char': 15.00,       // $15: 6-char vanity
  'bulk-10': 0.05,             // $0.05: 10 wallets
  'bulk-100': 0.25,            // $0.25: 100 wallets
  'encrypted-backup': 0.02,    // $0.02: encrypted JSON backup
  'shamir-split': 0.10         // $0.10: Shamir secret sharing
});

const walletService = new PaywallBuilder()
  .service('ethereum-wallet-mcp')
  .pricing(walletPricing)
  .build();
```

## Vanity Address Generation

```typescript
// Premium vanity address service
async function generateVanityWallet(prefix: string, suffix?: string) {
  const length = prefix.length + (suffix?.length || 0);
  
  // Price based on complexity (exponential difficulty)
  const tier = `vanity-${Math.min(length, 6)}char`;
  const price = walletPricing.getPrice(tier);
  
  if (price > 0) {
    await walletService.charge(price, { 
      type: 'vanity',
      prefix,
      suffix,
      estimatedTime: estimateVanityTime(length)
    });
  }
  
  return WalletGenerator.vanity({ prefix, suffix });
}

// Estimate generation time
function estimateVanityTime(chars: number): string {
  const times = {
    3: '~1 second',
    4: '~15 seconds', 
    5: '~4 minutes',
    6: '~2 hours',
    7: '~3 days'
  };
  return times[chars] || 'very long';
}
```

## Bulk Generation

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['ethereum-wallet-mcp']
});

// Bulk wallet generation for agents
async function generateAgentWallets(count: number, hdPath?: string) {
  const tier = count <= 10 ? 'bulk-10' : 'bulk-100';
  const batches = Math.ceil(count / (tier === 'bulk-10' ? 10 : 100));
  const totalCost = batches * walletPricing.getPrice(tier);
  
  await agent.pay({
    service: 'ethereum-wallet-mcp',
    amount: totalCost,
    description: `Generate ${count} wallets`
  });
  
  return WalletGenerator.bulk(count, { hdPath });
}
```

## Secure Backup Services

```typescript
// Premium encrypted backup
async function createEncryptedBackup(wallet: Wallet, password: string) {
  await walletService.charge(0.02, { type: 'encrypted-backup' });
  
  return WalletGenerator.exportKeystore(wallet, password, {
    kdf: 'scrypt',
    n: 262144, // High security
    r: 8,
    p: 1
  });
}

// Shamir secret sharing (premium)
async function shamirSplit(wallet: Wallet, threshold: number, shares: number) {
  await walletService.charge(0.10, { 
    type: 'shamir-split',
    threshold,
    shares 
  });
  
  return WalletGenerator.shamirSplit(wallet.privateKey, {
    threshold,
    shares
  });
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Basic wallet gen | ✅ | ✅ |
| BIP39 mnemonic | ✅ | ✅ |
| HD derivation | ✅ | ✅ |
| Vanity (3 char) | ❌ | $0.10 |
| Vanity (4 char) | ❌ | $0.50 |
| Vanity (5 char) | ❌ | $2.50 |
| Vanity (6 char) | ❌ | $15.00 |
| Bulk (10) | ❌ | $0.05 |
| Bulk (100) | ❌ | $0.25 |
| Encrypted backup | ❌ | $0.02 |
| Shamir split | ❌ | $0.10 |

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // Wallet MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 protocol
};
```

## MCP Tool Registration

```typescript
server.tool('generate_vanity_wallet', {
  description: 'Generate Ethereum wallet with vanity address (premium)',
  inputSchema: z.object({
    prefix: z.string().max(6),
    suffix: z.string().max(4).optional(),
    includeBackup: z.boolean().default(false)
  }),
  handler: async (params) => {
    return generateVanityWallet(params.prefix, params.suffix);
  }
});
```
