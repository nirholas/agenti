# Changelog

All notable changes to `@ag402/fetch` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-03-11

Initial public release of the TypeScript buyer-side SDK for the x402 auto-payment protocol.

### Added

- `createX402Fetch(options)` — wraps native `fetch()` to automatically handle HTTP 402 Payment Required responses
- `InMemoryWallet` — test wallet with micro-unit integer arithmetic to avoid IEEE 754 float drift
- `Wallet` interface — decouple wallet implementation from the fetch wrapper
- `MockPaymentProvider` — test/development provider returning fake `mock_tx_...` hashes
- `PaymentProvider` interface — plug in real on-chain payment providers (e.g. `@ag402/solana`, coming soon)
- `X402Config` — per-call amount limit, total spend cap, accepted chains/tokens allowlist, debug logging
- Protocol utilities exported as standalone functions: `parseWwwAuthenticate`, `buildWwwAuthenticate`, `parseAuthorization`, `buildAuthorization`, `parseAmount`, `descriptorToChallenge`
- Dual ESM + CommonJS output; TypeScript declarations for both formats
- Zero runtime dependencies
- `paymentTimeoutMs` option — timeout (default 30s) for `provider.pay()` calls; wallet is rolled back on timeout

### Security

- `buildAuthorization` and `buildWwwAuthenticate` reject CR/LF/double-quote in all fields (HTTP header injection prevention)
- `parseAmount` uses strict `/^\d+(\.\d+)?$/` regex — rejects hex (`0x10`), scientific notation (`1e5`), multi-token strings, non-positive values
- `parseWwwAuthenticate` rejects headers larger than 8 KB (regex exhaustion protection)
- All options validated at construction time — fail-fast before any request is made (covers `maxAmountPerCall`, `maxTotalSpend`, `acceptedChains`, `acceptedTokens`, `paymentTimeoutMs`)
- Defensive array copy of `acceptedChains`/`acceptedTokens` — prevents external mutation after construction
- `provider.getAddress()` return value isolated from the main payment flow — if it contains unsafe characters, proof falls back to omitting `payer_address` rather than crashing after the on-chain payment has already been made
- `InMemoryWallet` constructor rejects `NaN` and `Infinity` as initial balance

### Notes

- `MockPaymentProvider` emits a `console.warn` when used outside test environments (no `NODE_ENV=test` / `VITEST` / `JEST_WORKER_ID`)
- `InMemoryWallet` is not safe for concurrent calls on the same `createX402Fetch` instance; see README for details
- No real Solana payment support in this release — `@ag402/solana` provider is on the roadmap

---

## Roadmap

- `@ag402/solana` — real Solana USDC on-chain payment provider
- `SqliteWallet` — persistent wallet backed by SQLite
- TypeScript gateway/seller side
