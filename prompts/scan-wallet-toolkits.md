# Scan GitHub: Wallet Toolkits & On-Ramps

status: complete

## Goal
Search GitHub for wallet generation libraries, fiat on-ramp integrations, and multi-chain balance fetchers that could be adapted for agenti. We want to avoid building what already exists.

## Repos to inspect directly (user owns these)
- https://github.com/nirholas/ethereum-wallet-toolkit — clone, check license, what functions exist
- https://github.com/nirholas/solana-wallet-toolkit — clone, check license
- https://github.com/nirholas/bnb-chain-toolkit — check if BNB support is worth adding to agenti core

## GitHub search queries
1. `agent wallet typescript generate EVM Solana` — multi-chain wallet generation
2. `crypto on-ramp agent typescript` — fiat to crypto for agents
3. `USDC balance viem typescript` — USDC balance utilities
4. `coinbase developer platform onramp` — CDP on-ramp API

## What to evaluate
- Does `ethereum-wallet-toolkit` or `solana-wallet-toolkit` have useful utilities beyond what `@agenti/core` already does?
  - HD wallet derivation (BIP-44 paths)?
  - Hardware wallet support?
  - Mnemonic/seed phrase generation?
- Are there on-ramp SDKs (Coinbase, MoonPay, Transak) with TypeScript clients worth wrapping?

## Output
For each relevant repo:
1. URL + license
2. Specific functions in agenti to add or improve
3. Clone command
4. Attribution line

Also answer: **Should agenti add mnemonic/HD wallet support to `@agenti/core`?** Give a recommendation with reasoning.

Write findings to: `prompts/results/scan-wallet-toolkits-results.md`

Mark this file's status as `complete` when done.
