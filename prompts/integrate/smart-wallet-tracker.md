# Integrate: Smart Wallet Tracker

status: complete

## Source repos
- https://github.com/nirholas/kol-quest (KOL wallet aggregation, leaderboards, trade feeds)
- https://github.com/nirholas/scrape-smart-wallets (smart money wallet discovery)

## Goal
Add `packages/sdk/src/solana/wallets.ts` — a module for tracking smart money /
KOL wallets: discover top traders, get wallet rankings, stream recent trades.
Add 3 MCP tools so agents can follow what the best traders are doing.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/kol-quest /tmp/kol-quest
git clone https://github.com/nirholas/scrape-smart-wallets /tmp/scrape-smart-wallets
```
Read:
- `/tmp/kol-quest/api/index.ts` (Bun API server — wallet merging, filtering)
- `/tmp/kol-quest/fetchers/index.ts` (data sources: DexScreener, Birdeye, Geckoterminal, Helius)
- `/tmp/kol-quest/mcp/index.ts` (MCP server — tools exposed)
- `/tmp/scrape-smart-wallets/` (wallet discovery logic)

### 2. Create `packages/sdk/src/solana/wallets.ts`

```ts
export interface WalletRank {
  address: string
  pnl_7d: number       // USD profit/loss last 7 days
  pnl_30d: number
  win_rate: number     // 0–1
  trade_count: number
  source: 'kolscan' | 'gmgn' | 'helius' | 'manual'
  twitter?: string
  username?: string
}

export interface WalletTrade {
  wallet: string
  mint: string
  symbol?: string
  side: 'buy' | 'sell'
  sol_amount: number
  token_amount: number
  price_usd: number
  timestamp: number
  tx_signature: string
}

/**
 * Fetch top-ranked wallets from GMGN public API.
 * No API key required.
 */
export async function getTopWallets(options?: {
  limit?: number
  timeframe?: '1d' | '7d' | '30d'
  minWinRate?: number
}): Promise<WalletRank[]>

/**
 * Get recent trades for a specific wallet address.
 * Uses Helius enriched transaction API.
 */
export async function getWalletTrades(
  address: string,
  options?: { limit?: number; before?: string }
): Promise<WalletTrade[]>

/**
 * Check if a wallet is in the smart money / KOL list.
 */
export async function isSmartWallet(address: string): Promise<{
  isKol: boolean
  rank?: number
  pnl_7d?: number
  source?: string
}>

/**
 * Watch a list of wallets for new trades via Helius webhook or polling.
 * Returns a cleanup function.
 */
export function watchWallets(
  addresses: string[],
  onTrade: (trade: WalletTrade) => void | Promise<void>,
  options?: { pollIntervalMs?: number }
): () => void
```

### 3. Add 3 MCP tools to `packages/mcp/src/server.ts`

**`get_top_wallets`**
- Input: `{ timeframe?: '1d'|'7d'|'30d', limit?: number, min_win_rate?: number }`
- Returns ranked list of best-performing wallets with PnL and win rate
- Useful for agents deciding which wallets to mirror-trade

**`get_wallet_trades`**
- Input: `{ address: string, limit?: number }`
- Returns recent buy/sell history for any Solana wallet
- Useful for agents analyzing a specific trader's strategy

**`check_smart_wallet`**
- Input: `{ address: string }`
- Returns whether an address is a known KOL/smart wallet with their rank
- Useful for agents evaluating counterparties in a trade

### 4. Update exports
```ts
// packages/sdk/src/solana/index.ts
export { getTopWallets, getWalletTrades, isSmartWallet, watchWallets } from './wallets.js'
export type { WalletRank, WalletTrade } from './wallets.js'

// packages/sdk/src/index.ts — add same re-exports
```

## Data sources (free / no auth)
- GMGN public leaderboard: `https://gmgn.ai/api/v1/rank/sol/wallets/7d`
- Helius (use HELIUS_API_KEY env var if set, else use public RPC): enriched txs
- DexScreener wallet trades: `https://api.dexscreener.com/latest/dex/tokens/{mint}`
- Birdeye free tier: wallet token holdings

## Sensitivity check
kol-quest and scrape-smart-wallets are public repositories aggregating public on-chain
data. No proprietary algorithms — wallet rankings are derived from public blockchain
transactions. Safe to implement from scratch following the data source patterns.

## Output files
- `packages/sdk/src/solana/wallets.ts`
- Updated `packages/mcp/src/server.ts` (3 new tools)
- Updated `packages/sdk/src/solana/index.ts`
- Updated `packages/sdk/src/index.ts`

Mark this file's status as `complete` when done.
