# Build: ElizaOS Plugin

status: complete

## Goal
Create an ElizaOS plugin in `packages/sdk/src/frameworks/eliza.ts` that exposes agenti payment actions to Eliza agents.

## Output file
`packages/sdk/src/frameworks/eliza.ts`

## What to implement

ElizaOS plugins export a `Plugin` object with an `actions` array. Each action has:
- `name` — string identifier
- `description` — what it does
- `similes` — alternative phrases that trigger this action
- `examples` — conversation examples for few-shot
- `validate` — async fn(runtime, message) → boolean
- `handler` — async fn(runtime, message, state, options, callback)

```ts
import { Plugin, Action, IAgentRuntime, Memory } from '@elizaos/core'
import { agenti } from '../agenti'

export const agentiPlugin: Plugin = {
  name: 'agenti',
  description: 'Give Eliza agents the ability to pay for things with cryptocurrency',
  actions: [payAction, balanceAction, receiveAction],
}
```

## Three actions to implement

### payAction
- name: `PAY_URL`
- similes: `['PAY FOR', 'PURCHASE', 'BUY ACCESS', 'MAKE PAYMENT']`
- Extracts a URL from the message text (regex)
- Creates agenti instance from `runtime.getSetting('AGENTI_EVM_PRIVATE_KEY')`
- Calls `agent.pay(url)`
- Callbacks with result

### balanceAction
- name: `CHECK_BALANCE`  
- similes: `['GET BALANCE', 'HOW MUCH', 'WALLET BALANCE']`
- Gets balances and formats as human-readable message

### receiveAction
- name: `CREATE_INVOICE`
- similes: `['REQUEST PAYMENT', 'CREATE INVOICE', 'RECEIVE PAYMENT']`
- Parses amount + token from message
- Creates invoice, returns address + amount

## Dependencies (peer)
- `@elizaos/core` as peer dependency (`^0.1.0`)

## Export
```ts
// packages/sdk/src/index.ts
export { agentiPlugin } from './frameworks/eliza'
```

```json
// packages/sdk/package.json subpath
"./eliza": "./dist/frameworks/eliza.js"
```

## Check GitHub first
Check `prompts/results/scan-framework-adapters-results.md`. ElizaOS has many community plugins — there may be a payment plugin to adapt.

Mark this file's status as `complete` when done.
