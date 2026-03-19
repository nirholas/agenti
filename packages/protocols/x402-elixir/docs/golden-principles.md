# Golden Principles — x402 Elixir SDK

> These are non-negotiable. Every PR is judged against them.

## 1. Zero Lock-In
The library never forces a specific facilitator, chain, HTTP client, or framework. Users bring their own `Finch` process. Any facilitator URL is accepted. Any CAIP-2 network is valid.

**Violation:** Hardcoding Coinbase's facilitator URL. Requiring a specific HTTP client at compile time.

## 2. Typespecs Are Not Optional
Every public function has `@spec`. Every public module has `@moduledoc`. Every public function has `@doc`. Dialyzer must pass with zero warnings.

**Violation:** Merging a new public function without `@spec` and `@doc`.

## 3. Structured Errors, Never Strings
`{:error, :invalid_base64}` — always atoms, never string messages. No exceptions for expected failures (bad input, network error, invalid payment). Only raise for programmer errors.

**Violation:** `{:error, "invalid base64 encoding"}` or `raise "payment failed"` in a public function.

## 4. Minimal Dependencies
Required deps: only `jason` and `nimble_options`. Everything else is optional. The library must compile and work without `finch`, `ex_secp256k1`, or `ex_keccak` installed.

**Violation:** Adding a new required dependency without explicit discussion and justification.

## 5. Flat Module Hierarchy
`X402.Wallet`, not `X402.Utils.Validators.WalletHelper`. One level of nesting maximum except for `X402.Plug.*` and `X402.Facilitator.*` sub-namespaces.

**Violation:** Creating `X402.Internal.Helpers.Parser` or any 3+ level nesting.

## 6. Tests Mirror Source
Every `lib/x402/foo.ex` has `test/x402/foo_test.exs`. Test file structure mirrors source structure. No orphan test files. No untested source files.

**Violation:** Adding a new module without a corresponding test file.

## 7. Doctests Are Executable Documentation
Pure functions get doctests. They must be real, runnable examples. No `iex> # ...` placeholders. Doctests run in CI.

**Violation:** Merging a pure function without a working doctest.

## 8. Behaviours Over App Config
Extensibility is via `@behaviour` and callback injection, not `Application.get_env/3`. This keeps the library testable, composable, and free of global state.

**Violation:** Using `Application.get_env` for user-configurable logic that should be a behaviour callback.

## 9. No HTTP in Unit Tests
Unit tests use Bypass or Mox. Real HTTP calls are forbidden in test suite. CI never touches the live facilitator or any external service.

**Violation:** A test that makes a real `POST /verify` request to `x402-facilitator-app.fly.dev`.

## 10. Coverage Never Goes Below 90%
If a PR drops coverage below 90%, it is not merged. Period. Coverage is a floor, not a vanity metric.

**Violation:** Merging a PR with coverage at 88% "because it's close enough".
