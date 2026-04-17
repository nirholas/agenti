# Integrate: Trade Routing & P&L Tracking

status: complete

## Source repo
https://github.com/nirholas/paste-markets

## Goal
Add a trade thesis extraction and routing module to `@agenti/sdk`. Agents should be
able to analyze a piece of text (tweet, thesis, news article), extract tradeable ideas,
route them to the best available market (spot, perps, prediction), and track P&L.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/paste-markets /tmp/paste-markets
```
Read:
- `/tmp/paste-markets/src/app/api/trades/route.ts`
- `/tmp/paste-markets/src/lib/paste-trade.ts`
- `/tmp/paste-markets/docs/specs/07-public-api.md`
- Any thesis extraction / routing logic in `src/lib/`

### 2. Create `packages/sdk/src/trade-router.ts`

```ts
export interface TradingIdea {
  instrument: string      // "BTC", "SOL", "ETH" etc.
  direction: 'long' | 'short' | 'neutral'
  confidence: number      // 0–1
  timeframe: 'short' | 'medium' | 'long'
  thesis: string          // extracted thesis text
  suggestedMarkets: Market[]
}

export interface Market {
  name: string           // "Binance BTCUSDT", "Hyperliquid BTC-PERP", "Polymarket"
  type: 'spot' | 'perp' | 'prediction' | 'dex'
  chain?: string
  url?: string
}

export interface TradeRecord {
  id: string
  instrument: string
  direction: 'long' | 'short'
  market: string
  entryPrice: number
  currentPrice?: number
  pnlPercent?: number
  createdAt: number
  thesis: string
  author?: string
}

/**
 * 3-pass thesis extraction from unstructured text.
 * Pass 1: Extract trading beliefs (bullish/bearish signals).
 * Pass 2: Convert beliefs to specific instrument ideas.
 * Pass 3: Score confidence and suggest markets.
 *
 * Uses Claude API if ANTHROPIC_API_KEY is set, otherwise simple keyword extraction.
 */
export async function extractTradingIdeas(text: string): Promise<TradingIdea[]>

/**
 * Route a trading idea to the best available market given the agent's
 * available chains and wallets.
 */
export function routeIdea(
  idea: TradingIdea,
  available: { hasEvm?: boolean; hasSolana?: boolean; hasBinance?: boolean }
): Market[]

/**
 * Calculate P&L for a trade record.
 * Fetches current price from CoinGecko free API.
 */
export async function calculatePnl(trade: TradeRecord): Promise<{
  pnlPercent: number
  pnlUsd: number
  currentPrice: number
}>
```

### 3. Add MCP tools to `packages/mcp/src/server.ts`

**`extract_trade_ideas`**
- Input: `{ text: string }`
- Extracts structured trading ideas from any text (tweets, news, theses)
- Returns array of `TradingIdea` objects
- Useful for: agents monitoring Twitter/news and acting on sentiment

**`route_trade`**
- Input: `{ instrument: string, direction: 'long'|'short', has_evm?: boolean, has_solana?: boolean }`
- Returns ordered list of available markets for executing the trade
- Useful for: agents deciding where to place a trade

**`calculate_pnl`**
- Input: `{ instrument: string, direction: 'long'|'short', entry_price: number }`
- Returns current P&L percentage for a hypothetical position
- Useful for: agents tracking whether to exit a position

### 4. Export from SDK
```ts
// packages/sdk/src/index.ts
export { extractTradingIdeas, routeIdea, calculatePnl } from './trade-router.js'
export type { TradingIdea, Market, TradeRecord } from './trade-router.js'
```

### 5. Add example `examples/07-trade-from-thesis.ts`
```ts
// Agent reads a tweet about BTC, extracts the trading idea,
// routes it to the best market, and executes via pump.fun or Binance.
const ideas = await extractTradingIdeas("BTC looking bullish after ETF approval...")
const markets = routeIdea(ideas[0], { hasSolana: true })
console.log('Best market:', markets[0])
```

## Sensitivity check
paste-markets is open source. The thesis extraction pattern (3-pass LLM prompting)
is a general AI technique. The P&L calculation uses public price APIs. The market
routing logic is rule-based. All safe to rewrite from scratch.

## Output files
- `packages/sdk/src/trade-router.ts`
- Updated `packages/mcp/src/server.ts` (3 new tools)
- Updated `packages/sdk/src/index.ts`
- `examples/07-trade-from-thesis.ts`

Mark this file's status as `complete` when done.
