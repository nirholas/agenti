---
name: run-examples
description: Run the EVM and/or Solana example integration tests
argument-hint: "[evm|solana|all]"
disable-model-invocation: true
allowed-tools: Bash
---

# Run Example Integration Tests

Run the example integration tests from the `scripts/` directory. These are
live integration tests that start a facilitator, resource servers, and execute
real payment flows against testnets.

## Arguments

- `/run-examples evm` -- run only the EVM examples
- `/run-examples solana` -- run only the Solana examples
- `/run-examples all` or `/run-examples` (no argument) -- run both

## Execution

Each suite is run via `pnpm tsx` from the `scripts/` directory with a generous
timeout (5 minutes for EVM, 10 minutes for Solana).

```bash
# EVM examples (Base Sepolia USDC payment via Express server)
pnpm tsx evm-example/run-examples.ts

# Solana examples (SOL, Squads, Token, Exact payments via Hono + Express servers)
pnpm tsx solana-example/run-examples.ts
```

The working directory MUST be `scripts/` (i.e., use workdir parameter).

## Interpreting results

- A successful run exits with code 0 and prints `{ msg: 'success' }` responses.
- A failed run exits non-zero and prints an error. Look for `WRN` or `ERR` log
  lines from the facilitator to diagnose.
- The facilitator logs settlement results including the on-chain transaction hash.

## What to run

Based on `$ARGUMENTS`:

- If the argument is `evm`, run only the EVM examples.
- If the argument is `solana`, run only the Solana examples.
- If the argument is `all`, empty, or omitted, run both sequentially (EVM first,
  then Solana).

Report a summary of results when done (which suites passed, how many payments
settled).
