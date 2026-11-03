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
| `syncFacilitatorOnStart` | Fetch facilitator capabilities at startup (default `true`). |

## Charge for MCP tools

The same seller config prices MCP tools, following the official `@x402/mcp` transport: an unpaid call returns an error result carrying the x402 `PaymentRequired` in `structuredContent`, the client retries with the signed payment in `_meta["x402/payment"]`, and the settlement receipt comes back in `_meta["x402/payment-response"]`. Payment is verified before your handler runs and settled only when it succeeds, so a failing tool never costs the caller anything.

### Your own server: `mcpPaywall`

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mcpPaywall, serveMcpOverHttp } from '@agenti/gateway'

const pw = mcpPaywall({ payTo: { evm: '0xYourBaseAddress' }, networks: ['base-sepolia'] })

await serveMcpOverHttp(() => {
  const server = new McpServer({ name: 'premium', version: '1.0.0' })
  server.tool('forecast', 'Price forecast. $0.01 per call.', { symbol: z.string() },
    pw.charge('forecast', '$0.01', async ({ symbol }) => ({
      content: [{ type: 'text', text: await forecast(symbol) }],
    })))
  server.tool('ping', 'Free', {}, async () => ({ content: [{ type: 'text', text: 'pong' }] }))
  return server
}, { port: 4022 })
```

`mcpPaywall` takes `payTo`, `networks` and `facilitator` exactly like `paywall`, plus `hooks` (from `@x402/mcp`) and `maxTimeoutSeconds`. Each `charge(tool, price, handler)` builds its payment requirements on the first call and reuses them after.

### Resell an existing server: `monetizeMcp`

Put per-tool prices in front of any MCP server you can connect a client to. Schemas, results and errors pass through untouched. Priced tools get `_meta["x402/price"]` and a price note in their description so clients and models can see the cost before calling.

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { monetizeMcp, serveMcpOverHttp } from '@agenti/gateway'

const upstream = new Client({ name: 'proxy', version: '1.0.0' })
await upstream.connect(new StdioClientTransport({ command: 'npx', args: ['-y', 'some-mcp-server'] }))

const paid = monetizeMcp({
  upstream,
  prices: { search: '$0.05', '*': '$0.01' }, // '*' covers every tool not listed; omit it to keep the rest free
  payTo: { evm: '0xYourBaseAddress', svm: 'YourSolanaAddress' },
  facilitator: process.env.AGENTI_FACILITATOR_URL,
})
const { url } = await serveMcpOverHttp(paid.createServer, { port: 4022 })
```

### `serveMcpOverHttp(createServer, options)`

A Streamable HTTP host with one server instance per session. Options: `port` (default 4022, `0` picks a free port), `host` (default `127.0.0.1`), `path` (default `/mcp`), `sessionIdleMs` (default 30 minutes). `GET /health` answers `{ ok: true, sessions }` without a session. Returns `{ url, server, close() }`.

### CLI: `agenti-gateway mcp`

No code at all: wrap a stdio or HTTP MCP server and serve it with prices.

```bash
npx -p @agenti/gateway agenti-gateway mcp \
  --stdio "npx -y @modelcontextprotocol/server-everything" \
  --price 'echo=$0.02' --price '*=$0.01' \
  --pay-to-evm 0xYourBaseAddress --network base-sepolia
# agenti-gateway: serving 11 tools at http://127.0.0.1:4022/mcp
```

| Flag | Meaning |
|---|---|
| `--stdio "<cmd>"` or `--url <endpoint>` | The upstream. HTTP upstreams try Streamable HTTP, then SSE. |
| `--price tool=$p` | Repeatable. `*` sets the default. Unpriced tools stay free. |
| `--pay-to-evm`, `--pay-to-svm` | Receiving addresses (env `AGENTI_PAY_TO_EVM`, `AGENTI_PAY_TO_SVM`). |
| `--network <name>` | Repeatable. Defaults to mainnet for each address given. |
| `--facilitator <url>` | Required on mainnet (env `AGENTI_FACILITATOR_URL`). |
| `--port`, `--host`, `--path` | Where to listen. Use `--host 0.0.0.0` to accept remote clients. |

Agents pay for these tools with `connectPaidMcp` or the `call_mcp_tool` tool from [`@agenti/mcp`](../mcp).
