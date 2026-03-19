# Gasless TONAPI Relay

Align x402-ton's gasless broadcast with the Coinbase PR #1455 TON exact scheme spec by replacing the self-relay model with TONAPI `/v2/gasless/send`.

## Success Criteria

- USDT payments broadcast via TONAPI gasless relay (no facilitator TON spent)
- Native TON payments continue to use direct `sendFile` broadcast
- Client auto-detects gasless vs direct based on asset type
- Facilitator detects authType from BOC opcode (no `gasless` boolean in payload)
- Self-relay preserved as fallback when TONAPI is unavailable
- `relayAddress` in `/supported` = TONAPI relay address (from `/v2/gasless/config`)
- Commission amount discovered via `/v2/gasless/estimate` at server boot
- 100% alignment with PR #1455 spec
- USDT mainnet address matches PR #1455: `0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe`
- Circuit breaker prevents self-relay drain (budget cap + consecutive failure threshold)
- Relay address validated against allowlist at boot

## Scope

### IN scope (v1)
- TONAPI broadcast for USDT gasless payments
- Auto-detection of authType from BOC opcode
- Remove `gasless?: boolean` from `ExactTonPayload`
- TONAPI relay address + commission discovery at server boot
- Self-relay fallback
- signedBoc always wrapped in external message (even for gasless)
- Tests for all new paths
- Fix USDT mainnet address in constants.ts (wrong: `...436021ff`, correct: `...c3621dfe`)
- Circuit breaker for self-relay fallback (budget cap + consecutive failure threshold)
- TONAPI relay address validation (allowlist)
- Commission absolute upper bound (hardcoded safety cap)
- TONAPI request timeout (AbortController)
- x402Version validation

### OUT of scope
- Gasless for native TON (no use case — payer has TON)
- Multiple relay service support (registry)
- Gasless swap (`gasless-swap` protocol)
- TONAPI SDK dependency (raw HTTP calls)

## Boundaries

### ALWAYS
- Detect authType from opcode in BOC, never from a payload boolean
- signedBoc = external message BOC (base64), regardless of authType
- Hex-encode BOC when calling TONAPI (`Cell.toBoc().toString('hex')`)
- Verify signature before any broadcast attempt
- Log BOC hash (SHA-256), never raw BOC
- Validate TONAPI relay_address against allowlist before exposing in /supported
- Cap commission at absolute maximum (e.g., 10 USDT = 10_000_000 atomic units)
- Use AbortController timeout on all TONAPI HTTP calls

### NEVER
- Add `gasless` field to ExactTonPayload (not in PR #1455 spec)
- Use float math for commission amounts
- Trust TONAPI response without validating our own checks first
- Broadcast without re-running full verification (settle must re-verify)
- Accept TONAPI relay_address without allowlist validation
- Allow unlimited self-relay fallback without circuit breaker

### ASK FIRST
- Changing TONAPI API key configuration
- Modifying settlement timeout values
- Adding new error codes

## Native TON Support

PR #1455 describes a Jetton-only scheme (`internal_signed` authType). x402-ton supports both Jetton (gasless via TONAPI) and native TON (direct `sendFile` broadcast). This is a **documented superset**, not a divergence from the spec. Native TON payers already hold TON for gas, so the gasless path is irrelevant for them; only the USDT/Jetton path requires TONAPI relay.

## Files

- [requirements.md](requirements.md) — Problem, goals, acceptance criteria
- [research.md](research.md) — TONAPI API research + best practices
- [architecture.md](architecture.md) — System design, affected files, Mermaid diagrams
- [decisions.md](decisions.md) — Key decisions with rationale
- [context.md](context.md) — Handoff document for implementation session
