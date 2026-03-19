# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2026-03-01

### Fixed

- Safe cache eviction with bounded cleanup to prevent full-table scans under load (#30)
- Atomic payment claim in PaymentGate plug to prevent double-settlement on concurrent requests (#30)
- SIWX ETSStorage read consistency — route `get` through GenServer to prevent revoked session reads (#31)
- Full-jitter exponential backoff in Facilitator.HTTP to prevent thundering herd on retries (#31)
- Base.decode64 padding safety in PaymentSignature and PaymentRequired (#31)


## [0.3.1] - 2026-02-25

### Fixed

- Fixed unbounded ETS cache growth vulnerability (DoS) — added `max_size` config with LRU eviction (#17)
- Fixed expired entries not being deleted during direct ETS reads (#25)
- Fixed `mix format` compliance across all files

### Added

- Comprehensive tests for `X402.Behaviour.implements?/2` with doctests (#28)
- Test coverage for facilitator hook exception and throw handling (#24)
- Optimized ETS cache with direct concurrent reads bypassing GenServer serialization (#25)

## [0.3.0] - 2026-02-17

### Added

- **SIWX (Sign-In-With-X)** — Repeat access without repayment (#14)
  - `X402.Extensions.SIWX` — CAIP-122 message construction and EIP-4361 (SIWE) format
  - `X402.Extensions.SIWX.Verifier` — behaviour for signature verification
  - `X402.Extensions.SIWX.Verifier.Default` — EVM signature verification via `ex_secp256k1`
  - `X402.Extensions.SIWX.Storage` — behaviour for access record persistence
  - `X402.Extensions.SIWX.ETSStorage` — default ETS adapter with TTL and periodic cleanup
  - `SIGN-IN-WITH-X` header encode/decode
- **"upto" Scheme** — Max-price bidding for flexible payments (#13)
  - `PaymentRequired` encode/decode for `"upto"` scheme with `maxPrice`
  - `PaymentSignature` validation: payment value ≤ maxPrice
  - Facilitator client support for upto verification with hooks
  - `PaymentGate` Plug route config supports upto scheme
- **Payment Identifier** — Idempotency extension (#12)
  - `X402.Extensions.PaymentIdentifier` — encode/decode payment IDs in payloads
  - `X402.Extensions.PaymentIdentifier.Cache` — behaviour for deduplication cache
  - `X402.Extensions.PaymentIdentifier.ETSCache` — default ETS adapter with TTL
- **Lifecycle Hooks** — Behaviour-based hooks for verify/settle (#10)
  - `before_verify/2`, `after_verify/2`, `before_settle/2`, `after_settle/2`
  - `on_verify_failure/2`, `on_settle_failure/2`
  - Context struct with request metadata, result, and error tracking

### Changed

- `ex_secp256k1` and `ex_keccak` are now optional dependencies (only needed for SIWX)
- ETS storage uses `:protected` access with direct reads bypassing GenServer for better concurrency

### Fixed

- Credo strict compliance: implicit `try`, redundant `with` clauses
- Dialyzer: unreachable pattern matches in PaymentIdentifier and SIWX Verifier

## [0.1.0] - 2026-02-14

### Added

- `X402.PaymentRequired` — encode/decode `PAYMENT-REQUIRED` headers (Base64 JSON)
- `X402.PaymentSignature` — decode/validate `PAYMENT-SIGNATURE` headers
- `X402.PaymentResponse` — encode `PAYMENT-RESPONSE` settlement headers
- `X402.Facilitator` — GenServer client for facilitator `/verify` and `/settle` endpoints
- `X402.Facilitator.HTTP` — HTTP transport with retry logic and telemetry
- `X402.Plug.PaymentGate` — drop-in Plug middleware for payment gating
- `X402.Wallet` — EVM and Solana wallet address validation
- Comprehensive test suite with >90% coverage
- Full ExDoc documentation with guides
