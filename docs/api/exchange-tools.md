# Exchange Tools Reference

Reference for centralized exchange (CEX) integration tools in Agenti, powered by the CCXT library.

## Supported Exchanges

| Exchange | Package | Trading | Account | Order Book |
|----------|---------|---------|---------|------------|
| Binance | `packages/exchanges/binance-mcp` | Yes | Yes | Yes |
| Binance US | `packages/exchanges/binance-us-mcp` | Yes | Yes | Yes |

## Binance Tools

### Account Management

| Tool | Description | Auth Required |
|------|-------------|--------------|
| `binance_account_info` | Account balances, positions, and status | Yes |
| `binance_asset_detail` | Detailed info for a specific asset | Yes |
| `binance_trade_history` | Recent trade history | Yes |

### Market Data

| Tool | Description | Auth Required |
|------|-------------|--------------|
| `binance_order_book` | Real-time order book for a trading pair | No |
| `binance_ticker` | 24h ticker statistics | No |
| `binance_klines` | Candlestick/OHLCV data | No |
| `binance_trades` | Recent public trades | No |

### Trading

| Tool | Description | Auth Required |
|------|-------------|--------------|
| `binance_spot_place_order` | Place spot market/limit order | Yes |
| `binance_spot_cancel_order` | Cancel an open order | Yes |
| `binance_spot_open_orders` | List open orders | Yes |

### Algorithmic Trading

| Tool | Description | Auth Required |
|------|-------------|--------------|
| `binance_twap_future_algo` | Time-weighted average price futures algorithm | Yes |

## Input Schemas

### binance_spot_place_order

```typescript
z.object({
  symbol: z.string().describe('Trading pair (e.g., "BTCUSDT")'),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT']),
  quantity: z.string().describe('Order quantity'),
  price: z.string().optional().describe('Limit price (required for LIMIT orders)'),
  timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
  stopPrice: z.string().optional().describe('Stop price for stop orders'),
})
```

### binance_order_book

```typescript
z.object({
  symbol: z.string().describe('Trading pair (e.g., "ETHUSDT")'),
  limit: z.number().min(5).max(5000).default(100).describe('Order book depth'),
})
```

## Response Formats

### Account Info

```json
{
  "success": true,
  "data": {
    "accountType": "SPOT",
    "balances": [
      { "asset": "BTC", "free": "0.5", "locked": "0.0" },
      { "asset": "USDT", "free": "10000", "locked": "500" }
    ],
    "canTrade": true,
    "canDeposit": true,
    "canWithdraw": true
  }
}
```

### Order Book

```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "bids": [
      ["43250.00", "1.500"],
      ["43249.50", "0.750"]
    ],
    "asks": [
      ["43251.00", "2.000"],
      ["43251.50", "1.250"]
    ],
    "timestamp": 1705312800000
  }
}
```

## Configuration

```env
BINANCE_API_KEY=your_api_key
BINANCE_SECRET_KEY=your_secret_key

# For Binance US
BINANCE_US_API_KEY=your_us_key
BINANCE_US_SECRET_KEY=your_us_secret
```

## API Key Security

### Recommended Binance API Settings

1. **Enable only needed permissions**: Read, Spot Trading
2. **Disable**: Withdrawal, Futures, Margin
3. **IP restriction**: Whitelist your server IP
4. **Expiration**: Set key expiration date

## CCXT Integration

Exchange tools use the `ccxt` library (v4.5+) for unified exchange APIs:

```typescript
import ccxt from 'ccxt';

const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
});
```

This allows potential extension to 100+ exchanges supported by CCXT.
