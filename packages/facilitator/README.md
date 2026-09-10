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

`FACILITATOR_PRIVATE_KEY` is the gas wallet that broadcasts EVM settlement
transactions. Without it the server still answers `POST /verify`, and
`POST /settle` still works for Solana, where the payer has already broadcast the
transfer. `GET /balances` is disabled.

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

## Solana

Solana is supported alongside EVM, and settles by the opposite route.

On EVM the payer hands over a signed EIP-3009 authorization and this facilitator
broadcasts it. On Solana the payer builds, signs and submits the SPL transfer
themselves, then presents the signature. The money has already moved by the time
you see it, so there is nothing to broadcast and no settler key is needed.

That makes verification the whole job, and it has to be exact:

```ts
import { verify, settle } from '@agenti/facilitator'

const requirements = {
  scheme: 'exact',
  network: 'solana',                                        // or the CAIP-2 form
  amount: '100000',                                         // 0.10 USDC
  payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',    // USDC on mainnet
}

// payment.payload is { signature, payer } from the client's confirmed transfer.
const checked = await verify(payment, requirements)
if (!checked.valid) throw new Error(checked.error)

const claimed = await settle(payment, requirements)
// { settled: true, txHash: '<the payer's signature>' }
```

`verify` and `settle` dispatch on the payment, so the same two calls handle both
chains and your code does not branch.

**How much was paid is read from the ledger, not from the instructions.** The
verifier sums the pre/post token balance deltas for the recipient and mint, so it
is correct for `TransferChecked`, a plain `Transfer`, a transfer made through a
CPI, and a transfer bundled with unrelated instructions, and it cannot be fooled
by an instruction that looks like a payment but reverted.

**Settling consumes the signature.** A transaction signature is public the moment
it lands, so without this one real payment would buy unlimited requests from
anyone reading the chain. `verify` checks the signature has not been claimed but
does not claim it; `settle` claims it. Claiming happens only after every other
check passes, so a payment rejected for some other reason is not burned.

Verification waits for `finalized` commitment by default, which cannot be rolled
back. Pass `commitment: 'confirmed'` to answer in about a second instead, at the
cost of a transfer that a fork could in principle still drop. Point it at your
own RPC with `SOLANA_RPC_URL`, `SOLANA_DEVNET_RPC_URL`, or `solana.rpcUrl` in the
config.

Clusters: mainnet-beta and devnet, by CAIP-2 id or by the names `solana`,
`solana-mainnet`, `solana-devnet`. A devnet transfer is rejected against a
mainnet price, where the asset mint is a token anyone can faucet for free.

## Supported EVM chains

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
| `verify(payment, requirements, options?)` | Chain-agnostic. `{ valid, error? }`. |
| `settle(payment, requirements, options?)` | Chain-agnostic. `{ settled, txHash?, error? }`. |
| `verifyPayment` / `settlePayment` | The EVM path on its own. |
| `verifySolanaPayment` / `settleSolanaPayment` | The Solana path on its own. |
| `getSolanaNetwork` / `SOLANA_NETWORKS` | Cluster lookup by CAIP-2 id or alias. |
| `resolveNetworkPair(paymentNetwork, requiredNetwork)` | Binds the two networks to one chain. |
| `getChain(network)` / `CHAINS` | Chain lookup by CAIP-2 id or alias. |
| `hasNonce` / `markNonce` | The in-process replay guard. |

## Related

- [`@agenti/sdk`](../sdk) gates handlers against this facilitator.
- [`@agenti/a2a`](../a2a) uses it for agent-to-agent payment tasks.
