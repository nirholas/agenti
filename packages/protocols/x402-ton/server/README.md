# x402-ton Facilitator Server

Reference implementation of an x402 facilitator for the TON blockchain. Verifies and settles payments on behalf of vendors. Supports native TON (direct broadcast) and USDT (TONAPI gasless relay). Uses the [`x402ton`](https://www.npmjs.com/package/x402ton) SDK.

## Quick Start

```shell
git clone https://github.com/TONresistor/x402-ton.git
cd x402-ton
npm install --legacy-peer-deps

# Configure
export TON_MNEMONIC="your 24 word mnemonic here"
export TON_NETWORK="tvm:-239"
export PORT=4020

# Start
npm -w server run dev
```

The facilitator wallet needs a small TON balance (~0.5 TON) for self-relay fallback when TONAPI gasless is unavailable.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TON_MNEMONIC` | Yes | | 24-word wallet mnemonic (space-separated) |
| `TON_NETWORK` | Yes | | `tvm:-239` (mainnet) or `tvm:-3` (testnet) |
| `PORT` | No | `4020` | HTTP server port |
| `DB_PATH` | No | `./data/facilitator.db` | SQLite database path |
| `TONCENTER_URL` | No | Auto | TON RPC endpoint |
| `TONCENTER_API_KEY` | No | | Toncenter API key for higher rate limits |
| `TONAPI_KEY` | No | | TONAPI API key for gasless USDT relay |
| `TONAPI_ENDPOINT` | No | `https://tonapi.io` | TONAPI base URL override |
| `MAX_RELAY_COMMISSION` | No | `500000` | Max relay commission in atomic units (fallback when TONAPI estimate unavailable) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health and TON node connectivity |
| GET | `/supported` | Supported schemes, networks, assets, and facilitator config |
| POST | `/verify` | Verify a signed payment payload (no broadcast) |
| POST | `/settle` | Settle a verified payment (broadcast via TONAPI gasless or direct) |

## Gasless USDT Relay

USDT payments are broadcast via [TONAPI gasless](https://docs.tonconsole.com/tonapi/rest-api/gasless) relay. The facilitator:

1. Discovers the TONAPI relay address at boot (`/v2/gasless/config`)
2. Advertises it in `GET /supported` as `extra.relayAddress`
3. On settle, detects gasless from the BOC opcode (`0x73696e74` = internal auth)
4. Broadcasts via `POST /v2/gasless/send` (hex-encoded BOC)
5. Falls back to self-relay if TONAPI is unavailable (circuit breaker)

The client pays no TON for gas. TONAPI charges a commission in USDT, included in the signed transaction.

## Docker

```shell
docker build -t x402-ton .
docker run -p 4020:4020 \
  -e TON_MNEMONIC="your 24 word mnemonic here" \
  -e TON_NETWORK="tvm:-239" \
  x402-ton
```

## Testing

```shell
npx vitest run --config server/vitest.config.ts
```

## Architecture

```
server/
├── src/
│   ├── index.ts              Entry point
│   ├── config.ts             Environment variable loading and validation
│   ├── health.ts             Health check route
│   ├── routes/
│   │   ├── supported.ts      GET /supported
│   │   ├── verify.ts         POST /verify
│   │   ├── settle.ts         POST /settle
│   │   ├── error-codes.ts   Server-level error code constants
│   │   └── validation.ts    Input validation (payload, requirements)
│   ├── middleware/
│   │   ├── idempotency.ts    Idempotency-Key enforcement for /settle
│   │   ├── logging.ts        Pino structured logging
│   │   └── rate-limit.ts     Per-IP, per-wallet, and global rate limiting
│   └── store/
│       ├── idempotency-store.ts   SQLite-backed idempotency key storage
│       ├── tx-state.ts            Transaction state tracking (SETTLING → CONFIRMED/FAILED)
│       └── budget-store.ts      Self-relay daily budget tracking (SQLite)
└── test/                     77 tests (security, validation, stores, rate limiting)
```
