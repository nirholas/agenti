# CLAUDE.md — x402 Elixir SDK

## What This Is
The first Elixir SDK for the x402 HTTP payment protocol. A library (not an app) published to Hex.pm.

## Quality Standards (Dashbit-level)

Follow José Valim / Dashbit conventions strictly:

### Code Style
- **Flat module structure**: `X402.Wallet`, not `X402.Utils.Validators.Wallet`
- **Behaviours over config**: define `@callback` for extensibility, not app env
- **NimbleOptions** for all user-facing option validation
- **No GenServer unless necessary**: prefer pure functions, use GenServer only for stateful clients (Facilitator)
- **Pattern match > conditionals**: favor multi-clause functions over if/cond/case where possible
- **Typespecs on ALL public functions**: `@spec` is mandatory
- **@moduledoc on ALL public modules**: no module without documentation
- **@doc on ALL public functions**: with examples where helpful
- **Doctests**: every public function with a pure return value should have a doctest
- **No runtime dependencies on optional deps**: compile-time checks for optional dependencies like Finch

### Testing (>90% coverage target)
- **Unit tests for every module**: one test file per source file
- **Doctests enabled**: `doctest X402.ModuleName` in every test
- **Bypass for HTTP tests**: mock facilitator endpoints, never hit real services
- **Mox for behaviour mocking**: define `X402.Facilitator.HTTPBehaviour` and mock it
- **Property-based thinking**: test edge cases (empty strings, nil, malformed Base64, invalid JSON)
- **Test file naming**: `test/x402/module_name_test.exs` mirrors `lib/x402/module_name.ex`
- **No test helpers that hide assertions**: keep tests readable and self-contained
- **ExCoveralls**: must hit >90% line coverage

### Documentation
- **First paragraph of @moduledoc**: one-line summary (ExDoc uses it for sidebar)
- **@doc groups**: use `@doc group: "Headers"` etc. for organized API reference
- **Examples in docs**: real, runnable code examples
- **Since annotations**: `@doc since: "0.1.0"` on all functions
- **Guides**: getting-started.md and plug-integration.md in guides/

### Error Handling
- **{:ok, result} | {:error, reason}** for all fallible operations
- **No exceptions for expected failures**: only raise for programmer errors
- **Structured error tuples**: `{:error, :invalid_base64}` not `{:error, "bad base64"}`

### Dependencies
- **Minimal**: only Jason (required) and NimbleOptions (required)
- **Finch is optional**: users bring their own HTTP client
- **No Ecto, no Phoenix**: this is a standalone protocol library
- **Compile with --no-optional-deps**: must work without Finch installed

## Module Map

```
lib/x402.ex                    — Top-level module, convenience API
lib/x402/payment_required.ex   — PAYMENT-REQUIRED header encode/decode
lib/x402/payment_signature.ex  — PAYMENT-SIGNATURE header decode/validate
lib/x402/payment_response.ex   — PAYMENT-RESPONSE header encode
lib/x402/facilitator.ex        — Facilitator GenServer (verify/settle)
lib/x402/facilitator/http.ex   — HTTP transport for facilitator calls
lib/x402/plug/payment_gate.ex  — Plug middleware for payment gating
lib/x402/wallet.ex             — Wallet address validation (EVM + Solana)
lib/x402/telemetry.ex          — Telemetry event definitions
```

## x402 Protocol Reference

- Headers: PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE (all Base64-encoded JSON)
- Facilitator endpoints: POST /verify, POST /settle
- Supported schemes: "exact", "upto"
- Network format: CAIP-2 (e.g., "eip155:8453" for Base, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" for Solana)
- Docs: https://docs.x402.org
