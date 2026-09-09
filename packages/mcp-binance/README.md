# @agenti/mcp-binance

An MCP server for Binance spot trading. Market data, account state, and order
management as 12 tools any MCP client can call.

The rest of agenti is on-chain. This is the centralized-exchange counterpart, so
an agent can compare a CEX price against a DEX route, or hedge an on-chain
position without leaving the conversation.

## Install

```bash
claude mcp add binance -- npx -y @agenti/mcp-binance
```

Or configure it directly:

```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["-y", "@agenti/mcp-binance"],
      "env": {
        "BINANCE_API_KEY": "...",
        "BINANCE_API_SECRET": "..."
      }
    }
  }
}
```

Market data tools need no credentials. Account and order tools do.

## HTTP transport

```bash
MCP_TRANSPORT=http PORT=3001 npx @agenti/mcp-binance
# POST http://localhost:3001/mcp, health at /health
```

## Tools

**Public market data**: `binance_get_price`, `binance_get_orderbook`,
`binance_get_24h_stats`, `binance_get_klines`, `binance_get_top_symbols`,
`binance_search_symbol`.

**Authenticated**: `binance_get_account`, `binance_get_open_orders`,
`binance_place_order`, `binance_cancel_order`, `binance_get_trade_history`,
`binance_test_order`.

`binance_test_order` validates an order against the live exchange without
placing it. Use it to check symbol filters, lot sizes, and notional minimums
before `binance_place_order` spends anything.

## Use it as a library

```ts
import { createClient } from '@agenti/mcp-binance'

const client = createClient({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET,
})

const { price } = await client.getPrice('BTCUSDT')
```

## Trading safety

`binance_place_order` places real orders against real balances. Restrict the API
key to spot trading, leave withdrawals disabled, and keep IP allowlisting on.

## Related

- [`@agenti/mcp`](../mcp) is the on-chain MCP server.
