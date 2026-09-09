# @agenti/facilitator

A self-hosted x402 facilitator. It verifies EIP-3009 `TransferWithAuthorization`
signatures and settles them on-chain, so you can run the payment leg of an x402
service yourself instead of depending on a public facilitator.

Runs as an HTTP server or as three functions you call directly.

## Install

```bash
npm install @agenti/facilitator
```

## Run the server

```bash
FACILITATOR_PRIVATE_KEY=0xyourgaskey npx agenti-facilitator
# listening on http://localhost:3402
```

`FACILITATOR_PRIVATE_KEY` is the gas wallet that broadcasts settlement
transactions. Without it the server still answers `POST /verify`, while
`POST /settle` and `GET /balances` are disabled.

| Route | Purpose |
| --- | --- |
| `GET /health` | Status plus the CAIP-2 ids of every supported chain. |
| `POST /verify` | Check a signature against payment requirements. Moves no funds. |
| `POST /settle` | Verify, then broadcast the transfer and consume the nonce. |
| `GET /balances` | The settler wallet's balance on each supported chain. |

Both POST routes take `{ payment, requirements }`.

## Use it as a library

```ts
import { verifyPayment, settlePayment } from '@agenti/facilitator'

const requirements = {
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '100000',                                        // 0.10 USDC
  payTo: '0xYourAddress',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',     // USDC on Base
}

const verified = await verifyPayment(payment, requirements)
if (!verified.valid) throw new Error(verified.error)

const settled = await settlePayment(payment, requirements, {
  settlerPrivateKey: process.env.FACILITATOR_PRIVATE_KEY,
})
// { settled: true, txHash: '0x...' }
```

## Verify is not settlement

`verifyPayment` proves the signature is well-formed, unexpired, addressed to
you, and worth at least the amount you asked for. It moves no funds and consumes
no nonce, so a verified authorization can still be replayed.

`settlePayment` is what makes a payment final. Call it before your handler does
anything it cannot take back. `@agenti/sdk`'s `withPayment` wrappers do this for
you.

## Supported chains

Ethereum, Base, Arbitrum, Polygon, and Base Sepolia. Each is accepted by CAIP-2
id (`eip155:8453`) or by its legacy x402 v1 name (`base-mainnet`).

A payment is rejected when the chain it claims is not the chain the requirements
asked to be paid on, so an authorization cannot be settled somewhere the
resource never advertised. Set per-chain RPC endpoints with `ETH_RPC_URL`,
`BASE_RPC_URL`, `ARB_RPC_URL`, `POLYGON_RPC_URL`, and `BASE_SEPOLIA_RPC_URL`,
or pass `rpcUrls` in the config.

## API

| Export | Description |
| --- | --- |
| `createFacilitator(config)` | The Hono app behind the CLI. |
| `verifyPayment(payment, requirements)` | `{ valid, error? }`. |
| `settlePayment(payment, requirements, config)` | `{ settled, txHash?, error? }`. |
| `resolveNetworkPair(paymentNetwork, requiredNetwork)` | Binds the two networks to one chain. |
| `getChain(network)` / `CHAINS` | Chain lookup by CAIP-2 id or alias. |
| `hasNonce` / `markNonce` | The in-process replay guard. |

## Related

- [`@agenti/sdk`](../sdk) gates handlers against this facilitator.
- [`@agenti/a2a`](../a2a) uses it for agent-to-agent payment tasks.
