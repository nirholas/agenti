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

The middleware form gates an existing Hono route:

```ts
import { Hono } from 'hono'
import { merchantMiddleware } from '@agenti/a2a'
import type { MerchantConfig } from '@agenti/a2a'

const merchant: MerchantConfig = {
  payTo: '0xYourAddress',
  amount: '100000',                                      // 0.10 USDC
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  network: 'eip155:8453',
}

const facilitator = {
  settlerPrivateKey: process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`,
}

const app = new Hono()

app.post('/a2a', merchantMiddleware(merchant, facilitator), async (c) =>
  c.json({ report: 'the work the buyer paid for' }),
)
```

The first call comes back as `payment-required` with the terms. The buyer signs
and sends again; the merchant verifies, runs the handler, settles, and returns a
completed task wrapping the handler's output. A settlement that fails ends the
task as `failed` with `SETTLEMENT_FAILED` and withholds the handler's output
rather than handing it over unpaid, and the task stays payable so the buyer can
resubmit after a transient failure.

If your handler does something you cannot take back (sends a message, mints,
calls a third party), settle before it runs instead:

```ts
merchantMiddleware({ ...merchant, settleFirst: true }, facilitator)
```

`MerchantAgent` is the same flow as two explicit steps, for servers that are not
Hono:

```ts
import { MerchantAgent } from '@agenti/a2a'

const agent = new MerchantAgent(merchant, facilitator)

const quote = agent.requestPayment(taskId)          // send this back first
const result = await agent.processPayment(taskId, payload)

if (result.ok) {
  // result.receipt.transaction is the settlement tx hash
} else {
  // result.task is a failed task carrying the reason
}
```

## Pay for a task

The client takes a `signer`, so the wallet stays yours and this package never
touches a private key:

```ts
import { A2AClient } from '@agenti/a2a'

const client = new A2AClient({
  signer: async (requirements) => signEIP3009(requirements, myWallet),
})

const task = await client.send('https://merchant.example.com/a2a', {
  kind: 'message',
  role: 'user',
  parts: [{ kind: 'text', text: 'do the thing' }],
})
```

`send()` walks the whole flow: it posts the message, notices
`payment-required`, calls your signer with the merchant's terms, resends, and
returns the completed task. Pass `autoPay: false` to stop before paying. It
throws `PaymentRejectedError` when the merchant declines the terms and
`PaymentFailedError` when settlement does not land.

`sendWithPayment(url, message, config, taskId?)` is the same thing without
keeping a client around.

## Advertise the extension

```ts
import { createAgentCard } from '@agenti/a2a'

const card = createAgentCard({
  name: 'Report Generator',
  description: 'Generates market reports, priced per call',
  url: 'https://merchant.example.com/a2a',
  version: '1.0.0',
  skills: [{ id: 'report', name: 'Market report' }],
})
```

The card declares the x402 extension for you. Buyers activate it with the
`X-A2A-Extensions` header; `isExtensionActive()` and `addActivationHeader()`
handle both sides, and `extensionDeclaration()` gives you the raw declaration if
you are building a card yourself.

## API

| Export | Description |
| --- | --- |
| `merchantMiddleware(merchantConfig, facilitatorConfig)` | Hono middleware form of the seller side. |
| `MerchantAgent(merchantConfig, facilitatorConfig)` | The same flow as `requestPayment` / `processPayment`. |
| `A2AClient(config)` | Buyer side, including the pay-and-retry loop. |
| `sendWithPayment(url, message, config, taskId?)` | One-shot buyer helper. |
| `createAgentCard`, `extensionDeclaration` | Advertise x402 support. |
| `isExtensionActive`, `addActivationHeader` | Extension negotiation. |
| `PaymentStatus`, `ErrorCode`, `X402_EXTENSION_URI` | Protocol constants. |

## Related

- [`@agenti/facilitator`](../facilitator) verifies and settles underneath.
- [`@agenti/sdk`](../sdk) covers the plain-HTTP case.
