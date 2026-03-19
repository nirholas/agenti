<h1 align="center">x402-TON</h1>
<p align="center"><strong>HTTP 402 payments on TON, for AI agents</strong></p>
<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://www.npmjs.com/package/x402ton"><img src="https://img.shields.io/npm/v/x402ton" alt="npm"></a>
  <a href="packages/ton/test/"><img src="https://img.shields.io/badge/Tests-220_passed-brightgreen.svg" alt="Tests: 220 passed"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg" alt="TypeScript: strict"></a>
  <a href="https://ton.org/"><img src="https://img.shields.io/badge/TON-Blockchain-0098EA.svg" alt="TON"></a>
</p>
<p align="center">
  TypeScript SDK implementing the <a href="https://github.com/coinbase/x402">x402</a> open payment standard for <a href="https://ton.org/">TON</a>.<br>
  Sign, verify, and settle HTTP 402 payments with native TON and USDT. Built for AI agents economy and autonomous commerce.
</p>
<p align="center">
  <a href="https://x402.resistance.dog/health">Live Facilitator</a> · <a href="#api-reference">API Reference</a>
</p>

---

## Installation

```shell
npm install x402ton
```

Peer dependencies: `@ton/core`, `@ton/crypto`, `@ton/ton` — install alongside x402ton.

## Quick Start

### Client: Paying for an API

```typescript
import { TonSigner, SchemeNetworkClient } from "x402ton";

// Initialize signer with your wallet mnemonic
const signer = new TonSigner(mnemonic); // string[]
await signer.init();

// Create a payment client
const client = new SchemeNetworkClient(signer, {
  toncenterApiKey: process.env.TONCENTER_API_KEY,
  tonApiKey: process.env.TONAPI_KEY,      // required for USDT gasless
});

// Build a signed payment payload
const payload = await client.createPaymentPayload(
  "tvm:-239",           // network (mainnet)
  "1000000000",         // amount in nanoTON (1 TON)
  "native",             // asset ("native" or USDT jetton master address)
  payToAddress,         // vendor's raw address
  60,                   // timeout in seconds
  extra,                // { relayAddress, maxRelayCommission, ... } from /supported
);

// Send the payload with your HTTP request
const response = await fetch("https://api.example.com/resource", {
  headers: { "X-PAYMENT": JSON.stringify({ x402Version: 2, payload }) },
});
```

### Vendor: Accepting Payments via Facilitator

No SDK needed. Use any HTTP client to verify and settle payments through a facilitator:

```typescript
import { Hono } from "hono";

const FACILITATOR_URL = "https://x402.resistance.dog";

const app = new Hono();

app.get("/resource", async (c) => {
  const paymentHeader = c.req.header("X-PAYMENT");

  // No payment attached — return 402
  if (!paymentHeader) {
    return c.json({
      scheme: "exact",
      network: "tvm:-239",
      asset: "native",
      amount: "1000000000",
      payTo: "0:your-wallet-address-here",
      maxTimeoutSeconds: 60,
      extra: await fetch(`${FACILITATOR_URL}/supported`)
        .then((r) => r.json())
        .then((d) => d.kinds[0].extra),
    }, 402);
  }

  // Verify payment
  const paymentPayload = JSON.parse(paymentHeader);
  const verification = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentPayload: { x402Version: 2, payload: paymentPayload }, paymentRequirements }),
  }).then((r) => r.json());

  if (!verification.isValid) {
    return c.json({ error: verification.invalidReason }, 402);
  }

  // Serve the resource
  const data = { weather: "sunny", temperature: 22 };

  // Settle payment (async, after response)
  fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ paymentPayload: { x402Version: 2, payload: paymentPayload }, paymentRequirements }),
  });

  return c.json(data);
});
```

### Self-hosted Facilitator

See [server/README.md](server/README.md) for running your own facilitator instance.

## API Reference

### Classes

| Export | Description |
|--------|-------------|
| `TonSigner` | Unified wallet signer — key management and transaction signing |
| `SchemeNetworkClient` | Builds and signs payment payloads (native TON + USDT) |
| `SchemeNetworkServer` | Price parsing and payment requirements generation for vendors |
| `SchemeNetworkFacilitator` | Verification, settlement, and relay broadcasting (TONAPI gasless + self-relay) |

### Utility Functions

| Export | Description |
|--------|-------------|
| `validateBoc(boc)` | Parse and validate a base64-encoded BOC (depth, cells, size) |
| `validateTonAddress(addr)` | Validate raw hex address format (`0:<64hex>`) |
| `toAtomicUnits(amount, decimals)` | Convert human-readable amount to atomic units (BigInt) |
| `fromAtomicUnits(atomic, decimals)` | Convert atomic units to human-readable string |
| `hashBoc(boc)` | SHA-256 hash of a BOC string |
| `extractPayerFromPayload(signedBoc, walletPublicKey)` | Derive payer address from public key without RPC |
| `getCellDepth(boc)` | Get BOC cell tree depth |
| `getCellCount(boc)` | Count cells in BOC |
| `rawToBase64url(raw)` | Convert raw address to base64url (user-friendly) |
| `base64urlToRaw(b64)` | Convert base64url address to raw hex |

### Types

| Export | Description |
|--------|-------------|
| `ExactTonPayload` | Signed payment: `{ signedBoc, walletPublicKey, walletAddress, seqno, validUntil }` |
| `PaymentRequirements` | What the vendor requires: scheme, network, asset, amount, payTo |
| `VerifyResponse` | Verification result: `{ isValid, payer?, invalidReason? }` |
| `SettleResponse` | Settlement result: `{ success, transaction?, errorReason? }` |
| `TonExtra` | Facilitator config: `{ relayAddress?, maxRelayCommission?, assetDecimals, assetSymbol }` |
| `X402ErrorCode` | Error code enum object (const map of all error codes) |
| `X402ErrorCodeValue` | Union type of all error code strings |
| `EmulationConfig` | TonAPI emulation endpoint configuration |
| `GaslessConfigCache` | TONAPI gasless relay config cache |
| `BudgetPersistence` | Pluggable persistence for self-relay budget tracking |
| `FacilitatorOptions` | Facilitator constructor options (emulation, TONAPI, budget) |

## Architecture

```
x402ton/
├── packages/ton/              # x402ton SDK
│   ├── src/
│   │   ├── constants.ts       # CAIP-2 IDs, USDT masters, BOC limits, timing
│   │   ├── types.ts           # All TypeScript interfaces
│   │   ├── utils.ts           # BOC validation, address math, fee computation
│   │   ├── signer.ts          # TonSigner — unified wallet signer
│   │   └── exact/
│   │       ├── client/        # SchemeNetworkClient — build payment payloads
│   │       ├── server/        # SchemeNetworkServer — parse prices, enhance requirements
│   │       └── facilitator/   # SchemeNetworkFacilitator — verify + settle
│   └── test/unit/             # 143 unit tests
├── server/                    # Facilitator HTTP server (Hono + SQLite)
│   └── src/
│       ├── routes/            # /supported, /verify, /settle
│       ├── middleware/        # Rate limiting, idempotency, logging
│       └── store/
│           ├── idempotency.ts # Idempotency keys, transaction state
│           └── budget-store.ts   # Self-relay daily budget tracking
│   └── test/                 # 77 server tests (security, validation, stores)
└── scripts/                   # E2E tests and utility scripts
```

## Configuration

### Network Identifiers (CAIP-2)

| Network | Identifier | Native Asset | USDT |
|---------|-----------|-------------|------|
| Mainnet | `tvm:-239` | TON (9 decimals) | `0:b113a994...` (6 decimals) |
| Testnet | `tvm:-3` | TON (9 decimals) | `0:d042a064...` (6 decimals) |

## Testing

```shell
# Run SDK tests (220 tests: 143 SDK + 77 server)
npx vitest run --config packages/ton/vitest.config.ts --dir packages/ton

# Run with coverage
npx vitest run --config packages/ton/vitest.config.ts --dir packages/ton --coverage

# Run server tests
npx vitest run --config server/vitest.config.ts

# E2E test — native TON
CLIENT_MNEMONIC="..." VENDOR_ADDRESS="0:..." npx tsx scripts/test-e2e.ts

# E2E test — USDT gasless (requires TONAPI_KEY)
CLIENT_MNEMONIC="..." VENDOR_ADDRESS="0:..." TONAPI_KEY="..." npx tsx scripts/test-e2e-usdt.ts
```

## Error Codes

### Verification Errors

| Code | Description |
|------|-------------|
| `invalid_scheme` | Scheme is not `exact` |
| `invalid_network` | Network not supported (must be `tvm:-239` or `tvm:-3`) |
| `invalid_exact_ton_boc` | BOC parsing or canonical validation failed |
| `invalid_exact_ton_boc_depth` | BOC cell tree exceeds maximum depth (256) |
| `invalid_exact_ton_boc_cells` | BOC exceeds maximum cell count (1024) |
| `invalid_exact_ton_signature` | Ed25519 signature verification failed |
| `invalid_exact_ton_expired` | Transaction `valid_until` timestamp has passed |
| `invalid_exact_ton_seqno` | Sequence number does not match on-chain state |
| `invalid_exact_ton_amount` | Payment amount does not match required amount (exact equality) |
| `invalid_exact_ton_recipient` | Payment destination does not match required payTo address |
| `invalid_exact_ton_asset_mismatch` | Jetton master or transfer opcode mismatch |
| `invalid_exact_ton_replay` | Transaction hash already settled |
| `invalid_exact_ton_too_many_actions` | More than 2 W5 actions in transaction |
| `invalid_exact_ton_commission_exceeded` | Relay commission exceeds maximum allowed |
| `invalid_exact_ton_invalid_state_init` | stateInit code hash mismatch or missing for new wallet |
| `invalid_exact_ton_payload` | Malformed payload structure |

### Settlement Errors

| Code | Description |
|------|-------------|
| `settlement_broadcast_failed` | Failed to submit BOC to TON network |
| `settlement_timeout` | Transaction not confirmed within timeout period (30s native, 60s gasless) |
| `settlement_reverted` | Transaction reverted on-chain |
| `unexpected_settle_error` | Unhandled error during settlement |

### Adding a New Asset

To add support for a new jetton (e.g., USDC), add its master address to `NETWORK_CONFIG` in [`packages/ton/src/constants.ts`](packages/ton/src/constants.ts) and ensure the jetton follows the [TEP-74](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md) standard.

## License

MIT

## Links

- [x402 Protocol](https://github.com/coinbase/x402) - Open standard for internet-native payments
- [TON Documentation](https://docs.ton.org/) - TON blockchain developer docs
- [TEP-74 Jetton Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md) - TON fungible token standard
- [CAIP-2](https://chainagnostic.org/CAIPs/caip-2) - Chain Agnostic network identifiers
- [Live Facilitator](https://x402.resistance.dog/health) - Public x402ton facilitator instance
