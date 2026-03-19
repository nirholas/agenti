# AGENTS.md — x402 Elixir SDK

## What This Is
The Elixir SDK for the x402 HTTP payment protocol — published on Hex.pm. A **library**, not an app. Zero-lock-in: works with any facilitator, chain, or framework.

## Quick Context
- **Language:** Elixir (OTP)
- **Published:** Hex.pm (`x402 ~> 0.3`)
- **CI:** GitHub Actions → `mix test --cover`
- **Docs:** Generated via ExDoc, hosted on hexdocs.pm

## Module Map
```
lib/x402.ex                    — Top-level convenience API
lib/x402/payment_required.ex   — PAYMENT-REQUIRED header encode/decode
lib/x402/payment_signature.ex  — PAYMENT-SIGNATURE header decode/validate
lib/x402/payment_response.ex   — PAYMENT-RESPONSE header encode
lib/x402/facilitator.ex        — Facilitator GenServer (verify/settle)
lib/x402/facilitator/http.ex   — HTTP transport layer
lib/x402/plug/payment_gate.ex  — Plug middleware for Phoenix/Plug apps
lib/x402/wallet.ex             — EVM + Solana address validation
lib/x402/telemetry.ex          — Telemetry event definitions
```

## Key Commands
```bash
mix test                   # Run test suite
mix test --cover           # With coverage (target >90%)
mix dialyzer               # Type checking
mix docs                   # Generate ExDoc
MIX_ENV=test mix coveralls # ExCoveralls report
mix compile --no-optional-deps  # Must compile without Finch
```

## Code Standards (Dashbit-level)
- `@spec` on ALL public functions — no exceptions
- `@moduledoc` on ALL public modules
- `@doc` on ALL public functions, with doctests for pure return values
- `{:ok, result} | {:error, atom}` — never raise for expected failures
- Flat module naming: `X402.Wallet` not `X402.Utils.Validators.Wallet`
- Behaviours for extensibility (`@callback`), not app env config
- No GenServer unless stateful (only Facilitator uses it)

## Testing Rules
- Unit test per source file: `test/x402/foo_test.exs` ↔ `lib/x402/foo.ex`
- `doctest X402.ModuleName` in every test file
- Mox for behaviour mocking (`X402.Facilitator.HTTPBehaviour`)
- Bypass for HTTP tests — never hit real services
- >90% line coverage required

## Protocol Reference
- Headers: `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` (all Base64-encoded JSON)
- Facilitator endpoints: `POST /verify`, `POST /settle`
- Network format: CAIP-2 (e.g., `"eip155:8453"` for Base)
- Schemes: `"exact"`, `"upto"`
- Spec: https://docs.x402.org

## What NOT To Do
- Don't add Ecto, Phoenix, or other heavy deps
- Don't make Finch required — it's optional
- Don't raise for expected failures (bad base64, invalid address, etc.)
- Don't add runtime deps on optional libraries
