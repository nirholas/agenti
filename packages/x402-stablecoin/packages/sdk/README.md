# @x402/sdk

> X402 Payment Protocol SDK for Sperax USDs - Gasless payments, yield tracking, and HTTP 402 handling

[![npm version](https://badge.fury.io/js/@x402%2Fsdk.svg)](https://www.npmjs.com/package/@x402/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Simple API** - `await client.pay(recipient, amount, 'USDs')`
- ⛽ **Gasless Payments** - EIP-3009 transfer authorizations
- 📦 **Batch Payments** - Multiple transfers in one transaction
- 🔐 **HTTP 402 Handling** - Automatic payment required response handling
- 💰 **Yield Tracking** - Track USDs auto-yield earnings
- 🔷 **TypeScript First** - Full type definitions included
- 🛠️ **Express Middleware** - Easy server-side payment gates

## Installation

```bash
npm install @x402/sdk
# or
pnpm add @x402/sdk
# or
yarn add @x402/sdk
```

## Quick Start

```typescript
import { X402Client } from '@x402/sdk';

// Initialize client
const client = new X402Client({
  chain: 'arbitrum',
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

// Simple payment
const result = await client.pay('0xRecipient...', '10.00', 'USDs');
console.log('Transaction:', result.transaction.hash);
console.log('Gasless:', result.gasless);
```

## API Reference

### Creating a Client

```typescript
import { X402Client } from '@x402/sdk';

const client = new X402Client({
  // Required
  chain: 'arbitrum', // or 'arbitrum-sepolia', 'base', 'ethereum', etc.

  // Optional
  privateKey: '0x...', // For signing transactions
  rpcUrl: 'https://...', // Custom RPC URL
  enableGasless: true, // Enable EIP-3009 gasless payments (default: true)
  facilitatorUrl: 'http://...', // Payment verification service
  timeout: 30000, // Request timeout in ms
  debug: false, // Enable debug logging
});
```

### Standard Payments

```typescript
// Simple payment
const result = await client.pay('0xRecipient...', '10.00', 'USDs');

// Returns:
// {
//   transaction: {
//     hash: '0x...',
//     from: '0x...',
//     to: '0x...',
//     amount: '10000000000000000000',
//     formattedAmount: '10.00',
//     token: 'USDs',
//     status: 'confirmed',
//     ...
//   },
//   gasless: true, // Whether gasless payment was used
//   estimatedYield: { daily: '0.001370', weekly: '0.009589', ... }
// }
```

### Gasless Payments (EIP-3009)

Gasless payments allow the recipient or a relayer to submit the transaction, so the sender doesn't pay gas.

```typescript
// Create an authorization (sender signs, doesn't pay gas)
const auth = await client.createAuthorization(
  '0xRecipient...',
  '1.00',
  'USDs',
  { validityPeriod: 600 } // Optional: 10 minutes (default: 5 minutes)
);

// Authorization can be sent to recipient/relayer
console.log('Authorization:', auth);

// Settle the authorization (anyone can submit, pays gas)
const tx = await client.settleGasless(auth, 'USDs');
console.log('Transaction:', tx.hash);

// Check if gasless is supported for a token
const supported = client.supportsGasless('USDs'); // true
const notSupported = client.supportsGasless('DAI'); // false
```

### Batch Payments

```typescript
// Pay multiple recipients
const result = await client.payBatch(
  [
    { recipient: '0xAlice...', amount: '5.00', reference: 'payment-1' },
    { recipient: '0xBob...', amount: '3.00', reference: 'payment-2' },
    { recipient: '0xCharlie...', amount: '2.00', reference: 'payment-3' },
  ],
  'USDs',
  { continueOnError: true } // Continue if one fails
);

console.log('Successful:', result.successful.length);
console.log('Failed:', result.failed.length);
console.log('Total Amount:', result.totalAmount);
```

### HTTP 402 Handling

Handle HTTP 402 Payment Required responses from APIs:

```typescript
// Fetch with automatic 402 handling
import { fetchWith402Handling } from '@x402/sdk';

const response = await fetchWith402Handling('https://api.example.com/resource', {
  method: 'GET',
  onPaymentRequired: async (paymentRequest) => {
    // Pay and return transaction hash as proof
    const result = await client.pay(
      paymentRequest.recipient,
      paymentRequest.amount,
      paymentRequest.token
    );
    return result.transaction.hash;
  },
});

// Or handle manually
const response = await fetch('https://api.example.com/resource');

if (response.status === 402) {
  const parsed = await client.handlePaymentRequired(response, {
    autoPayUnder: '1.00', // Auto-pay amounts under $1
    preferGasless: true,
  });

  if (parsed.transaction) {
    // Retry with payment proof
    const retryResponse = await fetch('https://api.example.com/resource', {
      headers: { 'X-Payment-Proof': parsed.transaction.hash },
    });
  }
}
```

### Server-Side Payment Gates (Express)

```typescript
import express from 'express';
import { createPaymentGate } from '@x402/sdk';

const app = express();

// Protect a route with payment
app.get(
  '/api/premium-content',
  createPaymentGate({
    amount: '0.50',
    token: 'USDs',
    chain: 'arbitrum',
    recipient: '0xYourWallet...',
    resource: 'premium-content',
    validityPeriod: 300, // 5 minutes
  }),
  (req, res) => {
    res.json({ content: 'Premium content here!' });
  }
);

// Dynamic pricing
import { createDynamicPaymentGate } from '@x402/sdk';

app.get(
  '/api/ai-query',
  createDynamicPaymentGate(async (req) => ({
    amount: calculatePrice(req.query.complexity),
    token: 'USDs',
    chain: 'arbitrum',
    recipient: '0xYourWallet...',
    resource: 'ai-query',
  })),
  async (req, res) => {
    const result = await processQuery(req.query.q);
    res.json(result);
  }
);
```

### Yield Tracking

Track USDs auto-yield earnings:

```typescript
// Get yield information
const yieldInfo = await client.getYield('0xAddress...');
console.log('Balance:', yieldInfo.formattedBalance);
console.log('Total Yield:', yieldInfo.totalYield);
console.log('Current APY:', yieldInfo.currentAPY + '%');
console.log('Rebasing Enabled:', yieldInfo.rebasingEnabled);

// Estimate future yield
const estimate = await client.estimateYield('0xAddress...');
console.log('Daily Yield:', estimate.daily);
console.log('Weekly Yield:', estimate.weekly);
console.log('Monthly Yield:', estimate.monthly);
console.log('Annual Yield:', estimate.annual);

// Get current APY
const apy = await client.getCurrentAPY();
console.log('Current APY:', apy + '%');
```

### Balance & Token Operations

```typescript
// Get token balance
const balance = await client.getBalance('0xAddress...', 'USDs');
console.log('Balance:', balance.formatted);

// Get own address
const myAddress = client.getAddress();

// Approve token spending
const approveHash = await client.approve('0xSpender...', '100.00', 'USDs');

// Get available tokens on chain
const tokens = client.getAvailableTokens();
console.log('Available tokens:', tokens); // ['USDs', 'USDC', 'USDT', 'DAI', 'ETH']
```

### Contract Interfaces

Direct access to contract methods:

```typescript
// USDs contract
const usds = client.getUSDs();
const balance = await usds.balanceOf('0x...');
const isRebasing = await usds.isRebaseEnabled('0x...');
await usds.transfer('0xRecipient...', '10.00');

// Revenue Splitter contract
const splitter = client.getRevenueSplitter('0xSplitterAddress...');
const toolInfo = await splitter.getToolInfo('my-tool');
const earnings = await splitter.getDeveloperEarnings('0xDeveloper...');
await splitter.processPayment('my-tool', tokenAddress, '1.00');
```

### Event Handling

```typescript
// Listen for payment events
client.on((event) => {
  switch (event.type) {
    case 'payment:requested':
      console.log('Payment requested:', event.data);
      break;
    case 'payment:confirmed':
      console.log('Payment confirmed:', event.data.hash);
      break;
    case 'payment:failed':
      console.log('Payment failed:', event.data.error);
      break;
    case 'authorization:created':
      console.log('Authorization created:', event.data);
      break;
    case 'authorization:settled':
      console.log('Authorization settled:', event.data.hash);
      break;
  }
});
```

### Network Information

```typescript
const chainInfo = client.getChainInfo();
console.log('Chain:', chainInfo.name);
console.log('Chain ID:', chainInfo.chainId);
console.log('Explorer:', chainInfo.explorerUrl);
console.log('Testnet:', chainInfo.isTestnet);
```

## Error Handling

```typescript
import { X402Error, X402ErrorCode } from '@x402/sdk';

try {
  await client.pay('0x...', '10.00', 'USDs');
} catch (error) {
  if (error instanceof X402Error) {
    switch (error.code) {
      case X402ErrorCode.INSUFFICIENT_BALANCE:
        console.log('Not enough tokens:', error.details);
        break;
      case X402ErrorCode.TRANSACTION_FAILED:
        console.log('Transaction failed:', error.message);
        break;
      case X402ErrorCode.UNSUPPORTED_TOKEN:
        console.log('Token not supported:', error.message);
        break;
      // ... handle other error codes
    }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CONFIG` | Invalid client configuration |
| `MISSING_PRIVATE_KEY` | Private key required for operation |
| `UNSUPPORTED_CHAIN` | Chain not supported |
| `UNSUPPORTED_TOKEN` | Token not available on chain |
| `INSUFFICIENT_BALANCE` | Not enough tokens |
| `INSUFFICIENT_ALLOWANCE` | Token approval needed |
| `INVALID_PAYMENT_REQUEST` | Malformed payment request |
| `PAYMENT_TIMEOUT` | Payment deadline passed |
| `TRANSACTION_FAILED` | Transaction execution failed |
| `TRANSACTION_REVERTED` | Transaction reverted on-chain |
| `AUTHORIZATION_EXPIRED` | EIP-3009 authorization expired |
| `NONCE_ALREADY_USED` | Authorization nonce reused |
| `VERIFICATION_FAILED` | Payment verification failed |
| `INVALID_402_RESPONSE` | Malformed 402 response |

## Supported Chains

| Chain | ID | Default Token | Gasless Support |
|-------|-----|---------------|-----------------|
| Arbitrum | 42161 | USDs | ✅ USDs, USDC |
| Arbitrum Sepolia | 421614 | USDs | ✅ USDs, USDC |
| Base | 8453 | USDC | ✅ USDC |
| Ethereum | 1 | USDC | ✅ USDC |
| Polygon | 137 | USDC | ✅ USDC |
| Optimism | 10 | USDC | ✅ USDC |
| BNB Smart Chain | 56 | USDC | ❌ |

## Supported Tokens

### Arbitrum

| Token | Address | Decimals | EIP-3009 |
|-------|---------|----------|----------|
| USDs (Sperax USD) | `0xd74f5255d557944cf7dd0e45ff521520002d5748` | 18 | ✅ |
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 | ✅ |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 | ❌ |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 | ❌ |

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  X402ClientConfig,
  PaymentRequest,
  PaymentTransaction,
  PaymentResult,
  EIP3009Authorization,
  HTTP402Response,
  YieldInfo,
  YieldEstimate,
  X402Chain,
  X402Token,
} from '@x402/sdk';
```

## Advanced Usage

### Custom Payment Handler

```typescript
import { StandardPayment, GaslessPayment } from '@x402/sdk';
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(),
});

// Use individual payment handlers
const standard = new StandardPayment(publicClient, walletClient, 'arbitrum');
const gasless = new GaslessPayment(publicClient, walletClient, 'arbitrum', privateKey);

// Execute payments
const tx = await standard.execute(paymentRequest);
const auth = await gasless.createAuthorization(recipient, amount, token);
```

### Custom Yield Tracker

```typescript
import { YieldTracker } from '@x402/sdk';

const tracker = new YieldTracker(publicClient, 'arbitrum');

const yieldInfo = await tracker.getYieldInfo('0x...');
const estimate = tracker.calculateYieldEstimate(1000, 5.0);
const timeToTarget = tracker.estimateTimeToTarget(1000, 2000, 5.0);
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [nirholas](https://github.com/nirholas)
