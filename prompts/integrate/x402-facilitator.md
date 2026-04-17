# Integrate: x402 Facilitator Server

status: complete

## Source repos
- https://github.com/nirholas/x402-facilitator (primary — production EIP-3009 settlement)
- https://github.com/nirholas/x402-deploy (secondary — CLI wrapper and deploy tooling)

## Goal
Add a production-ready x402 facilitator package (`packages/facilitator/`) so agenti users can
self-host payment settlement instead of relying on https://x402.org/facilitator.

## Background
x402-facilitator is a production x402 facilitator. It verifies EIP-712 / EIP-3009 signatures and
settles USDC via `transferWithAuthorization` on Base, Arbitrum, and Ethereum. The agenti SDK
currently delegates verification to an external facilitator URL — this package removes that dependency.

## Steps

### 1. Clone and read (do not push raw clones)
```
git clone https://github.com/nirholas/x402-facilitator /tmp/x402-facilitator
git clone https://github.com/nirholas/x402-deploy /tmp/x402-deploy
```
Read these files fully before writing any code:
- `/tmp/x402-facilitator/src/core/settler.ts`
- `/tmp/x402-facilitator/src/core/verifier.ts`
- `/tmp/x402-facilitator/src/core/nonce-store.ts`
- `/tmp/x402-facilitator/src/routes/` (all route handlers)
- `/tmp/x402-facilitator/src/config/chains.ts`
- `/tmp/x402-deploy/src/gateway/` (payment verification middleware pattern)

### 2. Create `packages/facilitator/`

Scaffold with the same pattern as `packages/mcp/`:
```
packages/facilitator/
  src/
    server.ts        — Hono app with /verify, /settle, /health, /balances routes
    settler.ts       — EIP-3009 transferWithAuthorization on-chain settlement
    verifier.ts      — EIP-712 signature + authorization state validation
    nonce-store.ts   — In-memory LRU nonce cache (prevent replay attacks)
    chains.ts        — Multi-chain RPC + USDC token config (Base, Arbitrum, Ethereum)
    index.ts         — export createFacilitator()
    bin.ts           — #!/usr/bin/env node entry point
  package.json
  tsconfig.json
```

### 3. Key implementation details (from reading the source)

**`verifier.ts`** must:
- Validate `authorization.validAfter` ≤ now ≤ `authorization.validBefore`
- Recover signer from EIP-712 typed-data signature
- Confirm signer === `authorization.from`
- Check nonce has not been used (via nonce-store)
- Return `{ isValid: boolean, invalidReason?: string }`

**`settler.ts`** must:
- Call `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`
  on the USDC contract using viem's `writeContract`
- Wait for receipt confirmation
- Mark nonce as used in nonce-store
- Return `{ txHash, network, amount }`

**`nonce-store.ts`**:
- LRU cache keyed by `${from}:${nonce}` 
- TTL = `validBefore - now + 60s` buffer
- Must be thread-safe (in-memory is fine for single-process)

**`server.ts`** routes:
- `POST /verify` — run verifier, return `{ isValid, invalidReason? }`
- `POST /settle` — run verifier then settler, return `{ txHash? }` or error
- `GET /health` — `{ status: 'ok', chains: [...] }`
- `GET /balances` — return USDC balances of the operator wallet on each chain

**`chains.ts`** — support at minimum:
```ts
{ 'eip155:8453': { rpc: process.env.BASE_RPC_URL, usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' } }
{ 'eip155:42161': { rpc: process.env.ARB_RPC_URL, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' } }
{ 'eip155:1': { rpc: process.env.ETH_RPC_URL, usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' } }
```

### 4. `package.json` for `packages/facilitator/`
```json
{
  "name": "@agenti/facilitator",
  "version": "0.1.0",
  "type": "module",
  "bin": { "agenti-facilitator": "./dist/bin.js" },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts && tsup src/bin.ts --format esm --no-dts --platform node",
    "start": "node dist/bin.js"
  },
  "dependencies": {
    "@agenti/core": "workspace:*",
    "hono": "^4.0.0",
    "viem": "^2.21.0",
    "@hono/node-server": "^1.12.0"
  }
}
```

### 5. Update `packages/sdk/src/serve.ts`
Add a `facilitatorUrl` convenience export so users can point to their local instance:
```ts
export const LOCAL_FACILITATOR = 'http://localhost:3001'
```

### 6. Add example `examples/06-self-hosted-facilitator.ts`
Show: start facilitator, create agenti instance pointing to it, make a payment end-to-end.

## Sensitivity check
The x402-facilitator code handles private keys via env vars only. The core logic
(EIP-712 verification, nonce store, on-chain settlement) is generic x402 protocol
implementation — not proprietary Sperax business logic. Rewrite in TypeScript
following the algorithm, do not copy-paste verbatim.

## Output files
- `packages/facilitator/src/server.ts`
- `packages/facilitator/src/settler.ts`
- `packages/facilitator/src/verifier.ts`
- `packages/facilitator/src/nonce-store.ts`
- `packages/facilitator/src/chains.ts`
- `packages/facilitator/src/index.ts`
- `packages/facilitator/src/bin.ts`
- `packages/facilitator/package.json`
- `packages/facilitator/tsconfig.json`
- `examples/06-self-hosted-facilitator.ts`

Mark this file's status as `complete` when done.
