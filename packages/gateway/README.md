# @agenti/gateway

Charge for any Express API with [x402](https://x402.org) in a few lines. USDC on Base and Solana. A thin layer over the official `@x402/express`, `@x402/evm` and `@x402/svm` packages, so protocol upgrades arrive with a version bump.

```ts
import express from 'express'
import { paywall } from '@agenti/gateway'

const app = express()
app.use(
  paywall({
    routes: {
      'GET /api/data': '$0.01',
      'GET /api/premium/*': { price: '$0.05', description: 'Premium feed' },
    },
    payTo: { evm: '0xYourBaseAddress', svm: 'YourSolanaAddress' },
    facilitator: process.env.AGENTI_FACILITATOR_URL, // required on mainnet
  }),
)
app.get('/api/data', (_req, res) => res.json({ hello: 'paid world' }))
app.listen(3000)
```

Unpaid requests get `402` with a `PAYMENT-REQUIRED` header listing every accepted network. Clients pay with `@x402/fetch` or `agenti.pay()`.

## Facilitator

A facilitator verifies and settles payments. The public one at `https://x402.org/facilitator` handles testnets only (`base-sepolia`, `solana-devnet`), which is the default. For mainnet pass `facilitator` or set `AGENTI_FACILITATOR_URL`, for example a self-hosted [`@agenti/facilitator`](../facilitator) or a hosted provider. The gateway refuses to start on mainnet without one rather than silently settling nowhere.

## Options

| Option | Meaning |
|---|---|
| `routes` | `"METHOD /path"` to `"$price"` or `{ price, description, mimeType }`. Wildcards allowed. Unlisted routes stay free. |
| `payTo` | `{ evm?, svm? }` receiving addresses. |
| `networks` | Aliases `base`, `base-sepolia`, `solana`, `solana-devnet`, or raw CAIP-2 ids. Defaults to mainnet for each `payTo` given. |
| `facilitator` | URL or `FacilitatorClient`. |
| `paywall` | Browser paywall UI config from `@x402/express`. |
