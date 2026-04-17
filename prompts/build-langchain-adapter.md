# Build: LangChain Tool Adapter

status: complete

## Goal
Create a LangChain-compatible tool adapter in `packages/sdk/src/frameworks/langchain.ts` that lets LangChain agents use agenti's pay/balance/receive functions as tools.

## Output file
`packages/sdk/src/frameworks/langchain.ts`

## What to implement

```ts
import { agenti } from '../agenti'
import { AgentiConfig } from '../types'

// Returns an array of LangChain-compatible DynamicStructuredTool objects
export function agentiLangChainTools(config: AgentiConfig): DynamicStructuredTool[]
```

Three tools to expose:
1. **agenti_pay** — `{ url: string, method?: string, body?: string }` → makes HTTP request, auto-pays 402
2. **agenti_balance** — no params → returns USDC + SOL balances
3. **agenti_receive** — `{ amount: number, token: string, chain: string }` → creates payment invoice

## LangChain pattern to follow
```ts
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

new DynamicStructuredTool({
  name: 'agenti_pay',
  description: 'Make an HTTP request and automatically pay if the server requires x402 payment',
  schema: z.object({ url: z.string(), method: z.string().optional(), body: z.string().optional() }),
  func: async ({ url, method, body }) => { ... }
})
```

## Dependencies to add to packages/sdk/package.json
- `@langchain/core` as a peer dependency (`^0.2.0`)

## Export
Add to `packages/sdk/src/index.ts`:
```ts
export { agentiLangChainTools } from './frameworks/langchain'
```

And add a subpath export to `packages/sdk/package.json`:
```json
"./langchain": "./dist/frameworks/langchain.js"
```

## Check GitHub first
Before writing from scratch, check if `prompts/results/scan-framework-adapters-results.md` exists. If it has a relevant repo, clone it, study the pattern, rewrite for agenti, and add attribution comment.

Mark this file's status as `complete` when done.
