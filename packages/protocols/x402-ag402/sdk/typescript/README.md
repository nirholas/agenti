# @ag402/fetch

[![npm version](https://img.shields.io/npm/v/@ag402/fetch)](https://www.npmjs.com/package/@ag402/fetch)
[![license](https://img.shields.io/npm/l/@ag402/fetch)](./LICENSE)
[![CI](https://img.shields.io/badge/build-passing-brightgreen)](./src/__tests__)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](./package.json)
[![Node.js](https://img.shields.io/node/v/@ag402/fetch)](./package.json)

TypeScript SDK for **x402 auto-payment** — wraps the native `fetch()` to automatically handle HTTP 402 Payment Required responses.

**Zero runtime dependencies. Node.js 18+. ESM + CJS.**

---

## The Problem

When your AI agent hits a paid API, it gets back a `402 Payment Required` response. Without this library, handling it requires:

```typescript
// Without @ag402/fetch — you write this every time:
const res = await fetch("https://paid-api.example.com/data");

if (res.status === 402) {
  const wwwAuth = res.headers.get("www-authenticate");
  const challenge = parseChallenge(wwwAuth);           // parse the header
  if (challenge.chain !== "solana") throw ...;         // validate chain
  if (parseFloat(challenge.amount) > limit) throw ...; // validate amount
  const txId = await wallet.deduct(...);               // deduct from wallet
  await provider.pay(challenge);                       // broadcast on-chain
  const retryRes = await fetch("https://paid-api.example.com/data", {
    headers: { Authorization: buildProof(txHash) },    // retry with proof
  });
  // handle retryRes...
}
```

## The Solution

```typescript
import { createX402Fetch, InMemoryWallet } from "@ag402/fetch";

const wallet = new InMemoryWallet(100); // start with $100 test USDC
const apiFetch = createX402Fetch({ wallet });
// ⚠️  No `provider` supplied → uses MockPaymentProvider (fake tx hashes, test only).
//     For production, pass a real `provider`. See "Custom Payment Provider" below.

const res = await apiFetch("https://paid-api.example.com/data");
// That's it. Payment happened automatically.
console.log(res.x402.paymentMade);  // true
console.log(res.x402.amountPaid);   // 0.05
console.log(res.x402.txHash);       // "mock_tx_..."
```

---

## Install

```bash
npm install @ag402/fetch
```

## How It Works

1. Forward the original request as-is
2. If the server returns `402` with `WWW-Authenticate: x402 ...`:
   - Validate the challenge (chain, token, amount, budget limits)
   - Deduct from wallet
   - Call the payment provider → receive `tx_hash`
   - Retry with `Authorization: x402 tx_hash="..." chain="..." payer_address="..." request_id="..."`
3. Return the final response with `.x402` metadata attached

Non-x402 responses (including plain `402` without the x402 header) are passed through unchanged.

---

## Response Metadata

Every response has a `.x402` property:

```typescript
interface X402FetchMeta {
  paymentMade: boolean;  // true if payment was submitted on-chain (even if retry failed)
  txHash: string;        // on-chain tx hash, or "mock_tx_..." in test mode; "" if no payment
  amountPaid: number;    // USD amount paid; 0 if no payment
  blocked: boolean;      // true if rejected by a local budget rule before attempting payment
  error?: string;        // set when something went wrong — including when paymentMade=true
}
```

> **Important:** `error` can be set even when `paymentMade=true` — this means the on-chain payment
> was sent but the service's retry request failed. The funds are gone. Check your transaction log.

### Error Handling Pattern

```typescript
const res = await apiFetch("https://api.example.com/data");

if (res.x402.blocked) {
  // Budget rule rejected the payment — no funds were spent
  console.error("Payment blocked:", res.x402.error);
} else if (!res.ok) {
  if (res.x402.paymentMade) {
    // Payment sent on-chain but service failed — contact the provider
    console.error("Paid but service failed:", res.x402.txHash, res.x402.error);
  } else {
    // Either non-x402 error, or payment failed before broadcast (funds not spent)
    console.error("Request failed:", res.x402.error ?? res.status);
  }
} else {
  // Success
  const data = await res.json();
}
```

---

## Configuration

```typescript
const apiFetch = createX402Fetch({
  wallet,
  config: {
    maxAmountPerCall: 1.00,     // Reject any challenge > $1 per call (default: $1.00)
    maxTotalSpend: 50.00,       // Stop paying after $50 total (default: Infinity)
    acceptedChains: ["solana"], // Only pay on Solana (default: ["solana"])
    acceptedTokens: ["USDC"],   // Only accept USDC (default: ["USDC"])
    debug: true,                // Log payment activity to console (default: false)
  },
  paymentTimeoutMs: 30_000,     // Timeout for provider.pay() — rollback on timeout (default: 30s)
});

// Track spend across all calls on this instance
console.log(apiFetch.getTotalSpent()); // e.g. 1.35
```

Config and construction options are validated at construction time — invalid values (negative limits, empty arrays, NaN, zero/negative `paymentTimeoutMs`) throw immediately before any request is made.

---

## Wallet Interface

`createX402Fetch` accepts any object implementing the `Wallet` interface, not just `InMemoryWallet`:

```typescript
import type { Wallet } from "@ag402/fetch";

const myWallet: Wallet = {
  getBalance(): number { /* ... */ },
  deduct(amount: number, toAddress: string): string { /* return tx id */ },
  rollback(txId: string): boolean { /* undo deduction */ },
};

const apiFetch = createX402Fetch({ wallet: myWallet });
```

`InMemoryWallet` stores amounts as integer micro-units internally ($0.000001 precision) to avoid IEEE 754 float drift. It rejects `NaN` and `Infinity` as initial balance. It resets on process restart — use a custom `Wallet` backed by SQLite for persistence.

`InMemoryWallet` also exposes a `deposit(amount: number): void` method for adding funds after construction (useful in tests and REPL sessions).

### Concurrency Warning

> ⚠️ **`createX402Fetch` is NOT safe for concurrent calls on the same instance.**

Two simultaneous calls (e.g. `Promise.all`) may both pass the budget check before either deducts, causing over-spend:

```typescript
// UNSAFE — may over-spend:
const [r1, r2] = await Promise.all([apiFetch(urlA), apiFetch(urlB)]);

// SAFE — sequential:
const r1 = await apiFetch(urlA);
const r2 = await apiFetch(urlB);
```

If you need concurrent calls, create a separate `createX402Fetch` instance per call chain, or guard with an external mutex.

---

## Custom Payment Provider

By default, `MockPaymentProvider` is used — it returns a fake `mock_tx_...` hash and **never touches a real blockchain**. A `console.warn` is emitted when `MockPaymentProvider` is auto-selected outside of test environments (`NODE_ENV=test`, `VITEST`, `JEST_WORKER_ID`).

For production, implement `PaymentProvider`:

```typescript
import type { PaymentProvider, X402PaymentChallenge } from "@ag402/fetch";

const myProvider: PaymentProvider = {
  async pay(challenge: X402PaymentChallenge, requestId: string): Promise<string> {
    // Broadcast real USDC transfer on-chain; requestId is the idempotency key
    return "real_on_chain_tx_hash";
  },
  getAddress(): string {
    return "YourWalletPublicKey";
  },
};

const apiFetch = createX402Fetch({ wallet, provider: myProvider });
```

> **Use `@ag402/solana` for real on-chain payments:**
>
> ```bash
> npm install @ag402/fetch @ag402/solana
> ```
> ```typescript
> import { SolanaPaymentProvider, fromEnv } from "@ag402/solana";
>
> // Reads SOLANA_PRIVATE_KEY from environment
> const provider = fromEnv();
> const apiFetch = createX402Fetch({ wallet, provider });
> ```
>
> See the [`@ag402/solana` README](https://www.npmjs.com/package/@ag402/solana) for full setup, mainnet config, and confirmationLevel options.

---

## Protocol Utilities

All x402 header parsing/building is exported independently:

```typescript
import {
  parseWwwAuthenticate,   // string → X402PaymentChallenge | null
  buildWwwAuthenticate,   // X402PaymentChallenge → string
  parseAuthorization,     // string → X402PaymentProof | null
  buildAuthorization,     // X402PaymentProof → string
  parseAmount,            // X402PaymentChallenge → number (validates: positive, decimal-only)
  descriptorToChallenge,  // X402ServiceDescriptor → X402PaymentChallenge
} from "@ag402/fetch";
```

`parseAmount` strictly rejects hex (`0x10`), scientific notation (`1e5`), multi-token strings (`"1 extra"`), and non-positive values — safe to use on untrusted server input.

`buildAuthorization` and `buildWwwAuthenticate` throw on CR/LF/double-quote in field values to prevent HTTP header injection.

`parseWwwAuthenticate` rejects headers larger than 8 KB to prevent regex exhaustion from malicious servers.

---

## Examples

| File | Description |
|------|-------------|
| [`examples/basic-usage.ts`](./examples/basic-usage.ts) | Auto-pay a 402-protected endpoint with `MockPaymentProvider` |
| [`examples/custom-provider.ts`](./examples/custom-provider.ts) | Implement a real `PaymentProvider` for on-chain payments |
| [`examples/server-side-challenge.ts`](./examples/server-side-challenge.ts) | Emit a 402 challenge from a Node.js HTTP server (seller side) |

For a real Solana on-chain example, see the [`@ag402/solana` README](https://www.npmjs.com/package/@ag402/solana).

Run any example with:
```bash
npx tsx examples/basic-usage.ts
```

---

## Compatibility

| Runtime | Minimum version | Notes |
|---------|----------------|-------|
| Node.js | 18 | Native `fetch` + `crypto.randomUUID()` |
| Bun | 1.0 | Fully supported; frozen Response handled via Proxy |
| Deno | 1.28 | Native `fetch` available |
| Browser | — | Not officially supported (no Solana wallet integration yet) |

---

## Limitations

- **No wallet persistence** — `InMemoryWallet` resets on restart; implement `Wallet` for persistence
- **No concurrent call safety** — do not use `Promise.all` on the same instance; see [Concurrency Warning](#concurrency-warning)
- **No TypeScript gateway/seller side** — buyer only in this package

## Deferred / Roadmap

- SQLite-backed persistent wallet (`SqliteWallet`)
- TypeScript gateway/seller side

## License

[MIT](./LICENSE)
