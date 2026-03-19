# Public API Surface

This document outlines the public API surface of `x402-starknet` following library best practices.

## Design Principles

- **Small, stable surface** - Only 100 named exports
- **No wildcard exports** - Explicit named exports only
- **No deep imports** - Single entry point via `x402-starknet`
- **Tree-shakeable** - `sideEffects: false` in package.json
- **Type-safe** - Full TypeScript support with strict types
- **Stable error codes** - Programmatic error handling (spec-compliant)
- **Minimal runtime deps** - Only `zod`
- **Peer dependency model** - `starknet` as peer dependency

---

## Public Exports (100 total)

### Core Functions (3)

Payment operations:

- `createPaymentPayload()` - Create signed payment
- `verifyPayment()` - Verify payment validity
- `settlePayment()` - Execute payment transaction

### Encoding Utilities (7)

- `encodePaymentSignature()` - Encode payment payload to base64 for `PAYMENT-SIGNATURE` header
- `decodePaymentSignature()` - Decode payment payload from base64
- `encodePaymentRequired()` - Encode PaymentRequired response to base64
- `decodePaymentRequired()` - Decode PaymentRequired response from base64
- `encodePaymentResponse()` - Encode PaymentResponse to base64
- `decodePaymentResponse()` - Decode PaymentResponse from base64
- `HTTP_HEADERS` - Standard HTTP header names constant

### Network Utilities (15)

**Core utilities:**

- `getNetworkConfig()` - Get network configuration
- `getTransactionUrl()` - Get explorer URL for transaction
- `getAddressUrl()` - Get explorer URL for address
- `isTestnet()` - Check if network is testnet
- `isMainnet()` - Check if network is mainnet
- `getSupportedNetworks()` - Get all supported networks

**Validation & parsing utilities:**

- `isStarknetNetwork()` - Type guard for valid network identifiers
- `validateNetwork()` - Validate and return typed network
- `parseStarknetNetwork()` - Parse CAIP-2 into namespace + reference
- `buildStarknetCAIP2()` - Build CAIP-2 from reference
- `getNetworkReference()` - Get reference from CAIP-2 identifier

**Network constants:**

- `STARKNET_NETWORKS` - Array of supported networks
- `NETWORK_REFERENCES` - Map CAIP-2 to reference strings
- `NETWORK_NAMES` - Human-readable network names
- `DEFAULT_RPC_URLS` - Default RPC endpoints

### Token Utilities (12)

**Token address constants:**

- `ETH_ADDRESSES` - ETH contract addresses by network
- `STRK_ADDRESSES` - STRK contract addresses by network
- `USDC_ADDRESSES` - USDC contract addresses by network
- `TOKEN_ADDRESSES` - All token addresses indexed by symbol
- `TOKEN_DECIMALS` - Token decimal places by symbol

**Token utilities:**

- `getTokenAddress()` - Get token address for a network
- `getTokenDecimals()` - Get decimals for a token
- `getTokenSymbol()` - Identify token from address
- `toAtomicUnits()` - Convert human amount to atomic units
- `fromAtomicUnits()` - Convert atomic units to human amount
- `isTokenAvailable()` - Check if token available on network
- `getAvailableTokens()` - Get all tokens for a network

### Provider Factory (2)

- `createProvider()` - Create RPC provider for a network with optional custom config
- `getChainId()` - Get Starknet.js chain ID constant for a network

### Facilitator Client (2)

- `FacilitatorClient` - HTTP client class for facilitator API
- `createFacilitatorClient()` - Factory function for FacilitatorClient

### Discovery Client (2)

- `DiscoveryClient` - HTTP client class for Bazaar discovery API
- `createDiscoveryClient()` - Factory function for DiscoveryClient

### Payment Builder Utilities (4)

Convenience builders for constructing payment requirements:

- `buildPaymentRequirements()` - Build PaymentRequirements with token resolution and amount conversion
- `buildETHPayment()` - Build ETH payment requirements
- `buildSTRKPayment()` - Build STRK payment requirements
- `buildUSDCPayment()` - Build USDC payment requirements (mainnet only)

### Extensions System (10)

- `ExtensionRegistry` - Extension registry class
- `createExtensionRegistry()` - Factory function for ExtensionRegistry
- `globalRegistry` - Global extension registry instance
- `createExtensionData()` - Create extension data for payloads
- `getExtensionInfo()` - Extract info from extension data
- `hasExtension()` - Check if extensions contain a specific extension
- `getExtensionNames()` - Get all extension names from a record
- `mergeExtensions()` - Merge extensions from multiple sources
- `filterRegisteredExtensions()` - Filter to only registered extensions
- `validateExtensions()` - Validate all extensions against registry
- `defineExtension()` - Helper to create extension definitions

### Paymaster Configuration (3)

- `createPaymasterConfig()` - Create paymaster config from network and options
- `createSettlementOptions()` - Create settlement options with paymaster config
- `hasPublicPaymaster()` - Check if network has a public paymaster endpoint

### Constants (4)

- `VERSION` - Library version (`'1.0.0'`)
- `X402_VERSION` - Protocol version (`2`)
- `DEFAULT_PAYMASTER_ENDPOINTS` - AVNU paymaster endpoints
- `NETWORK_CONFIGS` - Network configurations

### Error Classes (4)

- `X402Error` - Base error class
- `PaymentError` - Payment-related errors
- `NetworkError` - Network-related errors
- `ERROR_CODES` - Constant object with all error codes

### Zod Validation Schemas (31)

Runtime validation schemas for type-safe parsing:

**Network Schemas:**

- `STARKNET_NETWORK_ID_SCHEMA` - Validate CAIP-2 network identifiers
- `STARKNET_NETWORK_SCHEMA` - Alias for network validation

**Payment Schemas:**

- `PAYMENT_SCHEME_SCHEMA` - Validate payment scheme ("exact")
- `SIGNATURE_SCHEMA` - Validate Starknet signatures
- `PAYMENT_AUTHORIZATION_SCHEMA` - Validate authorization structure
- `RESOURCE_INFO_SCHEMA` - Validate resource information
- `EXTENSION_DATA_SCHEMA` - Validate extension data
- `PAYMENT_REQUIREMENTS_SCHEMA` - Validate payment requirements
- `PAYMENT_REQUIREMENTS_V2_SCHEMA` - Alias for v2 requirements
- `EXACT_STARKNET_PAYLOAD_SCHEMA` - Validate exact scheme payload
- `PAYMENT_PAYLOAD_SCHEMA` - Validate payment payload
- `PAYMENT_PAYLOAD_V2_SCHEMA` - Alias for v2 payload
- `PAYMENT_REQUIRED_SCHEMA` - Validate 402 response

**Settlement Schemas:**

- `INVALID_PAYMENT_REASON_SCHEMA` - Validate error reasons
- `VERIFY_RESPONSE_SCHEMA` - Validate verification response
- `VERIFY_RESPONSE_V2_SCHEMA` - Alias for v2 verify response
- `SETTLE_RESPONSE_SCHEMA` - Validate settlement response
- `SETTLE_RESPONSE_V2_SCHEMA` - Alias for v2 settle response
- `SUPPORTED_KIND_SCHEMA` - Validate supported payment kind
- `SUPPORTED_RESPONSE_SCHEMA` - Validate /supported response

**Config Schemas:**

- `NETWORK_CONFIG_SCHEMA` - Validate network configuration
- `ACCOUNT_CONFIG_SCHEMA` - Validate account configuration
- `PROVIDER_OPTIONS_SCHEMA` - Validate provider options

**Discovery Schemas:**

- `RESOURCE_TYPE_SCHEMA` - Validate resource type (http, mcp, a2a)
- `RESOURCE_METADATA_SCHEMA` - Validate resource metadata
- `DISCOVERED_RESOURCE_SCHEMA` - Validate discovered resource
- `DISCOVERY_PAGINATION_SCHEMA` - Validate pagination info
- `DISCOVERY_RESPONSE_SCHEMA` - Validate discovery API response
- `DISCOVERY_PARAMS_SCHEMA` - Validate discovery query params
- `REGISTER_RESOURCE_REQUEST_SCHEMA` - Validate registration request
- `REGISTER_RESOURCE_RESPONSE_SCHEMA` - Validate registration response

### Types (Exported as TypeScript types)

All TypeScript types are exported:

- `StarknetNetwork`, `StarknetNetworkId`, `NetworkConfig`, `ProviderOptions`
- `PaymentScheme`, `Signature`, `PaymentAuthorization`
- `PaymentRequirements`, `PaymentPayload`, `PaymentRequired`
- `ResourceInfo`, `ExtensionData`, `ExactStarknetPayload`
- `VerifyResponse`, `SettleResponse`, `InvalidPaymentReason`
- `SupportedKind`, `SupportedResponse`
- `PaymasterConfig`, `SettlementOptions`, `PaymasterConfigOptions`, `ErrorCode`
- `Extension`, `IExtensionRegistry`, `ValidationResult`, `JSONSchema`
- `FacilitatorClientConfig`, `IFacilitatorClient`
- `DiscoveryClientConfig`, `IDiscoveryClient`
- `ResourceType`, `ResourceMetadata`, `DiscoveredResource`, `DiscoveryPagination`
- `DiscoveryResponse`, `DiscoveryParams`, `RegisterResourceRequest`, `RegisterResourceResponse`
- `PaymentRequirementsParams`, `ETHPaymentParams`, `STRKPaymentParams`, `USDCPaymentParams`

---

## Internal (Not Exported)

The following are implementation details and NOT exported:

- `PaymasterClient` class (abstracted away)
- Low-level paymaster helpers (`buildTransaction`, `executeTransaction`, etc.)
- Token utilities (`getTokenBalance`, `getTokenMetadata`)
- Provider utilities (`retryRpcCall`)
- Encoding helpers (`hexToFelt`, `feltToHex`)
- Internal helpers (`extractPayerAddress`, `waitForSettlement`)

---

## Package Configuration

```json
{
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "dependencies": {
    "zod": "^3.24.2"
  },
  "peerDependencies": {
    "starknet": "^8.0.0"
  }
}
```

**Key points:**

- ESM-only (no CJS)
- `sideEffects: false` enables optimal tree-shaking
- Single entry point (no subpath exports)
- Minimal runtime dependencies
- `starknet` as peer dependency (consumer provides)

---

## Import Examples

### Good - Named imports

```typescript
import { createPaymentPayload, verifyPayment } from 'x402-starknet';
```

### Good - Specific type imports

```typescript
import type { PaymentRequirements, VerifyResponse } from 'x402-starknet';
```

### Good - Facilitator client

```typescript
import { createFacilitatorClient } from 'x402-starknet';

const client = createFacilitatorClient({
  baseUrl: 'https://facilitator.example.com',
});
```

### Good - Payment Builders

```typescript
import { buildUSDCPayment, buildETHPayment } from 'x402-starknet';

// Build USDC payment requirements
const usdcReq = buildUSDCPayment({
  network: 'starknet:mainnet',
  amount: 1.5, // $1.50 USDC (human-readable)
  payTo: '0x1234...',
});

// Build ETH payment requirements
const ethReq = buildETHPayment({
  network: 'starknet:sepolia',
  amount: 0.001, // 0.001 ETH
  payTo: '0x1234...',
});
```

### Good - Extensions

```typescript
import { createExtensionRegistry, defineExtension } from 'x402-starknet';

const registry = createExtensionRegistry();
registry.register(
  defineExtension('receipts', {
    description: 'Payment receipts',
    schema: { type: 'object' },
  })
);
```

### Good - Validation with Zod schemas

```typescript
import {
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
} from 'x402-starknet';

// Parse and validate incoming data - result is properly typed
const payload = PAYMENT_PAYLOAD_SCHEMA.parse(rawPayload);
const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(rawRequirements);

// Safe parsing (returns { success, data } or { success, error })
const result = PAYMENT_PAYLOAD_SCHEMA.safeParse(untrustedData);
if (result.success) {
  console.log('Valid payload:', result.data);
} else {
  console.error('Validation errors:', result.error);
}
```

### Bad - Wildcard import (prevents tree-shaking)

```typescript
import * as x402 from 'x402-starknet';
```

### Bad - Deep imports (not supported)

```typescript
import { verifyPayment } from 'x402-starknet/payment'; // ERROR
```

---

## Error Handling Strategy

All errors extend from `X402Error` with stable `code` properties following x402 spec section 9:

```typescript
try {
  const payload = await createPaymentPayload(...);
} catch (error) {
  if (error instanceof PaymentError) {
    switch (error.code) {
      case 'ECONFLICT':
        // Handle insufficient funds
        break;
      case 'EINVALID_INPUT':
        // Handle invalid payload
        break;
    }
  }
}
```

**Stable Error Codes (spec-compliant):**

- `EINVALID_INPUT` - Invalid input or payload
- `ENOT_FOUND` - Resource not found
- `ETIMEOUT` - Operation timed out
- `ECONFLICT` - Conflict (e.g., insufficient funds, network mismatch)
- `ECANCELLED` - Operation cancelled
- `EINTERNAL` - Internal error
- `ENETWORK` - Network-related error
- `EPAYMASTER` - Paymaster error

---

## API Stability

**Current version:** 1.0.0 (stable)

**Versioning:**

- **MAJOR** - Breaking API changes
- **MINOR** - New features (backwards-compatible)
- **PATCH** - Bug fixes

**Deprecation Policy:**

1. Mark as `@deprecated` in JSDoc for one minor version
2. Log warnings in console
3. Remove in next major version
4. Provide migration guide and codemod if feasible

**Breaking changes will only occur in major releases.**

---

## Bundle Size

Optimized for minimal bundle size:

- **Tree-shakeable** - Only import what you use
- **Minimal runtime deps** - Only `zod` (~7kb)
- **Pure functions** - No classes or heavy abstractions
- **Type-only exports** - TypeScript types are free at runtime

Estimated bundle impact: **~15kb** (minified + gzipped) for full API

---

## Testing Public API

We include a test that verifies only intended exports are public:

```typescript
// tests/unit/public-api.test.ts
import * as publicApi from 'x402-starknet';

it('should export only intended symbols', () => {
  const allExports = Object.keys(publicApi);
  expect(allExports).toHaveLength(100); // Enforced!
});
```

This ensures we don't accidentally leak internal APIs.

---

## Migration from v0.3.2 to v1.0.0

### Network Identifiers

Network identifiers now use CAIP-2 format:

```typescript
// v0.1.0 (old)
const network = 'starknet-sepolia';

// v1.0.0 (new)
const network = 'starknet:sepolia';
```

### Encoding Functions

Encoding functions have been renamed to match spec v2:

```typescript
// v0.1.0 (old)
import { encodePaymentHeader, decodePaymentHeader } from 'x402-starknet';

// v1.0.0 (new)
import { encodePaymentSignature, decodePaymentSignature } from 'x402-starknet';
```

### HTTP Headers

HTTP headers use new names:

```typescript
// v0.1.0 (old)
headers: { 'X-Payment': encoded }

// v1.0.0 (new)
import { HTTP_HEADERS } from 'x402-starknet';
headers: { [HTTP_HEADERS.PAYMENT_SIGNATURE]: encoded }
// or: headers: { 'PAYMENT-SIGNATURE': encoded }
```

### Payment Requirements

Field names updated:

```typescript
// v0.1.0 (old)
{
  maxAmountRequired: '1000000';
}

// v1.0.0 (new)
{
  amount: '1000000';
}
```

### New Features

- `FacilitatorClient` for HTTP communication with facilitator servers
- Extensions system for protocol extensibility
- `HTTP_HEADERS` constant for standard header names

---

## Documentation

- **API Reference**: See [api.md](./api.md) for complete documentation
- **Usage Examples**: See [usage-examples.md](./usage-examples.md) for practical integration examples
- **Scheme Spec**: See [scheme_exact_starknet.md](./scheme_exact_starknet.md) for payment scheme details
- **Paymaster Setup**: See [paymaster-setup.md](./paymaster-setup.md) for paymaster configuration

---

## Comparison with Library Best Practices

| Practice           | Status | Notes                               |
| ------------------ | ------ | ----------------------------------- |
| Small surface      | Yes    | 100 named exports                   |
| Named exports only | Yes    | No `export *`                       |
| No deep imports    | Yes    | Single entry point                  |
| Tree-shakeable     | Yes    | `sideEffects: false`                |
| Minimal deps       | Yes    | Only 1 runtime dep (zod)            |
| Peer deps          | Yes    | `starknet` as peer                  |
| Type-safe          | Yes    | Full TypeScript support             |
| Stable errors      | Yes    | Error codes + classes               |
| ESM-first          | Yes    | `"type": "module"`                  |
| Documented         | Yes    | API.md + JSDoc + Scheme spec        |
| Tested             | Yes    | 465 tests, 100% public API coverage |

---

## Summary

The `x402-starknet` library follows industry best practices for library design:

- **Minimal, stable API** with 100 exports
- **Tree-shakeable** for optimal bundle sizes
- **Type-safe** with comprehensive TypeScript support
- **Predictable errors** with stable, spec-compliant error codes
- **Well-documented** with comprehensive API reference and protocol specification
- **Fully tested** with public API surface verification (465 tests)
- **Spec-compliant** with x402 v2 protocol
