# @agenti/mcp

An MCP server that gives Claude, or any MCP client, a crypto wallet. 58 tools
covering payments, balances, market data, Solana trading, and pump.fun.

## Install

Point your MCP client at the binary. For Claude Code:

```bash
claude mcp add agenti -- npx -y @agenti/mcp
```

Or configure it directly:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["-y", "@agenti/mcp"],
      "env": {
        "AGENTI_EVM_PRIVATE_KEY": "0x...",
        "AGENTI_SOLANA_PRIVATE_KEY": "..."
      }
    }
  }
}
```

Both keys are optional. Read-only tools (prices, TVL, news, token data) work
with no wallet at all; anything that moves money needs the matching key.

## HTTP transport

```bash
MCP_TRANSPORT=http PORT=3000 npx @agenti/mcp
# POST http://localhost:3000/mcp, health at /health
```

Stdio is the default.

## Tools

**Wallet and payments**: `create_wallet`, `get_balance`, `pay`, `create_invoice`,
`check_payment`, `verify_payment_receipt`, `get_payment_history`,
`get_vault_balances`, `generate_mnemonic`, `derive_wallet`, `sign_message`.

**Market data**: `get_coin_price`, `get_trending_coins`, `get_ohlcv`,
`search_coins`, `get_global_stats`, `get_protocol_tvl`, `get_top_protocols`,
`get_crypto_news`, `get_crypto_news_feed`, `detect_price_anomalies`,
`get_market_volatility`, `get_token_price`, `usd_to_token_amount`.

**Solana**: `solana_swap`, `solana_transfer`, `solana_deploy_token`,
`solana_get_token_data`, `solana_stake`, `solana_get_wallet_address`,
`jupiter_quote`, `jupiter_swap`.

**pump.fun**: `pump_buy`, `pump_sell`, `pump_token_info`,
`watch_pump_launches`, `watch_pump_graduations`, `decode_pump_transaction`.

**Wallet intelligence**: `get_top_wallets`, `get_wallet_trades`,
`check_smart_wallet`, `gmgn_trending_tokens`, `gmgn_token_info`,
`gmgn_new_pairs`, `gmgn_copy_trade`, `extract_trade_ideas`, `route_trade`,
`calculate_pnl`.

**BNB Chain**: `bnb_get_balance`, `bnb_transfer`, `bnb_get_token_price`,
`bnb_get_transactions`, `bnb_swap`.

**Gift cards and top-ups**: `bitrefill_search`, `bitrefill_get_featured`,
`bitrefill_create_invoice`, `bitrefill_check_order`, `bitrefill_get_categories`.

## Use it as a library

```ts
import { createServer } from '@agenti/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = createServer()
await server.connect(new StdioServerTransport())
```

## Spending safety

Tools in this server can move real funds. Give it a wallet holding only what you
are willing to let an agent spend, and keep approval prompts on in your client
for anything that transfers, swaps, or deploys.

## Related

- [`@agenti/mcp-binance`](../mcp-binance) is the CEX counterpart.
- [`@agenti/sdk`](../sdk) is the library behind these tools.
