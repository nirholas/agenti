# x402-starknet API Reference

Complete API documentation for the Starknet x402 payment protocol library.

**Version:** 1.0.0
**License:** Apache-2.0
**Protocol Version:** x402 v2

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Payment Operations](#core-payment-operations)
- [Network Utilities](#network-utilities)
- [Token Utilities](#token-utilities)
- [Encoding Utilities](#encoding-utilities)
- [Facilitator Client](#facilitator-client)
- [Discovery Client](#discovery-client)
- [Extensions System](#extensions-system)
- [Zod Validation Schemas](#zod-validation-schemas)
- [Constants](#constants)
- [TypeScript Types](#typescript-types)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Installation

```bash
npm install x402-starknet starknet
# or
bun add x402-starknet starknet
# or
yarn add x402-starknet starknet
```

**Peer Dependencies:**

- `starknet` ^8.0.0

---

## Quick Start

```typescript
import {
  createPaymentPayload,
  verifyPayment,
  settlePayment,
  getNetworkConfig,
  DEFAULT_PAYMASTER_ENDPOINTS,
  HTTP_HEADERS,
  encodePaymentSignature,
} from 'x402-starknet';
import { Account, RpcProvider } from 'starknet';

// 1. Create payment payload (client-side)
const payload = await createPaymentPayload(
  account,
  2, // x402 version
  paymentRequirements,
  {
    endpoint: DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia'],
    network: 'starknet:sepolia',
  }
);

// 2. Verify payment (server-side)
const verification = await verifyPayment(
  provider,
  payload,
  paymentRequirements
);

if (!verification.isValid) {
  console.error('Payment invalid:', verification.invalidReason);
  return;
}

// 3. Settle payment (server-side)
const settlement = await settlePayment(provider, payload, paymentRequirements);

console.log('Payment settled:', settlement.transaction);
```

---

## Core Payment Operations

### `createPaymentPayload`

Create a signed payment payload for an x402 request.

```typescript
function createPaymentPayload(
  account: Account,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
  paymasterConfig: PaymasterConfig
): Promise<PaymentPayload>;
```

**Parameters:**

- `account` - User's Starknet account (from starknet.js)
- `x402Version` - x402 protocol version (currently `2`)
- `paymentRequirements` - Payment requirements from server's 402 response
- `paymasterConfig` - Paymaster configuration
  - `endpoint` - Paymaster RPC endpoint URL
  - `network` - Network identifier (CAIP-2 format: `'starknet:mainnet'` | `'starknet:sepolia'` | `'starknet:devnet'`)
  - `apiKey?` - Optional API key for paymaster

**Returns:** `Promise<PaymentPayload>` - Signed payment payload to send to server

**Throws:**

- `PaymentError` - If payload creation fails
- `NetworkError` - If network interaction fails

**Example:**

```typescript
import {
  createPaymentPayload,
  DEFAULT_PAYMASTER_ENDPOINTS,
} from 'x402-starknet';

const payload = await createPaymentPayload(account, 2, paymentRequirements, {
  endpoint: DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia'],
  network: 'starknet:sepolia',
});
```

---

### `verifyPayment`

Verify a payment payload without executing the transaction.

This function validates:

- Payload structure (schema compliance)
- Network, asset, recipient, and amount matching
- **Payment expiration (validUntil timestamp)**
- Payer token balance sufficiency

```typescript
function verifyPayment(
  provider: RpcProvider,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse>;
```

**Parameters:**

- `provider` - Starknet RPC provider
- `payload` - Payment payload from client
- `paymentRequirements` - Payment requirements to verify against

**Returns:** `Promise<VerifyResponse>` - Verification result

**VerifyResponse:**

```typescript
{
  isValid: boolean;
  invalidReason?: InvalidPaymentReason;
  payer: string;
  details?: {
    balance?: string;
    validUntil?: string;       // Included when payment expired
    currentTimestamp?: string;  // Included when payment expired
    error?: string;
  };
}
```

**Invalid Reasons:**

- `'invalid_signature'` - Signature verification failed
- `'insufficient_funds'` - Payer has insufficient token balance (spec section 9)
- `'expired'` - Payment has expired (current time > validUntil)
- `'invalid_network'` - Network mismatch or malformed payload
- `'invalid_amount'` - Amount mismatch
- `'unexpected_verify_error'` - Unexpected error during verification (spec section 9, check `details.error`)

**Example:**

```typescript
const verification = await verifyPayment(provider, payload, requirements);

if (!verification.isValid) {
  console.error('Invalid payment:', verification.invalidReason);
  console.error('Details:', verification.details);
  return;
}

console.log('Payment valid from:', verification.payer);
```

---

### `settlePayment`

Execute a verified payment transaction via paymaster.

```typescript
function settlePayment(
  provider: RpcProvider,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  options?: {
    paymasterConfig?: {
      endpoint?: string;
      network?: string;
      apiKey?: string;
    };
  }
): Promise<SettleResponse>;
```

**Parameters:**

- `provider` - Starknet RPC provider
- `payload` - Payment payload from client
- `paymentRequirements` - Payment requirements
- `options?` - Optional settlement configuration
  - `paymasterConfig?` - Override paymaster configuration

**Returns:** `Promise<SettleResponse>` - Settlement result

**SettleResponse:**

```typescript
{
  success: boolean;
  errorReason?: string;
  transaction: string;
  network: StarknetNetworkId;
  payer: string;
  status?: 'pending' | 'accepted_on_l2' | 'accepted_on_l1' | 'rejected';
  blockNumber?: number;
  blockHash?: string;
}
```

**Throws:**

- `PaymentError` - If settlement fails
- `NetworkError` - If network interaction fails

**Example:**

```typescript
const settlement = await settlePayment(provider, payload, requirements);

if (!settlement.success) {
  console.error('Settlement failed:', settlement.errorReason);
  return;
}

console.log('Transaction:', settlement.transaction);
console.log('Status:', settlement.status);
console.log('Block:', settlement.blockNumber);
```

---

## Network Utilities

### `getNetworkConfig`

Get network configuration for a Starknet network.

```typescript
function getNetworkConfig(network: StarknetNetworkId): NetworkConfig;
```

**Parameters:**

- `network` - Network identifier (CAIP-2 format)

**Returns:** `NetworkConfig` - Network configuration

**Example:**

```typescript
import { getNetworkConfig } from 'x402-starknet';

const config = getNetworkConfig('starknet:sepolia');
console.log('RPC URL:', config.rpcUrl);
console.log('Chain ID:', config.chainId);
console.log('Explorer:', config.explorerUrl);
```

---

### `getTransactionUrl`

Get block explorer URL for a transaction.

```typescript
function getTransactionUrl(
  network: StarknetNetworkId,
  txHash: string
): string | null;
```

**Parameters:**

- `network` - Network identifier
- `txHash` - Transaction hash

**Returns:** `string | null` - Explorer URL or null if no explorer available

**Example:**

```typescript
const url = getTransactionUrl('starknet:sepolia', '0x1234...');
// Returns: 'https://sepolia.starkscan.co/tx/0x1234...'
```

---

### `getAddressUrl`

Get block explorer URL for an address.

```typescript
function getAddressUrl(
  network: StarknetNetworkId,
  address: string
): string | null;
```

**Parameters:**

- `network` - Network identifier
- `address` - Contract or account address

**Returns:** `string | null` - Explorer URL or null if no explorer available

**Example:**

```typescript
const url = getAddressUrl('starknet:sepolia', '0xabcd...');
// Returns: 'https://sepolia.starkscan.co/contract/0xabcd...'
```

---

### `isTestnet`

Check if a network is a testnet.

```typescript
function isTestnet(network: StarknetNetworkId): boolean;
```

**Example:**

```typescript
console.log(isTestnet('starknet:sepolia')); // true
console.log(isTestnet('starknet:mainnet')); // false
```

---

### `isMainnet`

Check if a network is mainnet.

```typescript
function isMainnet(network: StarknetNetworkId): boolean;
```

---

### `getSupportedNetworks`

Get all supported Starknet networks.

```typescript
function getSupportedNetworks(): Array<StarknetNetworkId>;
```

**Returns:** `Array<StarknetNetworkId>` - Array of network identifiers

**Example:**

```typescript
const networks = getSupportedNetworks();
// Returns: ['starknet:mainnet', 'starknet:sepolia', 'starknet:devnet']
```

---

### `isStarknetNetwork`

Type guard to check if a string is a valid Starknet network identifier.

```typescript
function isStarknetNetwork(network: string): network is StarknetNetworkId;
```

**Parameters:**

- `network` - String to validate

**Returns:** `boolean` - True if the string is a valid network identifier

**Example:**

```typescript
import { isStarknetNetwork, getNetworkConfig } from 'x402-starknet';

const userInput = 'starknet:sepolia';

if (isStarknetNetwork(userInput)) {
  // userInput is now typed as StarknetNetworkId
  const config = getNetworkConfig(userInput);
  console.log(config.rpcUrl);
}
```

---

### `validateNetwork`

Validate a network string and return it as a typed `StarknetNetworkId`. Throws if invalid.

```typescript
function validateNetwork(network: string): StarknetNetworkId;
```

**Parameters:**

- `network` - Network string to validate

**Returns:** `StarknetNetworkId` - Validated network identifier

**Throws:**

- `X402Error` - If network is not supported

**Example:**

```typescript
import { validateNetwork } from 'x402-starknet';

try {
  const network = validateNetwork(userInput);
  // network is now typed as StarknetNetworkId
} catch (error) {
  console.error('Invalid network:', error.message);
}
```

---

### `parseStarknetNetwork`

Parse a CAIP-2 Starknet network identifier into its components.

```typescript
function parseStarknetNetwork(caip2: string): {
  namespace: 'starknet';
  reference: NetworkReference;
};
```

**Parameters:**

- `caip2` - CAIP-2 network identifier (e.g., "starknet:mainnet")

**Returns:** Object with `namespace` ("starknet") and `reference` (e.g., "mainnet")

**Throws:**

- `X402Error` - If not a valid Starknet CAIP-2 identifier

**Example:**

```typescript
import { parseStarknetNetwork } from 'x402-starknet';

const { namespace, reference } = parseStarknetNetwork('starknet:sepolia');
console.log(namespace); // 'starknet'
console.log(reference); // 'sepolia'
```

---

### `buildStarknetCAIP2`

Build a CAIP-2 identifier from a Starknet network reference.

```typescript
function buildStarknetCAIP2(reference: NetworkReference): StarknetNetworkId;
```

**Parameters:**

- `reference` - Network reference ("mainnet", "sepolia", or "devnet")

**Returns:** `StarknetNetworkId` - CAIP-2 network identifier

**Example:**

```typescript
import { buildStarknetCAIP2 } from 'x402-starknet';

const network = buildStarknetCAIP2('sepolia');
console.log(network); // 'starknet:sepolia'
```

---

### `getNetworkReference`

Get the network reference from a CAIP-2 identifier.

```typescript
function getNetworkReference(network: StarknetNetworkId): NetworkReference;
```

**Parameters:**

- `network` - CAIP-2 network identifier

**Returns:** `NetworkReference` - Network reference (e.g., "mainnet", "sepolia", "devnet")

**Example:**

```typescript
import { getNetworkReference } from 'x402-starknet';

const ref = getNetworkReference('starknet:mainnet');
console.log(ref); // 'mainnet'
```

---

### Network Constants

#### `STARKNET_NETWORKS`

Array of all supported Starknet networks in CAIP-2 format.

```typescript
const STARKNET_NETWORKS: readonly [
  'starknet:mainnet',
  'starknet:sepolia',
  'starknet:devnet',
];
```

**Example:**

```typescript
import { STARKNET_NETWORKS } from 'x402-starknet';

for (const network of STARKNET_NETWORKS) {
  console.log(network);
}
```

---

#### `NETWORK_REFERENCES`

Mapping of CAIP-2 network identifiers to their reference strings.

```typescript
const NETWORK_REFERENCES: Record<StarknetNetworkId, NetworkReference>;
```

**Example:**

```typescript
import { NETWORK_REFERENCES } from 'x402-starknet';

console.log(NETWORK_REFERENCES['starknet:mainnet']); // 'mainnet'
```

---

#### `NETWORK_NAMES`

Human-readable display names for networks.

```typescript
const NETWORK_NAMES: Record<StarknetNetworkId, string>;
```

**Example:**

```typescript
import { NETWORK_NAMES } from 'x402-starknet';

console.log(NETWORK_NAMES['starknet:sepolia']); // 'Starknet Sepolia Testnet'
```

---

#### `DEFAULT_RPC_URLS`

Default RPC endpoints for each network.

```typescript
const DEFAULT_RPC_URLS: Record<StarknetNetworkId, string>;
```

**Example:**

```typescript
import { DEFAULT_RPC_URLS } from 'x402-starknet';

const rpcUrl = DEFAULT_RPC_URLS['starknet:mainnet'];
// 'https://starknet-mainnet.public.blastapi.io'
```

---

## Token Utilities

Canonical token addresses and utilities for Starknet.

### Token Address Constants

#### `ETH_ADDRESSES`

ETH contract addresses by network (18 decimals).

```typescript
const ETH_ADDRESSES: Partial<Record<StarknetNetworkId, string>>;
```

**Example:**

```typescript
import { ETH_ADDRESSES } from 'x402-starknet';

const mainnetEth = ETH_ADDRESSES['starknet:mainnet'];
// '0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7'
```

---

#### `STRK_ADDRESSES`

STRK contract addresses by network (18 decimals).

```typescript
const STRK_ADDRESSES: Partial<Record<StarknetNetworkId, string>>;
```

---

#### `USDC_ADDRESSES`

USDC contract addresses by network (6 decimals). Note: USDC is only available on mainnet.

```typescript
const USDC_ADDRESSES: Partial<Record<StarknetNetworkId, string>>;
```

---

#### `TOKEN_ADDRESSES`

All token addresses indexed by symbol and network.

```typescript
const TOKEN_ADDRESSES: Record<
  TokenSymbol,
  Partial<Record<StarknetNetworkId, string>>
>;
```

---

#### `TOKEN_DECIMALS`

Token decimal places by symbol.

```typescript
const TOKEN_DECIMALS: Record<TokenSymbol, number>;
// { ETH: 18, STRK: 18, USDC: 6 }
```

---

### `getTokenAddress`

Get token contract address for a specific network.

```typescript
function getTokenAddress(
  symbol: TokenSymbol,
  network: StarknetNetworkId
): string | undefined;
```

**Parameters:**

- `symbol` - Token symbol (`'ETH'`, `'STRK'`, or `'USDC'`)
- `network` - Network identifier

**Returns:** Token contract address or `undefined` if not available

**Example:**

```typescript
import { getTokenAddress } from 'x402-starknet';

const ethAddress = getTokenAddress('ETH', 'starknet:mainnet');
const usdcAddress = getTokenAddress('USDC', 'starknet:mainnet');

// Returns undefined for unsupported combinations
const sepoliaUsdc = getTokenAddress('USDC', 'starknet:sepolia'); // undefined
```

---

### `getTokenDecimals`

Get number of decimals for a token.

```typescript
function getTokenDecimals(symbol: TokenSymbol): number;
```

**Example:**

```typescript
import { getTokenDecimals } from 'x402-starknet';

console.log(getTokenDecimals('ETH')); // 18
console.log(getTokenDecimals('USDC')); // 6
```

---

### `toAtomicUnits`

Convert human-readable amount to atomic units (smallest unit).

```typescript
function toAtomicUnits(amount: number, symbol: TokenSymbol): string;
```

**Example:**

```typescript
import { toAtomicUnits } from 'x402-starknet';

const atomic = toAtomicUnits(1.5, 'USDC');
console.log(atomic); // '1500000' (1.5 * 10^6)

const ethAtomic = toAtomicUnits(0.001, 'ETH');
console.log(ethAtomic); // '1000000000000000' (0.001 * 10^18)
```

---

### `fromAtomicUnits`

Convert atomic units to human-readable amount.

```typescript
function fromAtomicUnits(atomicUnits: string, symbol: TokenSymbol): number;
```

**Example:**

```typescript
import { fromAtomicUnits } from 'x402-starknet';

const amount = fromAtomicUnits('1500000', 'USDC');
console.log(amount); // 1.5

const ethAmount = fromAtomicUnits('1000000000000000', 'ETH');
console.log(ethAmount); // 0.001
```

---

### `getTokenSymbol`

Identify token symbol from contract address.

```typescript
function getTokenSymbol(
  address: string,
  network: StarknetNetworkId
): TokenSymbol | undefined;
```

**Example:**

```typescript
import { getTokenSymbol, ETH_ADDRESSES } from 'x402-starknet';

const symbol = getTokenSymbol(
  ETH_ADDRESSES['starknet:mainnet']!,
  'starknet:mainnet'
);
console.log(symbol); // 'ETH'
```

---

### `isTokenAvailable`

Check if a token is available on a specific network.

```typescript
function isTokenAvailable(
  symbol: TokenSymbol,
  network: StarknetNetworkId
): boolean;
```

**Example:**

```typescript
import { isTokenAvailable } from 'x402-starknet';

console.log(isTokenAvailable('USDC', 'starknet:mainnet')); // true
console.log(isTokenAvailable('USDC', 'starknet:sepolia')); // false
```

---

### `getAvailableTokens`

Get all available tokens for a network.

```typescript
function getAvailableTokens(network: StarknetNetworkId): Array<TokenSymbol>;
```

**Example:**

```typescript
import { getAvailableTokens } from 'x402-starknet';

const mainnetTokens = getAvailableTokens('starknet:mainnet');
console.log(mainnetTokens); // ['ETH', 'STRK', 'USDC']

const sepoliaTokens = getAvailableTokens('starknet:sepolia');
console.log(sepoliaTokens); // ['ETH', 'STRK']
```

---

## Encoding Utilities

### `encodePaymentSignature`

Encode payment payload to base64 for HTTP `PAYMENT-SIGNATURE` header.

```typescript
function encodePaymentSignature(payload: PaymentPayload): string;
```

**Parameters:**

- `payload` - Payment payload

**Returns:** `string` - Base64-encoded payload

**Example:**

```typescript
import { encodePaymentSignature, HTTP_HEADERS } from 'x402-starknet';

const encoded = encodePaymentSignature(payload);

// Use in HTTP header
fetch(url, {
  headers: {
    [HTTP_HEADERS.PAYMENT_SIGNATURE]: encoded,
  },
});
```

---

### `decodePaymentSignature`

Decode base64 payment header back to payload.

```typescript
function decodePaymentSignature(encoded: string): PaymentPayload;
```

**Parameters:**

- `encoded` - Base64-encoded payment header

**Returns:** `PaymentPayload` - Decoded payment payload

**Throws:**

- `PaymentError` - If decoding or validation fails

**Example:**

```typescript
import { decodePaymentSignature, HTTP_HEADERS } from 'x402-starknet';

const header = request.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);
const payload = decodePaymentSignature(header);
```

---

### `encodePaymentRequired`

Encode PaymentRequired response to base64 for HTTP `PAYMENT-REQUIRED` header.

```typescript
function encodePaymentRequired(response: PaymentRequired): string;
```

**Parameters:**

- `response` - PaymentRequired response to encode

**Returns:** `string` - Base64-encoded response

**Example:**

```typescript
import { encodePaymentRequired, HTTP_HEADERS } from 'x402-starknet';

const paymentRequired: PaymentRequired = {
  x402Version: 2,
  error: 'Payment required',
  accepts: [requirement1, requirement2],
};

const encoded = encodePaymentRequired(paymentRequired);

// Use in HTTP response header
return new Response(null, {
  status: 402,
  headers: {
    [HTTP_HEADERS.PAYMENT_REQUIRED]: encoded,
  },
});
```

---

### `decodePaymentRequired`

Decode base64 PaymentRequired header back to object.

```typescript
function decodePaymentRequired(encoded: string): PaymentRequired;
```

**Parameters:**

- `encoded` - Base64-encoded payment required header

**Returns:** `PaymentRequired` - Decoded payment requirements

**Throws:**

- Error if decoding or validation fails

**Example:**

```typescript
import { decodePaymentRequired, HTTP_HEADERS } from 'x402-starknet';

const response = await fetch(url);
if (response.status === 402) {
  const header = response.headers.get(HTTP_HEADERS.PAYMENT_REQUIRED);
  if (header) {
    const requirements = decodePaymentRequired(header);
    // Use requirements.accepts to create payment
  }
}
```

---

### `encodePaymentResponse`

Encode payment response to base64 for HTTP `PAYMENT-RESPONSE` header.

```typescript
function encodePaymentResponse(response: object): string;
```

---

### `decodePaymentResponse`

Decode base64 payment response header.

```typescript
function decodePaymentResponse(encoded: string): unknown;
```

---

### `HTTP_HEADERS`

Standard HTTP header names for x402 protocol v2.

```typescript
const HTTP_HEADERS: {
  readonly PAYMENT_REQUIRED: 'PAYMENT-REQUIRED';
  readonly PAYMENT_SIGNATURE: 'PAYMENT-SIGNATURE';
  readonly PAYMENT_RESPONSE: 'PAYMENT-RESPONSE';
};
```

**Example:**

```typescript
import { HTTP_HEADERS } from 'x402-starknet';

// Request headers
headers[HTTP_HEADERS.PAYMENT_SIGNATURE] = encodedPayload;

// Response headers
headers[HTTP_HEADERS.PAYMENT_REQUIRED] = encodedRequirements;
headers[HTTP_HEADERS.PAYMENT_RESPONSE] = encodedResponse;
```

---

## Facilitator Client

The FacilitatorClient provides HTTP communication with x402 facilitator servers.

### `FacilitatorClient`

```typescript
class FacilitatorClient implements IFacilitatorClient {
  constructor(config: FacilitatorClientConfig);

  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;

  supported(): Promise<SupportedResponse>;
}
```

### `createFacilitatorClient`

Factory function for creating FacilitatorClient instances.

```typescript
function createFacilitatorClient(
  config: FacilitatorClientConfig
): IFacilitatorClient;
```

**FacilitatorClientConfig:**

```typescript
interface FacilitatorClientConfig {
  baseUrl: string; // Facilitator server URL
  apiKey?: string; // Optional API key
  timeout?: number; // Request timeout (ms), default 30000
  fetch?: typeof fetch; // Custom fetch implementation
}
```

**Example:**

```typescript
import { createFacilitatorClient } from 'x402-starknet';

const client = createFacilitatorClient({
  baseUrl: 'https://facilitator.example.com',
  apiKey: 'your-api-key',
  timeout: 60000,
});

// Verify payment
const verification = await client.verify(payload, requirements);

// Settle payment
const settlement = await client.settle(payload, requirements);

// Check supported schemes
const supported = await client.supported();
console.log('Supported:', supported.kinds);
```

---

## Extensions System

The extensions system provides protocol extensibility following x402 v2 specification.

### `ExtensionRegistry`

```typescript
class ExtensionRegistry implements IExtensionRegistry {
  register(extension: Extension): void;
  get(name: string): Extension | undefined;
  has(name: string): boolean;
  getNames(): Array<string>;
  validate(name: string, data: unknown): ValidationResult;
  unregister(name: string): boolean;
  clear(): void;
}
```

### `createExtensionRegistry`

```typescript
function createExtensionRegistry(): IExtensionRegistry;
```

### `globalRegistry`

Global extension registry instance for application-wide use.

```typescript
const globalRegistry: ExtensionRegistry;
```

### Extension Utilities

```typescript
// Create extension data for payloads
function createExtensionData(
  options: { name: string; info: unknown; validate?: boolean },
  registry?: IExtensionRegistry
): ExtensionData;

// Extract info from extension data
function getExtensionInfo(data: ExtensionData | undefined): unknown;

// Check if extension exists
function hasExtension(
  extensions: Record<string, unknown> | undefined,
  name: string
): boolean;

// Get all extension names
function getExtensionNames(
  extensions: Record<string, unknown> | undefined
): Array<string>;

// Merge extensions from multiple sources
function mergeExtensions(
  ...sources: Array<Record<string, unknown> | undefined>
): Record<string, unknown>;

// Filter to registered extensions only
function filterRegisteredExtensions(
  extensions: Record<string, unknown> | undefined,
  registry: IExtensionRegistry
): Record<string, unknown>;

// Validate all extensions
function validateExtensions(
  extensions: Record<string, unknown> | undefined,
  registry: IExtensionRegistry
): Record<string, { valid: boolean; errors?: Array<string> }>;

// Define extension helper
function defineExtension(
  name: string,
  options?: Omit<Extension, 'name'>
): Extension;
```

**Example:**

```typescript
import {
  createExtensionRegistry,
  defineExtension,
  createExtensionData,
  hasExtension,
} from 'x402-starknet';

// Create registry
const registry = createExtensionRegistry();

// Register extension with schema
registry.register(
  defineExtension('receipts', {
    description: 'Payment receipt generation',
    schema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['pdf', 'json'] },
        email: { type: 'string' },
      },
      required: ['format'],
    },
  })
);

// Create extension data
const receiptData = createExtensionData(
  {
    name: 'receipts',
    info: { format: 'pdf', email: 'user@example.com' },
    validate: true,
  },
  registry
);

// Use in PaymentRequired
const paymentRequired = {
  // ...
  extensions: {
    receipts: receiptData,
  },
};

// Check for extension
if (hasExtension(payload.extensions, 'receipts')) {
  // Handle receipts
}
```

---

## Zod Validation Schemas

The library exports Zod schemas for runtime validation and type-safe parsing of all protocol structures. These schemas enable consuming projects to validate incoming data without maintaining duplicate schema definitions.

### Usage

```typescript
import {
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
} from 'x402-starknet';

// Parse and validate - result is properly typed
const paymentPayload = PAYMENT_PAYLOAD_SCHEMA.parse(rawPayload);
const requirements = PAYMENT_REQUIREMENTS_SCHEMA.parse(rawRequirements);

// Safe parsing (returns { success, data } or { success, error })
const result = PAYMENT_PAYLOAD_SCHEMA.safeParse(untrustedData);
if (result.success) {
  console.log('Valid payload:', result.data);
} else {
  console.error('Validation errors:', result.error.issues);
}
```

### Available Schemas

#### Network Schemas

- `STARKNET_NETWORK_ID_SCHEMA` - Validates CAIP-2 network identifiers (`starknet:mainnet`, `starknet:sepolia`, `starknet:devnet`)
- `STARKNET_NETWORK_SCHEMA` - Alias for `STARKNET_NETWORK_ID_SCHEMA`

#### Payment Schemas

- `PAYMENT_SCHEME_SCHEMA` - Validates payment scheme (currently only `"exact"`)
- `SIGNATURE_SCHEMA` - Validates Starknet signature structure (`{ r, s }`)
- `PAYMENT_AUTHORIZATION_SCHEMA` - Validates authorization structure
- `RESOURCE_INFO_SCHEMA` - Validates resource information (`{ url, description?, mimeType? }`)
- `EXTENSION_DATA_SCHEMA` - Validates extension data structure
- `PAYMENT_REQUIREMENTS_SCHEMA` - Validates server payment requirements
- `PAYMENT_REQUIREMENTS_V2_SCHEMA` - Alias for v2 naming consistency
- `EXACT_STARKNET_PAYLOAD_SCHEMA` - Validates exact scheme payload
- `PAYMENT_PAYLOAD_SCHEMA` - Validates client payment payload
- `PAYMENT_PAYLOAD_V2_SCHEMA` - Alias for v2 naming consistency
- `PAYMENT_REQUIRED_SCHEMA` - Validates 402 response structure

#### Settlement Schemas

- `INVALID_PAYMENT_REASON_SCHEMA` - Validates error reason codes
- `VERIFY_RESPONSE_SCHEMA` - Validates verification response
- `VERIFY_RESPONSE_V2_SCHEMA` - Alias for v2 naming consistency
- `SETTLE_RESPONSE_SCHEMA` - Validates settlement response
- `SETTLE_RESPONSE_V2_SCHEMA` - Alias for v2 naming consistency
- `SUPPORTED_KIND_SCHEMA` - Validates supported payment kind
- `SUPPORTED_RESPONSE_SCHEMA` - Validates `/supported` endpoint response

#### Config Schemas

- `NETWORK_CONFIG_SCHEMA` - Validates network configuration
- `ACCOUNT_CONFIG_SCHEMA` - Validates account configuration
- `PROVIDER_OPTIONS_SCHEMA` - Validates provider options

#### Discovery Schemas

- `RESOURCE_TYPE_SCHEMA` - Validates resource type (`http`, `mcp`, `a2a`)
- `RESOURCE_METADATA_SCHEMA` - Validates resource metadata
- `DISCOVERED_RESOURCE_SCHEMA` - Validates discovered resource structure
- `DISCOVERY_PAGINATION_SCHEMA` - Validates pagination information
- `DISCOVERY_RESPONSE_SCHEMA` - Validates discovery API response
- `DISCOVERY_PARAMS_SCHEMA` - Validates discovery query parameters
- `REGISTER_RESOURCE_REQUEST_SCHEMA` - Validates registration request
- `REGISTER_RESOURCE_RESPONSE_SCHEMA` - Validates registration response

### Example: Server-side Validation

```typescript
import {
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  verifyPayment,
  settlePayment,
  type PaymentPayload,
  type PaymentRequirements,
} from 'x402-starknet';
import { RpcProvider } from 'starknet';

async function handlePayment(rawPayload: unknown, rawRequirements: unknown) {
  // Validate incoming data with proper error handling
  const payloadResult = PAYMENT_PAYLOAD_SCHEMA.safeParse(rawPayload);
  if (!payloadResult.success) {
    return {
      error: 'Invalid payment payload',
      details: payloadResult.error.issues,
    };
  }

  const requirementsResult =
    PAYMENT_REQUIREMENTS_SCHEMA.safeParse(rawRequirements);
  if (!requirementsResult.success) {
    return {
      error: 'Invalid requirements',
      details: requirementsResult.error.issues,
    };
  }

  // Types are now properly inferred
  const payload: PaymentPayload = payloadResult.data;
  const requirements: PaymentRequirements = requirementsResult.data;

  // Continue with verification and settlement
  const provider = new RpcProvider({ nodeUrl: '...' });
  const verification = await verifyPayment(provider, payload, requirements);

  if (!verification.isValid) {
    return { error: verification.invalidReason };
  }

  const settlement = await settlePayment(provider, payload, requirements);
  return { success: settlement.success, transaction: settlement.transaction };
}
```

---

## Constants

### `VERSION`

Library version.

```typescript
const VERSION: string = '1.0.0';
```

---

### `X402_VERSION`

Supported x402 protocol version.

```typescript
const X402_VERSION: number = 2;
```

---

### `DEFAULT_PAYMASTER_ENDPOINTS`

Default AVNU paymaster endpoints for each network.

```typescript
const DEFAULT_PAYMASTER_ENDPOINTS: {
  readonly 'starknet:mainnet': 'https://starknet.paymaster.avnu.fi';
  readonly 'starknet:sepolia': 'http://localhost:12777';
  readonly 'starknet:devnet': 'http://localhost:12777';
};
```

**Example:**

```typescript
import { DEFAULT_PAYMASTER_ENDPOINTS } from 'x402-starknet';

const endpoint = DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia'];
```

---

### `NETWORK_CONFIGS`

Network configurations for all supported networks.

```typescript
const NETWORK_CONFIGS: {
  readonly [K in StarknetNetworkId]: NetworkConfig;
};
```

**Example:**

```typescript
import { NETWORK_CONFIGS } from 'x402-starknet';

const sepoliaConfig = NETWORK_CONFIGS['starknet:sepolia'];
console.log('RPC:', sepoliaConfig.rpcUrl);
```

---

## TypeScript Types

### `StarknetNetworkId`

Supported Starknet network identifiers (CAIP-2 format).

```typescript
type StarknetNetworkId =
  | 'starknet:mainnet'
  | 'starknet:sepolia'
  | 'starknet:devnet';
```

---

### `StarknetNetwork`

Legacy network identifier type (alias for StarknetNetworkId).

```typescript
type StarknetNetwork = StarknetNetworkId;
```

---

### `NetworkConfig`

Network configuration.

```typescript
interface NetworkConfig {
  readonly network: StarknetNetworkId;
  readonly chainId: string;
  readonly rpcUrl: string;
  readonly explorerUrl: string | null;
  readonly name: string;
}
```

---

### `PaymentScheme`

Payment scheme (currently only 'exact' is supported).

```typescript
type PaymentScheme = 'exact';
```

---

### `PaymentRequirements`

Payment requirements from server's 402 response.

```typescript
interface PaymentRequirements {
  readonly scheme: PaymentScheme;
  readonly network: StarknetNetworkId;
  readonly amount: string; // Amount in smallest token unit
  readonly asset: string;
  readonly payTo: string;
  readonly resource: ResourceInfo; // Resource identifier
  readonly description?: string;
  readonly mimeType?: string;
  readonly outputSchema?: object | null;
  readonly maxTimeoutSeconds: number; // REQUIRED per spec
  readonly extra?: {
    readonly tokenName?: string;
    readonly tokenSymbol?: string;
    readonly tokenDecimals?: number;
    readonly paymentContract?: string;
  };
}
```

**Spec compliance:** x402 v2 Section 5.1 - PaymentRequirements Schema

**Required Fields:**

- `scheme`: Payment scheme identifier ("exact")
- `network`: CAIP-2 network identifier
- `amount`: Payment amount in smallest token unit (string)
- `asset`: Token contract address
- `payTo`: Recipient address
- `resource`: Protected resource identifier (string or ResourceInfo object)
- `maxTimeoutSeconds`: Maximum time (seconds) for payment settlement

**Optional Fields:**

- `description`: Human-readable payment description
- `mimeType`: Expected MIME type of response
- `outputSchema`: JSON schema describing response format (can be null)
- `extra`: Scheme-specific metadata (token info, payment contract)

---

### `PaymentPayload`

Payment payload sent from client to server.

```typescript
interface PaymentPayload {
  readonly x402Version: 2;
  readonly scheme: PaymentScheme;
  readonly network: StarknetNetworkId;
  readonly accepted: PaymentRequirements; // The accepted payment option
  readonly payload: ExactStarknetPayload;
}

interface ExactStarknetPayload {
  readonly signature: Signature;
  readonly authorization: PaymentAuthorization;
}

interface Signature {
  readonly r: string;
  readonly s: string;
}

interface PaymentAuthorization {
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly token: string;
  readonly nonce: string;
  readonly validUntil: string;
}
```

---

### `PaymentRequired`

Server's 402 response with payment requirements (v2 format).

**Spec compliance:** x402 v2 Section 5.1 - PaymentRequired Schema

```typescript
interface PaymentRequired {
  readonly x402Version: 2;
  readonly error: string;
  readonly accepts: ReadonlyArray<PaymentRequirements>;
}
```

**Fields:**

- `x402Version`: Protocol version (always 2)
- `error`: Human-readable error message explaining why payment is required
- `accepts`: Array of acceptable payment options

---

### `VerifyResponse`

Result of payment verification.

```typescript
interface VerifyResponse {
  readonly isValid: boolean;
  readonly invalidReason?: InvalidPaymentReason;
  readonly payer: string;
  readonly details?: {
    readonly balance?: string;
    readonly error?: string;
  };
}
```

---

### `SettleResponse`

Result of payment settlement.

```typescript
interface SettleResponse {
  readonly success: boolean;
  readonly errorReason?: string;
  readonly transaction: string;
  readonly network: StarknetNetworkId;
  readonly payer: string;
  readonly status?:
    | 'pending'
    | 'accepted_on_l2'
    | 'accepted_on_l1'
    | 'rejected';
  readonly blockNumber?: number;
  readonly blockHash?: string;
}
```

---

### `PaymasterConfig`

Paymaster configuration.

```typescript
interface PaymasterConfig {
  readonly endpoint: string;
  readonly network: string;
  readonly apiKey?: string;
}
```

---

### `InvalidPaymentReason`

Reasons why a payment might be invalid.

```typescript
type InvalidPaymentReason =
  | 'invalid_signature'
  | 'insufficient_funds' // Spec section 9
  | 'nonce_used'
  | 'expired'
  | 'invalid_network'
  | 'invalid_amount'
  | 'token_not_approved'
  | 'invalid_recipient'
  | 'contract_error'
  | 'unexpected_verify_error'; // Spec section 9
```

---

### Extension Types

```typescript
interface Extension {
  name: string;
  version?: string;
  description?: string;
  defaultInfo?: unknown;
  schema?: JSONSchema;
}

interface IExtensionRegistry {
  register(extension: Extension): void;
  get(name: string): Extension | undefined;
  has(name: string): boolean;
  getNames(): Array<string>;
  validate(name: string, data: unknown): ValidationResult;
  unregister(name: string): boolean;
  clear(): void;
}

interface ValidationResult {
  valid: boolean;
  errors?: Array<string>;
}

interface JSONSchema {
  type?: string | Array<string>;
  properties?: Record<string, JSONSchema>;
  required?: Array<string>;
  items?: JSONSchema;
  enum?: Array<unknown>;
  const?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
}
```

---

## Error Handling

All errors extend from `X402Error` with stable error codes following x402 spec section 9.

### `X402Error`

Base error class.

```typescript
class X402Error extends Error {
  readonly code: ErrorCode;
  constructor(message: string, code: ErrorCode);
}
```

---

### `PaymentError`

Payment-related errors.

```typescript
class PaymentError extends X402Error {
  static invalidPayload(details?: string): PaymentError;
  static insufficientFunds(required: string, available: string): PaymentError;
  static verificationFailed(reason: string): PaymentError;
  static settlementFailed(reason: string): PaymentError;
}
```

**Error Codes:**

- `EINVALID_INPUT` - Payment payload validation failed
- `ECONFLICT` - Insufficient funds or other conflict
- `EINTERNAL` - Internal error

**Example:**

```typescript
try {
  const payload = await createPaymentPayload(...);
} catch (error) {
  if (error instanceof PaymentError) {
    console.error('Payment error:', error.code, error.message);

    if (error.code === 'ECONFLICT') {
      // Handle insufficient balance
    }
  }
}
```

---

### `NetworkError`

Network-related errors.

```typescript
class NetworkError extends X402Error {
  static unsupportedNetwork(network: string): NetworkError;
  static networkMismatch(expected: string, actual: string): NetworkError;
  static rpcFailed(details: string): NetworkError;
}
```

**Error Codes:**

- `EINVALID_INPUT` - Unsupported network
- `ECONFLICT` - Network mismatch
- `ENETWORK` - RPC or network communication failed

---

### `ERROR_CODES`

All error codes as constants (spec-compliant).

```typescript
const ERROR_CODES: {
  readonly EINVALID_INPUT: 'EINVALID_INPUT';
  readonly ENOT_FOUND: 'ENOT_FOUND';
  readonly ETIMEOUT: 'ETIMEOUT';
  readonly ECONFLICT: 'ECONFLICT';
  readonly ECANCELLED: 'ECANCELLED';
  readonly EINTERNAL: 'EINTERNAL';
  readonly ENETWORK: 'ENETWORK';
  readonly EPAYMASTER: 'EPAYMASTER';
};
```

---

## Examples

### Complete Client-Side Flow

```typescript
import {
  createPaymentPayload,
  encodePaymentSignature,
  decodePaymentRequired,
  DEFAULT_PAYMASTER_ENDPOINTS,
  HTTP_HEADERS,
} from 'x402-starknet';
import { Account, RpcProvider } from 'starknet';

async function payForResource(url: string, account: Account) {
  try {
    // 1. Try to access resource without payment
    let response = await fetch(url);

    // 2. If 402 Payment Required, get payment requirements
    if (response.status === 402) {
      const header = response.headers.get(HTTP_HEADERS.PAYMENT_REQUIRED);
      const { accepts } = decodePaymentRequired(header!);
      const requirement = accepts[0];

      // 3. Create payment payload
      const payload = await createPaymentPayload(account, 2, requirement, {
        endpoint: DEFAULT_PAYMASTER_ENDPOINTS[requirement.network],
        network: requirement.network,
      });

      // 4. Retry request with payment
      response = await fetch(url, {
        headers: {
          [HTTP_HEADERS.PAYMENT_SIGNATURE]: encodePaymentSignature(payload),
        },
      });
    }

    // 5. Access resource
    if (response.ok) {
      const data = await response.json();
      return data;
    }

    throw new Error(`Request failed: ${response.status}`);
  } catch (error) {
    console.error('Payment flow failed:', error);
    throw error;
  }
}
```

---

### Complete Server-Side Flow

```typescript
import {
  decodePaymentSignature,
  verifyPayment,
  settlePayment,
  encodePaymentRequired,
  HTTP_HEADERS,
  type PaymentRequirements,
} from 'x402-starknet';
import { RpcProvider } from 'starknet';

const provider = new RpcProvider({ nodeUrl: 'https://...' });

const requirements: PaymentRequirements = {
  scheme: 'exact',
  network: 'starknet:sepolia',
  amount: '1000000', // 1 USDC
  asset: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  payTo: '0x1234...', // Your address
  resource: 'https://api.example.com/data',
  description: 'Premium API access',
  maxTimeoutSeconds: 60, // Required per spec
};

async function handleRequest(request: Request) {
  const paymentHeader = request.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);

  // No payment header - return 402
  if (!paymentHeader) {
    return new Response(null, {
      status: 402,
      headers: {
        [HTTP_HEADERS.PAYMENT_REQUIRED]: encodePaymentRequired({
          x402Version: 2,
          error: 'Payment required',
          accepts: [requirements],
        }),
      },
    });
  }

  try {
    // Decode payment
    const payload = decodePaymentSignature(paymentHeader);

    // Verify payment
    const verification = await verifyPayment(provider, payload, requirements);
    if (!verification.isValid) {
      return new Response(
        JSON.stringify({ error: verification.invalidReason }),
        { status: 400 }
      );
    }

    // Settle payment
    const settlement = await settlePayment(provider, payload, requirements);
    if (!settlement.success) {
      return new Response(JSON.stringify({ error: settlement.errorReason }), {
        status: 500,
      });
    }

    // Payment successful - return resource
    return new Response(
      JSON.stringify({ data: 'Premium content', tx: settlement.transaction }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Payment processing failed:', error);
    return new Response(
      JSON.stringify({ error: 'Payment processing failed' }),
      { status: 500 }
    );
  }
}
```

---

### Using Facilitator Client

```typescript
import {
  createFacilitatorClient,
  decodePaymentSignature,
  HTTP_HEADERS,
} from 'x402-starknet';

const facilitator = createFacilitatorClient({
  baseUrl: 'https://facilitator.example.com',
  apiKey: process.env.FACILITATOR_API_KEY,
});

async function handlePayment(
  request: Request,
  requirements: PaymentRequirements
) {
  const header = request.headers.get(HTTP_HEADERS.PAYMENT_SIGNATURE);
  if (!header) {
    return { status: 402 };
  }

  const payload = decodePaymentSignature(header);

  // Verify via facilitator
  const verification = await facilitator.verify(payload, requirements);
  if (!verification.isValid) {
    return { status: 400, error: verification.invalidReason };
  }

  // Settle via facilitator
  const settlement = await facilitator.settle(payload, requirements);
  if (!settlement.success) {
    return { status: 500, error: settlement.errorReason };
  }

  return { status: 200, transaction: settlement.transaction };
}
```

---

## Tree-Shaking

This library is fully tree-shakeable. Only import what you need:

```typescript
// Good - only imports what you use
import { createPaymentPayload, verifyPayment } from 'x402-starknet';

// Avoid - imports everything
import * as x402 from 'x402-starknet';
```

The library has `"sideEffects": false` in package.json, ensuring optimal bundle sizes.

---

## API Stability

This library follows semantic versioning:

- **MAJOR** version for breaking API changes
- **MINOR** version for new features (backwards-compatible)
- **PATCH** version for bug fixes

Current API is **stable** (v1.0.0). Breaking changes will only occur in major releases.

---

## License

Apache-2.0
