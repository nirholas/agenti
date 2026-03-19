# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-15

### Added
- USDT gasless relay via TONAPI (`/v2/gasless/send`) — client pays zero TON for gas
- Auto-detection of gasless vs direct broadcast from W5 opcode (`0x73696e74` internal / `0x7369676e` external)
- Self-relay fallback with circuit breaker (3 failures / 60s window / 300s cooldown)
- Daily self-relay budget tracking with SQLite persistence (`BudgetStore`)
- `TonSigner.signTransfer()` — encapsulates secret key usage
- Input validation layer (`validation.ts`, `error-codes.ts`)
- W5 v5r1 stateInit code hash validation
- Commission cap (10 USDT absolute maximum)
- Rate limiter memory cap (10k keys)
- E2E test script for USDT gasless (`scripts/test-e2e-usdt.ts`)
- Landing page with Liquid Glass dark theme and pastel accents
- Gasless TONAPI spec documentation (`specs/gasless-tonapi/`)
- 77 new server tests (budget-store, validation, tx-state, idempotency, security)

### Changed
- Payment model: client pays vendor directly (facilitator never holds funds)
- `ExactTonPayload` fields: `boc` → `signedBoc`, `publicKey` → `walletPublicKey`, added `walletAddress`, `seqno`, `validUntil`
- `TonExtra` fields: `facilitatorAddress` + `fee` → `relayAddress`, `maxRelayCommission`, `assetDecimals`, `assetSymbol`
- `SchemeNetworkClient` constructor: accepts options object `{ toncenterApiKey, tonApiKey }`
- `SchemeNetworkServer` constructor: `(network, relayAddress?, maxRelayCommission?)`
- `SchemeNetworkFacilitator`: relay broadcasting instead of fund routing
- Amount validation: exact equality (`===`) instead of minimum (`>=`)
- `paymentPayload` requires `x402Version: 2`
- `extractPayerFromPayload` signature: `(signedBoc, walletPublicKey)` instead of `(boc, pubKey, walletVer)`
- USDT mainnet address corrected (`...c3621dfe`)
- Settlement timeout: 30s native, 60s gasless
- Server health endpoint reads version dynamically from package.json

### Removed
- v4r2 wallet support (v5r1 only)
- Fee model (`TonFee`, `FeeConfig`, `feePercentage`, `feeMinimum`)
- `WalletVersion` type
- `computeFee()`, `validateAmount()` utilities
- Fund routing (`routeFunds()`)
- `settlement_route_failed` error code

### Fixed
- `loadUint(64)` overflow on `created_lt` and `query_id` → `loadUintBig(64)`
- TONAPI action ordering: identify primary payment by destination, not position
- Commission fallback: return `null` (not `"0"`) when TONAPI estimate fails
- Cell traversal cycle detection in `getCellDepth()` and `getCellCount()`
- `toAtomicUnits()` input validation (rejects negatives, malformed strings)
- Pino redact paths extended to nested `*.signedBoc`, `*.boc`
- `server.close()` on shutdown (fixes resource leak)

### Security
- BOC validation: 64KB size, 256 depth, 1024 cells limits
- Ed25519 signature verification before any broadcast
- Max 2 W5 actions per transaction
- Relay address cannot be facilitator (self-payment prevention)
- Pino structured logging with BOC/key redaction
- x402Version validation (must be 2)
- Error messages sanitized (no internal details leaked)

## [1.0.0] - 2026-03-04

### Added
- x402 payment SDK for TON blockchain (native TON + USDT jetton)
- Client, Server, and Facilitator scheme classes
- Facilitator server with `/supported`, `/verify`, `/settle`, `/health` endpoints
- Idempotency and transaction state management (SQLite)
- Rate limiting middleware (per-IP, per-wallet, global)
- TonAPI transaction emulation with graceful degradation
- 143 SDK unit tests
- Docker multi-stage build
- GitHub Actions CI/CD (test + release)
