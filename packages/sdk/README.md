# @agenti/sdk

Give an AI agent a wallet. Pay x402 endpoints, gate your own endpoints behind
payment, read balances, and trade, from Node or any modern runtime.

This is the package most people want. `@agenti/core` supplies the wallet,
`@agenti/facilitator` settles the money, and this sits in the middle.

## Install

```bash
npm install @agenti/sdk
```

## Pay for something

`pay()` is `fetch()` that knows what to do with a 402:

```ts
import { agenti } from '@agenti/sdk'
import { generateWallet } from '@agenti/core'

const client = agenti({ wallet: generateWallet() })

const response = await client.pay('https://api.example.com/premium')
console.log(await response.json())
```

If the endpoint answers `402 Payment Required`, the SDK reads the payment
requirements, signs an EIP-3009 authorization, and replays the request with the
payment attached. Both x402 v1 and v2 are handled, on EVM chains and Solana.

### Retries that do not pay twice

Every call signs a fresh nonce, so retrying an ambiguous request settles a
second time. Mark the attempts as one purchase and the SDK replays the same
authorization instead:

```ts
const headers = { 'Idempotency-Key': 'order-8fc21' }

await client.pay('https://api.example.com/premium', { headers })
await client.pay('https://api.example.com/premium', { headers })  // same authorization
```

The key is forwarded upstream too, so a server that dedupes by idempotency key
sees the retry before it settles at all.

## Charge for something

Wrap any Express, Hono, or Next.js App Router handler:

```ts
import express from 'express'
import { withPaymentExpress, LOCAL_FACILITATOR } from '@agenti/sdk/serve'

const app = express()

app.get(
  '/api/report',
  withPaymentExpress(
    async (req, res) => res.json({ report: 'the good stuff' }),
    { amount: '100000', address: '0xYourAddress' },   // 0.10 USDC on Base
  ),
)
```

A caller with no payment gets a 402 describing exactly what to pay. A caller
with a valid payment has it **settled on-chain before your handler runs**, so
work is never delivered against a payment that did not land. The settlement
receipt comes back on `X-PAYMENT-RESPONSE`.

### Charge on Solana

Name a Solana cluster and the whole gate switches: the 402 advertises an SPL
transfer, `token` defaults to USDC on that cluster, and `address` is a base58
account.

```ts
app.get(
  '/api/report',
  withPaymentExpress(
    async (req, res) => res.json({ report: 'the good stuff' }),
    {
      amount: '100000',                                     // 0.10 USDC
      address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      network: 'solana',
      facilitatorUrl: LOCAL_FACILITATOR,
    },
  ),
)
```

Solana payers settle for themselves: they submit and confirm the SPL transfer,
then present the signature. So the gate verifies the transfer really landed,
paid you, in the right token, on the right cluster, and then consumes the
signature so the same payment cannot buy a second request. Use
`network: 'solana-devnet'` to test without real money.

Endpoints whose work is free to repeat can opt into a verify-only soft gate:

```ts
withPaymentExpress(handler, { amount: '100000', address: '0x...', mode: 'verify' })
```

That skips settlement, which means the authorization stays replayable and you
are responsible for settling it yourself. It is a deliberate choice, not the
default.

`withPaymentHono` and `withPayment` (Next.js) take the same config.

## Framework adapters

```ts
import { agentiLangChainTools } from '@agenti/sdk/langchain'
import { agentiTools } from '@agenti/sdk/vercel-ai'
import { agentiPlugin } from '@agenti/sdk/eliza'
```

Each exposes pay, balance, and invoice as tools in that framework's own shape.
Pass `solanaAgentKit` in the LangChain or Vercel AI config to merge in the Solana
Agent Kit tool set. `solana-agent-kit` is an optional peer dependency, loaded only
when you use it, so install it alongside the SDK:

```bash
npm install @agenti/sdk solana-agent-kit
```

`solana-agent-kit@1.4` reaches `jito-ts`, which pins `@solana/web3.js@1.77`. Under
npm that copy resolves an `rpc-websockets` it cannot load, so add this override
to your `package.json` (pnpm and Yarn installs are unaffected):

```json
{ "overrides": { "jito-ts": { "rpc-websockets": "7.5.1" } } }
```

## Other surfaces

| Import | What it covers |
| --- | --- |
| `agenti(config)` | `pay`, `balance`, `receive` on one client. |
| `getBalances(wallet)` | Native and USDC balances across supported chains. |
| `solana`, `buy`, `sell`, `getCoinState` | pump.fun trading and bonding-curve state. |
| `watchPumpEvents`, `watchMigration` | Live launch and graduation streams. |
| `registerAgent`, `getAgentIdentity` | ERC-8004 on-chain agent identity. |
| `signEIP712`, `signMessage` | Signing helpers. |
| `@agenti/sdk/events` | The event stream, with no chain dependencies. |

## Related

- [`@agenti/mcp`](../mcp) exposes all of this to Claude and any MCP client.
- [`@agenti/facilitator`](../facilitator) is the settlement backend.
- [`@agenti/cli`](../cli) scaffolds a paid MCP server from a contract ABI.
