# @agenti/a2a

The x402 payment extension for A2A, the agent-to-agent protocol. Lets one agent
charge another for a task, and lets the paying agent settle it, over ordinary
A2A messages.

Where [`@agenti/sdk`](../sdk) gates an HTTP endpoint, this gates an A2A *task*,
which can be long-running and has a lifecycle the buyer can follow.

## Install

```bash
npm install @agenti/a2a
```

## Charge for a task

```ts
import { MerchantAgent } from '@agenti/a2a'

const merchant = new MerchantAgent({
  payTo: '0xYourAddress',
  amount: '100000',                                      // 0.10 USDC
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  network: 'eip155:8453',
  facilitator: { settlerPrivateKey: process.env.FACILITATOR_PRIVATE_KEY },
})

const task = await merchant.handle(message, async () => ({
  text: 'the work the buyer paid for',
}))
```

The first call comes back as `payment-required` with the terms. The buyer signs
and sends again; the merchant verifies, runs the handler, settles, and completes
the task. A settlement that fails ends the task as `failed` with
`SETTLEMENT_FAILED` rather than quietly handing over the artifact.

## Pay for a task

```ts
import { A2AClient } from '@agenti/a2a'

const client = new A2AClient({
  endpoint: 'https://merchant.example.com/a2a',
  wallet,
})

const result = await client.send({ text: 'do the thing' })
```

`A2AClient` walks the whole flow: it sends, notices `payment-required`, signs
the authorization, resends, and returns the completed task. It throws
`PaymentRejectedError` when the merchant declines the terms and
`PaymentFailedError` when settlement does not land.

## Advertise the extension

```ts
import { createAgentCard, extensionDeclaration, X402_EXTENSION_URI } from '@agenti/a2a'

const card = createAgentCard({
  name: 'Report Generator',
  url: 'https://merchant.example.com/a2a',
  extensions: [extensionDeclaration({ required: true })],
})
```

Buyers activate it with the `X-A2A-Extensions` header; `isExtensionActive()`
and `addActivationHeader()` handle both sides.

## API

| Export | Description |
| --- | --- |
| `MerchantAgent` | Class form of the seller side. |
| `merchantMiddleware(config, handler)` | Function form, for an existing A2A server. |
| `A2AClient` | Buyer side, including the pay-and-retry loop. |
| `sendWithPayment(...)` | One-shot buyer helper. |
| `createAgentCard`, `extensionDeclaration` | Advertise x402 support. |
| `isExtensionActive`, `addActivationHeader` | Extension negotiation. |
| `PaymentStatus`, `ErrorCode`, `X402_EXTENSION_URI` | Protocol constants. |

## Related

- [`@agenti/facilitator`](../facilitator) verifies and settles underneath.
- [`@agenti/sdk`](../sdk) covers the plain-HTTP case.
