# x402-starknet

![x402-starknet](./docs/banner.png)

**Pure library for implementing the x402 payment protocol on Starknet**

A TypeScript library providing core functions for building x402-compatible payment systems on Starknet. Designed as a foundation library with a minimal, stable API surface.

[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/aspect-build/x402-starknet)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

## Installation

```bash
npm install x402-starknet starknet
# or
bun add x402-starknet starknet
```

## Quick Start

```typescript
import {
  createPaymentPayload,
  verifyPayment,
  settlePayment,
  buildUSDCPayment,
  createProvider,
  createPaymasterConfig,
} from 'x402-starknet';

// Server: Build payment requirements
const requirements = buildUSDCPayment({
  network: 'starknet:mainnet',
  amount: 1.5, // $1.50 USDC
  payTo: '0x1234...',
});

// Client: Create signed payment
const payload = await createPaymentPayload(account, 2, requirements, {
  endpoint: 'https://starknet.paymaster.avnu.fi',
  network: 'starknet:mainnet',
});

// Server: Verify and settle
const provider = createProvider('starknet:mainnet');
const verification = await verifyPayment(provider, payload, requirements);

if (verification.isValid) {
  const paymasterConfig = createPaymasterConfig('starknet:mainnet', {
    apiKey: process.env.PAYMASTER_API_KEY,
  });
  const result = await settlePayment(provider, payload, requirements, {
    paymasterConfig,
  });
}
```

## Features

- **100 Named Exports** - Complete, batteries-included API
- **Type Safe** - Full TypeScript support with Zod validation schemas
- **Starknet Native** - Built for account abstraction with paymaster support
- **Multi-Network** - Mainnet, Sepolia, and devnet (CAIP-2 format)
- **Tree-Shakeable** - `sideEffects: false`, import only what you need
- **Spec Compliant** - Full x402 v2 protocol compliance

## Network Support

| Network | Identifier         | Status    |
| ------- | ------------------ | --------- |
| Mainnet | `starknet:mainnet` | Supported |
| Sepolia | `starknet:sepolia` | Supported |
| Devnet  | `starknet:devnet`  | Supported |

## Documentation

| Document                                                | Description                          |
| ------------------------------------------------------- | ------------------------------------ |
| [Usage Examples](./docs/usage-examples.md)              | Practical integration examples       |
| [Code Examples](./examples/)                            | Runnable TypeScript example files    |
| [API Reference](./docs/api.md)                          | Complete API documentation           |
| [API Surface](./docs/api-surface.md)                    | Public exports and design principles |
| [Paymaster Setup](./docs/paymaster-setup.md)            | Paymaster configuration guide        |
| [Scheme Specification](./docs/scheme_exact_starknet.md) | x402 exact scheme for Starknet       |

## Development

```bash
git clone https://github.com/aspect-build/x402-starknet.git
cd x402-starknet
bun install
bun run build    # Build TypeScript
bun run test     # Run tests (575 tests)
bun run lint     # Lint code
bun run check    # Run all checks
```

## License

Apache License 2.0 - see [LICENSE](./LICENSE) for details.

---

**Version**: 1.0.0 | **Protocol**: x402 v2 | **Tests**: 575 passing
