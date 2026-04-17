# Scan GitHub: x402 Protocol Implementations

status: complete

## Goal
Search GitHub for open-source x402 protocol implementations — both client-side (paying) and server-side (gating/facilitator). x402 is an HTTP payment protocol where a server returns 402 Payment Required, the client signs a crypto payment, then retries with proof.

## Search queries to run

1. `x402 protocol` (repos, sorted by stars)
2. `x402 payment required HTTP` 
3. `HTTP 402 crypto payment typescript`
4. `EIP-3009 transferWithAuthorization x402`
5. `x402 facilitator server`
6. `x402-js OR x402-ts OR x402-python`

Also check:
- https://github.com/coinbase/x402 (Coinbase's reference implementation)
- https://github.com/nirholas/x402-facilitator
- https://github.com/nirholas/x402-deploy

## What to extract
- Facilitator server implementations (we need a reference impl in `packages/facilitator/`)
- Client implementations that differ from our current `pay.ts`
- Server middleware patterns beyond Express/Hono/Next.js (Fastify, Koa, etc.)
- Any test suites for x402 flows

## Output
For each relevant repo:
1. Full URL + license
2. What's reusable and which file in agenti it would improve
3. Clone command + attribution line

Write findings to: `prompts/results/scan-x402-results.md`

Mark this file's status as `complete` when done.
