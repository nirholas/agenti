# Quality Status — x402 Elixir SDK

> Last updated: 2026-02-25

## Current Grades

| Area | Grade | Notes |
|------|-------|-------|
| Tests | A- | >89% line coverage (ExCoveralls), doctests on all pure functions |
| Architecture | A | Flat modules, behaviours, minimal deps — Dashbit-level |
| Docs | A | hexdocs published, @moduledoc + @doc + @spec on all publics |
| Type Safety | A | Dialyzer-clean, full typespecs |
| Security | B+ | No secrets stored, wallet validation tested, SIWX needs more fuzz |
| Optional Deps | A | Compiles cleanly with `--no-optional-deps` |

## Coverage Target
- **Hard minimum:** 90% line coverage via ExCoveralls
- Run: `MIX_ENV=test mix coveralls`
- CI enforces this — PRs that drop below 90% are blocked

## Known Debt

- [ ] Property-based tests (StreamData) for PaymentRequired encode/decode
- [ ] SIWX fuzzing — edge cases in EVM signature recovery
- [ ] Benchmark idempotency cache under high concurrency (bench_ets_cache.exs exists but not in CI)
- [ ] Facilitator retry/backoff not implemented — single attempt only
- [ ] "upto" scheme: bidding logic validation is minimal

## Testing Stack

- ExUnit (standard)
- ExCoveralls (coverage)
- Bypass (HTTP mocking for facilitator tests)
- Mox (behaviour mocking via `X402.Facilitator.HTTPBehaviour`)
- Doctests enabled on all public modules

## CI Checks (GitHub Actions)

1. `mix compile --warnings-as-errors`
2. `mix test --cover` (must be ≥90%)
3. `mix dialyzer`
4. `mix compile --no-optional-deps` (optional-dep safety)
5. `mix format --check-formatted`
