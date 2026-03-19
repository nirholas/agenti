# WebSockets Module Reference

The WebSockets module provides real-time data streaming for price feeds, trade events, and blockchain data.

## Tools

### Price Streams
- `ws_price_subscribe` - Subscribe to real-time price updates
- `ws_price_unsubscribe` - Unsubscribe from price updates

### Trade Streams
- `ws_trades_subscribe` - Subscribe to real-time trade feed
- `ws_orderbook_subscribe` - Subscribe to order book updates

### Blockchain Events
- `ws_block_subscribe` - Subscribe to new block events
- `ws_pending_tx_subscribe` - Subscribe to pending transactions
- `ws_event_subscribe` - Subscribe to smart contract events

## Input Schemas

### ws_price_subscribe

```typescript
z.object({
  symbols: z.array(z.string()).describe('Trading pairs (e.g., ["BTC/USDT", "ETH/USDT"])'),
  exchange: z.enum(['binance', 'coinbase', 'kraken']).default('binance'),
  interval: z.enum(['1s', '5s', '1m']).default('1s'),
})
```

### ws_event_subscribe

```typescript
z.object({
  contractAddress: z.string().describe('Smart contract address'),
  eventName: z.string().describe('Event name (e.g., "Transfer")'),
  chain: z.string().default('ethereum'),
  filters: z.record(z.string()).optional().describe('Event parameter filters'),
})
```

## Data Formats

### Price Update

```json
{
  "type": "price_update",
  "data": {
    "symbol": "BTC/USDT",
    "price": 43250.50,
    "bid": 43249.00,
    "ask": 43252.00,
    "volume": 1250.5,
    "timestamp": 1705312800000
  }
}
```

### Trade Event

```json
{
  "type": "trade",
  "data": {
    "symbol": "ETH/USDT",
    "side": "buy",
    "price": 2580.00,
    "amount": 15.5,
    "timestamp": 1705312800000
  }
}
```

### Block Event

```json
{
  "type": "new_block",
  "data": {
    "chain": "ethereum",
    "blockNumber": 19000000,
    "timestamp": 1705312800,
    "transactions": 150,
    "gasUsed": "15000000",
    "baseFee": "25000000000"
  }
}
```

## Usage Notes

- WebSocket subscriptions are maintained within the MCP session
- Subscriptions are automatically cleaned up when the session ends
- Multiple subscriptions can be active simultaneously
- Data is delivered as MCP notifications to the AI agent
- Rate limiting applies to prevent overwhelming the agent context

## Supported Exchanges

| Exchange | Price | Trades | Order Book |
|----------|-------|--------|------------|
| Binance | Yes | Yes | Yes |
| Coinbase | Yes | Yes | Yes |
| Kraken | Yes | Yes | Yes |

## Supported Chains (Event Subscription)

All EVM chains support WebSocket event subscriptions when using a WebSocket-enabled RPC endpoint (wss://).
