# @chaoschain/x402-client

TypeScript client for the ChaosChain x402 decentralized facilitator.

## Overview

This client provides a simple interface to verify and settle x402 payments using the decentralized CRE-powered facilitator instead of a centralized server.

## Installation

```bash
npm install @chaoschain/x402-client
# or
bun add @chaoschain/x402-client
```

## Quick Start

```typescript
import { X402Client } from '@chaoschain/x402-client';

const client = new X402Client({
  facilitatorUrl: 'http://localhost:8402'
});

// Verify a payment
const verifyResult = await client.verifyPayment(
  'base64_encoded_payment_header',
  {
    scheme: 'exact',
    network: 'base-sepolia',
    maxAmountRequired: '1000000',
    payTo: '0x...',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    resource: '/api/weather'
  }
);

if (verifyResult.isValid) {
  console.log('✅ Payment verified!');
  console.log('Consensus proof:', verifyResult.consensusProof);
}

// Settle a payment
const settleResult = await client.settlePayment(
  'base64_encoded_payment_header',
  {
    scheme: 'exact',
    network: 'base-sepolia',
    maxAmountRequired: '1000000',
    payTo: '0x...',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    resource: '/api/weather'
  }
);

if (settleResult.success) {
  console.log('✅ Payment settled!');
  console.log('Transaction hash:', settleResult.txHash);
}
```

## API Reference

### `X402Client`

#### Constructor

```typescript
new X402Client(config: X402ClientConfig)
```

**Config Options:**
- `facilitatorUrl` (required): URL of the facilitator service
- `x402Version` (optional): x402 protocol version (default: 1)
- `timeout` (optional): Request timeout in milliseconds (default: 30000)

#### Methods

**`verifyPayment(paymentHeader, paymentRequirements): Promise<VerifyResponse>`**

Verifies an x402 payment via decentralized consensus.

**`settlePayment(paymentHeader, paymentRequirements): Promise<SettleResponse>`**

Settles an x402 payment on-chain via decentralized consensus.

**`getSupportedSchemes(): Promise<SupportedSchemesResponse>`**

Gets the list of supported payment schemes and networks.

**`healthCheck(): Promise<ServiceInfo>`**

Checks if the facilitator is responsive.

## Types

### `PaymentRequirements`

```typescript
interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  asset: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown> | null;
}
```

### `VerifyResponse`

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason: string | null;
  consensusProof?: string;
  reportId?: string;
  timestamp?: number;
}
```

### `SettleResponse`

```typescript
interface SettleResponse {
  success: boolean;
  error: string | null;
  txHash: string | null;
  networkId: string | null;
  consensusProof?: string;
  timestamp?: number;
}
```

## Environment Variables

```bash
X402_FACILITATOR_URL=http://localhost:8402
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run dev

# Type check
bun run typecheck
```

## Integration with ChaosChain SDK

This client can be used alongside the main ChaosChain SDK for full agent functionality:

```typescript
import { ChaosChainSDK } from '@chaoschain/sdk';
import { X402Client } from '@chaoschain/x402-client';

// Initialize ChaosChain SDK for agent identity
const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  agentDomain: 'myagent.example.com',
  agentRole: 'server',
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY
});

// Initialize x402 client for decentralized payments
const x402 = new X402Client({
  facilitatorUrl: process.env.X402_FACILITATOR_URL
});

// Use both together
const agentId = await sdk.registerIdentity();
const paymentResult = await x402.verifyPayment(header, requirements);
```

## Learn More

- [ChaosChain x402 Repo](https://github.com/ChaosChain/chaoschain-x402)
- [x402 Protocol](https://github.com/coinbase/x402)
- [ChaosChain SDK](https://github.com/ChaosChain/chaoschain-sdk-ts)
- [Chainlink CRE](https://docs.chain.link/cre)

## License

MIT

