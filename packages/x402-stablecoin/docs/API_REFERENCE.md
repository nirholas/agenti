# X402 API Reference

> Comprehensive API documentation for the X402 Payment Protocol

**Version:** 1.0.0  
**Last Updated:** January 22, 2026  
**License:** MIT

---

## Table of Contents

1. [SDK Reference (@x402/sdk)](#sdk-reference-x402sdk)
2. [Facilitator REST API](#facilitator-rest-api)
3. [MCP Tools Reference (@x402/sperax-mcp)](#mcp-tools-reference-x402sperax-mcp)
4. [CLI Reference (@x402/cli)](#cli-reference-x402cli)
5. [Smart Contract ABIs](#smart-contract-abis)

---

## SDK Reference (@x402/sdk)

The X402 SDK provides a full-featured TypeScript/JavaScript client for interacting with the X402 payment protocol on Arbitrum and other EVM chains.

### Installation

```bash
npm install @x402/sdk
# or
pnpm add @x402/sdk
```

### Quick Start

```typescript
import { X402Client } from '@x402/sdk';

const client = new X402Client({
  chain: 'arbitrum',
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

// Simple payment
await client.pay('0x...', '10.00', 'USDs');
```

---

### X402Client

The main client class for interacting with the X402 payment protocol.

#### Constructor

```typescript
new X402Client(options: X402ClientConfig)
```

##### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `options.chain` | `X402Chain` | ✅ | - | Blockchain network to use |
| `options.privateKey` | `` `0x${string}` `` | ❌ | - | Private key for signing transactions |
| `options.rpcUrl` | `string` | ❌ | Network default | Custom RPC URL |
| `options.facilitatorUrl` | `string` | ❌ | `'http://localhost:3002'` | Facilitator server URL |
| `options.enableGasless` | `boolean` | ❌ | `true` | Enable gasless payments via EIP-3009 |
| `options.timeout` | `number` | ❌ | `30000` | Request timeout in milliseconds |
| `options.debug` | `boolean` | ❌ | `false` | Enable debug logging |

##### Supported Chains

| Chain | Chain ID | Description |
|-------|----------|-------------|
| `'arbitrum'` | 42161 | Arbitrum One (mainnet) |
| `'arbitrum-sepolia'` | 421614 | Arbitrum Sepolia (testnet) |
| `'base'` | 8453 | Base (mainnet) |
| `'ethereum'` | 1 | Ethereum mainnet |
| `'polygon'` | 137 | Polygon mainnet |
| `'optimism'` | 10 | Optimism mainnet |
| `'bsc'` | 56 | BNB Smart Chain |

##### Example

```typescript
import { X402Client } from '@x402/sdk';

const client = new X402Client({
  chain: 'arbitrum',
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  enableGasless: true,
  timeout: 60000,
});
```

##### Errors

| Error Code | Description |
|------------|-------------|
| `UNSUPPORTED_CHAIN` | The specified chain is not supported |
| `INVALID_CONFIG` | Invalid configuration parameters |

---

#### Methods

##### `pay(recipient, amount, token?)`

Execute a simple payment to a recipient.

```typescript
async pay(
  recipient: Address,
  amount: string,
  token?: X402Token
): Promise<PaymentResult>
```

###### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `recipient` | `Address` | ✅ | - | Recipient wallet address |
| `amount` | `string` | ✅ | - | Amount to pay (human-readable, e.g., `"10.00"`) |
| `token` | `X402Token` | ❌ | Chain default | Token to use (`'USDs'`, `'USDC'`, `'USDT'`, `'DAI'`, `'ETH'`) |

###### Returns

`Promise<PaymentResult>`

```typescript
interface PaymentResult {
  transaction: PaymentTransaction;
  gasless: boolean;
  estimatedYield?: YieldEstimate;
}
```

###### Example

```typescript
const result = await client.pay('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', '10.00', 'USDs');
console.log('Transaction hash:', result.transaction.hash);
console.log('Gasless:', result.gasless);
```

###### Errors

| Error Code | Description |
|------------|-------------|
| `INSUFFICIENT_BALANCE` | Not enough tokens to complete payment |
| `TRANSACTION_FAILED` | Transaction execution failed |
| `MISSING_PRIVATE_KEY` | No private key configured |

---

##### `createAuthorization(recipient, amount, token?, options?)`

Create a gasless payment authorization using EIP-3009. The authorization can be submitted by anyone (recipient or relayer) to execute the transfer.

```typescript
async createAuthorization(
  recipient: Address,
  amount: string,
  token?: X402Token,
  options?: AuthorizationOptions
): Promise<EIP3009Authorization>
```

###### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `recipient` | `Address` | ✅ | - | Recipient wallet address |
| `amount` | `string` | ✅ | - | Amount to authorize |
| `token` | `X402Token` | ❌ | Chain default | Token to use |
| `options.validityPeriod` | `number` | ❌ | `300` (5 min) | Authorization validity in seconds |
| `options.nonce` | `` `0x${string}` `` | ❌ | Auto-generated | Custom 32-byte nonce |

###### Returns

`Promise<EIP3009Authorization>`

```typescript
interface EIP3009Authorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}
```

###### Example

```typescript
const auth = await client.createAuthorization(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
  '1.00',
  'USDs',
  { validityPeriod: 600 } // 10 minutes
);

// Send to facilitator or recipient for settlement
console.log('Authorization:', auth);
```

###### Errors

| Error Code | Description |
|------------|-------------|
| `MISSING_PRIVATE_KEY` | Private key required for signing |
| `UNSUPPORTED_TOKEN` | Token does not support EIP-3009 |

---

##### `settleGasless(authorization, token?)`

Settle a gasless payment authorization on-chain.

```typescript
async settleGasless(
  authorization: EIP3009Authorization,
  token?: X402Token
): Promise<PaymentTransaction>
```

###### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `authorization` | `EIP3009Authorization` | ✅ | The signed authorization |
| `token` | `X402Token` | ❌ | Token (must match authorization) |

###### Returns

`Promise<PaymentTransaction>`

###### Example

```typescript
const tx = await client.settleGasless(authorization, 'USDs');
console.log('Settlement hash:', tx.hash);
```

###### Errors

| Error Code | Description |
|------------|-------------|
| `AUTHORIZATION_EXPIRED` | Authorization has passed validBefore |
| `AUTHORIZATION_NOT_YET_VALID` | Current time is before validAfter |
| `NONCE_ALREADY_USED` | Authorization nonce was already used |
| `INVALID_SIGNATURE` | Signature verification failed |

---

##### `supportsGasless(token?)`

Check if gasless payments are supported for a token.

```typescript
supportsGasless(token?: X402Token): boolean
```

###### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `token` | `X402Token` | ❌ | Chain default | Token to check |

###### Returns

`boolean` - Whether the token supports EIP-3009 gasless transfers.

###### Example

```typescript
if (client.supportsGasless('USDs')) {
  const auth = await client.createAuthorization(recipient, amount);
}
```

---

##### `payBatch(items, token?, options?)`

Execute multiple payments in a batch.

```typescript
async payBatch(
  items: BatchPaymentItem[],
  token?: X402Token,
  options?: { continueOnError?: boolean }
): Promise<BatchPaymentResult>
```

###### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | `BatchPaymentItem[]` | ✅ | - | Array of payment items |
| `token` | `X402Token` | ❌ | Chain default | Token for all payments |
| `options.continueOnError` | `boolean` | ❌ | `false` | Continue if a payment fails |

###### BatchPaymentItem

```typescript
interface BatchPaymentItem {
  recipient: Address;
  amount: string;
  reference?: string;
}
```

###### Returns

```typescript
interface BatchPaymentResult {
  successful: PaymentTransaction[];
  failed: Array<{ item: BatchPaymentItem; error: string }>;
  totalAmount: string;
  totalGasUsed: string;
}
```

###### Example

```typescript
const result = await client.payBatch([
  { recipient: '0x...', amount: '5.00' },
  { recipient: '0x...', amount: '10.00' },
], 'USDs', { continueOnError: true });

console.log(`Successful: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);
```

---

##### `handlePaymentRequired(response, options?)`

Handle an HTTP 402 Payment Required response.

```typescript
async handlePaymentRequired(
  response: HTTP402Response | Response,
  options?: Handle402Options
): Promise<HTTP402ParseResult & { transaction?: PaymentTransaction }>
```

###### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `response` | `HTTP402Response \| Response` | ✅ | HTTP 402 response or fetch Response |
| `options.autoPayUnder` | `string` | ❌ | Auto-pay if amount is under this threshold |
| `options.preferGasless` | `boolean` | ❌ | Prefer gasless payment if available |
| `options.onApprovalRequired` | `(request: PaymentRequest) => Promise<boolean>` | ❌ | Custom approval callback |

###### Returns

```typescript
interface HTTP402ParseResult {
  isPaymentRequired: boolean;
  paymentRequest?: PaymentRequest;
  error?: string;
  transaction?: PaymentTransaction;  // If payment was made
}
```

###### Example

```typescript
const response = await fetch('https://api.example.com/tool');

if (response.status === 402) {
  const result = await client.handlePaymentRequired(response, {
    autoPayUnder: '1.00',
  });
  
  if (result.transaction) {
    // Payment was made, retry the request
    const retryResponse = await fetch('https://api.example.com/tool', {
      headers: { 'X-Payment-Tx': result.transaction.hash }
    });
  }
}
```

---

##### `create402Response(request, message?)`

Create a 402 response for servers.

```typescript
create402Response(
  request: PaymentRequest,
  message?: string
): { status: 402; headers: Record<string, string>; body: object }
```

###### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `request` | `PaymentRequest` | ✅ | Payment request details |
| `message` | `string` | ❌ | Custom error message |

###### Example

```typescript
const paymentResponse = client.create402Response({
  amount: '0.01',
  token: 'USDs',
  chain: 'arbitrum',
  recipient: '0x...',
  resource: 'weather-api',
});

// Use in Express
res.status(paymentResponse.status)
   .set(paymentResponse.headers)
   .json(paymentResponse.body);
```

---

##### `getYield(address)`

Get yield information for an address holding USDs.

```typescript
async getYield(address: Address): Promise<YieldInfo>
```

###### Returns

```typescript
interface YieldInfo {
  balance: string;
  formattedBalance: string;
  totalYield: string;
  currentAPY: string;
  rebasingEnabled: boolean;
  lastRebaseAt?: number;
}
```

###### Example

```typescript
const yieldInfo = await client.getYield('0x...');
console.log(`Current APY: ${yieldInfo.currentAPY}%`);
console.log(`Total Yield Earned: ${yieldInfo.totalYield} USDs`);
```

---

##### `estimateYield(address)`

Estimate yield over time for an address.

```typescript
async estimateYield(address: Address): Promise<YieldEstimate>
```

###### Returns

```typescript
interface YieldEstimate {
  daily: string;
  weekly: string;
  monthly: string;
  annual: string;
  apy: string;
}
```

---

##### `getCurrentAPY()`

Get the current USDs APY.

```typescript
async getCurrentAPY(): Promise<number>
```

###### Returns

`Promise<number>` - Current APY as a percentage (e.g., `5.25` for 5.25%)

---

##### `getBalance(address, token?)`

Get token balance for an address.

```typescript
async getBalance(address: Address, token?: X402Token): Promise<BalanceInfo>
```

###### Returns

```typescript
interface BalanceInfo {
  raw: bigint;
  formatted: string;
  token: X402Token;
}
```

###### Example

```typescript
const balance = await client.getBalance('0x...', 'USDs');
console.log(`Balance: ${balance.formatted} ${balance.token}`);
```

---

##### `getAddress()`

Get the wallet address associated with this client.

```typescript
getAddress(): Address | undefined
```

---

##### `approve(spender, amount, token?)`

Approve token spending.

```typescript
async approve(spender: Address, amount: string, token?: X402Token): Promise<Hash>
```

---

##### `getRevenueSplitter(address)`

Get a Revenue Splitter contract interface.

```typescript
getRevenueSplitter(address: Address): RevenueSplitter
```

---

##### `on(listener)` / `off(listener)`

Add or remove payment event listeners.

```typescript
on(listener: PaymentEventListener): void
off(listener: PaymentEventListener): void
```

###### Event Types

```typescript
type PaymentEvent =
  | { type: 'payment:requested'; data: PaymentRequest }
  | { type: 'payment:approved'; data: PaymentTransaction }
  | { type: 'payment:confirmed'; data: PaymentTransaction }
  | { type: 'payment:failed'; data: { error: string; request?: PaymentRequest } }
  | { type: 'authorization:created'; data: EIP3009Authorization }
  | { type: 'authorization:settled'; data: PaymentTransaction };
```

###### Example

```typescript
client.on((event) => {
  switch (event.type) {
    case 'payment:confirmed':
      console.log('Payment confirmed:', event.data.hash);
      break;
    case 'payment:failed':
      console.error('Payment failed:', event.data.error);
      break;
  }
});
```

---

##### `getChainInfo()`

Get current chain information.

```typescript
getChainInfo(): {
  chain: X402Chain;
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
}
```

---

##### `getAvailableTokens()`

Get available tokens on the current chain.

```typescript
getAvailableTokens(): X402Token[]
```

---

### BatchPayment

Batch payment handler for executing multiple payments efficiently.

#### Methods

##### `executeMultiple(items, token, options?)`

Execute multiple payments in separate transactions.

```typescript
async executeMultiple(
  items: BatchPaymentItem[],
  token: X402Token,
  options?: { continueOnError?: boolean }
): Promise<BatchPaymentResult>
```

##### `executeViaSplitter(splitterAddress, toolNames, amounts, token)`

Execute batch payments through a revenue splitter contract (more gas efficient).

```typescript
async executeViaSplitter(
  splitterAddress: Address,
  toolNames: string[],
  amounts: string[],
  token: X402Token
): Promise<PaymentTransaction>
```

---

### GaslessPayment

Gasless payment handler using EIP-3009 (transferWithAuthorization).

#### Methods

##### `createAuthorization(recipient, amount, token, options?)`

Create an EIP-3009 payment authorization.

```typescript
async createAuthorization(
  recipient: Address,
  amount: string,
  token: X402Token,
  options?: AuthorizationOptions
): Promise<EIP3009Authorization>
```

##### `settleAuthorization(authorization, token)`

Submit an authorization to the blockchain.

```typescript
async settleAuthorization(
  authorization: EIP3009Authorization,
  token: X402Token
): Promise<PaymentTransaction>
```

##### `executeGasless(request)`

Execute a complete gasless payment flow.

```typescript
async executeGasless(request: PaymentRequest): Promise<PaymentTransaction>
```

---

### HTTP402Handler

Static utility class for handling HTTP 402 responses.

#### Static Methods

##### `parse(response)`

Parse a 402 response to extract payment details.

```typescript
static parse(response: HTTP402Response): HTTP402ParseResult
```

##### `fromFetchResponse(response)`

Check if a fetch Response is a 402 and parse it.

```typescript
static async fromFetchResponse(response: Response): Promise<HTTP402ParseResult>
```

##### `createResponse(request, message?)`

Create a 402 response for servers.

```typescript
static createResponse(
  request: PaymentRequest,
  message?: string
): { status: 402; headers: Record<string, string>; body: object }
```

---

### RevenueSplitter

Interface for interacting with X402 Revenue Splitter contracts.

#### Constructor

```typescript
new RevenueSplitter(
  contractAddress: Address,
  publicClient: PublicClient,
  walletClient?: WalletClient
)
```

#### Methods

##### `getToolInfo(toolName)`

Get tool information and revenue stats.

```typescript
async getToolInfo(toolName: string): Promise<ToolRevenueStats | null>
```

###### Returns

```typescript
interface ToolRevenueStats {
  toolName: string;
  developer: Address;
  totalRevenue: string;
  totalCalls: number;
  platformFeeBps: number;
  active: boolean;
}
```

##### `calculateSplit(toolName, amount)`

Calculate revenue split for a payment.

```typescript
async calculateSplit(toolName: string, amount: string): Promise<RevenueSplit>
```

###### Returns

```typescript
interface RevenueSplit {
  totalAmount: string;
  developerAmount: string;
  platformAmount: string;
  developerPercentage: string;
  platformPercentage: string;
}
```

##### `processPayment(toolName, tokenAddress, amount, decimals?)`

Process a single payment through the splitter.

```typescript
async processPayment(
  toolName: string,
  tokenAddress: Address,
  amount: string,
  decimals?: number
): Promise<Hash>
```

---

### Type Definitions

#### X402ClientConfig

```typescript
interface X402ClientConfig {
  chain: X402Chain;
  privateKey?: `0x${string}`;
  rpcUrl?: string;
  facilitatorUrl?: string;
  enableGasless?: boolean;
  timeout?: number;
  debug?: boolean;
}
```

#### PaymentRequest

```typescript
interface PaymentRequest {
  amount: string;
  token: X402Token;
  chain: X402Chain;
  recipient: Address;
  reference?: string;
  deadline?: number;
  resource?: string;
  description?: string;
}
```

#### PaymentTransaction

```typescript
interface PaymentTransaction {
  hash: Hash;
  chainId: number;
  from: Address;
  to: Address;
  amount: string;
  formattedAmount: string;
  token: X402Token;
  tokenAddress?: Address;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  timestamp?: number;
}
```

---

### Error Codes

```typescript
enum X402ErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_PRIVATE_KEY = 'MISSING_PRIVATE_KEY',

  // Network errors
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_ERROR = 'RPC_ERROR',

  // Token errors
  UNSUPPORTED_TOKEN = 'UNSUPPORTED_TOKEN',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',

  // Payment errors
  INVALID_PAYMENT_REQUEST = 'INVALID_PAYMENT_REQUEST',
  PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',

  // Authorization errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  AUTHORIZATION_EXPIRED = 'AUTHORIZATION_EXPIRED',
  AUTHORIZATION_NOT_YET_VALID = 'AUTHORIZATION_NOT_YET_VALID',
  NONCE_ALREADY_USED = 'NONCE_ALREADY_USED',

  // Verification errors
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',

  // HTTP 402 errors
  INVALID_402_RESPONSE = 'INVALID_402_RESPONSE',
  MISSING_AUTH_HEADER = 'MISSING_AUTH_HEADER',

  // Contract errors
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
}
```

---

### Constants

```typescript
import {
  NETWORKS,           // Network configurations
  TOKENS,             // Token configurations per chain
  DEFAULT_TOKEN,      // Default token per chain
  SPERAX_USD_ADDRESS, // USDs contract address
  ERC20_ABI,          // Standard ERC-20 ABI
  EIP3009_ABI,        // EIP-3009 ABI
  USDS_ABI,           // USDs token ABI
  REVENUE_SPLITTER_ABI,
  X402_VERSION,       // Protocol version
  SDK_VERSION,        // SDK version
} from '@x402/sdk';
```

---

## Facilitator REST API

The X402 Facilitator is a production-ready Express.js server for payment verification and gasless settlements.

### Base URL

```
Production: https://facilitator.x402.io
Development: http://localhost:3002
```

### Authentication

No authentication required for public endpoints. Rate limiting applies to all endpoints.

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/verify` | 100 requests | 60 seconds |
| `/settle` | 50 requests | 60 seconds |
| `/quote` | 200 requests | 60 seconds |
| `/health` | Unlimited | - |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706025600
```

---

### Endpoints

#### POST /verify

Verify an on-chain payment transaction.

##### Request

```http
POST /verify
Content-Type: application/json
```

```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "paymentRequest": {
    "price": "1.00",
    "token": "USDs",
    "chain": "arbitrum",
    "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  }
}
```

##### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `txHash` | `string` | ✅ | Transaction hash (66 characters, 0x-prefixed) |
| `paymentRequest.price` | `string` | ✅ | Expected payment amount |
| `paymentRequest.token` | `string` | ✅ | Token symbol (`USDs`, `USDC`, `USDT`, `DAI`) |
| `paymentRequest.chain` | `string` | ✅ | Chain (`arbitrum`, `arbitrum-sepolia`) |
| `paymentRequest.recipient` | `string` | ✅ | Expected recipient address |

##### Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "verified": true,
  "txHash": "0x1234...",
  "timestamp": 1706025600000,
  "blockNumber": 123456789,
  "confirmations": 12
}
```

##### Response (Failure)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json
```

```json
{
  "verified": false,
  "txHash": "0x1234...",
  "timestamp": 1706025600000,
  "error": "Payment amount mismatch"
}
```

##### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_TX_HASH` | 400 | Missing txHash field |
| `MISSING_PAYMENT_REQUEST` | 400 | Missing paymentRequest field |
| `INVALID_TX_HASH` | 400 | Invalid transaction hash format |
| `INVALID_PAYMENT_REQUEST` | 400 | Missing required payment request fields |
| `VERIFICATION_ERROR` | 500 | Internal error during verification |

---

#### POST /settle

Execute a gasless EIP-3009 settlement for USDs.

##### Request

```http
POST /settle
Content-Type: application/json
```

```json
{
  "authorization": {
    "from": "0xSenderAddress...",
    "to": "0xRecipientAddress...",
    "value": "1000000000000000000",
    "validAfter": 1706025000,
    "validBefore": 1706028600,
    "nonce": "0x1234567890abcdef...",
    "v": 27,
    "r": "0xabcdef...",
    "s": "0x123456..."
  },
  "paymentRequest": {
    "price": "1.00",
    "token": "USDs",
    "chain": "arbitrum",
    "recipient": "0xRecipientAddress..."
  }
}
```

##### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `authorization.from` | `Address` | ✅ | Sender address |
| `authorization.to` | `Address` | ✅ | Recipient address |
| `authorization.value` | `string` | ✅ | Amount in wei |
| `authorization.validAfter` | `number` | ✅ | Unix timestamp (start validity) |
| `authorization.validBefore` | `number` | ✅ | Unix timestamp (end validity) |
| `authorization.nonce` | `string` | ✅ | 32-byte nonce (hex) |
| `authorization.v` | `number` | ✅ | Signature v component |
| `authorization.r` | `string` | ✅ | Signature r component |
| `authorization.s` | `string` | ✅ | Signature s component |
| `paymentRequest` | `object` | ✅ | Payment details |

##### Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "success": true,
  "txHash": "0xabcdef...",
  "timestamp": 1706025600000,
  "gasUsed": "65000",
  "effectiveGasPrice": "100000000"
}
```

##### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_AUTHORIZATION` | 400 | Missing authorization field |
| `INVALID_AUTHORIZATION` | 400 | Invalid authorization structure |
| `UNSUPPORTED_TOKEN` | 400 | Only USDs supported for gasless |
| `AUTHORIZATION_EXPIRED` | 400 | Authorization past validBefore |
| `AUTHORIZATION_NOT_VALID_YET` | 400 | Current time before validAfter |
| `SETTLEMENT_ERROR` | 500 | Error executing settlement |

---

#### POST /quote

Generate a payment quote (returns HTTP 402).

##### Request

```http
POST /quote
Content-Type: application/json
```

```json
{
  "service": "gpt-4",
  "params": {
    "maxTokens": 4000
  },
  "network": "arbitrum",
  "token": "USDs"
}
```

##### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service` | `string` | ✅ | Service/tool name |
| `params` | `object` | ❌ | Service-specific parameters |
| `params.maxTokens` | `number` | ❌ | Token count (for AI models) |
| `params.size` | `string` | ❌ | Image size (for image generation) |
| `params.quantity` | `number` | ❌ | Number of items |
| `network` | `string` | ❌ | Network (default: `arbitrum`) |
| `token` | `string` | ❌ | Payment token (default: `USDs`) |

##### Response

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "price": "0.004",
  "token": "USDs",
  "chain": "arbitrum",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "deadline": 1706025900,
  "description": "gpt-4 API call",
  "facilitatorUrl": "http://localhost:3002",
  "x402Version": 1
}
```

##### Service Pricing

| Service | Base Price (USD) |
|---------|------------------|
| `gpt-4` | 0.001 |
| `gpt-4-turbo` | 0.0008 |
| `gpt-3.5-turbo` | 0.0002 |
| `claude-3-opus` | 0.0015 |
| `claude-3-sonnet` | 0.0008 |
| `claude-3-haiku` | 0.0002 |
| `dall-e-3` | 0.004 |
| `stable-diffusion` | 0.001 |
| `code-interpreter` | 0.0005 |
| `web-search` | 0.0001 |
| `default` | 0.0001 |

---

#### GET /quote/pricing

Get all service pricing.

##### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "pricing": {
    "gpt-4": "0.001",
    "gpt-4-turbo": "0.0008",
    "claude-3-opus": "0.0015"
  },
  "defaultToken": "USDs",
  "defaultNetwork": "arbitrum",
  "quoteValiditySeconds": 300
}
```

---

#### GET /health

Health check endpoint.

##### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "healthy",
  "uptime": 86400.5,
  "version": "1.0.0",
  "network": "arbitrum",
  "paymentsProcessed": 12345,
  "cacheSize": 1000,
  "blockNumber": 123456789,
  "timestamp": 1706025600000
}
```

##### Health Status Values

| Status | Description |
|--------|-------------|
| `healthy` | All systems operational |
| `degraded` | Partial functionality |
| `unhealthy` | Service unavailable |

---

#### GET /payments/:txHash

Get payment status by transaction hash.

##### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "txHash": "0x1234...",
  "verified": true,
  "settled": true,
  "amount": "1.00",
  "token": "USDs",
  "from": "0xSender...",
  "to": "0xRecipient...",
  "timestamp": 1706025600000,
  "blockNumber": 123456789
}
```

---

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## MCP Tools Reference (@x402/sperax-mcp)

Model Context Protocol (MCP) tools for AI agents to interact with X402 payments using Sperax USDs.

### Installation

```bash
npm install @x402/sperax-mcp
```

### Configuration

```json
{
  "mcpServers": {
    "sperax-x402": {
      "command": "npx",
      "args": ["@x402/sperax-mcp"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "NETWORK": "bsc",
        "FACILITATOR_URL": "http://localhost:3002"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | ❌ | - | Private key for signing (required for payments) |
| `NETWORK` | ❌ | `bsc` | Network (`mainnet`, `sepolia`, `bsc`) |
| `FACILITATOR_URL` | ❌ | `http://localhost:3002` | Facilitator URL |
| `BSC_RPC_URL` | ❌ | Default BSC RPC | Custom RPC URL |

---

### Available Tools

#### x402_check_usds_balance

Check USDs balance and earned yield for an address.

##### Input Schema

```json
{
  "type": "object",
  "properties": {
    "address": {
      "type": "string",
      "description": "Ethereum address to check balance for"
    }
  },
  "required": ["address"]
}
```

##### Output

```json
{
  "balance": "1000.50",
  "yieldEarned": "25.30",
  "apy": "5.25",
  "isRebasing": true
}
```

##### Example Conversation

```
User: What's my USDs balance at 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0?

AI: I'll check that balance for you.
[Calls x402_check_usds_balance with address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"]

Your USDs balance is 1,000.50 USDs. You've earned 25.30 USDs in yield so far, and the current APY is 5.25%. Your account has rebasing enabled, so your balance automatically increases as yield accrues.
```

---

#### x402_pay_with_usds

Make an X402 payment using USDs stablecoin.

##### Input Schema

```json
{
  "type": "object",
  "properties": {
    "recipient": {
      "type": "string",
      "description": "Recipient address for the payment"
    },
    "amount": {
      "type": "string",
      "description": "Amount in USDs to pay (e.g., '1.50' for $1.50)"
    },
    "gasless": {
      "type": "boolean",
      "description": "Whether to use gasless EIP-3009 transfer (default: false)"
    },
    "memo": {
      "type": "string",
      "description": "Optional memo/description for the payment"
    }
  },
  "required": ["recipient", "amount"]
}
```

##### Output

```json
{
  "txHash": "0x1234567890abcdef...",
  "status": "confirmed",
  "memo": "Payment for API access"
}
```

##### Example Conversation

```
User: Pay 5 USDs to 0x123... for the weather API

AI: I'll process that payment for you.
[Calls x402_pay_with_usds with recipient: "0x123...", amount: "5.00", memo: "Weather API"]

Payment successful! I've sent 5.00 USDs to 0x123... 
Transaction hash: 0xabcdef...
```

---

#### x402_create_payment_authorization

Create a signed EIP-3009 authorization for gasless X402 payment.

##### Input Schema

```json
{
  "type": "object",
  "properties": {
    "recipient": {
      "type": "string",
      "description": "Recipient address for the payment"
    },
    "amount": {
      "type": "string",
      "description": "Amount in USDs to authorize"
    },
    "validUntil": {
      "type": "number",
      "description": "Unix timestamp when authorization expires (default: 1 hour)"
    }
  },
  "required": ["recipient", "amount"]
}
```

##### Output

```json
{
  "from": "0xSenderAddress...",
  "to": "0xRecipientAddress...",
  "value": "1000000000000000000",
  "validAfter": 1706025000,
  "validBefore": 1706028600,
  "nonce": "0x1234...",
  "signature": "0xabcdef..."
}
```

---

#### x402_get_yield_stats

Get current USDs yield statistics including APY, vault TVL, and rebase info.

##### Input Schema

```json
{
  "type": "object",
  "properties": {}
}
```

##### Output

```json
{
  "apy": "5.25",
  "tvl": "$150,000,000 USD",
  "lastRebase": "2026-01-22T12:00:00.000Z",
  "collateralRatio": "120%"
}
```

---

#### x402_estimate_payment_cost

Estimate the cost of an X402 payment including gas fees.

##### Input Schema

```json
{
  "type": "object",
  "properties": {
    "recipient": {
      "type": "string",
      "description": "Recipient address"
    },
    "amount": {
      "type": "string",
      "description": "Payment amount in USDs"
    },
    "gasless": {
      "type": "boolean",
      "description": "Whether to estimate gasless payment"
    }
  },
  "required": ["recipient", "amount"]
}
```

##### Output

```json
{
  "paymentAmount": "10.00",
  "estimatedGas": "65000",
  "estimatedGasCost": "0.0001 BNB",
  "totalCost": "10.00 USDs + 0.0001 BNB",
  "savings": "Use gasless=true to avoid gas costs"
}
```

---

#### x402_verify_payment

Verify an X402 payment was completed successfully.

##### Input Schema

```json
{
  "type": "object",
  "properties": {
    "transactionHash": {
      "type": "string",
      "description": "Transaction hash to verify"
    }
  },
  "required": ["transactionHash"]
}
```

##### Output

```json
{
  "verified": true,
  "status": "success",
  "blockNumber": 123456789,
  "from": "0xSender...",
  "to": "0xRecipient...",
  "amount": "10.00"
}
```

---

## CLI Reference (@x402/cli)

The X402 CLI provides a command-line interface for interacting with X402 payments.

### Installation

```bash
npm install -g @x402/cli
# or
npx @x402/cli <command>
```

### Global Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--version` | `-v` | Display version number |
| `--verbose` | `-V` | Enable verbose output |
| `--help` | `-h` | Display help |

---

### Commands

#### `x402 init`

Initialize CLI configuration.

```bash
x402 init [options]
```

##### Options

| Option | Description |
|--------|-------------|
| `--force`, `-f` | Force re-initialization |
| `--network <network>` | Network to use (`arbitrum`, `arbitrum-sepolia`) |

##### Interactive Prompts

1. Private key (masked input)
2. Network selection
3. Enable gasless transactions
4. Auto-approve threshold

##### Example

```bash
$ x402 init
? Enter your private key: ********
? Select network: Arbitrum One
? Enable gasless transactions? Yes
? Auto-approve payments under (USD): 1.00

✓ Configuration created at ~/.x402/config.json
✓ Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
✓ Network: Arbitrum One
```

---

#### `x402 pay`

Make a payment to a recipient.

```bash
x402 pay [recipient] [amount] [options]
```

##### Arguments

| Argument | Description |
|----------|-------------|
| `recipient` | Recipient address (optional, prompts if missing) |
| `amount` | Amount to send (optional, prompts if missing) |

##### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--token <token>` | `-t` | `USDs` | Token to send |
| `--gasless` | `-g` | - | Use gasless transfer |
| `--memo <memo>` | `-m` | - | Payment memo/note |
| `--yes` | `-y` | - | Skip confirmation prompt |

##### Example

```bash
# Interactive
$ x402 pay
? Recipient address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
? Amount to send: 10.00
? Select token: USDs (Sperax USD - Auto-yield)
? Use gasless transfer? Yes
? Confirm payment? Yes
✓ Payment confirmed!

# Direct
$ x402 pay 0x742d35... 10.00 --token USDs --gasless -y
```

---

#### `x402 balance`

Check token balances.

```bash
x402 balance [address] [options]
```

##### Arguments

| Argument | Description |
|----------|-------------|
| `address` | Address to check (optional, uses configured wallet) |

##### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--token <token>` | `-t` | Specific token to check |

##### Example

```bash
$ x402 balance
✓ Balances on Arbitrum One

  USDs:  1,234.56
  USDC:  500.00
  USDT:  0.00
```

---

#### `x402 yield`

Check USDs auto-yield information.

```bash
x402 yield [address]
```

##### Example

```bash
$ x402 yield
✓ Yield information for 0x742d35...

  Balance:        1,234.56 USDs
  Total Earned:   45.67 USDs
  Current APY:    5.25%
  Monthly Est:    5.40 USDs
  Last Rebase:    2 hours ago
```

---

#### `x402 tools`

Manage X402 tools.

##### `x402 tools list`

List registered tools.

```bash
x402 tools list [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--all` | `-a` | Show all tools |

##### `x402 tools call`

Call a registered tool.

```bash
x402 tools call <tool-name> [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--args <json>` | `-a` | Tool arguments as JSON |
| `--yes` | `-y` | Skip payment confirmation |

##### `x402 tools register`

Register a new tool.

```bash
x402 tools register <name> <price> [options]
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--description <desc>` | `-d` | Tool description |

##### Example

```bash
$ x402 tools list
✓ Found 5 tools

  Name            Price      Calls    Revenue
  weather-api     0.01 USDs  1,234    12.34 USDs
  image-gen       0.05 USDs  567      28.35 USDs

$ x402 tools call weather-api --args '{"city": "NYC"}'
✓ Tool weather-api executed
Result: {"temperature": 72, "conditions": "sunny"}
```

---

#### `x402 history`

View payment history.

```bash
x402 history [options]
```

##### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--limit <number>` | `-l` | `10` | Number of transactions to show |
| `--type <type>` | `-t` | - | Filter by type |
| `--status <status>` | `-s` | - | Filter by status |

##### Example

```bash
$ x402 history --limit 5
✓ Found 5 transactions

  Date        Type      Amount     Status     Hash
  Jan 22      payment   10.00 USDs confirmed  0x1234...
  Jan 21      tool_call 0.05 USDs  confirmed  0xabcd...
```

---

#### `x402 tx`

View transaction details.

```bash
x402 tx <hash> [options]
```

##### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--refresh` | `-r` | Refresh status from chain |

---

#### `x402 config`

Manage CLI configuration.

##### `x402 config list`

Show all configuration values.

```bash
x402 config list
```

##### `x402 config get`

Get a configuration value.

```bash
x402 config get <key>
```

##### `x402 config set`

Set a configuration value.

```bash
x402 config set <key> <value>
```

##### `x402 config reset`

Reset configuration to defaults.

```bash
x402 config reset
```

##### Modifiable Keys

| Key | Type | Description |
|-----|------|-------------|
| `network` | `string` | Network (`arbitrum`, `arbitrum-sepolia`) |
| `defaultToken` | `string` | Default payment token |
| `rpcUrl` | `string` | Custom RPC URL |
| `facilitatorUrl` | `string` | Facilitator server URL |
| `autoApproveUnder` | `string` | Auto-approve threshold |
| `gaslessEnabled` | `boolean` | Enable gasless transactions |

---

### Configuration File

Location: `~/.x402/config.json`

```json
{
  "network": "arbitrum",
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "defaultToken": "USDs",
  "gaslessEnabled": true,
  "autoApproveUnder": "1.00",
  "facilitatorUrl": "http://localhost:3002",
  "lastUsed": 1706025600000
}
```

---

### Environment Variables

| Variable | Description |
|----------|-------------|
| `X402_PRIVATE_KEY` | Private key (overrides stored) |
| `X402_NETWORK` | Network override |
| `X402_RPC_URL` | RPC URL override |
| `X402_VERBOSE` | Enable verbose logging |

---

## Smart Contract ABIs

### ToolRegistry

On-chain marketplace for AI tools with payment processing.

**Address (Arbitrum):** Deployed via UUPS proxy

#### Events

##### `ToolRegistered`

```solidity
event ToolRegistered(
    string indexed name,
    address indexed developer,
    address paymentToken,
    uint256 pricePerCall
);
```

| Parameter | Indexed | Type | Description |
|-----------|---------|------|-------------|
| `name` | ✅ | `string` | Tool name |
| `developer` | ✅ | `address` | Developer address |
| `paymentToken` | ❌ | `address` | Payment token address |
| `pricePerCall` | ❌ | `uint256` | Price per call (wei) |

##### `ToolPriceUpdated`

```solidity
event ToolPriceUpdated(
    string indexed name,
    uint256 oldPrice,
    uint256 newPrice
);
```

##### `ToolCalled`

```solidity
event ToolCalled(
    string indexed name,
    address indexed caller,
    uint256 amount
);
```

#### Functions

##### `registerTool`

Register a new tool in the marketplace.

```solidity
function registerTool(
    string calldata name,
    address developer,
    uint256 price,
    address token
) external
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique tool name |
| `developer` | `address` | Developer wallet address |
| `price` | `uint256` | Price per call (wei) |
| `token` | `address` | Payment token address |

##### `updateToolPrice`

Update tool price (developer only).

```solidity
function updateToolPrice(
    string calldata name,
    uint256 newPrice
) external
```

##### `payForTool`

Process payment for a tool call.

```solidity
function payForTool(string calldata name) external
```

##### `getToolInfo`

Get tool information.

```solidity
function getToolInfo(string calldata name) external view returns (
    address developer,
    uint256 price,
    uint256 totalCalls
)
```

#### Custom Errors

```solidity
error InvalidAddress();
error InvalidAmount();
error Unauthorized();
error NotAllowed();
```

---

### X402PaymentChannel

State channels for streaming micro-payments between AI agents and tools.

#### Events

##### `ChannelOpened`

```solidity
event ChannelOpened(
    bytes32 indexed channelId,
    address indexed sender,
    address indexed recipient,
    address token,
    uint256 deposit
);
```

##### `PaymentIncremented`

```solidity
event PaymentIncremented(
    bytes32 indexed channelId,
    uint256 amount,
    uint256 nonce
);
```

##### `ChannelClosed`

```solidity
event ChannelClosed(
    bytes32 indexed channelId,
    uint256 senderAmount,
    uint256 recipientAmount
);
```

##### `DisputeRaised`

```solidity
event DisputeRaised(
    bytes32 indexed channelId,
    address indexed disputer,
    uint256 claimedAmount
);
```

#### Functions

##### `openChannel`

Open a new payment channel.

```solidity
function openChannel(
    address recipient,
    address token,
    uint256 deposit
) external returns (bytes32 channelId)
```

##### `topUpChannel`

Add funds to an existing channel.

```solidity
function topUpChannel(
    bytes32 channelId,
    uint256 amount
) external
```

##### `incrementPayment`

Increment payment in channel (off-chain signature).

```solidity
function incrementPayment(
    bytes32 channelId,
    uint256 amount,
    bytes calldata signature
) external
```

##### `closeChannel`

Close channel cooperatively with both signatures.

```solidity
function closeChannel(
    bytes32 channelId,
    uint256 finalAmount,
    bytes calldata signatures
) external
```

#### Channel Struct

```solidity
struct Channel {
    address sender;
    address recipient;
    address token;
    uint256 deposit;
    uint256 withdrawn;
    uint256 nonce;
    ChannelState state;
    uint256 challengePeriod;
    uint256 closingTime;
}

enum ChannelState {
    Open,
    Closing,
    Closed,
    Disputed
}
```

---

### X402Subscription

Recurring payment system for AI tool subscriptions.

#### Events

##### `SubscriptionCreated`

```solidity
event SubscriptionCreated(
    uint256 indexed subscriptionId,
    address indexed subscriber,
    address indexed recipient,
    uint256 amount,
    uint256 interval
);
```

##### `SubscriptionPayment`

```solidity
event SubscriptionPayment(
    uint256 indexed subscriptionId,
    uint256 amount,
    uint256 timestamp
);
```

##### `SubscriptionCancelled`

```solidity
event SubscriptionCancelled(uint256 indexed subscriptionId);
```

#### Functions

##### `createSubscription`

Create a new subscription.

```solidity
function createSubscription(
    address recipient,
    uint256 amount,
    uint256 interval
) external returns (uint256 subscriptionId)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `recipient` | `address` | Payment recipient |
| `amount` | `uint256` | Payment amount per interval |
| `interval` | `uint256` | Payment interval in seconds (min: 1 hour, max: 365 days) |

##### `depositFunds`

Deposit USDs to fund subscriptions.

```solidity
function depositFunds(uint256 amount) external
```

##### `executeSubscription`

Execute a subscription payment (callable by anyone).

```solidity
function executeSubscription(uint256 subscriptionId) external
```

##### `cancelSubscription`

Cancel a subscription.

```solidity
function cancelSubscription(uint256 subscriptionId) external
```

---

### X402RevenueSplitter

Splits payment revenue between developers and the platform.

#### Events

##### `PaymentProcessed`

```solidity
event PaymentProcessed(
    address indexed payer,
    address indexed developer,
    uint256 totalAmount,
    uint256 developerAmount,
    uint256 platformAmount,
    string memo
);
```

##### `PlatformFeeUpdated`

```solidity
event PlatformFeeUpdated(
    uint256 oldFeeBps,
    uint256 newFeeBps
);
```

#### Functions

##### `processPayment`

Process a single payment with revenue splitting.

```solidity
function processPayment(
    address developer,
    uint256 amount,
    string calldata memo
) external
```

##### `processBatchPayments`

Process multiple payments in a single transaction.

```solidity
function processBatchPayments(Payment[] calldata payments) external

struct Payment {
    address developer;
    uint256 amount;
    string memo;
}
```

#### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_PLATFORM_FEE_BPS` | 5000 | Maximum 50% platform fee |
| `BPS_DENOMINATOR` | 10000 | Basis points denominator |

---

### X402CreditSystem

Prepaid credits with yield accumulation.

#### Events

##### `CreditsDeposited`

```solidity
event CreditsDeposited(
    address indexed user,
    uint256 amount,
    uint256 creditBalance
);
```

##### `CreditsUsed`

```solidity
event CreditsUsed(
    address indexed user,
    string indexed tool,
    uint256 amount
);
```

##### `CreditsWithdrawn`

```solidity
event CreditsWithdrawn(
    address indexed user,
    uint256 amount
);
```

#### Functions

##### `deposit`

Deposit USDs to receive credits.

```solidity
function deposit(uint256 amount) external
```

##### `useCredits`

Use credits for tool payment.

```solidity
function useCredits(string calldata tool, uint256 amount) external
```

##### `withdraw`

Withdraw remaining credits as USDs.

```solidity
function withdraw(uint256 amount) external
```

##### `getCreditBalance`

Get user's credit balance including yield.

```solidity
function getCreditBalance(address user) external view returns (uint256)
```

---

### Common Interfaces

#### IUSDs (Sperax USD)

```solidity
interface IUSDs {
    function rebaseOptIn() external;
    function rebaseOptOut() external;
    function creditsPerToken() external view returns (uint256);
    function isRebasingAccount(address account) external view returns (bool);
}
```

---

## Appendix

### Token Addresses

#### Arbitrum One (42161)

| Token | Address | Decimals |
|-------|---------|----------|
| USDs | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` | 18 |
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 |

#### Arbitrum Sepolia (421614)

| Token | Address | Decimals |
|-------|---------|----------|
| USDs | Testnet deployment | 18 |
| USDC | Testnet deployment | 6 |

### EIP-3009 Typed Data

```typescript
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};
```

### WWW-Authenticate Header Format

```
X402 price="<amount> <token>" chain="<chain>" recipient="<address>" [resource="<name>"] [deadline="<timestamp>"]
```

Example:
```
X402 price="0.01 USDs" chain="arbitrum" recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" resource="weather-api" deadline="1706028600"
```

---

## Support

- **GitHub:** https://github.com/nirholas/x402
- **Documentation:** https://docs.x402.io
- **Discord:** https://discord.gg/x402

---

*Copyright © 2024-2026 nirholas. Licensed under MIT.*