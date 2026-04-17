import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createClient } from './client.js'

export function createBinanceMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agenti-binance',
    version: '0.1.0',
  })

  const client = createClient()

  // ── Market data (no API key needed) ──────────────────────────────────────

  server.tool(
    'binance_get_price',
    'Get current spot price for a Binance trading pair (e.g. BTCUSDT)',
    {
      symbol: z.string().describe('Trading pair symbol, e.g. BTCUSDT'),
    },
    async ({ symbol }) => {
      const data = await client.get('/api/v3/ticker/price', { symbol: symbol.toUpperCase() })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  server.tool(
    'binance_get_orderbook',
    'Get top-of-book bid/ask and full order book depth for a symbol',
    {
      symbol: z.string().describe('Trading pair symbol, e.g. BTCUSDT'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe('Number of price levels to return per side (default 10, max 100)'),
    },
    async ({ symbol, limit }) => {
      const data = (await client.get('/api/v3/depth', {
        symbol: symbol.toUpperCase(),
        limit: limit.toString(),
      })) as { bids: unknown[]; asks: unknown[] }

      const top = {
        symbol: symbol.toUpperCase(),
        bestBid: Array.isArray(data.bids) ? data.bids[0] : null,
        bestAsk: Array.isArray(data.asks) ? data.asks[0] : null,
        bids: data.bids,
        asks: data.asks,
      }
      return { content: [{ type: 'text', text: JSON.stringify(top, null, 2) }] }
    },
  )

  server.tool(
    'binance_get_24h_stats',
    'Get 24h rolling OHLCV stats and price change for a symbol',
    {
      symbol: z.string().describe('Trading pair symbol, e.g. BTCUSDT'),
    },
    async ({ symbol }) => {
      const data = await client.get('/api/v3/ticker/24hr', { symbol: symbol.toUpperCase() })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  server.tool(
    'binance_get_klines',
    'Get candlestick (OHLCV) data for a symbol. Intervals: 1m 5m 15m 30m 1h 4h 1d 1w',
    {
      symbol: z.string().describe('Trading pair symbol, e.g. BTCUSDT'),
      interval: z
        .enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'])
        .default('1h')
        .describe('Candlestick interval'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .default(100)
        .describe('Number of candles to return (default 100, max 1000)'),
    },
    async ({ symbol, interval, limit }) => {
      const raw = (await client.get('/api/v3/klines', {
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit.toString(),
      })) as unknown[][]

      const candles = raw.map((k) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteVolume: k[7],
        trades: k[8],
      }))
      return { content: [{ type: 'text', text: JSON.stringify(candles, null, 2) }] }
    },
  )

  server.tool(
    'binance_get_top_symbols',
    'Get the top 20 trading pairs by 24h quote volume on Binance',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe('Number of symbols to return (default 20)'),
      quote_asset: z
        .string()
        .default('USDT')
        .describe('Quote asset to filter by (default USDT)'),
    },
    async ({ limit, quote_asset }) => {
      const all = (await client.get('/api/v3/ticker/24hr', {})) as Array<{
        symbol: string
        quoteVolume: string
      }>

      const filtered = all
        .filter((t) => t.symbol.endsWith(quote_asset.toUpperCase()))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit)
        .map((t) => ({ symbol: t.symbol, quoteVolume: t.quoteVolume }))

      return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] }
    },
  )

  server.tool(
    'binance_search_symbol',
    'Search for Binance trading pairs by base or quote asset (e.g. base=BTC returns all BTC pairs)',
    {
      base_asset: z.string().optional().describe('Base asset to filter by, e.g. BTC'),
      quote_asset: z.string().optional().describe('Quote asset to filter by, e.g. USDT'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe('Max results to return'),
    },
    async ({ base_asset, quote_asset, limit }) => {
      const info = (await client.get('/api/v3/exchangeInfo', {})) as {
        symbols: Array<{ symbol: string; baseAsset: string; quoteAsset: string; status: string }>
      }

      let results = info.symbols.filter((s) => s.status === 'TRADING')
      if (base_asset) results = results.filter((s) => s.baseAsset === base_asset.toUpperCase())
      if (quote_asset) results = results.filter((s) => s.quoteAsset === quote_asset.toUpperCase())

      const out = results.slice(0, limit).map((s) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
      }))
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] }
    },
  )

  // ── Account (requires BINANCE_API_KEY) ──────────────────────────────────

  server.tool(
    'binance_get_account',
    'Get account balances for all non-zero assets. Requires BINANCE_API_KEY + BINANCE_SECRET_KEY.',
    {},
    async () => {
      const data = (await client.signedGet('/api/v3/account')) as {
        balances: Array<{ asset: string; free: string; locked: string }>
      }

      const nonZero = data.balances.filter(
        (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0,
      )
      return { content: [{ type: 'text', text: JSON.stringify(nonZero, null, 2) }] }
    },
  )

  server.tool(
    'binance_get_open_orders',
    'List all open orders for a symbol. Requires BINANCE_API_KEY + BINANCE_SECRET_KEY.',
    {
      symbol: z.string().optional().describe('Trading pair symbol — omit to get all open orders'),
    },
    async ({ symbol }) => {
      const params: Record<string, string> = {}
      if (symbol) params['symbol'] = symbol.toUpperCase()
      const data = await client.signedGet('/api/v3/openOrders', params)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  // ── Trading (requires BINANCE_API_KEY + BINANCE_SECRET_KEY) ─────────────

  server.tool(
    'binance_place_order',
    'Place a market or limit buy/sell order. Requires BINANCE_API_KEY + BINANCE_SECRET_KEY.',
    {
      symbol: z.string().describe('Trading pair, e.g. BTCUSDT'),
      side: z.enum(['BUY', 'SELL']).describe('Order direction'),
      type: z.enum(['MARKET', 'LIMIT']).describe('Order type'),
      quantity: z.string().describe('Base asset quantity to buy or sell'),
      price: z
        .string()
        .optional()
        .describe('Limit price — required for LIMIT orders'),
      time_in_force: z
        .enum(['GTC', 'IOC', 'FOK'])
        .default('GTC')
        .describe('Time-in-force for LIMIT orders (default GTC)'),
    },
    async ({ symbol, side, type, quantity, price, time_in_force }) => {
      const params: Record<string, string> = {
        symbol: symbol.toUpperCase(),
        side,
        type,
        quantity,
      }
      if (type === 'LIMIT') {
        if (!price) throw new Error('price is required for LIMIT orders')
        params['price'] = price
        params['timeInForce'] = time_in_force
      }
      const data = await client.signedPost('/api/v3/order', params)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  server.tool(
    'binance_cancel_order',
    'Cancel an open order by orderId or clientOrderId. Requires BINANCE_API_KEY + BINANCE_SECRET_KEY.',
    {
      symbol: z.string().describe('Trading pair, e.g. BTCUSDT'),
      order_id: z.string().optional().describe('Binance order ID'),
      client_order_id: z.string().optional().describe('Client order ID (origClientOrderId)'),
    },
    async ({ symbol, order_id, client_order_id }) => {
      if (!order_id && !client_order_id) {
        throw new Error('Either order_id or client_order_id is required')
      }
      const params: Record<string, string> = { symbol: symbol.toUpperCase() }
      if (order_id) params['orderId'] = order_id
      if (client_order_id) params['origClientOrderId'] = client_order_id
      const data = await client.signedDelete('/api/v3/order', params)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  server.tool(
    'binance_get_trade_history',
    'Get recent filled trades for a symbol. Requires BINANCE_API_KEY + BINANCE_SECRET_KEY.',
    {
      symbol: z.string().describe('Trading pair, e.g. BTCUSDT'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .default(50)
        .describe('Number of trades to return (default 50, max 1000)'),
    },
    async ({ symbol, limit }) => {
      const data = await client.signedGet('/api/v3/myTrades', {
        symbol: symbol.toUpperCase(),
        limit: limit.toString(),
      })
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    },
  )

  server.tool(
    'binance_test_order',
    'Validate order parameters without placing a real order. Returns {} on success. Requires BINANCE_API_KEY + BINANCE_SECRET_KEY.',
    {
      symbol: z.string().describe('Trading pair, e.g. BTCUSDT'),
      side: z.enum(['BUY', 'SELL']).describe('Order direction'),
      type: z.enum(['MARKET', 'LIMIT']).describe('Order type'),
      quantity: z.string().describe('Base asset quantity'),
      price: z.string().optional().describe('Limit price — required for LIMIT orders'),
      time_in_force: z
        .enum(['GTC', 'IOC', 'FOK'])
        .default('GTC')
        .describe('Time-in-force for LIMIT orders'),
    },
    async ({ symbol, side, type, quantity, price, time_in_force }) => {
      const params: Record<string, string> = {
        symbol: symbol.toUpperCase(),
        side,
        type,
        quantity,
      }
      if (type === 'LIMIT') {
        if (!price) throw new Error('price is required for LIMIT orders')
        params['price'] = price
        params['timeInForce'] = time_in_force
      }
      const data = await client.signedPost('/api/v3/order/test', params)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: true, message: 'Order parameters are valid', result: data },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  return server
}
