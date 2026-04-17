# Build: Reference x402 Facilitator Server

status: complete

## Goal
Create a standalone reference x402 facilitator server in `packages/facilitator/`. The facilitator verifies that an x402 payment signature is valid and optionally settles it on-chain. Agenti's `pay.ts` already calls a facilitator at `verifyWithFacilitator()` — this creates the server side of that.

## Output location
New package: `packages/facilitator/`

```
packages/facilitator/
  package.json
  tsconfig.json
  src/
    index.ts     — exports createFacilitator()
    verify.ts    — signature verification logic
    settle.ts    — on-chain settlement (optional)
    bin.ts       — standalone HTTP server CLI
```

## Check GitHub first
Read `prompts/results/scan-x402-results.md` if it exists. Coinbase's x402 repo likely has a reference facilitator — if MIT licensed, clone it, understand the verify/settle flow, then rewrite cleanly for agenti with attribution.

Also check: https://github.com/coinbase/x402

## What to implement

### verify.ts
```ts
export async function verifyPayment(payment: PaymentPayload, requirements: PaymentRequired): Promise<VerifyResult>
```
- For EVM: recover signer from EIP-3009 signature, check it matches the paying address, check nonce/time bounds
- For Solana pump-agent: check transaction signature against program ID

### settle.ts
```ts
export async function settlePayment(payment: PaymentPayload): Promise<SettleResult>
```
- EVM: optional on-chain confirmation via viem
- Solana: optional confirmation via web3.js

### index.ts / bin.ts
```ts
// Express server
POST /verify  → verifyPayment()
POST /settle  → settlePayment()
GET  /health  → { ok: true }
```

### package.json
```json
{
  "name": "@agenti/facilitator",
  "bin": { "agenti-facilitator": "dist/bin.js" },
  "dependencies": {
    "express": "^4.18.0",
    "viem": "^2.21.0",
    "@solana/web3.js": "^1.95.0",
    "@agenti/core": "workspace:*"
  }
}
```

## Protocol reference
x402 v1:
- Client sends `X-Payment` header (base64 JSON with signature + requirements)
- Facilitator POST /verify returns `{ valid: boolean, error?: string }`

x402 v2:
- Client sends `PAYMENT-SIGNATURE` header
- Facilitator returns `{ settled: boolean }`

Mark this file's status as `complete` when done.
