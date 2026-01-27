# X402 on Arbitrum with Sperax USD

Complete implementation of X402 payment protocol on Arbitrum with support for Sperax USD ($USDs) auto-yield stablecoin and EIP-3009 gasless transfers.

## Overview

This integration enables:

- **Sperax USD ($USDs)**: Auto-yield stablecoin with ~4-8% APY built into your balance
- **EIP-3009 Gasless Transfers**: Users sign payment authorizations, facilitators pay gas
- **Layer-2 Efficiency**: Low transaction fees on Arbitrum
- **X402 Protocol**: Standard HTTP 402 Payment Required responses
- **Multi-Token Support**: USDs, USDC, USDT, DAI on Arbitrum

## Sperax USD ($USDs)

**Contract Address**: `0xd74f5255d557944cf7dd0e45ff521520002d5748`

### Key Features

- **Auto-Yield**: Holders automatically earn yield without staking or claiming
- **Fully Backed**: 100% backed by diversified basket of whitelisted stablecoins
- **Gas-Free Yield**: Yield distributed directly to wallets, no gas required
- **Layer-2 Native**: Optimized for Arbitrum's low fees
- **EIP-3009 Support**: Enables gasless token transfers

### Why USDs for X402?

1. **Automatic Yield**: Users earn while holding payment balances
2. **No Gas for Transfers**: EIP-3009 support enables gasless payments
3. **Retail Friendly**: Low fees make micro-payments viable
4. **Fully Backed**: More decentralized than centralized stablecoins

## Quick Start

### Installation

```bash
pnpm add @nirholas/lyra viem
```

### Basic Usage

```typescript
import { createArbitrumAdapter } from '@nirholas/lyra/x402';

// Initialize adapter
const adapter = createArbitrumAdapter({
  network: 'mainnet',
  privateKey: process.env.PRIVATE_KEY,
});

// Create payment request
const paymentRequest = adapter.createPaymentRequest({
  price: '0.0001', // 0.0001 USDs
  recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  token: 'USDs',
  description: 'AI tool execution',
});

// Execute payment
const tx = await adapter.executeStandardPayment(paymentRequest);
console.log('Payment completed:', tx.hash);
```

### Gasless Payments with EIP-3009

```typescript
// User creates signed authorization (no gas needed)
const authorization = await adapter.createPaymentAuthorization(
  paymentRequest,
  userAddress,
  userPrivateKey
);

// Verify through facilitator
const isValid = await adapter.verifyPayment(authorization);

// Execute gasless payment (facilitator pays gas)
const tx = await adapter.executeGaslessPayment(
  paymentRequest,
  authorization
);
```

## Architecture

```
┌─────────────────┐    HTTP 402     ┌─────────────────┐    Verify/Settle    ┌─────────────────┐
│                 │ ──────────────► │                 │ ──────────────────► │                 │
│  X402 Client    │                 │  Quote Service  │                     │   Facilitator   │
│  (auto-pay)     │ ◄────────────── │  (requires pay) │ ◄────────────────── │ (Arb Sepolia)   │
│                 │    Quote + Proof│                 │    Payment Confirmed│                 │
└─────────────────┘                 └─────────────────┘                     └─────────────────┘
         │                                   │                                       │
         │                                   │                                       │
         ▼                                   ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Arbitrum Network                                             │
│  ┌─────────────────┐                                           ┌─────────────────┐          │
│  │   Sperax USD    │                                           │   EIP-3009      │          │
│  │   ($USDs)       │ ◄───────────────────────────────────────► │   Gasless       │          │
│  │   Auto-yield    │                                           │   Transfers     │          │
│  └─────────────────┘                                           └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Arbitrum Mainnet

```typescript
const adapter = createArbitrumAdapter({
  network: 'mainnet',
  rpcUrl: 'https://arb1.arbitrum.io/rpc', // Optional
  privateKey: process.env.PRIVATE_KEY,
  enableGasless: true,
  facilitatorUrl: 'https://facilitator.example.com',
  quoteServiceUrl: 'https://api.example.com',
});
```

### Arbitrum Sepolia (Testnet)

```typescript
const adapter = createArbitrumAdapter({
  network: 'sepolia',
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
  privateKey: process.env.PRIVATE_KEY,
  facilitatorUrl: 'http://localhost:3002',
  quoteServiceUrl: 'http://localhost:3001',
});
```

## Token Addresses

### Arbitrum Mainnet

| Token | Address | Decimals |
|-------|---------|----------|
| USDs  | `0xd74f5255d557944cf7dd0e45ff521520002d5748` | 18 |
| USDC  | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDT  | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |
| DAI   | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 |

### Arbitrum Sepolia

Deploy test tokens:

```bash
pnpm x402:deploy  # Deploys TestUSDC, TestWETH to Sepolia
pnpm x402:seed    # Mints test tokens to your wallet
```

## API Reference

### `createArbitrumAdapter(config)`

Creates an Arbitrum X402 adapter instance.

**Parameters:**
- `network`: `'mainnet' | 'sepolia'`
- `rpcUrl?`: Custom RPC endpoint (optional)
- `privateKey?`: Wallet private key for transactions
- `enableGasless?`: Enable EIP-3009 gasless transfers (default: true)
- `facilitatorUrl?`: Payment facilitator URL
- `quoteServiceUrl?`: Quote service URL

**Returns:** `ArbitrumX402Adapter`

### `adapter.createPaymentRequest(params)`

Creates an X402 payment request.

**Parameters:**
```typescript
{
  price: string;          // Amount in token units (e.g., "0.0001")
  recipient: Address;     // Payment recipient address
  token?: X402Token;      // Payment token (default: 'USDs')
  description?: string;   // Payment description
}
```

**Returns:** `PaymentRequest`

### `adapter.executeStandardPayment(request)`

Executes a standard ERC-20 transfer payment.

**Parameters:**
- `request`: PaymentRequest object

**Returns:** `Promise<PaymentTransaction>`

### `adapter.createPaymentAuthorization(request, from, privateKey)`

Creates an EIP-3009 payment authorization signature (gasless).

**Parameters:**
- `request`: PaymentRequest object
- `from`: User's wallet address
- `privateKey`: User's private key for signing

**Returns:** `Promise<EIP3009Authorization>`

### `adapter.executeGaslessPayment(request, authorization)`

Executes a gasless payment using EIP-3009 authorization.

**Parameters:**
- `request`: PaymentRequest object
- `authorization`: EIP3009Authorization from `createPaymentAuthorization`

**Returns:** `Promise<PaymentTransaction>`

### `adapter.verifyPayment(authorization)`

Verifies payment authorization through facilitator.

**Parameters:**
- `authorization`: EIP3009Authorization object

**Returns:** `Promise<boolean>`

### `adapter.getUSdsBalance(address)`

Gets USDs balance (includes auto-yield).

**Parameters:**
- `address`: Wallet address to query

**Returns:** `Promise<{ balance: string; formattedBalance: string }>`

### `adapter.getNetworkInfo()`

Gets current network information.

**Returns:**
```typescript
{
  chain: 'arbitrum' | 'arbitrum-sepolia';
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}
```

## Examples

### 1. Basic USDs Payment

```typescript
const tx = await adapter.executeStandardPayment(
  adapter.createPaymentRequest({
    price: '0.0001',
    recipient: merchantAddress,
    token: 'USDs',
  })
);
```

### 2. Gasless Payment

```typescript
// User signs authorization
const auth = await adapter.createPaymentAuthorization(
  paymentRequest,
  userAddress,
  userPrivateKey
);

// Verify
const valid = await adapter.verifyPayment(auth);

// Execute (facilitator pays gas)
const tx = await adapter.executeGaslessPayment(paymentRequest, auth);
```

### 3. Metered AI Inference

```typescript
const BATCH_SIZE = 5;
let messageCount = 0;
let totalCost = 0;

for (const message of messages) {
  messageCount++;
  totalCost += 0.0001; // 0.0001 USDs per message

  if (messageCount % BATCH_SIZE === 0) {
    await adapter.executeStandardPayment(
      adapter.createPaymentRequest({
        price: totalCost.toString(),
        recipient: merchantAddress,
        token: 'USDs',
        description: `Batch payment for ${BATCH_SIZE} AI inferences`,
      })
    );
    totalCost = 0;
  }
}
```

### 4. X402 HTTP Flow

```typescript
// Initial request
const response = await fetch('https://api.example.com/quote', {
  method: 'POST',
  body: JSON.stringify({ sell: 'USDC', buy: 'WETH' }),
});

// Handle 402 Payment Required
if (response.status === 402) {
  const paymentDetails = await response.json();
  
  // Create authorization
  const auth = await adapter.createPaymentAuthorization(
    adapter.createPaymentRequest({
      price: paymentDetails.accepts[0].maxAmountRequired,
      recipient: paymentDetails.accepts[0].payTo,
      token: 'USDs',
    }),
    userAddress,
    userPrivateKey
  );

  // Retry with payment
  const retryResponse = await fetch('https://api.example.com/quote', {
    method: 'POST',
    headers: {
      'X-Payment': Buffer.from(JSON.stringify({
        x402Version: 1,
        scheme: 'exact',
        network: 'arbitrum',
        payload: auth,
      })).toString('base64'),
    },
    body: JSON.stringify({ sell: 'USDC', buy: 'WETH' }),
  });

  const quote = await retryResponse.json();
}
```

## Development Setup

### 1. Deploy Contracts to Arbitrum Sepolia

```bash
# From monorepo root
cd packages/core
pnpm x402:deploy
```

This deploys:
- TestUSDC with EIP-3009 support
- TestWETH with EIP-3009 support
- QuoteRegistry for replay protection
- MockAdapter for swaps
- ComposableExecutor for quote verification

### 2. Seed Test Tokens

```bash
pnpm x402:seed
```

Mints test tokens to your wallet for testing.

### 3. Start Services

```bash
# Terminal 1: Start facilitator
pnpm x402:facilitator

# Terminal 2: Start quote service
pnpm x402:service

# Or start both together
pnpm dev:x402
```

### 4. Run Examples

```bash
pnpm tsx packages/core/src/x402/examples-arbitrum.ts
```

## Testing

```bash
# Test payment flow
pnpm --filter x402-service pay test-x402

# Execute a swap with payment
pnpm --filter x402-service pay pay \
  --swap \
  --sell USDC \
  --buy WETH \
  --amount 25 \
  --max-slippage 0.3
```

## Integration with Lyra Tools

### Make a Lyra Tool Paid

```typescript
import { createX402Tool } from '@nirholas/lyra/x402';

const paidSecurityAudit = createX402Tool({
  name: 'security_audit_premium',
  description: 'Premium AI-powered security audit',
  pricing: {
    name: 'security_audit_premium',
    description: 'Deep security analysis with AI',
    price: '0.01', // 0.01 USDs per audit
    currency: 'USDs',
    chain: 'arbitrum',
    tier: 'premium',
    paymentRecipient: merchantAddress,
    platformFee: 0.20, // 20% platform fee
  },
  handler: async (params, context) => {
    // Tool execution logic
    const result = await performSecurityAudit(params.contractAddress);
    return result;
  },
});
```

### Use in Lyra Client

```typescript
import { LyraClient } from '@nirholas/lyra';

const client = new LyraClient({
  x402: {
    enabled: true,
    walletAddress: userAddress,
    maxPaymentPerTool: '1.0',
    defaultToken: 'USDs',
    defaultChain: 'arbitrum',
    autoApproveUnder: '0.01', // Auto-approve payments under 0.01 USDs
  },
});

// Automatically handles payment if tool requires it
const result = await client.tools.execute('security_audit_premium', {
  contractAddress: '0x...',
});
```

## Resources

- **X402 Protocol**: https://github.com/coinbase/x402
- **Sperax USD**: https://sperax.io/
- **Demo Implementation**: https://github.com/hummusonrails/x402-demo-arbitrum
- **Arbitrum Docs**: https://docs.arbitrum.io/
- **EIP-3009**: https://eips.ethereum.org/EIPS/eip-3009

## Troubleshooting

### "Insufficient balance" errors

```bash
# Check USDs balance
const balance = await adapter.getUSdsBalance(userAddress);
console.log('Balance:', balance.formattedBalance);

# Get test tokens (Sepolia)
pnpm x402:seed
```

### "Payment verification failed"

- Ensure facilitator service is running: `pnpm x402:facilitator`
- Check that signature is valid
- Verify payment hasn't expired (check `validBefore` timestamp)

### "Transaction reverted"

- Check token approvals
- Verify sufficient balance
- Ensure quote hasn't expired
- Check network connectivity

## License

MIT

---

**Built with ❤️ for the Arbitrum and Sperax ecosystems**
