# Build: Vercel AI SDK Tool Adapter

status: complete

## Goal
Create a Vercel AI SDK compatible tool definition in `packages/sdk/src/frameworks/vercel-ai.ts` so agenti payment functions can be used as tools in `generateText` / `streamText` calls.

## Output file
`packages/sdk/src/frameworks/vercel-ai.ts`

## What to implement

```ts
import { tool } from 'ai'
import { z } from 'zod'
import { agenti } from '../agenti'
import { AgentiConfig } from '../types'

// Returns a record of Vercel AI SDK tools
export function agentiTools(config: AgentiConfig): Record<string, ReturnType<typeof tool>>
```

Three tools:
1. **agentiPay** — pay any URL, auto-handle 402
2. **agentiBalance** — get wallet balances
3. **agentiReceive** — create a payment invoice

## Vercel AI SDK pattern
```ts
import { tool } from 'ai'
import { z } from 'zod'

const agentiPay = tool({
  description: 'Make an HTTP request and automatically pay if the server requires x402 cryptocurrency payment (HTTP 402)',
  parameters: z.object({
    url: z.string().describe('The URL to request'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET').optional(),
    body: z.string().optional().describe('JSON body for POST/PUT requests'),
  }),
  execute: async ({ url, method, body }) => {
    const agent = agenti(config)
    const response = await agent.pay(url, { method, body: body ? JSON.parse(body) : undefined })
    return { status: response.status, body: await response.text() }
  },
})
```

## Dependencies to add to packages/sdk/package.json
- `ai` as a peer dependency (`^4.0.0`)

## Export
Add to `packages/sdk/src/index.ts`:
```ts
export { agentiTools } from './frameworks/vercel-ai'
```

And add a subpath export to `packages/sdk/package.json`:
```json
"./vercel-ai": "./dist/frameworks/vercel-ai.js"
```

## Check GitHub first
Check if `prompts/results/scan-framework-adapters-results.md` exists with a relevant repo. If so, clone, study, rewrite for agenti, add attribution.

Mark this file's status as `complete` when done.
