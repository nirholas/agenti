# `@x402-sovereign/core`

Self-hosted x402 facilitator.

This package lets an API seller run their own x402 facilitator instead of pointing `paymentMiddleware` at Coinbase.

When you run this, you become the thing that:
- tells the middleware which networks you support (`/supported`)
- verifies a buyer’s signed payment intent (`/verify`)
- settles that intent on-chain by pulling funds from the buyer (`/settle`)

No external facilitator. No Coinbase account. Your own infra.

---

## What this gives you

- **Drop-in replacement for Coinbase’s facilitator URL**  
  You point `paymentMiddleware` at _your_ server instead of theirs.

- **EVM-only for now (Base / Base Sepolia etc.)**

- **Framework adapters included**  
  Built-in adapters for Hono and Express. Or use the framework-agnostic core with any HTTP server.

---

## Quick Start

### Option 1: Using Built-in Adapters (Recommended)

**With Hono:**

```ts
import { Hono } from "hono";
import { Facilitator, createHonoAdapter } from "@x402-sovereign/core";
import { baseSepolia } from "viem/chains";

const app = new Hono();

const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  networks: [baseSepolia],
});

// Mounts GET /facilitator/supported, POST /facilitator/verify, POST /facilitator/settle
createHonoAdapter(facilitator, app, "/facilitator");
```

**With Express:**

```ts
import express from "express";
import { Facilitator, createExpressAdapter } from "@x402-sovereign/core";
import { baseSepolia } from "viem/chains";

const app = express();
app.use(express.json());

const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  networks: [baseSepolia],
});

// Mounts GET /facilitator/supported, POST /facilitator/verify, POST /facilitator/settle
createExpressAdapter(facilitator, app, "/facilitator");
```

### Option 2: Manual Setup (Any Framework)

```ts
import { Facilitator } from "@x402-sovereign/core";
import { baseSepolia } from "viem/chains";

const facilitator = new Facilitator({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  networks: [baseSepolia],
});

// Expose three routes in your server:

// GET /supported
facilitator.listSupportedKinds()

// POST /verify   { paymentPayload, paymentRequirements }
await facilitator.verifyPayment(paymentPayload, paymentRequirements)

// POST /settle   { paymentPayload, paymentRequirements }
await facilitator.settlePayment(paymentPayload, paymentRequirements)
```

Then configure `paymentMiddleware` with your own facilitator URL:

```ts
paymentMiddleware(
  "0xYourReceivingAddress",
  {
    "/protected-route": {
      price: "$0.10",
      network: "base-sepolia",
      config: { description: "Premium content" },
    },
  },
  {
    url: "http://localhost:3000/facilitator",
  }
);
```

After that:
- clients hitting `/protected-route` see the normal x402 payment flow
- your server calls **your** facilitator
- settlement happens with **your** key on-chain
- Coinbase is not in the loop

---

## API

### `new Facilitator({ evmPrivateKey, networks, minConfirmations? })`

- `evmPrivateKey`: EVM private key used to settle payments (this account pays gas and receives funds)
- `networks`: array of viem `Chain` objects you want to support (e.g. `baseSepolia`)
- `minConfirmations` (optional): planned, not enforced yet

### `listSupportedKinds(): { kinds: { x402Version: 1; scheme: "exact"; network: string; }[] }`

Used for `/supported`.

### `verifyPayment(paymentPayload, paymentRequirements)`

Calls x402’s `verify(...)` under the hood.  
Returns `{ valid: boolean }` (is the buyer’s signed intent acceptable).

Used for `/verify`.

### `settlePayment(paymentPayload, paymentRequirements)`

Calls x402’s `settle(...)` under the hood.  
Broadcasts the settlement tx on-chain using your key.  
Returns `{ settled: boolean; txHash?: string }`.

Used for `/settle`.

---

## Security

- The key you pass in (`evmPrivateKey`) is hot. Treat this like a hot wallet.
- That key pays gas and pulls funds from buyers using their signed authorization.
- Do not commit it. Load it from env / KMS.

---

## Framework Adapters

Built-in adapters are available for popular frameworks. See [ADAPTERS.md](./ADAPTERS.md) for details:

- **Hono**: `createHonoAdapter(facilitator, app, basePath)`
- **Express**: `createExpressAdapter(facilitator, router, basePath)`
- **Custom**: Use `facilitator.handleRequest()` for any other framework

## Examples

- **Hono Example**: [`../example-hono/`](../example-hono/)
- **Express Example**: [`../example-express/`](../example-express/)

---

## Status

- EVM only
- per-request payments work end to end on Base Sepolia
- entitlement / persistence (who already paid for what) is out of scope for this package and will live above it

That's the whole point of this repo. You own the facilitator.
