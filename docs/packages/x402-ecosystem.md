# x402 Ecosystem Package

`packages/protocols/x402-ecosystem` - Complete x402 payment protocol integration for AI agent autonomous payments.

## Overview

The x402 Ecosystem package provides the full HTTP 402 payment protocol implementation, enabling AI agents to pay for API access, services, and content autonomously.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  AI Agent    │────>│  API Server  │────>│ Facilitator  │
│  (Agenti)    │<────│  (402 resp)  │<────│ (on-chain)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       └──── Signs payment (EIP-3009) ───────────┘
```

## Components

### @x402/core
Core protocol types, encoding/decoding, and validation logic.

### @x402/evm
EVM payment execution and verification:
- EIP-3009 `transferWithAuthorization` for gasless payments
- Multi-chain USDC support
- Payment proof generation and verification

### @x402/svm
Solana payment execution:
- SPL USDC transfers
- Payment instruction construction
- Proof verification

### @x402/http
HTTP middleware for automatic 402 handling:
- Intercepts 402 responses
- Parses payment requirements
- Signs and resubmits with payment proof

## Payment Schemes

### Exact Payment
Fixed amount for a specific resource:
```json
{
  "scheme": "exact",
  "maxAmountRequired": "100000",
  "network": "base",
  "asset": "USDC"
}
```

### Metered Payment
Pay-per-use based on consumption (planned):
```json
{
  "scheme": "metered",
  "ratePerUnit": "1000",
  "unit": "token",
  "network": "base"
}
```

## SDKs

| Language | Package | Status |
|----------|---------|--------|
| TypeScript | `x402/typescript` | Production |
| Python | `x402/python` | Production |
| Go | `x402/go` | Production |
| Java | `x402/java` | Beta |

## Server-Side Integration

For API providers who want to accept x402 payments:

```typescript
import { x402Middleware } from '@x402/http';

app.use('/paid-api/*', x402Middleware({
  facilitator: '0x...',
  amount: '100000', // 0.10 USDC (6 decimals)
  network: 'base',
  description: 'API access',
}));
```

## Client-Side Integration

Already built into Agenti's `x402_pay_request` tool. For custom clients:

```typescript
import { x402Fetch } from '@x402/http';

const response = await x402Fetch('https://paid-api.com/data', {
  privateKey: process.env.PRIVATE_KEY,
  maxPayment: '1000000', // Max 1 USDC
});
```

## USDs Stablecoin Integration

The package includes Sperax USDs support:
- Auto-yield earning on idle balances
- x402 payment compatible
- Yield tracking and estimation tools

## Configuration

```env
X402_ENABLED=true
X402_DEFAULT_CHAIN=base
X402_MAX_PAYMENT=10
PRIVATE_KEY=0x...
```
