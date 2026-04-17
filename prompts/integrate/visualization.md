# Integrate: Agent Activity Visualization

status: complete

## Source repo
https://github.com/nirholas/visualize-web3-realtime

## Goal
Add a lightweight real-time visualization dashboard (`packages/dashboard/`) for
monitoring agent activity — wallet transactions, tool call sequences, trade flows.
Uses the existing Web3 3D visualization engine as a reference but outputs a
simpler 2D graph (no Three.js dep required for basic version).

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/visualize-web3-realtime /tmp/visualize-web3-realtime
```
Read:
- `/tmp/visualize-web3-realtime/packages/core/src/` (graph engine types)
- `/tmp/visualize-web3-realtime/packages/react-graph/src/` (React bindings)
- Agent monitoring event types (task DAGs, tool calls)
- WebSocket/SSE data provider pattern

### 2. Create `packages/dashboard/`

A standalone Next.js app for visualizing agent activity.

```
packages/dashboard/
  src/
    app/
      page.tsx          — main dashboard
      api/events/route.ts — SSE endpoint streaming agent events
    components/
      AgentGraph.tsx    — 2D force-directed graph (D3, no Three.js)
      TransactionFeed.tsx — real-time transaction list
      WalletCard.tsx    — wallet balance + recent activity
    lib/
      events.ts         — SSE client for consuming agent events
      graph.ts          — graph data model (nodes + edges)
    types.ts
  package.json
  tsconfig.json
  next.config.ts
```

### 3. Event schema

Define a simple event format that agenti SDK can emit:

```ts
// packages/sdk/src/events.ts
export type AgentiEvent =
  | { type: 'pay'; url: string; amount: string; network: string; txHash?: string; ts: number }
  | { type: 'trade'; mint: string; side: 'buy'|'sell'; sol: number; ts: number }
  | { type: 'balance'; address: string; balances: Balance[]; ts: number }
  | { type: 'invoice'; address: string; amount: number; token: string; ts: number }
  | { type: 'error'; message: string; tool: string; ts: number }

/** Global event emitter for monitoring agent activity. */
export const agentiEvents: EventTarget

/** Emit an event (called internally by SDK functions). */
export function emitEvent(event: AgentiEvent): void

/** Subscribe to events (for dashboard or logging). */
export function onAgentiEvent(
  handler: (event: AgentiEvent) => void
): () => void  // returns unsubscribe fn
```

### 4. SSE endpoint in dashboard

`src/app/api/events/route.ts`:
```ts
// Streams agentiEvents as Server-Sent Events
// Client connects with EventSource('/api/events')
// Each event: data: <JSON>\n\n
```

### 5. Dashboard components

**`AgentGraph.tsx`**
- Nodes: wallets, tokens, URLs
- Edges: payment flows, trades
- Use D3-force for layout (no WebGL required)
- Update in real-time via SSE

**`TransactionFeed.tsx`**
- Scrolling feed of recent events
- Color-coded by type (green=pay, blue=trade, yellow=balance)
- Timestamps + amounts

### 6. `package.json`
```json
{
  "name": "@agenti/dashboard",
  "version": "0.1.0",
  "dependencies": {
    "@agenti/sdk": "workspace:*",
    "next": "^14.0.0",
    "react": "^18.0.0",
    "d3": "^7.0.0",
    "d3-force": "^3.0.0"
  }
}
```

### 7. Update workspace
Add `"packages/dashboard"` to `pnpm-workspace.yaml`.

### 8. Instrument the SDK
In key SDK functions (pay, buy, sell, etc.), add:
```ts
import { emitEvent } from './events.js'
// After successful pay:
emitEvent({ type: 'pay', url, amount, network, txHash, ts: Date.now() })
```

## Sensitivity check
visualize-web3-realtime is MIT licensed. The visualization patterns (force-directed
graphs, SSE streaming) are standard web techniques. The D3 force simulation is
industry-standard. The agent event schema is entirely new design. Safe to implement
from scratch using the visualization repo as architectural reference only.

## Output files
- `packages/sdk/src/events.ts` (event emitter, instrumentation)
- `packages/dashboard/src/app/page.tsx`
- `packages/dashboard/src/app/api/events/route.ts`
- `packages/dashboard/src/components/AgentGraph.tsx`
- `packages/dashboard/src/components/TransactionFeed.tsx`
- `packages/dashboard/src/components/WalletCard.tsx`
- `packages/dashboard/src/lib/events.ts`
- `packages/dashboard/src/lib/graph.ts`
- `packages/dashboard/package.json`
- `packages/dashboard/tsconfig.json`
- `packages/dashboard/next.config.ts`
- Updated `pnpm-workspace.yaml`
- Updated `packages/sdk/src/index.ts` (export events)

Mark this file's status as `complete` when done.
