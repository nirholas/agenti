# Integrate: Event Monitor Framework

status: complete

## Source repos
- https://github.com/nirholas/pumpkit (monorepo: @pumpkit/core monitor framework)
- https://github.com/nirholas/pumpfun-claims-bot (MCP + instruction decoding + RPC failover)

## Goal
Add a reusable event monitoring framework to `packages/sdk/src/solana/` so agents
can subscribe to on-chain events (launches, migrations, claims) without writing
polling boilerplate. Also expose these as MCP tools.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/pumpkit /tmp/pumpkit
git clone https://github.com/nirholas/pumpfun-claims-bot /tmp/pumpfun-claims-bot
```
Read:
- `/tmp/pumpkit/packages/core/src/monitors/` (base monitor class, event types)
- `/tmp/pumpkit/packages/core/src/storage/` (FileStore, SqliteStore)
- `/tmp/pumpkit/packages/core/src/health.ts` (health check server)
- `/tmp/pumpfun-claims-bot/src/claim-monitor.ts` (instruction decoding)
- `/tmp/pumpfun-claims-bot/src/event-monitor.ts` (graduation detection)
- `/tmp/pumpfun-claims-bot/src/rpc-fallback.ts` (round-robin with cooldown)

### 2. Create `packages/sdk/src/solana/events.ts`

A typed event system for pump.fun on-chain activity:

```ts
export type PumpEvent =
  | { type: 'launch'; mint: string; name: string; symbol: string; creator: string; timestamp: number }
  | { type: 'graduation'; mint: string; pool: string; timestamp: number }
  | { type: 'trade'; mint: string; side: 'buy' | 'sell'; sol: number; tokens: number; wallet: string; timestamp: number }
  | { type: 'claim'; mint: string; github?: string; twitter?: string; wallet: string; timestamp: number }

export interface EventMonitorOptions {
  connection: Connection
  /** Filter to specific event types. Default: all. */
  eventTypes?: PumpEvent['type'][]
  /** Filter to specific mint addresses. */
  mints?: string[]
  /** Polling interval in ms (used when WebSocket is unavailable). Default: 2000. */
  pollIntervalMs?: number
}

/**
 * Subscribe to real-time pump.fun on-chain events.
 * Uses Connection.onLogs (WebSocket) with poll fallback.
 * Returns a cleanup function.
 */
export function watchPumpEvents(
  options: EventMonitorOptions,
  onEvent: (event: PumpEvent) => void | Promise<void>,
): () => void

/**
 * Decode a raw Solana log line into a PumpEvent, or null if not a pump.fun event.
 */
export function decodePumpLog(log: string, signature: string): PumpEvent | null
```

### 3. Create `packages/sdk/src/solana/storage.ts`

A minimal key-value persistence layer for event deduplication:

```ts
export interface EventStore {
  has(key: string): boolean | Promise<boolean>
  set(key: string, value: unknown): void | Promise<void>
  get(key: string): unknown | Promise<unknown>
}

/** In-memory store (no persistence, reset on restart). */
export class MemoryStore implements EventStore { ... }

/** File-based JSON store (persists across restarts). */
export class FileStore implements EventStore {
  constructor(filePath: string) { ... }
}
```

### 4. Add 3 MCP tools to `packages/mcp/src/server.ts`

**`watch_pump_launches`**
- Input: `{ duration_seconds: number, min_liquidity_sol?: number }`
- Monitors new pump.fun token launches for the specified duration
- Returns list of launches seen during that window

**`watch_pump_graduations`**
- Input: `{ duration_seconds: number, mints?: string[] }`
- Monitors for tokens graduating to PumpSwap AMM
- Returns list of graduation events

**`decode_pump_transaction`**
- Input: `{ signature: string }`
- Fetches and decodes a transaction to extract pump.fun events
- Returns structured event data (launch/trade/graduation)

### 5. Export from index
```ts
// packages/sdk/src/solana/index.ts
export { watchPumpEvents, decodePumpLog } from './events.js'
export { MemoryStore, FileStore } from './storage.js'
export type { PumpEvent, EventMonitorOptions, EventStore } from './events.js'
```

## Sensitivity check
pumpkit and pumpfun-claims-bot are open-source repositories with MIT/Apache licenses.
The instruction decoding patterns are derived from public pump.fun program IDL.
The monitor framework is a generic polling/WebSocket pattern. Safe to rewrite
from scratch following the event type schemas.

## Output files
- `packages/sdk/src/solana/events.ts`
- `packages/sdk/src/solana/storage.ts`
- Updated `packages/mcp/src/server.ts` (3 new tools)
- Updated `packages/sdk/src/solana/index.ts`
- Updated `packages/sdk/src/index.ts`

Mark this file's status as `complete` when done.
