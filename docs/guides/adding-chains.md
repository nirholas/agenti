# Adding New Chain Support

This guide explains how to add support for a new blockchain to Agenti.

## EVM Chain Support

Adding a new EVM-compatible chain is straightforward since Agenti uses `viem` for all EVM interactions.

### 1. Add Chain Configuration

Edit `src/evm/chains.ts` to add the new chain:

```typescript
import { defineChain } from 'viem';

export const myNewChain = defineChain({
  id: 12345, // Chain ID
  name: 'My New Chain',
  nativeCurrency: {
    name: 'Token',
    symbol: 'TKN',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mynewchain.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: 'https://explorer.mynewchain.com',
    },
  },
});
```

### 2. Register the Chain

Add the chain to the supported chains mapping:

```typescript
// src/evm/index.ts
import { myNewChain } from './chains';

export const supportedChains = {
  // ... existing chains
  mynewchain: myNewChain,
};
```

### 3. Add RPC Configuration

Support custom RPC via environment variables:

```typescript
// Check for custom RPC
const rpcUrl = process.env.MYNEWCHAIN_RPC_URL || 'https://rpc.mynewchain.com';
```

### 4. Test the Chain

```bash
# Test basic connectivity
npm test -- --grep "mynewchain"
```

## Non-EVM Chain Support

For non-EVM chains, create a vendor integration:

### 1. Create Vendor Directory

```bash
mkdir -p src/vendors/mynewchain
```

### 2. Implement the Vendor

```typescript
// src/vendors/mynewchain/index.ts
import { z } from 'zod';

// Chain-specific SDK import
import { MyChainSDK } from '@mychain/sdk';

const client = new MyChainSDK({
  endpoint: process.env.MYCHAIN_RPC_URL || 'https://rpc.mychain.com',
});

// Balance tool
const balanceSchema = z.object({
  address: z.string().describe('Wallet address'),
});

export const mychain_balance = {
  name: 'mychain_balance',
  description: 'Check native token balance on MyChain',
  inputSchema: balanceSchema,
  async execute(params: unknown) {
    const { address } = balanceSchema.parse(params);
    const balance = await client.getBalance(address);
    return { success: true, data: { balance, address } };
  },
};

// Transfer tool
const transferSchema = z.object({
  to: z.string().describe('Recipient address'),
  amount: z.string().describe('Amount to send'),
});

export const mychain_transfer = {
  name: 'mychain_transfer',
  description: 'Transfer native tokens on MyChain',
  inputSchema: transferSchema,
  async execute(params: unknown) {
    const validated = transferSchema.parse(params);
    const tx = await client.transfer(validated);
    return { success: true, data: { txHash: tx.hash } };
  },
};
```

### 3. Register the Vendor

```typescript
// src/vendors/index.ts
export * from './mynewchain';
```

## x402 Chain Support

To add x402 payment support for a new chain:

### EVM Chain

```typescript
// src/x402/chains/evm.ts
export const x402EvmChains = [
  // ... existing chains
  {
    chainId: 12345,
    name: 'My New Chain',
    usdcAddress: '0x...',  // USDC contract on this chain
    facilitatorAddress: '0x...',  // x402 facilitator contract
  },
];
```

### Non-EVM Chain

Create a new payment execution module following the pattern in `x402/typescript/packages/`.

## Checklist for New Chains

- [ ] Chain configuration with correct chain ID and RPC
- [ ] Native token balance checking
- [ ] Native token transfers
- [ ] Token standard support (ERC-20, SPL, etc.)
- [ ] Environment variable for custom RPC
- [ ] Block explorer integration
- [ ] Gas estimation
- [ ] Tests for all new tools
- [ ] Documentation in `docs/chains/`
- [ ] x402 support (optional)

## Testing New Chains

```bash
# Run chain-specific tests
npm test -- --grep "mychain"

# Test with MCP inspector
npm run test:inspector
```
