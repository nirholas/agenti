# HTTP x402 Client Adapter

Wraps x402 v2 SDK clients to use Ampersend treasurers for payment decisions.

## Overview

Integrates ampersend-sdk treasurers with Coinbase's x402 v2 SDK (`@x402/fetch`), enabling sophisticated payment authorization logic (budgets, policies, approvals) with standard x402 HTTP clients.

**→ [Complete Documentation](../../../../README.md)**

## Quick Start

```typescript
import { createAmpersendHttpClient } from "@ampersend_ai/ampersend-sdk"

// Create HTTP client (one-liner setup)
const fetchWithPayment = await createAmpersendHttpClient({
  smartAccountAddress: "0x...",
  sessionKeyPrivateKey: "0x...",
})

const response = await fetchWithPayment("https://paid-api.example.com/resource")
```

## API Reference

### wrapWithAmpersend

```typescript
function wrapWithAmpersend(client: x402Client, treasurer: X402Treasurer, networks: Array<string>): x402Client
```

Configures an x402Client to use an Ampersend treasurer for payment authorization.

**Parameters:**

- `client` - The x402Client instance to wrap
- `treasurer` - The X402Treasurer that handles payment authorization decisions
- `networks` - Array of v1 network names to register (e.g., `"base"`, `"base-sepolia"`)

**Returns:** The configured x402Client instance (same instance, mutated)

## Features

- **Transparent Integration**: Drop-in replacement for `registerExactEvmScheme`
- **Treasurer Pattern**: Payment decisions via `X402Treasurer.onPaymentRequired()`
- **Payment Lifecycle**: Tracks payment status (sending, success, error) via `onStatus()`
- **v1 Protocol Support**: Works with EVM networks using v1 payment payloads

## How It Works

1. Wraps the x402Client with treasurer-based payment hooks
2. On 402 response, calls `treasurer.onPaymentRequired()` for authorization
3. If approved, creates payment using the treasurer's wallet
4. Notifies treasurer of payment status via `onStatus()`

## Learn More

- [TypeScript SDK Guide](../../../../README.md)
- [Treasurer Documentation](../../../../README.md#x402treasurer)
- [x402-http-client Example](https://github.com/edgeandnode/ampersend-examples/tree/main/typescript/examples/x402-http-client)
