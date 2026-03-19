# x402a

> EXPERIMENTAL: HTTP 402 Payment Required implementation for Aptos blockchain

[![npm version](https://img.shields.io/npm/v/x402a)](https://www.npmjs.com/package/x402a)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Warning**: This is an experimental v0.1.0 release. Not recommended for production use with real funds. Use testnet only.

**x402a** enables micropayments for API routes and web services using the HTTP 402 Payment Required status code and Aptos blockchain.

## Features

- **Simple Integration** - Add payments to any API with minimal code
- **Micropayments** - Support for tiny payments (fractions of a cent)
- **Fast** - Payments settle on Aptos in seconds
- **Secure** - Fee payer sponsored transactions with cryptographic signatures
- **Flexible** - Single or multi-recipient payments, custom pricing
- **React Support** - Built-in wallet integration
- **Gas-Free for Users** - Facilitator pays gas fees via sponsored transactions

## Installation

```bash
npm install x402a
# or
pnpm add x402a
# or
yarn add x402a
```

## Quick Start

### Client-Side

```typescript
import { signTransactionForFeePayer } from 'x402a/client';

// Sign transaction for fee payer
const { authenticator } = await signTransactionForFeePayer(
  wallet,
  transactionPayload
);
```

### Server-Side (Facilitator)

```typescript
import { X402Facilitator } from 'x402a/server';

const facilitator = new X402Facilitator({
  privateKey: process.env.FACILITATOR_PRIVATE_KEY,
  contractAddress: process.env.CONTRACT_ADDRESS,
  network: 'testnet',
});

// Build transaction for client to sign
const txPayload = await facilitator.buildTransactionForClient({
  from: userAddress,
  to: recipientAddress,
  amount: '1000000', // octas
  nonce: generateSecureNonce(),
  validUntil: calculateExpirationTimestamp(3600),
  chainId: getChainIdFromNetwork('aptos-testnet'),
  contractAddress: process.env.CONTRACT_ADDRESS,
});

// Submit signed transaction as fee payer
const result = await facilitator.submitPayment({
  from: userAddress,
  to: recipientAddress,
  amount: '1000000',
  nonce: nonce,
  authenticator: userSignature,
  validUntil: validUntil,
  chainId: chainId,
});
```

## Documentation

See the [main repository](https://github.com/raintree-technology/x402a) for full documentation.

## Exports

### Client (`x402a/client`)
- `signTransactionForFeePayer()` - Sign transactions for fee payer
- `calculateExpiration()` - Calculate expiration timestamps
- `generateSecureNonce()` - Generate secure nonces
- `getChainIdFromNetwork()` - Get chain ID from network name
- Encoding utilities

### Server (`x402a/server`)
- `X402Facilitator` - Facilitator class
- `parsePaymentHeader()` - Parse payment headers
- `validatePaymentPayload()` - Validate payments
- `getSupportedPayments()` - Get supported payment types
- Health check utilities
- Rate limiting utilities
- Logging utilities

### Types
- Full TypeScript type definitions
- Payment requirements and payloads
- Transaction types
- Configuration types

## Security

This is an experimental release. Key security features:
- Nonce-based replay protection
- Transaction expiration
- Chain ID validation
- Balance pre-checks
- Zero address prevention
- Integer overflow protection

**Do not use with real funds. Testnet only.**

## License

MIT

## Links

- [GitHub Repository](https://github.com/raintree-technology/x402a)
- [npm Package](https://www.npmjs.com/package/x402a)
- [Documentation](https://github.com/raintree-technology/x402a#readme)
