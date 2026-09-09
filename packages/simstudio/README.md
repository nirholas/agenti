# @agenti/simstudio

An HTTP bridge that exposes agenti's payment, market and Solana tools to
[Sim Studio](https://simstudio.ai), the visual agent builder, as blocks you can
drag onto a canvas.

Sim Studio calls tools over HTTP rather than importing a library, so this
package runs a small server that speaks its shape.

## Install

```bash
npm install @agenti/simstudio
```

## Run the bridge

```bash
npx agenti-simstudio
# listening on http://localhost:3000, health at /health
```

Point a Sim Studio custom tool at the routes below. `GET /health` lists every
tool the running bridge exposes, which is the quickest way to confirm your
deployment is reachable from the canvas.

| Route | Does |
| --- | --- |
| `POST /tools/pay` | Pay an x402 endpoint and return the response. |
| `POST /tools/balance` | Read balances across supported chains. |
| `POST /tools/receive` | Create a payment invoice. |
| `POST /tools/market/price` | Spot price for a coin. |
| `POST /tools/market/trending` | Trending coins. |
| `POST /tools/market/tvl` | Protocol TVL. |
| `POST /tools/market/news` | Crypto news feed. |
| `POST /tools/solana/token-price` | pump.fun bonding-curve state. |
| `POST /tools/solana/buy` | Buy a pump.fun token. |
| `POST /tools/solana/sell` | Sell a pump.fun token. |
| `POST /tools/solana/smart-wallet` | Score a wallet as smart money. |

Example:

```bash
curl -X POST http://localhost:3000/tools/market/price \
  -H 'Content-Type: application/json' \
  -d '{"coin":"solana"}'
```

Set `SOLANA_RPC_URL` to use your own RPC instead of the public mainnet endpoint.

## Keys

Tools that move money take the key in the request body (`evmPrivateKey`,
`solanaPrivateKey`), because Sim Studio holds credentials per block. Run the
bridge somewhere private and reachable only by your Sim Studio instance: any
caller who can reach these routes can spend whatever key they present.

## Use it as a library

```ts
import { createSimStudioBridge } from '@agenti/simstudio'
import { serve } from '@hono/node-server'

serve({ fetch: createSimStudioBridge().fetch, port: 3000 })
```

`@agenti/simstudio/tools` and `@agenti/simstudio/blocks` export the tool and
block definitions on their own if you are wiring them into something else.

## Related

- [`@agenti/sdk`](../sdk) is the library behind every route here.
- [`@agenti/mcp`](../mcp) is the MCP equivalent for Claude and other MCP clients.
