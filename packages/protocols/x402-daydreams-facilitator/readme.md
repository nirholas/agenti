# x402 Facilitator

> **Warning**: This project is currently in alpha. APIs may change without notice and should not be used in production environments without thorough testing.

A production-ready payment settlement service for the [x402 protocol](https://github.com/coinbase/x402). Built with Elysia and Node.js, it verifies cryptographic payment signatures and settles transactions on-chain for EVM, SVM (Solana), and Starknet networks.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
  - [One-Click Deploy (Railway)](#one-click-deploy-railway)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Network Configuration](#network-configuration)
  - [RPC Configuration](#rpc-configuration)
- [Custom Signers](#custom-signers)
- [API Reference](#api-reference)
- [Payment Schemes](#payment-schemes)
- [Unified Client](#unified-client)
- [Upto Module](#upto-module)
  - [Architecture: Who Maintains What State?](#architecture-who-maintains-what-state)
  - [Client Responsibilities](#client-responsibilities)
  - [Facilitator Responsibilities](#facilitator-responsibilities)
  - [Payment Flow Example](#payment-flow-example)
  - [Recommended Integration Pattern](#recommended-integration-pattern)
  - [State Persistence Considerations](#state-persistence-considerations)
- [Resource Tracking](#resource-tracking)
- [Resource Server](#resource-server)
- [Framework Middleware](#framework-middleware)
  - [Elysia](#elysia)
  - [Hono](#hono)
  - [Express](#express)
  - [Paywall Support](#paywall-support)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
  - [Railway Deployment](#railway-deployment)

## Overview

The x402 Facilitator acts as a trusted intermediary between clients making payments and resource servers providing paid content. It:

1. **Verifies** payment signatures and authorizations
2. **Settles** transactions on-chain (EVM/Solana)
3. **Manages** batched payment sessions for efficient settlement (upto scheme)

### Supported Networks

| Network        | CAIP-2 Identifier                         | Schemes     |
| -------------- | ----------------------------------------- | ----------- |
| Base Mainnet   | `eip155:8453`                             | exact, upto |
| Base Sepolia   | `eip155:84532`                            | exact, upto |
| Ethereum       | `eip155:1`                                | exact, upto |
| Optimism       | `eip155:10`                               | exact, upto |
| Arbitrum       | `eip155:42161`                            | exact, upto |
| Polygon        | `eip155:137`                              | exact, upto |
| Starknet Mainnet | `starknet:SN_MAIN`                      | exact       |
| Starknet Sepolia | `starknet:SN_SEPOLIA`                   | exact       |
| Solana Devnet  | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | exact       |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | exact       |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         x402 Facilitator                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   /verify    │    │   /settle    │    │  /supported  │          │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘          │
│         │                   │                                       │
│         ▼                   ▼                                       │
│  ┌─────────────────────────────────────────────────────┐           │
│  │              Payment Scheme Registry                 │           │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │           │
│  │  │ Exact (EVM) │  │ Upto (EVM)  │  │ Exact (SVM) │  │           │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │           │
│  └─────────────────────────────────────────────────────┘           │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐        │
│  │ EVM Signer  │      │ SVM Signer  │      │Session Store│        │
│  │ (Viem/CDP)  │      │(Solana Kit) │      │ (In-Memory) │        │
│  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘        │
│         │                    │                    │                │
└─────────┼────────────────────┼────────────────────┼────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │  EVM RPC    │      │ Solana RPC  │      │  Sweeper    │
   └─────────────┘      └─────────────┘      └─────────────┘
```

### Core Components

| Component           | File                          | Responsibility                              |
| ------------------- | ----------------------------- | ------------------------------------------- |
| HTTP Server         | `src/app.ts`                  | Elysia server with endpoints and middleware |
| Facilitator Factory | `src/factory.ts`              | `createFacilitator()` with signer injection |
| CDP Signer          | `src/signers/cdp.ts`          | Coinbase Developer Platform adapter         |
| Upto Scheme         | `src/upto/evm/facilitator.ts` | Permit-based batched payments               |
| Session Store       | `src/upto/store.ts`           | In-memory session management                |
| Sweeper             | `src/upto/sweeper.ts`         | Background batch settlement                 |
| Elysia Middleware   | `src/elysia/`                 | Payment middleware for Elysia               |
| Hono Middleware     | `src/hono/`                   | Payment middleware for Hono                 |
| Express Middleware  | `src/express/`                | Payment middleware for Express              |
| Middleware Core     | `src/middleware/core.ts`      | Shared payment processing logic             |

### Data Flow

**Exact Payment (Immediate Settlement)**

```
Client → POST /verify → Signature validation → VerifyResponse
Client → POST /settle → On-chain transfer → SettleResponse (tx hash)
```

**Upto Payment (Batched Settlement)**

```
Client → POST /verify → Permit validation → Session created/updated
              ↓
         Accumulate pending spend across requests
              ↓
         Sweeper triggers → POST /settle (batch) → Reset pending
```

## Resource Tracking

Resource tracking is an optional module that records request, verification, and settlement metadata for analytics and auditing. It plugs into the framework middleware and follows the payment lifecycle end-to-end.

### How It Works

1. **Start**: `startTracking()` runs at request start and captures request metadata (headers, IP, user agent, etc.).
2. **Update**: `recordRequest()` updates `paymentRequired` and attaches route config after `processHTTPRequest`.
3. **Verify**: `recordVerification()` records payment verification success/failure and payment details.
4. **Track Upto**: `recordUptoSession()` stores Upto session metadata when used.
5. **Settle**: `recordSettlement()` records settlement attempt and result for exact payments.
6. **Finalize**: `finalizeTracking()` runs on response end (including 402 errors). For early exits, `handlerExecuted` is set to `false`.

Tracking is **best effort** by default. If `asyncTracking` is enabled (default), tracking errors are captured via `onTrackingError` and never block requests.

### Usage

```typescript
import {
  createResourceTrackingModule,
  InMemoryResourceTrackingStore,
  PostgresResourceTrackingStore,
} from "@daydreamsai/facilitator/tracking";
import { createElysiaPaymentMiddleware } from "@daydreamsai/facilitator/elysia";

// Development: in-memory store
const tracking = createResourceTrackingModule({
  store: new InMemoryResourceTrackingStore(),
  captureHeaders: ["x-request-id"],
});

// Production: Postgres store
// const tracking = createResourceTrackingModule({
//   store: new PostgresResourceTrackingStore(pgClient),
//   asyncTracking: true,
//   onTrackingError: (err, id) => console.error(`tracking error ${id}`, err),
// });

app.use(
  createElysiaPaymentMiddleware({
    httpServer,
    resourceTracking: tracking,
  })
);
```

### Drizzle Adapter (node-postgres)

If you're using Drizzle with `pg`, you can reuse the same pool and adapt it to
the tracking store:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PostgresClientAdapter } from "@daydreamsai/facilitator/tracking";
import { PostgresResourceTrackingStore } from "@daydreamsai/facilitator/tracking";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const adapter: PostgresClientAdapter = {
  query: async (sql, params) => (await pool.query(sql, params)).rows,
  queryOne: async (sql, params) => (await pool.query(sql, params)).rows[0],
  queryScalar: async (sql, params) => {
    const row = (await pool.query(sql, params)).rows[0];
    return row ? Object.values(row)[0] : undefined;
  },
};

const store = new PostgresResourceTrackingStore(adapter);
await store.initialize();
```

### Querying Data

```typescript
const recent = await tracking.list({
  filters: { paymentVerified: true },
  limit: 50,
});

const stats = await tracking.getStats(
  new Date(Date.now() - 24 * 60 * 60 * 1000),
  new Date()
);
```

## Quick Start

### Prerequisites

- Node.js v22+ or Bun
- CDP account (recommended) or EVM/SVM private keys

### As a Library

```typescript
import { createFacilitator } from "@daydreamsai/facilitator";
import { createCdpEvmSigner } from "@daydreamsai/facilitator/signers/cdp";
import { CdpClient } from "@coinbase/cdp-sdk";

// Initialize CDP
const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: "facilitator" });

// Create signer
const signer = createCdpEvmSigner({
  cdpClient: cdp,
  account,
  network: "base",
  rpcUrl: process.env.EVM_RPC_URL_BASE,
});

// Create facilitator
const facilitator = createFacilitator({
  evmSigners: [{
    signer,
    networks: "eip155:8453",
    schemes: ["exact", "upto"],
    upto: {
      // Optional: fail /verify early for underfunded payers
      verifyBalanceCheck: true,
    },
  }],
});
```

### From Source

```bash
# Clone and install
git clone https://github.com/daydreamsai/facilitator
cd facilitator
bun install

# Configure environment
cp .env-local .env
# Edit .env with your CDP credentials or private keys

# Start development server
bun dev
```

### Verify Installation

```bash
curl http://localhost:8090/supported
```

### One-Click Deploy (Railway)

Deploy your own facilitator instance to Railway with one click:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/Egob9T?referralCode=6OVVY9)

**Required environment variables (choose one):**

| Mode | Variables |
|------|-----------|
| CDP (recommended) | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `CDP_ACCOUNT_NAME` |
| Private Key | `EVM_PRIVATE_KEY` |

**Optional variables:**
- `EVM_NETWORKS` - Networks to enable (default: `base,base-sepolia`)
- `ALCHEMY_API_KEY` - For better RPC reliability
- `SVM_PRIVATE_KEY` + `SVM_NETWORKS` - Enable Solana support

After deployment, verify at `https://your-app.railway.app/supported`.

### Multi-Chain Paid Endpoint (EVM + Solana + Starknet)

This repo includes a single endpoint example that accepts EVM, Solana, and
Starknet payments in one `accepts` array.

Start the facilitator with Starknet enabled:

```bash
STARKNET_NETWORKS=starknet-mainnet,starknet-sepolia \
STARKNET_SPONSOR_ADDRESS=0x... \
STARKNET_PAYMASTER_ENDPOINT_STARKNET_MAINNET=https://starknet.paymaster.avnu.fi \
STARKNET_PAYMASTER_ENDPOINT_STARKNET_SEPOLIA=https://starknet.paymaster.avnu.fi \
STARKNET_PAYMASTER_API_KEY=your-avnu-api-key \
bun dev
```

Run the API example:

```bash
EVM_PRIVATE_KEY=... \
SVM_PRIVATE_KEY=... \
STARKNET_PAY_TO=0x... \
bun run examples/paidApiAll.ts
```

See `examples/paidApiAll.ts` for the full route config.

### Token-Gated Endpoint Example

This repo includes a token-gated API example that checks ERC20 balances before
allowing access to protected routes.

Run the example:

```bash
cd examples
bun run token-gated:api
```

Call a protected route with a wallet address:

```bash
curl -H "x-wallet-address: 0xYourWalletAddress" \
  http://localhost:3000/api/premium
```

## Configuration

### Environment Variables

**CDP Signer (Recommended)**

| Variable             | Required | Default | Description        |
| -------------------- | -------- | ------- | ------------------ |
| `CDP_API_KEY_ID`     | Yes      | -       | CDP API key ID     |
| `CDP_API_KEY_SECRET` | Yes      | -       | CDP API key secret |
| `CDP_WALLET_SECRET`  | Yes      | -       | CDP wallet secret  |
| `CDP_ACCOUNT_NAME`   | Yes      | -       | CDP account name   |

**Private Key Signer (Fallback)**

| Variable          | Required | Default | Description                        |
| ----------------- | -------- | ------- | ---------------------------------- |
| `EVM_PRIVATE_KEY` | Yes\*    | -       | Ethereum private key (hex format)  |
| `SVM_PRIVATE_KEY` | Yes\*    | -       | Solana private key (Base58 format) |

\*Required when CDP credentials are not configured.

**Starknet Paymaster (Exact Scheme)**

| Variable                           | Required | Default | Description                                      |
| ---------------------------------- | -------- | ------- | ------------------------------------------------ |
| `STARKNET_PAYMASTER_API_KEY`       | No       | -       | Paymaster API key (AVNU hosted paymaster)        |
| `STARKNET_SPONSOR_ADDRESS`         | Yes\*    | -       | Sponsor account address for /supported signers   |
| `STARKNET_PAYMASTER_ENDPOINT_*`    | No       | -       | Per-network paymaster endpoint override          |
| `STARKNET_PAYMASTER_API_KEY_*`     | No       | -       | Per-network paymaster API key override           |
| `STARKNET_SPONSOR_ADDRESS_*`       | No       | -       | Per-network sponsor address override             |

\*Required when enabling Starknet networks.

**Server Configuration**

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `PORT`   | No       | `8090`  | Server port |
| `UPTO_VERIFY_BALANCE_CHECK` | No | `false` | For `upto`, enables on-chain `balanceOf(owner)` preflight in `/verify` (after permit validation). Returns `insufficient_balance` or `balance_check_failed` when enabled |

### Network Configuration

The facilitator uses a simplified network configuration system. Instead of manually specifying RPC URLs for each network, you can set API keys and enable networks with comma-separated lists.

**Enabling Networks**

| Variable       | Default                 | Description                    |
| -------------- | ----------------------- | ------------------------------ |
| `EVM_NETWORKS` | `base,base-sepolia`     | Comma-separated EVM networks   |
| `STARKNET_NETWORKS` | `(empty)`          | Comma-separated Starknet networks (opt-in) |
| `SVM_NETWORKS` | `solana-devnet`         | Comma-separated Solana networks |

**Supported EVM Networks**

| Name               | CAIP-2            | Chain ID |
| ------------------ | ----------------- | -------- |
| `base`             | `eip155:8453`     | 8453     |
| `base-sepolia`     | `eip155:84532`    | 84532    |
| `ethereum`         | `eip155:1`        | 1        |
| `sepolia`          | `eip155:11155111` | 11155111 |
| `optimism`         | `eip155:10`       | 10       |
| `optimism-sepolia` | `eip155:11155420` | 11155420 |
| `arbitrum`         | `eip155:42161`    | 42161    |
| `arbitrum-sepolia` | `eip155:421614`   | 421614   |
| `polygon`          | `eip155:137`      | 137      |
| `polygon-amoy`     | `eip155:80002`    | 80002    |
| `avalanche`        | `eip155:43114`    | 43114    |
| `avalanche-fuji`   | `eip155:43113`    | 43113    |
| `abstract`         | `eip155:2741`     | 2741     |
| `abstract-testnet` | `eip155:11124`    | 11124    |

**Supported Starknet Networks**

| Name               | CAIP-2             |
| ------------------ | ------------------ |
| `starknet-mainnet` | `starknet:SN_MAIN` |
| `starknet-sepolia` | `starknet:SN_SEPOLIA` |

**Supported SVM Networks**

| Name              | CAIP-2                                    |
| ----------------- | ----------------------------------------- |
| `solana-mainnet`  | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `solana-devnet`   | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| `solana-testnet`  | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` |

### RPC Configuration

RPC URLs are automatically resolved based on available API keys. Set a single API key to enable RPC access for all networks.

**RPC Provider API Keys**

| Variable          | Provider | Description                                       |
| ----------------- | -------- | ------------------------------------------------- |
| `ALCHEMY_API_KEY` | Alchemy  | EVM + Starknet RPC provider ([alchemy.com](https://alchemy.com)) |
| `INFURA_API_KEY`  | Infura   | EVM RPC provider ([infura.io](https://infura.io))     |
| `HELIUS_API_KEY`  | Helius   | Solana RPC provider ([helius.dev](https://helius.dev)) |

**RPC Resolution Priority (EVM)**

1. Explicit override: `EVM_RPC_URL_<NETWORK>` (e.g., `EVM_RPC_URL_BASE`)
2. Alchemy (if `ALCHEMY_API_KEY` is set)
3. Infura (if `INFURA_API_KEY` is set)
4. Public RPC fallback

**RPC Resolution Priority (Starknet)**

1. Explicit override: `STARKNET_RPC_URL_<NETWORK>` (e.g., `STARKNET_RPC_URL_STARKNET_MAINNET`)
2. Alchemy (if `ALCHEMY_API_KEY` is set)
3. Public RPC fallback

**RPC Resolution Priority (SVM)**

1. Explicit override: `SVM_RPC_URL_<NETWORK>` (e.g., `SVM_RPC_URL_SOLANA_MAINNET`)
2. Helius (if `HELIUS_API_KEY` is set)
3. Public RPC fallback

**Explicit RPC Overrides**

Override specific networks when needed (hyphens become underscores in env var names):

```bash
# EVM overrides
EVM_RPC_URL_BASE=https://custom-base-rpc.example.com
EVM_RPC_URL_BASE_SEPOLIA=https://custom-sepolia-rpc.example.com

# Starknet overrides
STARKNET_RPC_URL_STARKNET_MAINNET=https://custom-starknet-mainnet.example.com
STARKNET_RPC_URL_STARKNET_SEPOLIA=https://custom-starknet-sepolia.example.com

# SVM overrides
SVM_RPC_URL_SOLANA_MAINNET=https://custom-solana-rpc.example.com
```

### Example Configurations

**Minimal (Base only with Alchemy)**

```bash
CDP_API_KEY_ID=your-key-id
CDP_API_KEY_SECRET=your-secret
CDP_WALLET_SECRET=your-wallet-secret
ALCHEMY_API_KEY=your-alchemy-key
```

**Multi-Network EVM**

```bash
EVM_NETWORKS=base,optimism,arbitrum,polygon
ALCHEMY_API_KEY=your-alchemy-key
```

**Full Stack (EVM + Solana)**

```bash
EVM_NETWORKS=base,base-sepolia,optimism
SVM_NETWORKS=solana-mainnet,solana-devnet
ALCHEMY_API_KEY=your-alchemy-key
HELIUS_API_KEY=your-helius-key
SVM_PRIVATE_KEY=your-solana-private-key
```

**Starknet (Opt-in)**

```bash
STARKNET_NETWORKS=starknet-mainnet,starknet-sepolia
ALCHEMY_API_KEY=your-alchemy-key
STARKNET_SPONSOR_ADDRESS=0xyour-sponsor-address
STARKNET_PAYMASTER_API_KEY=your-paymaster-key
```

### OpenTelemetry (Optional)

Enable distributed tracing:

```bash
export OTEL_SERVICE_NAME="x402-facilitator"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
```

## Custom Signers

### CDP Signer (Recommended)

Use [Coinbase Developer Platform](https://portal.cdp.coinbase.com/) for managed key custody:

```typescript
import { createFacilitator } from "@daydreamsai/facilitator";
import { createCdpEvmSigner } from "@daydreamsai/facilitator/signers/cdp";
import { CdpClient } from "@coinbase/cdp-sdk";

const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: "facilitator" });

const signer = createCdpEvmSigner({
  cdpClient: cdp,
  account,
  network: "base",
  rpcUrl: process.env.EVM_RPC_URL_BASE,
});

const facilitator = createFacilitator({
  evmSigners: [
    {
      signer,
      networks: "eip155:8453",
      schemes: ["exact", "upto"],
      upto: { verifyBalanceCheck: true },
    },
  ],
});
```

### Multi-Network CDP Setup

```typescript
import { createFacilitator } from "@daydreamsai/facilitator";
import { createMultiNetworkCdpSigners } from "@daydreamsai/facilitator/signers/cdp";

const signers = createMultiNetworkCdpSigners({
  cdpClient: cdp,
  account,
  networks: {
    base: process.env.EVM_RPC_URL_BASE,
    "base-sepolia": process.env.BASE_SEPOLIA_RPC_URL,
    optimism: process.env.OPTIMISM_RPC_URL,
  },
});

const facilitator = createFacilitator({
  evmSigners: [
    { signer: signers.base!, networks: "eip155:8453" },
    { signer: signers["base-sepolia"]!, networks: "eip155:84532" },
    { signer: signers.optimism!, networks: "eip155:10" },
  ],
});
```

### CDP Network Mapping

| CDP Network        | CAIP-2            | Chain ID |
| ------------------ | ----------------- | -------- |
| `base`             | `eip155:8453`     | 8453     |
| `base-sepolia`     | `eip155:84532`    | 84532    |
| `ethereum`         | `eip155:1`        | 1        |
| `ethereum-sepolia` | `eip155:11155111` | 11155111 |
| `optimism`         | `eip155:10`       | 10       |
| `arbitrum`         | `eip155:42161`    | 42161    |
| `polygon`          | `eip155:137`      | 137      |
| `avalanche`        | `eip155:43114`    | 43114    |

### Lifecycle Hooks

Add custom logic at key points:

```typescript
const facilitator = createFacilitator({
  evmSigners: [{ signer, networks: "eip155:8453" }],
  hooks: {
    onBeforeVerify: async (ctx) => {
      // Rate limiting, logging
    },
    onAfterVerify: async (ctx) => {
      // Track verified payments
    },
    onVerifyFailure: async (ctx) => {
      // Handle verification failures
    },
    onBeforeSettle: async (ctx) => {
      // Validate before settlement
    },
    onAfterSettle: async (ctx) => {
      // Analytics, notifications
    },
    onSettleFailure: async (ctx) => {
      // Alerting, retry logic
    },
  },
});
```

## API Reference

### GET /supported

Returns supported payment schemes and networks.

**Response:**

```json
{
  "kinds": [
    { "x402Version": 2, "scheme": "exact", "network": "eip155:8453" },
    { "x402Version": 2, "scheme": "upto", "network": "eip155:8453" }
  ],
  "signers": {
    "eip155": ["0x..."]
  }
}
```

### POST /verify

Validates a payment signature against requirements.

**Request:**

```json
{
  "paymentPayload": {
    "x402Version": 2,
    "accepted": {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "1000",
      "payTo": "0x..."
    },
    "payload": { "signature": "0x...", "authorization": {} }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "1000",
    "payTo": "0x..."
  }
}
```

**Response (Success):**

```json
{ "isValid": true, "payer": "0x..." }
```

**Response (Failure):**

```json
{ "isValid": false, "invalidReason": "invalid_signature" }
```

For `upto` payments, `/verify` always validates permit shape/signature/cap/deadline/spender.
By default it is signature-only and does not query on-chain balance. To enable optional
post-signature balance preflight:

- Set `evmSigners[].upto.verifyBalanceCheck = true` in `createFacilitator(...)`
- Or set `UPTO_VERIFY_BALANCE_CHECK=true` when using `examples/facilitator-server`

With preflight enabled, `/verify` may also return:

- `invalidReason: "insufficient_balance"` when `balanceOf(owner) < requirements.amount`
- `invalidReason: "balance_check_failed"` when the balance RPC check fails (fail-closed)

### POST /settle

Executes on-chain payment settlement.

**Request:** Same as `/verify`

**Response (Success):**

```json
{
  "success": true,
  "transaction": "0x...",
  "network": "eip155:8453",
  "payer": "0x..."
}
```

**Response (Failure):**

```json
{
  "success": false,
  "errorReason": "insufficient_balance",
  "network": "eip155:8453"
}
```

## Payment Schemes

### Exact Scheme

Immediate, single-transaction settlement. Each payment request results in one on-chain transfer.

**Supported tokens:**

- USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- SPL tokens on Solana

#### Exact Scheme (Starknet Paymaster)

Starknet exact payments are gasless for users because a **paymaster** sponsors gas. The user still signs the transaction data.

**Flow:**

1. Client receives `PaymentRequired` (402 response).
2. Client calls the paymaster `paymaster_buildTransaction` to get SNIP-12 `typed_data`.
3. Client signs `typed_data` with their **own** Starknet account signer (private key or wallet).
4. Client sends `PaymentPayload` **including `typedData`** to the resource server/facilitator.
5. Facilitator verifies the payload and calls `paymaster_executeTransaction` to submit the tx.
6. Paymaster pays gas from its sponsor account and broadcasts to Starknet.

**Important:** The paymaster never signs for the user. If the client cannot sign, the payment cannot be created. The facilitator **rejects Starknet payloads without `typedData`**. `STARKNET_SPONSOR_ADDRESS` identifies the paymaster sponsor account for `/supported`.

### Upto Scheme (Batched Payments)

Permit-based flow for efficient EVM token payments:

`/verify` for `upto` always checks permit correctness. Optional balance preflight can be
enabled via `upto.verifyBalanceCheck` to reject underfunded payers before settlement.

1. **Client signs once** - ERC-2612 Permit for a cap amount
2. **Multiple requests** - Reuse the same Permit signature
3. **Automatic batching** - Sweeper settles accumulated spend
4. **Settlement triggers:**
   - Idle timeout (2 minutes of inactivity)
   - Deadline buffer (60 seconds before Permit expires)
   - Cap threshold (90% of cap reached)

**Session Lifecycle:**

```
┌─────────┐     verify      ┌─────────┐     sweep/close     ┌─────────┐
│  None   │ ───────────────▶│  Open   │ ──────────────────▶ │ Closed  │
└─────────┘                 └────┬────┘                     └─────────┘
                                 │ settle
                                 ▼
                            ┌─────────┐
                            │Settling │
                            └────┬────┘
                                 │ success
                                 ▼
                            Back to Open (if cap/deadline allow)
```

**Limitations:**

- ERC-2612 Permit tokens only
- In-memory sessions (lost on restart without custom store)

## Unified Client

The unified client wraps x402 client + HTTP helpers into a single
`fetchWithPayment` function. It handles 402 responses by creating a payment
payload and retrying the request with the `PAYMENT-SIGNATURE` header.

```typescript
import { createUnifiedClient } from "@daydreamsai/facilitator/client";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const account = privateKeyToAccount(
  process.env.CLIENT_EVM_PRIVATE_KEY as `0x${string}`
);
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL),
});

const { fetchWithPayment, uptoScheme } = createUnifiedClient({
  evmExact: { signer: account },
  evmUpto: {
    signer: account,
    publicClient,
    facilitatorUrl: process.env.FACILITATOR_URL,
    // Optional: skip /supported lookup by setting a local signer map
    // facilitatorSignerByNetwork: { "eip155:8453": "0x..." },
  },
});

const response = await fetchWithPayment("https://api.example.com/premium");
```

### Upto Scheme Behavior

- ERC-2612 permits are cached per `(network, asset, owner, facilitator signer)`
  and reused until close to expiry.
- If a paid request still returns 402 with `cap_exhausted` or `session_closed`,
  the unified client invalidates the cached permit and retries once.
- You can force a new permit with
  `uptoScheme?.invalidatePermit("eip155:8453", "0x...")`.

### Starknet Note

Starknet exact requires `typedData` in the payment payload. The unified client
throws if `typedData` is missing.

## Upto Module

The upto module provides components for batched payment tracking on resource servers.

### Architecture: Who Maintains What State?

When building a service that uses the upto scheme, understanding state ownership is critical. The client and facilitator each maintain different pieces of state:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Upto Scheme State Ownership                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   YOUR SERVICE (Client)              FACILITATOR                            │
│   ════════════════════               ═══════════                            │
│                                                                             │
│   ┌──────────────────┐               ┌──────────────────┐                  │
│   │   PermitCache    │               │  Session Store   │                  │
│   │  ┌────────────┐  │               │  ┌────────────┐  │                  │
│   │  │ Signed     │  │   payment     │  │ pendingSpent│  │                  │
│   │  │ Permit     │──┼───request────▶│  │ settledTotal│  │                  │
│   │  │ (EIP-2612) │  │               │  │ cap/deadline│  │                  │
│   │  └────────────┘  │               │  │ status      │  │                  │
│   │                  │◀──────────────┼──└────────────┘  │                  │
│   │  Invalidate on:  │  cap_exhausted │                  │                  │
│   │  • cap_exhausted │  session_closed│  Sweeper settles │                  │
│   │  • session_closed│               │  automatically   │                  │
│   │  • deadline near │               │                  │                  │
│   └──────────────────┘               └──────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Aspect | Your Service (Client) | Facilitator |
|--------|----------------------|-------------|
| **Stores** | Signed permit (EIP-2612 signature) | Session metadata (cap, pending, settled) |
| **Reuses** | Same permit for multiple requests | Cap across payments until exhausted |
| **Invalidates** | On error codes or deadline | On deadline, cap exhaustion, or explicit close |
| **Persists** | Optional (in-memory is fine) | Required for production (Redis, PostgreSQL) |

### Client Responsibilities

Your service should maintain a **permit cache** for efficient permit reuse:

```typescript
// Pseudocode for client-side permit management
interface CachedPermit {
  signature: string;
  cap: bigint;
  deadline: bigint;
  nonce: bigint;
  network: string;
  asset: string;
}

class PermitCache {
  private cache = new Map<string, CachedPermit>();

  // Key format: network:asset:owner:spender
  get(key: string): CachedPermit | undefined {
    const permit = this.cache.get(key);
    if (!permit) return undefined;

    // Pre-invalidate 60 seconds before deadline
    const buffer = 60n;
    if (BigInt(Math.floor(Date.now() / 1000)) + buffer >= permit.deadline) {
      this.cache.delete(key);
      return undefined;
    }

    return permit;
  }

  set(key: string, permit: CachedPermit): void {
    this.cache.set(key, permit);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}
```

**When to invalidate permits:**

| Facilitator Response | Action |
|---------------------|--------|
| `cap_exhausted` | Invalidate permit, sign new one with fresh cap |
| `session_closed` | Invalidate permit, sign new one |
| `settling_in_progress` | Retry after short delay (session temporarily locked) |
| Success | Keep using cached permit |

### Facilitator Responsibilities

The facilitator maintains session state internally. You don't need to track:

- **Pending spend** - How much has been charged but not yet settled on-chain
- **Settled total** - How much has been settled on-chain
- **Settlement timing** - When to batch and settle (handled by sweeper)

**Session ID is deterministic:** The same permit signature always maps to the same session. This is how the facilitator correlates multiple payments under one cap.

```typescript
// Facilitator generates session ID from permit fields
function generateSessionId(permit: PaymentPayload): string {
  const key = {
    network, asset, owner, spender, cap, nonce, deadline, signature
  };
  return sha256(JSON.stringify(key));
}
```

### Payment Flow Example

```
1. Client: Check cache for valid permit
   └─ Cache miss → Sign new EIP-2612 permit (cap: 50 USDC, deadline: 1 hour)
   └─ Cache hit  → Reuse existing permit

2. Client: Send payment request with permit
   POST /verify → Facilitator validates signature

3. Facilitator: Track payment internally
   └─ First request  → Create session (cap=50, pending=10)
   └─ Later requests → Update session (pending += amount)

4. Facilitator Sweeper (background, every 30s):
   └─ Idle > 2min with pending > 0    → Settle batch on-chain
   └─ Deadline < 60s                   → Settle and close session
   └─ (settled + pending) >= 90% cap  → Settle batch

5. Client: Receives cap_exhausted
   └─ Invalidate permit in cache
   └─ Sign new permit
   └─ Retry request
```

### Recommended Integration Pattern

**Option 1: Use the built-in client (simplest)**

The `createUnifiedClient` handles permit caching automatically:

```typescript
import { createUnifiedClient } from "@daydreamsai/facilitator/client";

const { fetchWithPayment } = createUnifiedClient({
  evmUpto: {
    signer: account,
    publicClient,
    facilitatorUrl: "http://localhost:8090",
  },
});

// Permit caching is automatic
const response = await fetchWithPayment("https://api.example.com/premium");
```

**Option 2: Build custom permit management**

Only do this if you need:
- Cross-service permit sharing
- Persistence across restarts
- Custom invalidation logic

```typescript
// Custom integration pseudocode
async function makePayment(amount: bigint) {
  const cacheKey = `${network}:${asset}:${owner}:${facilitatorSigner}`;
  let permit = permitCache.get(cacheKey);

  if (!permit) {
    permit = await signPermit({ cap: amount * 10n, deadline: 3600 });
    permitCache.set(cacheKey, permit);
  }

  const response = await fetch(paidEndpoint, {
    headers: { "X-Payment": encodePayment(permit, amount) }
  });

  if (response.status === 402) {
    const error = await response.json();
    if (error.code === "cap_exhausted" || error.code === "session_closed") {
      permitCache.invalidate(cacheKey);
      return makePayment(amount);  // Retry with new permit
    }
  }

  return response;
}
```

### State Persistence Considerations

| Scenario | Client Storage | Facilitator Storage |
|----------|---------------|---------------------|
| Single instance, dev/test | In-memory | In-memory |
| Single instance, production | In-memory (permits are cheap to re-sign) | Redis/PostgreSQL |
| Multi-instance, production | Redis (share permits across instances) | Redis/PostgreSQL |

**Key insight:** Client-side permit caching is an optimization, not a requirement. If you lose your cache, you just sign a new permit. Facilitator-side session state is critical - losing it means losing track of pending payments.

### Installation

```typescript
import {
  createUptoModule,
  trackUptoPayment,
  generateSessionId,
  formatSession,
  TRACKING_ERROR_MESSAGES,
  TRACKING_ERROR_STATUS,
} from "@daydreamsai/facilitator/upto";
```

### Creating an Upto Module

```typescript
import { createUptoModule } from "@daydreamsai/facilitator/upto";
import { HTTPFacilitatorClient } from "@x402/core/http";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "http://localhost:8090",
});

const upto = createUptoModule({
  facilitatorClient,
  // Optional: custom session store (defaults to InMemoryUptoSessionStore)
  // store: new RedisUptoSessionStore(redis),
  // Optional: sweeper configuration for auto settlement
  // sweeperConfig: { intervalMs: 30_000, idleSettleMs: 120_000 },
});

// Use the sweeper plugin for automatic settlement
app.use(upto.createSweeper());
```

### Tracking Payments

```typescript
import { trackUptoPayment, TRACKING_ERROR_STATUS } from "@daydreamsai/facilitator/upto";

const result = await trackUptoPayment(upto.store, paymentPayload, requirements);

if (!result.success) {
  // Handle error
  const status = TRACKING_ERROR_STATUS[result.error];
  return { error: result.error, status };
}

// Payment tracked successfully
console.log(`Session ${result.sessionId} updated`);
console.log(`Pending: ${result.session.pendingSpent}`);
```

### Custom Session Store

Replace in-memory storage with persistent storage:

```typescript
import type { UptoSessionStore, UptoSession } from "@daydreamsai/facilitator/upto";

class RedisSessionStore implements UptoSessionStore {
  async get(id: string): Promise<UptoSession | undefined> {
    /* Redis get */
  }
  async set(id: string, session: UptoSession): Promise<void> {
    /* Redis set */
  }
  async delete(id: string): Promise<void> {
    /* Redis del */
  }
  async *entries(): AsyncIterableIterator<[string, UptoSession]> {
    /* Redis scan */
  }
}
```

Or use the built-in Redis store + global sweeper lock:

```typescript
import {
  RedisUptoSessionStore,
  createRedisSweeperLock,
} from "@daydreamsai/facilitator/upto";

const store = new RedisUptoSessionStore(redis, {
  keyPrefix: "facilitator:upto",
});

const sweeperLock = createRedisSweeperLock(redis, {
  key: "facilitator:upto:sweeper:lock",
  ttlMs: 60_000,
});

const upto = createUptoModule({
  facilitatorClient,
  store,
  sweeperConfig: {
    lock: sweeperLock,
    settlingTimeoutMs: 300_000,
  },
});
```

## Resource Server

Pre-configured resource server with all schemes registered:

```typescript
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { HTTPFacilitatorClient } from "@x402/core/http";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "http://localhost:8090",
});

const resourceServer = createResourceServer(facilitatorClient);
await resourceServer.initialize();

// Use with payment middleware
resourceServer.onAfterVerify(async (ctx) => {
  if (ctx.requirements.scheme === "upto") {
    // Track upto sessions
  }
});
```

## Framework Middleware

Pre-built payment middleware for popular web frameworks. Each middleware handles:

- Payment verification via the facilitator
- Automatic settlement after successful requests
- Paywall HTML for browser-based payments
- Upto session tracking (optional)

### Elysia

```typescript
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";

import { createElysiaPaidRoutes } from "@daydreamsai/facilitator/elysia";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { createUptoModule } from "@daydreamsai/facilitator/upto";

const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:8090" });
const resourceServer = createResourceServer(facilitatorClient);
const upto = createUptoModule({ facilitatorClient, autoSweeper: true });
const paywallProvider = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .build();

const app = new Elysia({ prefix: "/api", adapter: node() });

createElysiaPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    upto,
    paywallProvider,
    paywallConfig: { appName: "My Paid API", testnet: true },
  },
})
  .get("/premium", () => ({ message: "premium content" }), {
    payment: {
      accepts: {
        scheme: "exact",
        network: "eip155:8453",
        payTo: "0x...",
        price: "$0.01",
      },
      description: "Premium content",
      mimeType: "application/json",
    },
  });

app.listen(4022);
```

### Hono

```typescript
import { Hono } from "hono";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";

import { createHonoPaidRoutes } from "@daydreamsai/facilitator/hono";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { createUptoModule } from "@daydreamsai/facilitator/upto";

const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:8090" });
const resourceServer = createResourceServer(facilitatorClient);
const upto = createUptoModule({ facilitatorClient, autoSweeper: true });
const paywallProvider = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .build();

const app = new Hono().basePath("/api");

createHonoPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    upto,
    paywallProvider,
    paywallConfig: { appName: "My Paid API", testnet: true },
  },
})
  .get("/premium", (c) => c.json({ message: "premium content" }), {
    payment: {
      accepts: {
        scheme: "exact",
        network: "eip155:8453",
        payTo: "0x...",
        price: "$0.01",
      },
      description: "Premium content",
      mimeType: "application/json",
    },
  });

export default { port: 4023, fetch: app.fetch };
```

### Express

```typescript
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";

import { createExpressPaidRoutes } from "@daydreamsai/facilitator/express";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { createUptoModule } from "@daydreamsai/facilitator/upto";

const facilitatorClient = new HTTPFacilitatorClient({ url: "http://localhost:8090" });
const resourceServer = createResourceServer(facilitatorClient);
const upto = createUptoModule({ facilitatorClient, autoSweeper: true });
const paywallProvider = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .build();

const app = express();
app.use(express.json());

createExpressPaidRoutes(app, {
  basePath: "/api",
  middleware: {
    resourceServer,
    upto,
    paywallProvider,
    paywallConfig: { appName: "My Paid API", testnet: true },
  },
})
  .get("/api/premium", (_req, res) => res.json({ message: "premium content" }), {
    payment: {
      accepts: {
        scheme: "exact",
        network: "eip155:8453",
        payTo: "0x...",
        price: "$0.01",
      },
      description: "Premium content",
      mimeType: "application/json",
    },
  });

app.listen(4024);
```

### Middleware Configuration

| Option | Type | Description |
| ------ | ---- | ----------- |
| `resourceServer` | `x402ResourceServer` | Pre-configured resource server instance |
| `upto` | `UptoModule` | Optional upto module for batched payments |
| `paywallProvider` | `PaywallProvider` | Optional paywall HTML generator |
| `paywallConfig` | `PaywallConfig` | Paywall display options |
| `autoSettle` | `boolean` | Auto-settle after successful requests (default: `true`) |
| `paymentHeaderAliases` | `string[]` | Alternative header names for payment data |

### Payment Route Options

Each route can specify payment requirements:

```typescript
{
  payment: {
    accepts: {
      scheme: "exact" | "upto",
      network: "eip155:8453",           // CAIP-2 network ID
      payTo: "0x...",                   // Recipient address
      price: "$0.01" | {                // Price shorthand or detailed
        amount: "10000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        extra: { name: "USD Coin", version: "2" }
      }
    },
    description: "What this endpoint provides",
    mimeType: "application/json"
  }
}
```

### Paywall Support

When a browser (Accept: text/html) requests a paid endpoint without payment, the middleware returns an interactive paywall page instead of a JSON error.

**Setup:**

1. Install the paywall package:
   ```bash
   bun add @x402/paywall
   ```

2. Create and configure the provider:
   ```typescript
   import { createPaywall, evmPaywall, svmPaywall } from "@x402/paywall";

   const paywallProvider = createPaywall()
     .withNetwork(evmPaywall)   // EVM chains
     .withNetwork(svmPaywall)   // Solana
     .build();
   ```

3. Pass to middleware config:
   ```typescript
   createElysiaPaidRoutes(app, {
     middleware: {
       resourceServer,
       paywallProvider,
       paywallConfig: {
         appName: "My App",
         testnet: true,  // Show testnet warning
       },
     },
   });
   ```

**Paywall Config Options:**

| Option | Type | Description |
| ------ | ---- | ----------- |
| `appName` | `string` | Application name shown in paywall |
| `testnet` | `boolean` | Display testnet warning banner |

## Testing

```bash
# Run tests
bun test

# Watch mode
bun test:watch

# Coverage
bun test:coverage
```

### Smoke Testing

1. Start the facilitator:

   ```bash
   bun dev
   ```

2. Start the demo paid API:

   ```bash
   bun smoke:api
   ```

3. Run the smoke client:
   ```bash
   export CLIENT_EVM_PRIVATE_KEY="0x..."
   bun smoke:upto
   ```

## Production Deployment

### Security Considerations

1. **Private Key Management**
   - Use CDP for managed custody (recommended)
   - Or use secrets managers (AWS Secrets Manager, HashiCorp Vault)
   - Never commit `.env` files with real keys

2. **Network Security**
   - Run behind a reverse proxy (nginx, Cloudflare)
   - Enable TLS/HTTPS
   - Implement rate limiting

3. **Signature Validation**
   - All signatures verified via EIP-712 typed data
   - Permit deadlines enforced with buffer
   - Network/chain ID validation prevents replay attacks

### Scaling

1. **Session Persistence**
   - Replace `InMemoryUptoSessionStore` with Redis/PostgreSQL
   - Required for multi-instance deployments

2. **RPC Resilience**
   - Configure multiple RPC endpoints
   - Implement retry logic with exponential backoff

3. **Monitoring**
   - Enable OpenTelemetry tracing
   - Set up alerts for settlement failures

### Example Deployment

```yaml
# docker-compose.yml
services:
  facilitator:
    build: .
    environment:
      - CDP_API_KEY_ID=${CDP_API_KEY_ID}
      - CDP_API_KEY_SECRET=${CDP_API_KEY_SECRET}
      - CDP_WALLET_SECRET=${CDP_WALLET_SECRET}
      - PORT=8090
    ports:
      - "8090:8090"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/supported"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Railway Deployment

For quick cloud deployment, use the Railway deploy button in the [Quick Start](#one-click-deploy-railway) section, or follow these manual steps:

1. **Create a Railway template** from this repository at [railway.com](https://railway.com)
2. **Configure environment variables:**
   - For CDP: Set `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `CDP_ACCOUNT_NAME` from your [Coinbase Developer Platform](https://portal.cdp.coinbase.com/) account
   - For private key: Set `EVM_PRIVATE_KEY` with your hex-formatted private key
3. **Optional configuration:**
   - `EVM_NETWORKS` - Comma-separated networks (e.g., `base,optimism,arbitrum`)
   - `ALCHEMY_API_KEY` - For better RPC reliability
   - `SVM_NETWORKS` + `SVM_PRIVATE_KEY` - Enable Solana support
4. **Deploy** and wait for the health check to pass
5. Your facilitator is live at `https://your-app.railway.app`

The repository includes a `railway.toml` configuration that uses the existing Dockerfile for builds.

## License

MIT
