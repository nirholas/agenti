# Integrate: Binance CEX Trading Tools

status: complete

## Source repos
- https://github.com/nirholas/Binance-MCP (478+ tools, Binance.com API)
- https://github.com/nirholas/Binance-US-MCP (87 tools, Binance.US API — US-regulated)

## Goal
Add a `packages/mcp-binance/` subpackage providing a standalone MCP server for
Binance trading. Keep it separate from `@agenti/mcp` to avoid forcing everyone
to have Binance API keys. Agents that need CEX trading can install this alongside.

This is focused on read-only market data + paper-trade simulation first.
Live trading requires BINANCE_API_KEY + BINANCE_SECRET_KEY env vars.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/Binance-MCP /tmp/Binance-MCP
git clone https://github.com/nirholas/Binance-US-MCP /tmp/Binance-US-MCP
```
Read:
- `/tmp/Binance-MCP/src/modules/` (pick the ~10 most useful tool modules)
- `/tmp/Binance-MCP/src/server/` (transport setup)
- `/tmp/Binance-MCP/src/config/binanceClient.ts` (API client init)
- `/tmp/Binance-US-MCP/src/` (note differences for US endpoint)

### 2. Create `packages/mcp-binance/`

```
packages/mcp-binance/
  src/
    server.ts     — createBinanceMcpServer()
    client.ts     — thin Binance REST API client (fetch-based, no SDK dep)
    bin.ts        — stdio entry point
    index.ts      — exports
  package.json
  tsconfig.json
```

### 3. Implement 12 tools in `server.ts`

Prioritize market data (no API key) first, trading second (API key required):

**Market data (no API key needed):**
- `binance_get_price` — Current price for a symbol (e.g. BTCUSDT)
- `binance_get_orderbook` — Top-of-book bid/ask for a symbol
- `binance_get_24h_stats` — 24h OHLCV + change for a symbol
- `binance_get_klines` — Candlestick data (1m/5m/1h/1d intervals)
- `binance_get_top_symbols` — Top 20 symbols by 24h volume
- `binance_search_symbol` — Search for trading pairs by base/quote asset

**Account (requires BINANCE_API_KEY):**
- `binance_get_account` — Account balances (non-zero assets)
- `binance_get_open_orders` — List open orders for a symbol

**Trading (requires BINANCE_API_KEY + BINANCE_SECRET_KEY):**
- `binance_place_order` — Market or limit buy/sell
- `binance_cancel_order` — Cancel an open order
- `binance_get_trade_history` — Recent fills for a symbol
- `binance_test_order` — Validate order parameters without executing (TEST mode)

### 4. `client.ts` — simple fetch-based client

Do NOT depend on `@binance/connector-typescript` — use native fetch.
Use HMAC-SHA256 signature for authenticated endpoints.

```ts
export class BinanceClient {
  constructor(private apiKey?: string, private secret?: string, private us = false)
  
  /** Base URL: api.binance.com or api.binance.us */
  private baseUrl: string
  
  get(path: string, params?: Record<string, string>): Promise<unknown>
  signedGet(path: string, params?: Record<string, string>): Promise<unknown>
  signedPost(path: string, params?: Record<string, string>): Promise<unknown>
}
```

### 5. `package.json`
```json
{
  "name": "@agenti/mcp-binance",
  "version": "0.1.0",
  "description": "MCP server for Binance CEX trading — market data, spot trading, account management",
  "bin": { "agenti-mcp-binance": "./dist/bin.js" },
  "dependencies": { "zod": "^3.23.0", "@modelcontextprotocol/sdk": "^1.10.0" }
}
```

### 6. Update workspace
Add `"packages/mcp-binance"` to `pnpm-workspace.yaml`.

## Environment variables
- `BINANCE_API_KEY` — optional, needed for account/trading tools
- `BINANCE_SECRET_KEY` — optional, needed for signed endpoints
- `BINANCE_US=true` — optional, switches base URL to api.binance.us

## Sensitivity check
Both repos are Apache 2.0 / MIT licensed. Binance REST API is public documentation.
The credential handling pattern (HMAC-SHA256, env vars) is standard practice.
Implement the client from scratch using the official Binance API docs as spec.
Do not copy the connector-typescript SDK internals.

## Output files
- `packages/mcp-binance/src/server.ts`
- `packages/mcp-binance/src/client.ts`
- `packages/mcp-binance/src/bin.ts`
- `packages/mcp-binance/src/index.ts`
- `packages/mcp-binance/package.json`
- `packages/mcp-binance/tsconfig.json`
- Updated `pnpm-workspace.yaml`

Mark this file's status as `complete` when done.
