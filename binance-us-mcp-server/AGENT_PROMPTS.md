# Claude Opus 4.5 Agent Prompts for Binance.US MCP Server

## Overview

These 5 prompts divide the Binance.US MCP server implementation into parallelizable workstreams. Each agent should complete their assigned module independently, following the established patterns from `binance-mcp-server`.

---

## Agent 1: Project Setup & Core Infrastructure

### Task
Create the binance-us-mcp-server project structure, configuration, and core client infrastructure.

### Prompt

```
You are building a Binance.US MCP server at `/workspaces/universal-crypto-mcp/binance-us-mcp-server/`.

Reference the existing binance-mcp-server at `/workspaces/universal-crypto-mcp/binance-mcp-server/` for patterns.

The Binance.US API documentation is at `/workspaces/universal-crypto-mcp/binance-us-docs.md`.

## Tasks

1. **Create package.json** with these dependencies:
   - @modelcontextprotocol/sdk ^1.11.0
   - dotenv ^16.5.0
   - zod ^3.22.4
   - Dev: typescript ^5.0.0, tsx ^4.7.0, @types/node ^20.0.0

2. **Create tsconfig.json** with:
   - target: ES2022
   - module: NodeNext
   - moduleResolution: NodeNext
   - outDir: ./build
   - strict: true

3. **Create src/config/binanceUsClient.ts**:
   - Base URL: `https://api.binance.us`
   - WebSocket URL: `wss://stream.binance.us:9443`
   - Implement HMAC SHA256 signature generation (see docs lines 100-200)
   - Export `binanceUsRequest(method, path, data, signed)` helper
   - Handle API key via X-MBX-APIKEY header
   - Support both query string and request body params

4. **Create src/index.ts** - MCP server entry point:
   - Import McpServer from @modelcontextprotocol/sdk
   - Use StdioServerTransport
   - Register tool modules (placeholder imports for now)
   - Server name: "binance-us-mcp", version: "1.0.0"

5. **Create config.json** - Claude Desktop config example:
   ```json
   {
     "mcpServers": {
       "binance-us-mcp": {
         "command": "node",
         "args": ["build/index.js"],
         "env": {
           "BINANCE_US_API_KEY": "",
           "BINANCE_US_API_SECRET": ""
         }
       }
     }
   }
   ```

6. **Create README.md** documenting:
   - Binance.US vs Binance.com differences
   - US-specific API key types (Exchange, Custodial Solution, Credit Line)
   - Setup instructions
   - Available tool categories

## Key Differences from Binance.com
- Base URL: api.binance.us (not api.binance.com)
- WebSocket: stream.binance.us:9443
- US regulatory compliance
- Custodial Solution API (unique to US)
- Credit Line API (unique to US)
- No futures, margin, or lending

## File Structure to Create
```
binance-us-mcp-server/
├── package.json
├── tsconfig.json
├── config.json
├── README.md
└── src/
    ├── index.ts
    └── config/
        └── binanceUsClient.ts
```

Output all files with complete, working code.
```

---

## Agent 2: Market Data & General Endpoints

### Task
Implement public market data endpoints (no auth required) and general system endpoints.

### Prompt

```
You are implementing market data tools for the Binance.US MCP server.

Working directory: `/workspaces/universal-crypto-mcp/binance-us-mcp-server/`
Reference docs: `/workspaces/universal-crypto-mcp/binance-us-docs.md` (lines 800-1500)
Reference patterns: `/workspaces/universal-crypto-mcp/binance-mcp-server/src/tools/binance-spot/market-api/`

## Endpoints to Implement (from Binance.US docs)

### General Endpoints (src/tools/general/)
| Tool Name | Endpoint | Auth | Description |
|-----------|----------|------|-------------|
| binance_us_ping | GET /api/v3/ping | NONE | Test connectivity |
| binance_us_server_time | GET /api/v3/time | NONE | Get server time |
| binance_us_system_status | GET /sapi/v1/system/status | SIGNED | System maintenance status |
| binance_us_exchange_info | GET /api/v3/exchangeInfo | NONE | Trading rules, pairs info |

### Market Data Endpoints (src/tools/market/)
| Tool Name | Endpoint | Auth | Description |
|-----------|----------|------|-------------|
| binance_us_order_book | GET /api/v3/depth | NONE | Order book depth |
| binance_us_recent_trades | GET /api/v3/trades | NONE | Recent trades list |
| binance_us_historical_trades | GET /api/v3/historicalTrades | MARKET_DATA | Old trades lookup |
| binance_us_agg_trades | GET /api/v3/aggTrades | NONE | Compressed trades |
| binance_us_klines | GET /api/v3/klines | NONE | Candlestick data |
| binance_us_avg_price | GET /api/v3/avgPrice | NONE | Current average price |
| binance_us_ticker_24hr | GET /api/v3/ticker/24hr | NONE | 24hr price change |
| binance_us_ticker_price | GET /api/v3/ticker/price | NONE | Symbol price ticker |
| binance_us_ticker_book | GET /api/v3/ticker/bookTicker | NONE | Best price/qty on book |
| binance_us_rolling_window | GET /api/v3/ticker | NONE | Rolling window stats |

## Implementation Pattern

For each tool:

1. Create Zod schema for parameters
2. Register with server.tool()
3. Call binanceUsRequest() from config
4. Return formatted JSON response

Example structure:
```typescript
// src/tools/market/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { binanceUsRequest } from "../../config/binanceUsClient.js";

export function registerMarketTools(server: McpServer) {
  // binance_us_order_book
  server.tool(
    "binance_us_order_book",
    "Get order book depth for a symbol on Binance.US",
    {
      symbol: z.string().describe("Trading pair symbol, e.g., BTCUSD"),
      limit: z.number().optional().describe("Depth limit: 5, 10, 20, 50, 100, 500, 1000, 5000")
    },
    async ({ symbol, limit }) => {
      const params = { symbol, ...(limit && { limit }) };
      const result = await binanceUsRequest("GET", "/api/v3/depth", params, false);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
  
  // ... more tools
}
```

## Files to Create
```
src/tools/
├── general/
│   └── index.ts
└── market/
    └── index.ts
```

Implement ALL endpoints listed above with full Zod validation and proper error handling.
```

---

## Agent 3: Trading & Order Management

### Task
Implement all trading endpoints - order placement, cancellation, and queries.

### Prompt

```
You are implementing trading tools for the Binance.US MCP server.

Working directory: `/workspaces/universal-crypto-mcp/binance-us-mcp-server/`
Reference docs: `/workspaces/universal-crypto-mcp/binance-us-docs.md` (lines 2800-4500)
Reference patterns: `/workspaces/universal-crypto-mcp/binance-mcp-server/src/tools/binance-spot/trade-api/`

## Trading Endpoints to Implement (src/tools/trade/)

### Order Management
| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_new_order | /api/v3/order | POST | Place new order |
| binance_us_test_order | /api/v3/order/test | POST | Test order (no execution) |
| binance_us_get_order | /api/v3/order | GET | Query order status |
| binance_us_cancel_order | /api/v3/order | DELETE | Cancel active order |
| binance_us_cancel_replace | /api/v3/order/cancelReplace | POST | Cancel and replace order |
| binance_us_open_orders | /api/v3/openOrders | GET | Get all open orders |
| binance_us_all_orders | /api/v3/allOrders | GET | Get all orders (history) |

### OCO Orders (One-Cancels-Other)
| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_new_oco | /api/v3/order/oco | POST | Place OCO order |
| binance_us_get_oco | /api/v3/orderList | GET | Query OCO order |
| binance_us_cancel_oco | /api/v3/orderList | DELETE | Cancel OCO order |
| binance_us_open_oco | /api/v3/openOrderList | GET | Get open OCO orders |

### Order Types to Support
- LIMIT
- MARKET
- STOP_LOSS
- STOP_LOSS_LIMIT
- TAKE_PROFIT
- TAKE_PROFIT_LIMIT
- LIMIT_MAKER

### Time In Force Options
- GTC (Good Till Cancel)
- IOC (Immediate Or Cancel)
- FOK (Fill Or Kill)

## Implementation Notes

1. **All trading endpoints require SIGNED auth** - use signature generation

2. **New Order Parameters** (from docs):
```typescript
const newOrderSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT", "LIMIT_MAKER"]),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
  quantity: z.number().optional(),
  quoteOrderQty: z.number().optional(),
  price: z.number().optional(),
  newClientOrderId: z.string().optional(),
  stopPrice: z.number().optional(),
  trailingDelta: z.number().optional(),
  icebergQty: z.number().optional(),
  newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional(),
  selfTradePreventionMode: z.enum(["EXPIRE_TAKER", "EXPIRE_MAKER", "EXPIRE_BOTH", "NONE"]).optional(),
  recvWindow: z.number().optional()
});
```

3. **OCO Order Parameters**:
```typescript
const ocoOrderSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number(),
  price: z.number(),
  stopPrice: z.number(),
  stopLimitPrice: z.number().optional(),
  stopLimitTimeInForce: z.enum(["GTC", "FOK", "IOC"]).optional(),
  listClientOrderId: z.string().optional(),
  limitClientOrderId: z.string().optional(),
  stopClientOrderId: z.string().optional(),
  limitIcebergQty: z.number().optional(),
  stopIcebergQty: z.number().optional(),
  newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional(),
  selfTradePreventionMode: z.enum(["EXPIRE_TAKER", "EXPIRE_MAKER", "EXPIRE_BOTH", "NONE"]).optional()
});
```

4. **Timestamp is always required** - add automatically

## Files to Create
```
src/tools/trade/
├── index.ts           # Main export
├── orders.ts          # Standard orders
└── oco.ts             # OCO orders
```

Include comprehensive parameter validation and helpful error messages.
```

---

## Agent 4: Wallet, Account & Sub-accounts

### Task
Implement wallet operations, account info, and sub-account management.

### Prompt

```
You are implementing wallet and account tools for the Binance.US MCP server.

Working directory: `/workspaces/universal-crypto-mcp/binance-us-mcp-server/`
Reference docs: `/workspaces/universal-crypto-mcp/binance-us-docs.md` (lines 1700-2800, 4500-5500)
Reference patterns: `/workspaces/universal-crypto-mcp/binance-mcp-server/src/tools/binance-wallet/`

## Account Endpoints (src/tools/account/)

| Tool Name | Endpoint | Description |
|-----------|----------|-------------|
| binance_us_account_info | GET /api/v3/account | Account balances, permissions |
| binance_us_my_trades | GET /api/v3/myTrades | Account trade history |
| binance_us_rate_limits | GET /api/v3/rateLimit/order | Current order rate limit usage |
| binance_us_trade_fee | GET /sapi/v1/asset/query/trading-fee | Get trading fee for symbol |
| binance_us_trade_volume | GET /sapi/v1/asset/query/trading-volume | Past 30 days volume |

## Wallet Endpoints (src/tools/wallet/)

| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_asset_config | GET /sapi/v1/capital/config/getall | Asset fees, network status |
| binance_us_withdraw_crypto | POST /sapi/v1/capital/withdraw/apply | Withdraw crypto |
| binance_us_withdraw_fiat | POST /sapi/v1/fiatpayment/withdraw/apply | Withdraw USD via BITGO |
| binance_us_withdraw_history | GET /sapi/v1/capital/withdraw/history | Withdrawal history |
| binance_us_deposit_history | GET /sapi/v1/capital/deposit/hisrec | Deposit history |
| binance_us_deposit_address | GET /sapi/v1/capital/deposit/address | Get deposit address |

## Sub-account Endpoints (src/tools/subaccount/)

| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_subaccount_list | GET /sapi/v3/sub-account/list | List sub-accounts |
| binance_us_subaccount_transfer_history | GET /sapi/v3/sub-account/transfer/history | Transfer history |
| binance_us_subaccount_transfer | POST /sapi/v3/sub-account/transfer | Execute transfer |
| binance_us_subaccount_assets | GET /sapi/v3/sub-account/assets | Sub-account balances |
| binance_us_subaccount_summary | GET /sapi/v1/sub-account/spotSummary | Master account USD value |
| binance_us_subaccount_status | GET /sapi/v1/sub-account/status | Sub-account status list |

## Implementation Details

### Withdraw Crypto Parameters:
```typescript
const withdrawCryptoSchema = z.object({
  coin: z.string().describe("Asset symbol, e.g., BTC"),
  network: z.string().describe("Network, e.g., ERC20, BEP20"),
  address: z.string().describe("Withdrawal address"),
  amount: z.number().describe("Withdrawal amount"),
  addressTag: z.string().optional().describe("Memo for XRP, XMR, etc."),
  withdrawOrderId: z.string().optional().describe("Client ID")
});
```

### Withdraw Fiat Parameters:
```typescript
const withdrawFiatSchema = z.object({
  paymentMethod: z.literal("BITGO").default("BITGO"),
  paymentAccount: z.string().describe("Account to withdraw to"),
  amount: z.number().describe("USD amount"),
  fiatCurrency: z.literal("USD").default("USD")
});
```

### Sub-account Transfer Parameters:
```typescript
const subaccountTransferSchema = z.object({
  fromEmail: z.string().email(),
  toEmail: z.string().email(),
  asset: z.string(),
  amount: z.number()
});
```

## Files to Create
```
src/tools/
├── account/
│   └── index.ts
├── wallet/
│   └── index.ts
└── subaccount/
    └── index.ts
```

All endpoints require SIGNED authentication. Include recvWindow and timestamp parameters.
```

---

## Agent 5: OTC, Staking, Custodial & Credit Line APIs

### Task
Implement Binance.US-specific APIs: OTC trading, staking, custodial solution, and credit line.

### Prompt

```
You are implementing Binance.US-specific tools (OTC, Staking, Custodial, Credit Line).

Working directory: `/workspaces/universal-crypto-mcp/binance-us-mcp-server/`
Reference docs: `/workspaces/universal-crypto-mcp/binance-us-docs.md` (lines 4200-5000, 5800-8500)

These are UNIQUE to Binance.US and don't exist in the regular Binance.com API.

## OTC Endpoints (src/tools/otc/)

Large block trades outside the order book:

| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_otc_coin_pairs | GET /sapi/v1/otc/coinPairs | Get supported OTC pairs |
| binance_us_otc_quote | POST /sapi/v1/otc/quotes | Request quote for trade |
| binance_us_otc_place_order | POST /sapi/v1/otc/orders | Place OTC order with quote |
| binance_us_otc_get_order | GET /sapi/v1/otc/orders/{orderId} | Get OTC order details |
| binance_us_otc_all_orders | GET /sapi/v1/otc/orders | Query all OTC orders |
| binance_us_ocbs_orders | GET /sapi/v1/ocbs/orders | Get OCBS (fiat) orders |

### OTC Quote Parameters:
```typescript
const otcQuoteSchema = z.object({
  fromCoin: z.string().describe("Sell coin, e.g., BTC, SHIB"),
  toCoin: z.string().describe("Buy coin, e.g., USDT, KSHIB"),
  requestCoin: z.string().describe("Which coin amount to specify"),
  requestAmount: z.number().describe("Amount of requestCoin")
});
```

## Staking Endpoints (src/tools/staking/)

| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_staking_asset_info | GET /sapi/v1/staking/asset | Staking asset info (APR, APY) |
| binance_us_staking_history | GET /sapi/v1/staking/history | Staking transaction history |
| binance_us_staking_balance | GET /sapi/v1/staking/stakingBalance | Current staking balance |
| binance_us_staking_rewards | GET /sapi/v1/staking/stakingRewardsHistory | Staking rewards history |

## Custodial Solution Endpoints (src/tools/custodial/)

For institutional custody partners (Anchorage, etc.):

| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_cust_balance | GET /sapi/v1/custodian/balance | Custodial account balance |
| binance_us_cust_transfer_history | GET /sapi/v1/custodian/transferHistory | Transfer history |
| binance_us_cust_transfer | POST /sapi/v1/custodian/transfer | Execute custodial transfer |
| binance_us_cust_withdraw | POST /sapi/v1/custodian/withdraw | Custodial withdrawal |
| binance_us_cust_available_balance | GET /sapi/v1/custodian/availableBalance | Available balance |
| binance_us_cust_new_order | POST /sapi/v1/custodian/order | Place custodial order |
| binance_us_cust_oco_order | POST /sapi/v1/custodian/ocoOrder | Place custodial OCO |
| binance_us_cust_open_orders | GET /sapi/v1/custodian/openOrders | Open custodial orders |
| binance_us_cust_get_order | GET /sapi/v1/custodian/order | Get custodial order |
| binance_us_cust_order_history | GET /sapi/v1/custodian/orderHistory | Order history |
| binance_us_cust_trade_history | GET /sapi/v1/custodian/tradeHistory | Trade history |
| binance_us_cust_cancel_order | DELETE /sapi/v1/custodian/cancelOrder | Cancel order |
| binance_us_cust_cancel_orders_symbol | DELETE /sapi/v1/custodian/cancelOrdersBySymbol | Cancel all for symbol |
| binance_us_cust_cancel_oco | DELETE /sapi/v1/custodian/cancelOcoOrder | Cancel OCO |
| binance_us_cust_settlement_settings | GET /sapi/v1/custodian/settlementSetting | Settlement config |
| binance_us_cust_settlement_history | GET /sapi/v1/custodian/settlementHistory | Settlement history |

### Custodial Order Parameters:
```typescript
const custodialOrderSchema = z.object({
  rail: z.string().describe("Custodial partner, e.g., ANCHORAGE"),
  symbol: z.string().describe("Trading pair, e.g., BTCUSD"),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT"]),
  quantity: z.number().optional(),
  quoteOrderQty: z.number().optional(),
  price: z.number().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
  stopPrice: z.number().optional(),
  asset: z.string().optional().describe("Asset for express trade"),
  allowExpressTrade: z.boolean().optional().default(false)
});
```

## Credit Line Endpoints (src/tools/creditline/)

For institutional credit agreements:

| Tool Name | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| binance_us_cl_account | GET /sapi/v2/cl/account | Credit line account info |
| binance_us_cl_alert_history | GET /sapi/v1/cl/alert/history | Margin call alerts |
| binance_us_cl_liquidation_history | GET /sapi/v1/cl/liquidation/history | Liquidation history |

### Credit Line Response includes:
- currentLTV, initialLTV, marginCallLTV, liquidationLTV
- interestRate, liquidationFeeRate
- contractStartTime, contractEndTime
- loanAssets with quantities
- Account balances

## Files to Create
```
src/tools/
├── otc/
│   └── index.ts
├── staking/
│   └── index.ts
├── custodial/
│   └── index.ts
└── creditline/
    └── index.ts
```

## Important Notes

1. **Custodial API requires special API key type** - document this in tool descriptions
2. **Credit Line API requires institutional agreement** - add warnings
3. **OTC has minimum/maximum amounts** - include in responses
4. **Rail parameter is always uppercase** - validate and transform

Include comprehensive error handling for API-specific error codes.
```

---

## Integration Checklist

After all 5 agents complete their work:

1. [ ] Update `src/index.ts` to import all tool modules
2. [ ] Run `npm install` and `npm run build`
3. [ ] Test with MCP Inspector: `npx @modelcontextprotocol/inspector tsx src/index.ts`
4. [ ] Verify all tools appear in Claude Desktop
5. [ ] Test key endpoints with real API keys (if available)

## Environment Variables

```bash
BINANCE_US_API_KEY=your_api_key
BINANCE_US_API_SECRET=your_secret_key
```

## Estimated Tool Count

| Module | Tools |
|--------|-------|
| General | 4 |
| Market | 10 |
| Trade | 11 |
| Account | 5 |
| Wallet | 6 |
| Sub-account | 6 |
| OTC | 6 |
| Staking | 4 |
| Custodial | 16 |
| Credit Line | 3 |
| **Total** | **~71 tools** |
