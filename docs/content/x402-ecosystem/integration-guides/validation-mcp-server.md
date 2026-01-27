# Validation MCP Server x402 Integration

> Validate Ethereum addresses, keys, checksums, keccak256 hashes, function selectors, ENS.

## Overview

**Repository:** [nirholas/validation-mcp-server](https://github.com/nirholas/validation-mcp-server)  
**MCP Registry:** `io.github.nirholas/validation-mcp-server`  
**x402 Use Case:** Bulk validation, ENS resolution, advanced checks

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/validation-mcp-server
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { Validator } from '@nirholas/validation-mcp-server';

// Validation pricing
const validationPricing = PricingStrategy.fixed({
  // Free tier
  'address-single': 0,           // Free: single address
  'checksum': 0,                 // Free: checksum validation
  'hash-single': 0,              // Free: single hash
  'selector': 0,                 // Free: function selector
  
  // Premium
  'address-batch': 0.005,        // $0.005: per 100 addresses
  'ens-resolve': 0.002,          // $0.002: ENS resolution
  'ens-batch': 0.01,             // $0.01: per 50 ENS names
  'contract-check': 0.003,       // $0.003: is contract check
  'signature-decode': 0.001,     // $0.001: decode signature
  'abi-validate': 0.01,          // $0.01: ABI validation
  'deep-address': 0.01           // $0.01: full address analysis
});

const validator = new PaywallBuilder()
  .service('validation-mcp-server')
  .pricing(validationPricing)
  .build();
```

## Free Validations

```typescript
// Address validation (free)
function validateAddress(address: string): ValidationResult {
  return Validator.address(address, {
    checkChecksum: true,
    normalize: true
  });
}

// Checksum validation (free)
function validateChecksum(address: string): boolean {
  return Validator.checksum(address);
}

// Function selector (free)
function getSelector(signature: string): string {
  return Validator.selector(signature);
  // 'transfer(address,uint256)' -> '0xa9059cbb'
}

// Hash validation (free)
function validateHash(hash: string): boolean {
  return Validator.keccak256(hash);
}
```

## Premium Validations

```typescript
// ENS resolution
async function resolveENS(name: string) {
  await validator.charge(0.002, { type: 'ens-resolve', name });
  
  return Validator.resolveENS(name, {
    includeAvatar: true,
    includeRecords: true,
    // Returns: address, avatar, contenthash, text records
  });
}

// Contract check
async function isContract(address: string, chainId: number) {
  await validator.charge(0.003, { type: 'contract-check' });
  
  return Validator.isContract(address, chainId, {
    includeCode: false,
    includeCodeHash: true
  });
}

// Deep address analysis
async function analyzeAddress(address: string, chainId: number) {
  await validator.charge(0.01, { type: 'deep-address' });
  
  return Validator.analyzeAddress(address, chainId, {
    isContract: true,
    ensReverse: true,      // Reverse lookup
    transactionCount: true,
    balance: true,
    firstSeen: true,
    labels: true           // Known labels (exchange, contract, etc)
  });
}
```

## Batch Validation

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['validation-mcp-server'],
  dailyLimit: 5
});

// Batch address validation
async function validateAddressBatch(addresses: string[]) {
  const batches = Math.ceil(addresses.length / 100);
  
  await agent.pay({
    service: 'validation-mcp-server',
    amount: batches * 0.005,
    description: `Validate ${addresses.length} addresses`
  });
  
  return Validator.batchValidate(addresses, {
    checkChecksum: true,
    normalize: true,
    deduplicateResults: true
  });
}

// Batch ENS resolution
async function resolveENSBatch(names: string[]) {
  const batches = Math.ceil(names.length / 50);
  
  await agent.pay({
    service: 'validation-mcp-server',
    amount: batches * 0.01,
    description: `Resolve ${names.length} ENS names`
  });
  
  return Validator.batchResolveENS(names);
}
```

## ABI Validation

```typescript
// Validate ABI structure
async function validateABI(abi: any[]) {
  await validator.charge(0.01, { type: 'abi-validate' });
  
  return Validator.validateABI(abi, {
    checkDuplicates: true,
    validateTypes: true,
    checkSelectors: true,
    generateSummary: true
  });
}

// Decode function signature
async function decodeSignature(signature: string) {
  await validator.charge(0.001, { type: 'signature-decode' });
  
  return Validator.decodeSignature(signature, {
    // Lookup in 4byte.directory
    includeKnownSignatures: true,
    parseParams: true
  });
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Address validation | ✅ | ✅ |
| Checksum validation | ✅ | ✅ |
| Hash validation | ✅ | ✅ |
| Function selector | ✅ | ✅ |
| Batch addresses | ❌ | $0.005/100 |
| ENS resolution | ❌ | $0.002 |
| Batch ENS | ❌ | $0.01/50 |
| Contract check | ❌ | $0.003 |
| Signature decode | ❌ | $0.001 |
| ABI validation | ❌ | $0.01 |
| Deep analysis | ❌ | $0.01 |

## Validation Types

```typescript
// All supported validations
const validationTypes = {
  address: {
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    bitcoin: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/
  },
  hash: {
    keccak256: /^0x[a-fA-F0-9]{64}$/,
    sha256: /^[a-fA-F0-9]{64}$/
  },
  signature: {
    ethereum: /^0x[a-fA-F0-9]{130}$/,
    eip712: /^0x[a-fA-F0-9]{130}$/
  },
  ens: /^[a-z0-9-]+\.eth$/
};
```

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // Validation MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + ENS/RPC costs
};
```

## MCP Tool Registration

```typescript
server.tool('validate_address', {
  description: 'Validate Ethereum address with optional deep analysis',
  inputSchema: z.object({
    address: z.string(),
    deep: z.boolean().default(false),
    chainId: z.number().optional()
  }),
  handler: async (params) => {
    if (params.deep) {
      return analyzeAddress(params.address, params.chainId || 1);
    }
    return validateAddress(params.address);
  }
});

server.tool('resolve_ens', {
  description: 'Resolve ENS name to address (premium)',
  inputSchema: z.object({
    name: z.string(),
    includeRecords: z.boolean().default(false)
  }),
  handler: async (params) => {
    return resolveENS(params.name);
  }
});

server.tool('validate_batch', {
  description: 'Validate multiple addresses (premium)',
  inputSchema: z.object({
    addresses: z.array(z.string()).max(1000)
  }),
  handler: async (params) => {
    return validateAddressBatch(params.addresses);
  }
});
```
