# Ag402 Top 10 Priority Issues

> Generated: 2026-03-09 | Status: Active

## Issue Tracking

| # | Issue | Category | Priority | Difficulty | Status |
|---|-------|----------|----------|------------|--------|
| 1 | Private key memory safety | Security | Critical | High | **FIXED** |
| 2 | Monkey patch fragility | Architecture | Critical | High | **FIXED** |
| 3 | E2E test coverage gaps | Quality | High | Medium | **WONTFIX** |
| 4 | CI/CD workflow duplication | Engineering | High | Low | **FIXED** |
| 5 | Weak password policy & crypto params | Security | High | Medium | **FIXED** |
| 6 | RPC failover & resource management | Reliability | High | Medium | **FIXED** |
| 7 | Overly broad exception handling | DX | Medium | Medium | **FIXED** |
| 8 | Incomplete demo/FTUE experience | UX | Medium | Low | **WONTFIX** |
| 9 | Multi-package version coordination | Engineering | Medium | Medium | **WONTFIX** |
| 10 | Seller gateway lacks production ops | Ops | Medium | Medium | **WONTFIX** |

---

## #1 Private Key Memory Safety (Critical)

**Problem**: Python `str` is immutable — `wipe_from_memory()` / `del value` cannot truly clear private keys from memory. `solana_adapter.py` itself warns "Consider using HSM in production". Passwords passed via `AG402_UNLOCK_PASSWORD` env var are readable from `/proc`.

**Affected files**:
- `core/ag402_core/security/wallet_encryption.py` — password/key handling
- `core/ag402_core/payment/solana_adapter.py` — keypair lifecycle
- `core/ag402_core/monkey.py` — wallet init

**Fix approach**:
- Convert private key handling from `str` to `bytearray` (mutable, can be zeroed)
- Implement real memory wiping via `ctypes.memset` on bytearray buffers
- Add `SecureBytes` context manager for scoped key lifetime
- Remove ineffective `wipe_from_memory` for str, replace with real implementation
- Keep backward compatibility, don't break existing API surface

**Verification**: Unit tests confirming bytearray is zeroed after use.

---

## #2 Monkey Patch Fragility (Critical)

**Problem**: Global patching of `httpx`/`requests` internals. Sync/async bridging risks deadlocks. No conflict detection.

---

## #3 E2E Test Coverage Gaps (High)

**Problem**: Localnet/devnet tests only run nightly/manually. Mock adapter had prior forgery vulnerability (S1-3).

---

## #4 CI/CD Workflow Duplication (High)

**Problem**: `security.yml` duplicates `trivy.yml`, `semgrep.yml`, `pip-audit.yml`.

---

## #5 Weak Password Policy & Crypto Params (High)

**Problem**: 8-char minimum, no complexity check. 16-byte salt (should be 32). Fernet = AES-128-CBC (should be AES-256-GCM).

---

## #6 RPC Failover & Resource Management (High)

**Problem**: Old AsyncClient not closed on reconnect. Single failover attempt. No connection pooling.

---

## #7 Overly Broad Exception Handling (Medium)

**Problem**: `except Exception` everywhere. Generic error messages. No structured error hierarchy.

---

## #8 Incomplete Demo/FTUE Experience (Medium)

**Problem**: `ag402 demo` not fully implemented as CLI command. README has TODO for terminal GIF.

---

## #9 Multi-Package Version Coordination (Medium)

**Problem**: 4 independent packages with no version sync mechanism. No cross-package compatibility matrix.

---

## #10 Seller Gateway Lacks Production Ops (Medium)

**Problem**: No /healthz, no metrics, no structured logging, no graceful shutdown, no TLS guidance.

---

## Change Log

| Date | Issue | Action | Details |
|------|-------|--------|---------|
| 2026-03-09 | — | Created | Initial issue list from full project audit |
| 2026-03-09 | #1 | **FIXED** | Private key memory safety — bytearray + secure_zero(ctypes.memset), 14 tests, 0 regressions |
| 2026-03-10 | #7 | **FIXED** | Exception handling — added exc_info traceback to pay()/verify_payment() catch-all blocks, added missing logger.error to pay() catch-all |
| 2026-03-10 | #8 | **WONTFIX** | Demo/FTUE — `ag402 demo` already fully implemented (mock/localnet/devnet), only README terminal GIF missing (needs manual recording) |
| 2026-03-10 | #9 | **WONTFIX** | Version coordination — core 4 packages already synced at 0.1.14, publish.yml correctly orchestrated, current scale doesn't need automated tooling |
| 2026-03-10 | #10 | **WONTFIX** | Gateway ops — already has /health + graceful shutdown + Docker + in-memory metrics; Prometheus/structured logging are 1.0-level requirements |
