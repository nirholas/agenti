# Security Policy

## Reporting a Vulnerability

Ag402 handles private keys and financial transactions. We take security extremely seriously.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **aethercore.dev@proton.me**

You should receive a response within 48 hours. If for some reason you do not, please follow up to ensure we received your original message.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Security Design

- **Seller-No-Key Architecture**: Sellers (API providers) **never need a private key**. They only configure a public receiving address (`AG402_RECEIVE_ADDRESS`). Ag402 verifies incoming payments on-chain using the buyer's signature — no seller signing required. This eliminates an entire class of key-management risks for providers.
- **Non-custodial**: Private keys never leave your machine. Only **buyers** (agents that pay for API calls) hold a private key, and it is used solely for signing payment transactions.
- **PBE Encryption**: PBKDF2-HMAC-SHA256 (480K iterations) + Fernet/AES for key-at-rest protection. Atomic file writes (tempfile + os.replace) prevent crash-induced corruption. Minimum 8-character password enforced.
- **6-Layer Budget Guard**: Single-TX cap, per-minute cap, daily cap, circuit breaker, auto-rollback, key filter. Budget check + deduction are serialized under asyncio.Lock to prevent TOCTOU race conditions.
- **Zero Telemetry**: No usage tracking, no IP logging, no analytics.
- **Replay Protection**: Timestamp + nonce validation on gateway side. Nonce length limit (128 chars) and cache-full flood rejection prevent abuse.
- **tx_hash Deduplication**: Atomic `INSERT OR IGNORE` in SQLite eliminates TOCTOU race conditions on concurrent requests.
- **Sender Verification**: On-chain payment verification validates that the claimed payer's token balance decreased, preventing stolen tx_hash attacks.
- **Production Mode Safety**: Gateway refuses to start without a real payment verifier when X402_MODE=production.
- **Protocol Input Validation**: Amount fields reject NaN, Infinity, zero, and negative values. Header serialization sanitizes CR/LF/quote to prevent HTTP response splitting.
- **SSRF Protection**: Forward Proxy blocks CONNECT tunnels to private/loopback/link-local/reserved IPs and restricts to standard web ports (80/443/8080/8443).
- **Header Whitelist**: Gateway proxy forwards only known-safe request headers; strips Cookie, X-Forwarded-For, Connection, etc.
- **Health Monitoring**: `GET /health` endpoint exposes gateway status, mode, uptime, and request/payment/error metrics.
- **Configurable Finality**: SolanaAdapter supports "confirmed" (fast) or "finalized" (safe) commitment levels for chain reorg protection. Returns `confirmation_status` ("confirmed" | "sent") in PaymentResult for clarity.
- **Localhost Detection**: Challenge validator uses `ipaddress` module for complete loopback/local address detection (IPv4, IPv6, 0.0.0.0).
- **Gateway Rate Limiting**: IP-based sliding-window rate limiter (configurable, default 60 req/min) returns HTTP 429 to prevent resource exhaustion.
- **RPC Retry + Failover**: SolanaAdapter automatically retries failed RPC calls with exponential backoff, then fails over to backup RPC endpoint (`SOLANA_RPC_BACKUP_URL`). Full failover coverage for `pay()`, `check_balance()`, and `verify_payment()`. Prevents single-point-of-failure on RPC outages.
- **Transaction Idempotency**: Unique `request_id` is embedded in every Solana transaction memo (`Ag402-v1|<request_id>`). Gateway-side `PersistentReplayGuard` deduplicates payment proofs by `tx_hash`, preventing replay attacks and double-counting.
- **Priority Fees**: Configurable `computeBudget` and `SetComputeUnitPrice` instructions ensure reliable transaction confirmation during Solana network congestion.

## V1 Security Audit Summary

A comprehensive security audit was performed on V1, identifying 24 issues across 4 severity levels:

| Severity | Found | Fixed | Status |
|----------|-------|-------|--------|
| **P0 — Critical** | 5 | 5 | All fixed |
| **P1 — High** | 7 | 7 | All fixed |
| **P2 — Medium** | 7 | 7 | All fixed |
| **P3 — Low** | 5 | 0 | Deferred to V2 |

Total: 447 tests passing (up from 316 pre-audit), 0 regressions.

## V1.3 Security TDD Audit (2026-02-24)

109 new security-focused TDD tests added across three priority tiers:

| Tier | Tests | Coverage |
|------|-------|----------|
| **P0** | 30 | SQL LIKE injection, negative/zero amount validation, encryption boundaries (key tamper/wrong password/memory wipe), circuit-breaker TOCTOU races |
| **P1** | 56 | Clock rollback attacks, replay guard edge cases, path traversal, protocol fuzzing (null byte/Unicode/oversized headers), monkey-patch concurrency, SSRF IPv6-mapped bypass |
| **P2** | 23 | Persistent replay guard, resource exhaustion, fault injection (corrupted DB/empty password), gateway 402 flow/rate limiting/header whitelist |

Source code fixes:
- **SQL LIKE wildcard injection**: Added `_escape_like()` to `AgentWallet` — escapes `%`, `_`, `\` before SQL `LIKE` clause
- **Negative/zero amount bypass**: `deposit()` and `deduct()` now reject `amount <= 0` with `ValueError`

Total: **500 tests** passing (391 existing + 109 new security TDD), 0 regressions.

## V1.6 Security Enhancements (2026-02-24)

- **Transaction idempotency (F3)**: `request_id` in memo + `PersistentReplayGuard` tx_hash deduplication on gateway
- **Priority fees (F4)**: Prevents transaction starvation during congestion
- **Full RPC failover (F5)**: All Solana operations (`pay`, `check_balance`, `verify_payment`) covered
- 9 concurrent payment tests validate race-condition safety
- 5 mainnet smoke tests for real-chain verification

Total: **562+ tests** passing, 0 regressions.

## V1.7 Bug Fixes (2026-02-26)

- **Docker serve binding**: Default host changed to `0.0.0.0` with `--host` CLI argument
- **aiosqlite event loop**: Single `asyncio.run()` + `uvicorn.Server` prevents event loop mismatch
- **Permission pre-check**: `PersistentReplayGuard.init_db()` validates directory write access
- **Doctor gateway checks**: Port availability, data dir writability, backend reachability
- 13 new tests for issue fixes

Total: **575+ tests** passing, 0 regressions.

## V1.8 Security Fixes (v0.1.13, 2026-03-08)

TDD-driven security hardening — 17 new tests written first (red), then code implemented (green):

| ID | Severity | Fix |
|----|----------|-----|
| S1-1 | High | Private key removed from `os.environ`; stored in module-level variable with getter |
| S1-2 | High | Mode-aware host binding: test→`127.0.0.1`, production→`0.0.0.0` |
| S1-3 | Medium | Strict mock payment verification: only `.pay()`-recorded tx_hashes accepted |
| S2-1 | Medium | `/health` endpoint returns minimal info in production (no target_url/metrics) |
| S2-2 | Medium | Temp directory permissions enforced (`0o700`) in CLI runner and base runner |
| B1 | Bug | `loop="asyncio"` for uvicorn across all entry points (macOS/Windows compatibility) |
| B2 | Bug | ATA error detection with friendly messages in `SolanaAdapter.pay()` |
| B3 | Bug | Improved ConfigError message with actionable guidance |

Total: **588 tests** passing, 0 regressions.

## V1.9 Security Fixes (v0.1.15, 2026-03-10)

Prepaid system hardening — buyer-side HMAC credential flow + gateway-side verifier:

| ID | Severity | Fix |
|----|----------|-----|
| P1 | Medium | `PrepaidVerifier`: `signature=null` / non-string input returns `invalid_signature` instead of crash |
| P2 | Medium | `/prepaid/purchase` endpoint now protected by `_rate_limiter` (was bypassed previously) |
| P3 | Low | DNS rebinding: `addr.is_link_local` added to `_is_private_address()` for Python 3.10 compat |
| P4 | Low | `ag402 prepaid buy` (production mode): explicit `[Y/n]` confirmation gate before irreversible on-chain broadcast |
| P5 | Low | `ag402 prepaid buy`: gateway-supplied price validated against `cfg.single_tx_limit` before broadcast |

Total: **775+ tests** passing, 0 regressions.

## Responsible Disclosure

We follow a responsible disclosure process. After a fix is available, we will:
1. Credit the reporter (unless they prefer anonymity)
2. Publish a security advisory on GitHub
3. Release a patched version
