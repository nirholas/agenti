# Architecture State -- V1 Release

## Project Summary

**Ag402** v0.1.0 -- Payment infrastructure for the AI Agent economy.
Powered by the Open402 standard.

Three-layer monorepo: `open402` (protocol) + `ag402-core` (engine) + `ag402-mcp` (gateway adapter).
398 tests passing. Lint clean (ruff). E2E demo working. Security audited (P0-P2 fixed). CI/CD configured.
Devnet tested (17 on-chain tests + 28 resilience tests + 4 devnet timing tests). Retry + failover integrated.

**V1 Focus**: 100% Python ecosystem support (generic Python agents via httpx/requests). Node.js/desktop integrations planned for V2.

## Latest Changes (CLI UX Overhaul)

### `ag402 serve` — Auto-starts built-in demo backend
- Added `_check_port_available()` to detect backend port availability
- If backend is not running, auto-starts a Starlette Demo API in background (returns JSON: service, message, path, params, price)
- Runs via `threading.Thread(daemon=True)` with uvicorn
- Custom request logging middleware replaces uvicorn default access logs (402→💰, 200→✓, 500→✗, with latency)
- After startup, shows "buyer view" hint: `ag402 pay <gateway_url>`

### `ag402 pay` — Full x402 negotiation visualization
- No longer uses middleware black box — manually executes each protocol step
- 6-step visual flow: ①Wallet setup → ②Send request (show 402) → ③Receive payment challenge (chain/token/amount/address) → ④Auto-pay (tx_hash) → ⑤Retry with proof (proof→200) → ⑥Settlement (elapsed time + balance change)
- Added `_print_response_body()` helper: JSON pretty-print (10-line truncation), HTML/text (6-line truncation)
- Uses `open402` library: `parse_www_authenticate`, `build_authorization`, `X402PaymentProof`

### CLI Output Polish
- All commands use numbered steps (①②③④⑤) with clear labels
- Colorized status codes, JSON pretty-printing
- Non-JSON responses truncated with ellipsis

## Three-Layer Architecture

```
+---------------------------------------------------+
|  ag402-mcp       HTTP gateway adapter           |
|  (adapters/mcp)     FastAPI reverse proxy + x402   |
+---------------------------------------------------+
|  ag402-core      Payment engine                 |
|  (core/)            Wallet, middleware, CLI,        |
|                     monkey-patch, proxy, runners    |
+---------------------------------------------------+
|  open402            Protocol standard              |
|  (protocol/)        Spec, headers, negotiation     |
|                     Zero dependencies              |
+---------------------------------------------------+
```

## Package Details

### Layer 1: open402 (`protocol/open402/`)
- **spec.py**: `X402PaymentChallenge`, `X402PaymentProof`, `X402ServiceDescriptor`, JSON Schema. Amount validation rejects NaN/Infinity/zero/negative. Header serialization sanitizes CR/LF/quote to prevent injection.
- **headers.py**: Parse/build `WWW-Authenticate: x402` and `Authorization: x402`. Extension headers (X-Service-Hash, X-Agent-ID) parsed and passed through
- **negotiation.py**: `Accept-x402-Version` negotiation with graceful degradation
- **Zero dependencies** -- pure Python protocol types

### Layer 2: ag402-core (`core/ag402_core/`)

#### Config (`config.py`)
- Frozen `X402Config` dataclass
- **Auto-loads `~/.ag402/.env`** on startup (zero-config for users)
- All budget limits configurable via environment variables with hard ceilings:
  - `X402_DAILY_LIMIT` (default $10, ceiling $1000)
  - `X402_PER_MINUTE_LIMIT` (default $2, ceiling $10)
  - `X402_PER_MINUTE_COUNT` (default 5, ceiling 50)
  - `X402_CIRCUIT_BREAKER_THRESHOLD` (default 3, ceiling 20)
  - `X402_CIRCUIT_BREAKER_COOLDOWN` (default 60s, ceiling 3600s)
- `RunMode` enum: PRODUCTION / TEST
- **Default mode changed to TEST** (v0.1.0) -- zero-config developer onboarding
- PBE wallet encryption support via `AG402_UNLOCK_PASSWORD`

#### Env Manager (`env_manager.py`)
- Zero-dependency `.env` file parser (handles quotes, equals in values, inline comments)
- Robust: unparseable lines logged as warnings, never crashes
- `load_dotenv()` / `save_env_file()` / `set_env_value()` / `parse_env_file()`
- 30 unit tests covering edge cases

#### Setup Wizard (`setup_wizard.py`)
- Interactive terminal UI for first-time setup
- **Role selection**: consumer (buy API) / provider (sell API) / both
- **Full encryption flow even in test mode** (security perception)
- Generates `~/.ag402/.env` and `~/.ag402/wallet.key`
- Auto-deposits test funds after setup

#### Monkey-Patch (`monkey.py`)
- `ag402_core.enable()` / `disable()` / `enabled()` context manager
- Patches `httpx.AsyncClient.send` and `requests.Session.send`
- **Non-402 responses pass through completely untouched** (no exception swallowing)
- Original exception stacks preserved exactly
- Handles existing event loops via ThreadPoolExecutor + asyncio.run()
- 11 unit tests

#### Forward Proxy (`proxy/forward_proxy.py`)
- HTTP forward proxy on `127.0.0.1:14020`
- Intercepts 402 → auto-pay → retry with proof
- HTTPS CONNECT tunnels passed through as-is (no MITM)
- **SSRF protection**: Blocks CONNECT to private/loopback/link-local/reserved IPs; restricts to ports 80/443/8080/8443
- Used by `ag402 run` for HTTP-level interception
- **Note**: HTTPS auto-pay requires Python SDK injection (`ag402.enable()`), proxy mode only handles HTTP

#### Agent Runners (`runners/`)
- **base.py**: `AgentRunner` — launches child process with env injection
  - `sitecustomize.py` + `PYTHONPATH` injection for Python processes (works for scripts AND interactive shells)
  - `HTTP_PROXY` for HTTP traffic

#### Friendly Errors (`friendly_errors.py`)
- Wraps CLI with human-readable error messages
- Pattern-matched errors → "what went wrong" + "what to do next"
- Raw tracebacks only shown with `AG402_DEBUG=1`

#### Wallet (`wallet/`)
- **agent_wallet.py**: SQLite (WAL mode + 10s timeout) + asyncio.Lock. deposit/deduct/rollback/get_balance/get_daily_spend
- **models.py**: Transaction dataclass
- **faucet.py**: X402_MODE=test auto-deposits 100 virtual USD
- **payment_order.py**: `PaymentOrder` + `PaymentOrderStore` + `OrderState` 6-state machine (CREATED → LOCAL_DEDUCTED → CHAIN_BROADCASTED → DELIVERING → SUCCESS / REFUNDED). Strict uni-directional transitions with SQLite persistence.

#### Payment (`payment/`)
- **base.py**: `BasePaymentProvider` ABC + `PaymentResult` dataclass. `verify_payment()` supports `expected_sender` to prevent third-party tx_hash reuse. `confirmation_status` field distinguishes "confirmed" vs "sent" (confirmation timed out).
- **registry.py**: `PaymentProviderRegistry` — lazy-loading provider resolution (auto/mock/solana/stripe-v2). Passes `rpc_backup_url` from config to SolanaAdapter.
- **solana_adapter.py**: `SolanaAdapter` (real) + `MockSolanaAdapter` (test). Configurable `confirmation_level` ("confirmed"/"finalized") for chain reorg protection. Uses `round()` for lamport conversion to avoid float precision errors. **Retry + Failover**: RPC calls (`get_latest_blockhash`, `send_transaction`) are wrapped with `retry_with_backoff` (exponential backoff, configurable `max_rpc_retries`). On retry exhaustion, auto-failovers to `rpc_backup_url` via `MultiEndpointClient`. Returns `confirmation_status` ("confirmed" | "sent") in `PaymentResult`.
- **retry.py**: `retry_with_backoff()` — async retry with exponential backoff (configurable max_retries, base_delay, max_delay). `MultiEndpointClient` — multi-RPC endpoint manager with sequential failover and primary reset. Both integrated into `SolanaAdapter` for production use.

#### Prepaid (`prepaid/`) — NEW in P0-1, seller-side in P0-2
- **models.py**: `PrepaidCredential` dataclass. 5 package tiers (Starter 100c/3d → Enterprise 10k c/730d). UTC-aware datetimes with `_utc()` backward-compat helper. HMAC-SHA256 signature covers `buyer|package|expires_at` (excludes `remaining_calls` — decrements locally)
- **client.py**: Buyer-side JSON store at `~/.ag402/prepaid_credentials.json`. Atomic write via `tempfile+os.replace()`. All `from_dict()` calls catch `(KeyError, ValueError, TypeError)` for corrupt-entry resilience. `rollback_call()` capped at original package limit to prevent reject-loop inflation
- **verifier.py** (NEW in P0-2): Stateless `PrepaidVerifier` for seller/gateway side. 5-step: parse → seller_address match → expiry → remaining_calls > 0 → HMAC. `hmac.compare_digest()` for constant-time comparison. `remaining_calls` excluded from HMAC (buyer manages locally)
- Prepaid fast-path in `x402_middleware._try_prepaid()`: 1ms local verify vs 500ms+ on-chain. `check_and_deduct` + `rollback_call` both under `_payment_lock` (TOCTOU + concurrent-rollback safe). 429/5xx upstream → rollback (buyer gets service or refund)

#### Middleware (`middleware/`)
- **x402_middleware.py**: Core loop: Intercept 402 -> parse -> budget -> **prepaid fast-path** -> deduct -> pay -> retry -> rollback. **Prepaid path** (`_try_prepaid`): check local credential under lock → attach `X-Prepaid-Credential` header → on seller rejection or network error, rollback under lock and fall through to on-chain. Dual-mode fallback (non-x402 402 -> Bearer API key). Replay header injection. Integrated PaymentOrder state machine for payment lifecycle tracking (CREATED → LOCAL_DEDUCTED → CHAIN_BROADCASTED → DELIVERING → SUCCESS/REFUNDED). Point-of-no-return semantics: after chain broadcast, local deductions are never rolled back. **Budget-deduct lock**: asyncio.Lock serializes budget check + deduct to prevent TOCTOU race.
- **budget_guard.py**: Single-tx limit + per-minute limit + daily limit + circuit breaker + balance check. All configurable via env with hard ceilings.

#### Security (`security/`)
- **key_guard.py**: `PrivateKeyFilter` logging filter + `install_key_guard()`
- **wallet_encryption.py**: PBE encryption (PBKDF2-HMAC-SHA256 + Fernet/AES). Encrypt/decrypt private keys with user password. Docker support via env var. **Atomic file write** via tempfile + os.replace() to prevent crash-induced corruption.
- **rate_limiter.py**: In-memory sliding-window rate limiter
- **replay_guard.py**: `ReplayGuard` (timestamp + nonce validation, OrderedDict cache with pruning, nonce length limit, cache-full flood protection) + `PersistentReplayGuard` (SQLite-backed tx_hash deduplication with atomic INSERT OR IGNORE, lazy init with `_ensure_db()` on all public methods including `prune()`) + `generate_replay_headers()`
- **challenge_validator.py**: Pre-payment challenge validation (URL, amount, address, token, trust). Uses `ipaddress` module for complete loopback detection (IPv4/IPv6/0.0.0.0).

#### Gateway (`gateway/`)
- **auth.py**: `PaymentVerifier` for server-side proof validation

#### CLI (`cli.py`)
- **19 commands**: `setup`, `init`, `run`, `env`, `serve`, `pay`, `prepaid`, `upgrade`, `help`, `status`, `balance`, `history`, `tx`, `config`, `info`, `doctor`, `demo`, `export`, `mcp`, `mcp-config`, `install`
- **Prepaid management** (NEW in P0-3): `ag402 prepaid status` / `ag402 prepaid purge` / `ag402 prepaid buy <gateway_url> <package_id>`
- **Interactive setup wizard**: `ag402 setup` (role selection + encryption + budget)
- **Agent integration**: `ag402 run -- python agent.py`
- **Config management**: `ag402 env show/set`
- **Provider mode**: `ag402 serve` (auto-starts built-in demo backend + custom request logging, `--host 0.0.0.0` for Docker)
- **Buyer mode**: `ag402 pay <url>` (6-step x402 negotiation visualization)
- **Production migration**: `ag402 upgrade`
- **Beautiful help**: `ag402 help` (categorized with usage hints)
- **Friendly errors**: human-readable messages with "next step" guidance
- **Colorized output**: ANSI colors with auto-detection, progress bars, dashboard layout
- **Cross-platform**: macOS, Linux, Windows (respects `NO_COLOR` / `FORCE_COLOR`)

### Layer 3: ag402-mcp (`adapters/mcp/ag402_mcp/`)
- **gateway.py**: HTTP gateway adapter with CLI entry point (`ag402-gateway`)
- Wraps any API with x402 payment verification
- **Prepaid fast-path** (NEW in P0-2): `X-Prepaid-Credential` header processed before on-chain auth. Valid credential → proxy immediately (1ms). Invalid/expired/depleted → 402 with standard x402 challenge so buyer falls back to on-chain. Enabled via `--prepaid-signing-key` CLI arg or `AG402_PREPAID_SIGNING_KEY` env var
- **Prepaid purchase endpoints** (NEW in P0-3): `GET /prepaid/packages` (public, 5 tiers) + `POST /prepaid/purchase` (verify tx_hash → issue signed credential JSON). `tx_hash` validated `[A-Za-z0-9_-]{1,128}` (header injection prevention). Credential returned to buyer, not stored on seller.
- **Production mode safety**: Refuses to start without real verifier when `X402_MODE=production`; prominent test mode warning banner
- **GET /health endpoint**: Returns JSON with status, mode, uptime, and metrics counters (requests_total, payments_verified, payments_rejected, replays_rejected, challenges_issued, proxy_errors, prepaid_verified, prepaid_rejected)
- **Header whitelist**: Only forwards known-safe headers (accept, content-type, user-agent, etc.) to upstream; blocks Cookie, X-Forwarded-For, Connection
- **tx_hash deduplication**: Atomic `INSERT OR IGNORE` in persistent SQLite-backed `PersistentReplayGuard` (survives restarts). Eliminates TOCTOU race in concurrent requests.
- **Shared httpx client**: Created/closed via lifespan, with fallback per-request client for non-lifespan usage

## Developer Experience (DX) Flow

```
pip install ag402-core
    ↓
ag402 setup          ← Interactive wizard (role/mode/encryption/limits)
    ↓
ag402 demo           ← Live demo
    ↓
ag402 run -- python my_agent.py  ← Integrate your agent
    ↓
ag402 upgrade        ← Test → production migration
```

**No need to**: read more than 10 lines of README, edit config files, or manually set environment variables.

## V1 Compatibility Matrix

| Agent Framework | Compatibility | Method |
|----------------|---------------|--------|
| Generic Python Agent | ★★★★★ | `ag402 run -- python xxx` |
| Python SDK | ★★★★★ | `ag402_core.enable()` — two lines |
| LangChain / AutoGen / CrewAI | ★★★★★ | httpx/requests based, auto-compatible |

## Key Design Decisions

1. **Three-layer monorepo**: Protocol (zero deps) -> Engine -> Adapters
2. **x402 Compatible**: Standard Coinbase x402 fields + extension headers (X-Service-Hash, X-Agent-ID)
3. **Frozen Config**: Immutable after startup
4. **Hard ceilings**: All env-configurable limits have hardcoded upper bounds for safety
5. **Adapter pattern**: BasePaymentProvider -> Solana now, Stripe/Coinbase/Lightning later
6. **Lazy loading**: Heavy deps (solana-py) only imported when needed
7. **Auto-rollback**: Payment or retry failure -> wallet deduction reversed
8. **Sub-wallet only**: Auto-generated, never import main wallet
9. **Replay defense**: Timestamp window + nonce uniqueness (server-side opt-in)
10. **Dual-mode**: x402 payment OR Bearer API key fallback for non-x402 services
11. **Test-first default**: New installs default to TEST mode for safe experimentation
12. **PBE encryption**: Private keys encrypted at rest with PBKDF2 + AES
13. **Monkey-patch transparency**: Non-402 responses pass through untouched, original exceptions preserved. Stream-safe: never reads body of non-402 responses
14. **.env zero-dependency**: Custom parser (no python-dotenv), graceful on malformed lines
15. **Test mode = full encryption**: Even test mode walks through encryption flow for security perception
16. **V1 Python-only focus**: 100% Python ecosystem, Node.js/desktop planned for V2
17. **sitecustomize injection**: Replaced PYTHONSTARTUP (interactive-only) with sitecustomize.py + PYTHONPATH for reliable script injection
18. **tx_hash anti-replay**: Gateway tracks consumed tx_hashes via OrderedDict with FIFO eviction to prevent payment replay attacks
19. **SQLite WAL mode**: Wallet DB uses WAL journal mode + busy_timeout for multi-process safety
20. **Thread-safe circuit breaker**: BudgetGuard uses threading.Lock for class-level state
21. **serve auto-backend**: `ag402 serve` auto-starts a built-in Starlette demo API if no backend is running on the target port
22. **pay 6-step visualization**: `ag402 pay` manually executes each x402 protocol step with numbered output, replacing middleware black-box
23. **Custom request logging**: `serve` uses middleware-based request logging (402💰/200✓/500✗ + latency), suppressing uvicorn default access logs
24. **PaymentProviderRegistry**: Dynamic provider resolution based on config mode — eliminates hardcoded adapter selection
25. **PaymentOrder state machine**: Strict 6-state lifecycle (CREATED → LOCAL_DEDUCTED → CHAIN_BROADCASTED → DELIVERING → SUCCESS/REFUNDED). Point-of-no-return after chain broadcast ensures local deductions are never incorrectly rolled back.
26. **PersistentReplayGuard**: SQLite-backed tx_hash deduplication that survives process restarts. Lazy init (`_ensure_db()`) on all public methods (including `prune()`). Demo cleanup closes persistent guard to prevent orphaned aiosqlite threads.
27. **RPC Retry + Failover**: `SolanaAdapter` wraps critical RPC calls (`get_latest_blockhash`, `send_transaction`) with `retry_with_backoff` (exponential backoff). On retry exhaustion, auto-failovers to backup RPC via `MultiEndpointClient`. Resets to primary after successful send.
28. **confirmation_status in PaymentResult**: `"confirmed"` = confirmed at requested level, `"sent"` = tx sent but confirmation timed out (may still succeed on-chain). Eliminates ambiguity when `success=True` but confirmation was incomplete.

## V1 Security Audit (Completed)

Full security audit performed. All P0 (critical) and P1 (high) issues fixed. All P2 (medium) issues fixed. P3 (low) items deferred to V2.

### P0 Fixes (Critical — production blockers)

| ID | Issue | Fix | File |
|----|-------|-----|------|
| P0-1.1 | verify_payment() missing sender check — stolen tx_hash attack | Added `expected_sender` param; `_verify_sender()` checks pre_token_balance decrease | `solana_adapter.py`, `base.py`, `auth.py` |
| P0-1.2 | Gateway defaults to test mode (no chain verification) | Production mode raises ValueError without verifier; prominent test mode warning | `gateway.py` |
| P0-1.3 | tx_hash dedup TOCTOU race — concurrent double-spend | Atomic `INSERT OR IGNORE` + `rowcount` check | `replay_guard.py` |
| P0-1.4 | Forward Proxy CONNECT tunnel — unrestricted SSRF | Block private/loopback/link-local IPs; restrict to ports 80/443/8080/8443 | `forward_proxy.py` |
| P0-1.5 | `int(amount * 1e6)` float truncation | `round(amount * 1_000_000)` | `solana_adapter.py` |

### P1 Fixes (High — pre-launch required)

| ID | Issue | Fix | File |
|----|-------|-----|------|
| P1-2.1 | amount_float accepts NaN/Infinity | Validates with `math.isnan`/`math.isinf`, rejects zero/negative | `spec.py` |
| P1-2.2 | Header injection via CR/LF in challenge fields | `_HEADER_UNSAFE_RE` sanitization in `to_header_value()` | `spec.py` |
| P1-2.3 | No password strength enforcement for wallet encryption | Minimum 8-character password enforced in `encrypt_private_key()` | `wallet_encryption.py` |
| P1-2.4 | Wallet file non-atomic write — crash corruption | `tempfile.mkstemp()` + `os.replace()` | `wallet_encryption.py` |
| P1-2.5 | Budget check → deduct TOCTOU | `asyncio.Lock` serializes budget_check + deduct | `x402_middleware.py` |
| P1-2.6 | No health check endpoint | `GET /health` + metrics counters | `gateway.py` |
| P1-2.7 | No request rate limiting on Gateway | IP-based sliding-window rate limiter (default 60 req/min), returns HTTP 429 | `gateway.py` |

### P2 Fixes (Medium — V1.1)

| ID | Issue | Fix | File |
|----|-------|-----|------|
| P2-3.1 | Only "confirmed" commitment — reorg risk | Configurable `confirmation_level` param ("confirmed"/"finalized") | `solana_adapter.py` |
| P2-3.3 | Nonce cache flooding / oversized nonces | `_MAX_NONCE_LENGTH=128` + cache-full rejection after prune | `replay_guard.py` |
| P2-3.4 | Gateway forwards all headers (Cookie, X-Forwarded-For) | Whitelist-only forwarding (accept, content-type, user-agent, etc.) | `gateway.py` |
| P2-3.5 | localhost check misses ::1, 0.0.0.0, 127.x.x.x range | `_is_local_address()` via `ipaddress` module | `challenge_validator.py` |
| P2-3.6 | No health check or observability | `GET /health` + metrics counters (requests, verified, rejected, errors) | `gateway.py` |
| P2-3.7 | Forward Proxy zero test coverage | 39 tests: SSRF, ports, lifecycle, nonce flood, headers, health, localhost | `test_v1_p2_security_fixes.py` |

### P3 Items (Low — deferred to V2)

- Dependency version pinning (`>=` → `==` + lockfile)
- Docker secrets / vault for password management
- Key Guard for base64/hex-encoded private keys
- `bytearray` instead of `str` for in-memory private keys
- MockSolanaAdapter negative balance protection

## Test Coverage

| Package | Tests | Coverage | Status |
|---------|-------|----------|--------|
| open402 (spec, headers, negotiation) | 27 | 100% | PASS |
| ag402-core: wallet | 10 | 96% | PASS |
| ag402-core: payment + registry | 18 | 94%+ | PASS |
| ag402-core: middleware + stateful | 16 | 97% | PASS |
| ag402-core: gateway | 3 | 88% | PASS |
| ag402-core: security (replay, key_guard, rate_limiter) | 62 | 98%+ | PASS |
| ag402-core: payment_order (state machine) | 20 | 98% | PASS |
| ag402-core: CLI (enhanced) | 61 | 75% | PASS |
| ag402-core: env_manager | 30 | 98% | PASS |
| ag402-core: monkey-patch | 11 | 90% | PASS |
| ag402-core: budget_enhanced | 12 | 95% | PASS |
| ag402-core: decimal_precision | 4 | 100% | PASS |
| ag402-core: phase4 (integration) | 22 | 90% | PASS |
| ag402-core: solana_enhanced | 10 | 94% | PASS |
| ag402-core: solana_resilience (mock) | 28 | 96% | PASS |
| ag402-core: devnet on-chain | 17 | -- | PASS |
| ag402-core: devnet resilience + timing | 4 | -- | PASS |
| ag402-core: payment_verifier_amounts | 5 | 95% | PASS |
| ag402-core: v1 security audit (P0/P1) | 40 | 98% | PASS |
| ag402-core: v1 security audit (P2) | 39 | 96% | PASS |
| ag402-mcp: adapter tests | 5 | -- | PASS |
| **Total** | **447** | **92%+** | **ALL PASS** |
