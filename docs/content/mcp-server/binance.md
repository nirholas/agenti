<!-- universal-crypto-mcp | n1ch0las | 0xN1CH -->

# Binance MCP Servers

<!-- Maintained by n1ch0las | ID: 0xN1CH -->

This repository includes two Binance MCP server packages in the `packages/` directory:

1. **binance-mcp-server** - Full Binance.com API integration
2. **binance-us-mcp-server** - Binance US API integration

---

## Binance MCP Server (Global)

Full-featured MCP server for Binance.com with support for:

- Spot trading
- Futures (USD-M and COIN-M)
- Margin trading
- Options
- Copy trading
- Auto-invest
- Mining
- Staking
- Simple Earn
- And more...

### Installation

```bash
cd packages/binance-mcp-server
npm install
npm run build
```

### Configuration

Create `config.json`:

```json
{
  "apiKey": "your_binance_api_key",
  "apiSecret": "your_binance_api_secret",
  "testnet": false
}
```

### Modules

| Module | Description |
|--------|-------------|
| `algo` | Algorithmic trading orders |
| `auto-invest` | Auto-invest plans |
| `c2c` | Crypto-to-crypto trading |
| `convert` | Convert between assets |
| `copy-trading` | Copy trading |
| `crypto-loans` | Crypto-backed loans |
| `dual-investment` | Dual investment products |
| `fiat` | Fiat deposit/withdrawal |
| `futures-coinm` | COIN-M futures |
| `futures-usdm` | USD-M futures |
| `gift-card` | Binance gift cards |
| `margin` | Margin trading |
| `mining` | Mining pool |
| `nft` | NFT marketplace |
| `options` | Options trading |
| `pay` | Binance Pay |
| `portfolio-margin` | Portfolio margin |
| `rebate` | Rebate program |
| `simple-earn` | Simple Earn products |
| `spot` | Spot trading |
| `staking` | Staking products |
| `vip-loan` | VIP loans |
| `wallet` | Wallet operations |

### Usage with Claude Desktop

```json
{
  "mcpServers": {
    "binance": {
      "command": "node",
      "args": ["/path/to/packages/binance-mcp-server/dist/index.js"],
      "env": {
        "BINANCE_API_KEY": "your_key",
        "BINANCE_API_SECRET": "your_secret"
      }
    }
  }
}
```

---

## Binance US MCP Server

MCP server specifically for Binance US API.

### Installation

```bash
cd packages/binance-us-mcp-server
npm install
npm run build
```

### Key Differences from Global

- US-compliant API endpoints
- Limited asset selection
- No futures or margin trading
- Different trading pairs

### Available Tools

| Tool | Description |
|------|-------------|
| Market data | Prices, order books, trades |
| Account info | Balances, trade history |
| Spot trading | Buy/sell orders |
| OCO orders | One-cancels-other orders |
| Wallet | Deposits, withdrawals |

### Configuration

```json
{
  "apiKey": "your_binance_us_api_key",
  "apiSecret": "your_binance_us_api_secret"
}
```

### Documentation

See the `docs/` folder in the binance-us-mcp-server package:

- [API Reference](../../packages/binance-us-mcp-server/docs/API_REFERENCE.md)
- [Tools Reference](../../packages/binance-us-mcp-server/docs/TOOLS_REFERENCE.md)
- [Configuration Guide](../../packages/binance-us-mcp-server/docs/CONFIGURATION.md)
- [Examples](../../packages/binance-us-mcp-server/docs/EXAMPLES.md)
- [Security](../../packages/binance-us-mcp-server/docs/SECURITY.md)

---

## Security Best Practices

### API Key Permissions

Only enable the permissions you need:

| Permission | Use Case |
|------------|----------|
| Read | Market data, account info |
| Spot Trading | Buy/sell on spot |
| Margin Trading | Margin orders (global only) |
| Futures Trading | Futures orders (global only) |
| Withdrawals | ⚠️ Only if needed |

### IP Whitelisting

Always whitelist your server IP in Binance API settings.

### Environment Variables

Never commit API keys. Use environment variables:

```bash
export BINANCE_API_KEY=your_key
export BINANCE_API_SECRET=your_secret
```

---

## Example Prompts

### Market Data

```
"Get the current BTC/USDT price on Binance"
"Show me the order book for ETH/USDT"
"Get 24h trading volume for BNB"
```

### Trading

```
"Place a limit buy order for 0.01 BTC at $40,000"
"Sell 100 USDT worth of ETH at market price"
"Cancel order #12345"
```

### Account

```
"Show my Binance spot balances"
"Get my recent trade history"
"What are my open orders?"
```

### Futures (Global Only)

```
"Get my futures positions"
"Set leverage to 5x for BTC/USDT"
"Place a long position with stop loss"
```


<!-- EOF: n1ch0las | ucm:0xN1CH -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->