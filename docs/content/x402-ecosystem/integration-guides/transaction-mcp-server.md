# Transaction MCP Server x402 Integration

> Build and sign Ethereum transactions - EIP-1559, gas estimation, RLP, ERC-20 transfers.

## Overview

**Repository:** [nirholas/transaction-mcp-server](https://github.com/nirholas/transaction-mcp-server)  
**MCP Registry:** `io.github.nirholas/transaction-mcp-server`  
**x402 Use Case:** Per-transaction fees, batch transactions, priority gas

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/transaction-mcp-server
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { TransactionBuilder } from '@nirholas/transaction-mcp-server';

// Per-operation pricing
const txPricing = PricingStrategy.fixed({
  'build-legacy': 0,            // Free: legacy tx
  'build-eip1559': 0.001,       // $0.001: EIP-1559 tx
  'gas-estimate': 0,            // Free: basic estimate
  'gas-optimize': 0.005,        // $0.005: optimized gas
  'erc20-transfer': 0.001,      // $0.001: ERC-20 tx
  'batch-tx': 0.01,             // $0.01: per 10 txs
  'simulate': 0.002,            // $0.002: tx simulation
  'decode-tx': 0,               // Free: decode transaction
  'priority-gas': 0.01,         // $0.01: priority gas pricing
  'flashbots': 0.05             // $0.05: Flashbots bundle
});

const txBuilder = new PaywallBuilder()
  .service('transaction-mcp-server')
  .pricing(txPricing)
  .build();
```

## Transaction Building

```typescript
// Build EIP-1559 transaction
async function buildTransaction(params: TxParams) {
  await txBuilder.charge(0.001, { type: 'build-eip1559' });
  
  return TransactionBuilder.build({
    to: params.to,
    value: params.value,
    data: params.data,
    chainId: params.chainId,
    type: 2, // EIP-1559
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    nonce: params.nonce || await getNonce(params.from),
    gasLimit: params.gasLimit || await estimateGas(params)
  });
}

// ERC-20 transfer
async function buildERC20Transfer(
  token: string,
  to: string,
  amount: bigint,
  chainId: number
) {
  await txBuilder.charge(0.001, { type: 'erc20-transfer' });
  
  return TransactionBuilder.erc20Transfer({
    token,
    to,
    amount,
    chainId
  });
}
```

## Gas Optimization

```typescript
// Premium gas optimization
async function optimizeGas(tx: Transaction) {
  await txBuilder.charge(0.005, { type: 'gas-optimize' });
  
  return TransactionBuilder.optimizeGas(tx, {
    strategy: 'balanced', // 'fast' | 'balanced' | 'cheap'
    maxWaitMinutes: 5,
    historicalAnalysis: true,
    predictNextBlock: true
  });
}

// Priority gas (for time-sensitive txs)
async function getPriorityGas(chainId: number, urgency: 'high' | 'critical') {
  await txBuilder.charge(0.01, { type: 'priority-gas' });
  
  return TransactionBuilder.priorityGas(chainId, {
    urgency,
    // Analyzes mempool, pending blocks, gas trends
    includeFlashbotsPrice: true
  });
}
```

## Transaction Simulation

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['transaction-mcp-server'],
  dailyLimit: 10
});

// Simulate transaction before sending
async function simulateTransaction(tx: Transaction) {
  await agent.pay({
    service: 'transaction-mcp-server',
    amount: 0.002,
    description: 'Transaction simulation'
  });
  
  return TransactionBuilder.simulate(tx, {
    traceCall: true,
    stateOverrides: {},
    blockTag: 'pending',
    // Returns: success, gasUsed, returnData, logs, stateChanges
  });
}
```

## Batch Transactions

```typescript
// Build multiple transactions
async function buildBatch(transactions: TxParams[]) {
  const batches = Math.ceil(transactions.length / 10);
  await txBuilder.charge(batches * 0.01, { 
    type: 'batch-tx',
    count: transactions.length 
  });
  
  return TransactionBuilder.buildBatch(transactions, {
    sequentialNonces: true,
    optimizeGasAcross: true,
    // Returns array of signed txs ready to broadcast
  });
}
```

## Flashbots Integration

```typescript
// Premium Flashbots bundle
async function createFlashbotsBundle(
  transactions: Transaction[],
  targetBlock: number
) {
  await txBuilder.charge(0.05, { type: 'flashbots' });
  
  return TransactionBuilder.flashbotsBundle({
    transactions,
    targetBlock,
    minTimestamp: Math.floor(Date.now() / 1000),
    maxTimestamp: Math.floor(Date.now() / 1000) + 120,
    // Protects against MEV, front-running
  });
}
```

## Transaction Decoding (Free)

```typescript
// Free transaction decoding
async function decodeTransaction(rawTx: string) {
  // No charge
  return TransactionBuilder.decode(rawTx, {
    parseData: true,      // Decode calldata
    identifyMethod: true, // Match function selector
    humanReadable: true   // Format for display
  });
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Legacy tx build | ✅ | ✅ |
| Decode transaction | ✅ | ✅ |
| Basic gas estimate | ✅ | ✅ |
| EIP-1559 build | ❌ | $0.001 |
| ERC-20 transfer | ❌ | $0.001 |
| Gas optimization | ❌ | $0.005 |
| Tx simulation | ❌ | $0.002 |
| Batch transactions | ❌ | $0.01/10 |
| Priority gas | ❌ | $0.01 |
| Flashbots bundle | ❌ | $0.05 |

## Supported Chains

```typescript
const supportedChains = {
  'eip155:1': 'Ethereum',
  'eip155:42161': 'Arbitrum',
  'eip155:8453': 'Base',
  'eip155:137': 'Polygon',
  'eip155:10': 'Optimism',
  'eip155:56': 'BSC',
  'eip155:43114': 'Avalanche'
};
```

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // Transaction MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + RPC costs
};
```

## MCP Tool Registration

```typescript
server.tool('build_transaction', {
  description: 'Build Ethereum transaction (EIP-1559)',
  inputSchema: z.object({
    to: z.string(),
    value: z.string().optional(),
    data: z.string().optional(),
    chainId: z.number(),
    gasStrategy: z.enum(['fast', 'balanced', 'cheap']).default('balanced')
  }),
  handler: async (params) => {
    const tx = await buildTransaction(params);
    if (params.gasStrategy !== 'balanced') {
      return optimizeGas(tx);
    }
    return tx;
  }
});

server.tool('simulate_transaction', {
  description: 'Simulate transaction before sending (premium)',
  inputSchema: z.object({
    transaction: z.object({
      to: z.string(),
      data: z.string(),
      value: z.string().optional()
    }),
    chainId: z.number()
  }),
  handler: async (params) => {
    return simulateTransaction(params.transaction);
  }
});
```
