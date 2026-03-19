# Task: Dialyzer Setup and Fix All Warnings

## Goal
Add Dialyzer to the x402 library, fix all warnings, and add PLT caching to CI.

## Steps

1. **Add dialyxir dependency**: Add `{:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false}` to mix.exs

2. **Run dialyzer**: `mix dialyzer` — fix ALL warnings. Common issues:
   - Missing specs (add @spec)
   - Type mismatches
   - Unreachable patterns
   - Invalid callbacks

3. **PLT caching in CI**: Update `.github/workflows/ci.yml` to:
   - Add a `dialyzer` step/job
   - Cache PLT files (`_build/dev/dialyzer_*.plt*` or similar)
   - Run `mix dialyzer --format github`

4. **Add mix dialyzer to mix ci alias** (or as separate check)

5. **Run ALL quality gates**:
   - `mix compile --warnings-as-errors`
   - `mix compile --no-optional-deps --warnings-as-errors`
   - `mix test` (0 failures)
   - `mix format --check-formatted`
   - `mix credo --strict`
   - `mix dialyzer` (0 warnings)

## Completion
When done, run: `openclaw system event --text "Done: x402 dialyzer" --mode now`
