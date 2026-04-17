const GMGN_BASE = 'https://gmgn.ai/defi/quotation/v1'
const GMGN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://gmgn.ai/',
}

export interface WalletRank {
  address: string
  pnl_7d: number
  pnl_30d: number
  win_rate: number
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

async function gmgnFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GMGN_BASE}${path}`, { headers: GMGN_HEADERS })
  if (!res.ok) throw new Error(`GMGN fetch failed: ${res.status} ${path}`)
  return res.json()
}

/**
 * Fetch top-ranked wallets from GMGN public API.
 * No API key required.
 */
export async function getTopWallets(options?: {
  limit?: number
  timeframe?: '1d' | '7d' | '30d'
  minWinRate?: number
}): Promise<WalletRank[]> {
  const timeframe = options?.timeframe ?? '7d'
  const limit = options?.limit ?? 20
  const minWinRate = options?.minWinRate ?? 0

  const categories = ['smart_degen', 'kol', 'snipe_bot']
  const seen = new Set<string>()
  const results: WalletRank[] = []

  for (const category of categories) {
    if (results.length >= limit) break
    try {
      const data = (await gmgnFetch(
        `/rank/sol/${category}/${timeframe}?orderby=pnl_${timeframe}&direction=desc&page=1&limit=100`
      )) as any

      const rank = data?.data?.rank ?? []
      for (const w of rank) {
        const address: string = w.wallet_address
        if (!address || seen.has(address)) continue
        seen.add(address)

        const win_rate: number = w.winrate ?? 0
        if (win_rate < minWinRate) continue

        results.push({
          address,
          pnl_7d: parseFloat(w.pnl_7d ?? w.realized_profit_7d ?? 0),
          pnl_30d: parseFloat(w.pnl_30d ?? w.realized_profit_30d ?? 0),
          win_rate,
          trade_count: (w.buy ?? 0) + (w.sell ?? 0),
          source: 'gmgn',
          twitter: w.twitter_username ?? undefined,
          username: w.name ?? w.twitter_name ?? undefined,
        })

        if (results.length >= limit) break
      }
    } catch {
      // skip failed category
    }
  }

  return results.sort((a, b) => b.pnl_7d - a.pnl_7d).slice(0, limit)
}

/**
 * Get recent trades for a specific wallet address.
 * Uses Helius enriched transaction API when HELIUS_API_KEY is set.
 */
export async function getWalletTrades(
  address: string,
  options?: { limit?: number; before?: string }
): Promise<WalletTrade[]> {
  const limit = options?.limit ?? 20
  const apiKey = process.env['HELIUS_API_KEY']

  if (apiKey) {
    return fetchHeliusTrades(address, apiKey, limit, options?.before)
  }

  // Fall back to GMGN wallet activity
  return fetchGmgnTrades(address, limit)
}

async function fetchHeliusTrades(
  address: string,
  apiKey: string,
  limit: number,
  before?: string
): Promise<WalletTrade[]> {
  const params = new URLSearchParams({
    'api-key': apiKey,
    limit: String(Math.min(limit, 100)),
  })
  if (before) params.set('before', before)

  const res = await fetch(
    `https://api.helius.xyz/v0/addresses/${address}/transactions?${params}`
  )
  if (!res.ok) throw new Error(`Helius API error: ${res.status}`)

  const txs = (await res.json()) as any[]
  const trades: WalletTrade[] = []

  for (const tx of txs) {
    const transfers: any[] = tx.tokenTransfers ?? []
    for (const t of transfers) {
      if (!t.mint) continue
      const isBuy = t.toUserAccount === address
      const isSell = t.fromUserAccount === address
      if (!isBuy && !isSell) continue

      const nativeDelta = estimateNativeDelta(tx, address, isBuy)

      trades.push({
        wallet: address,
        mint: t.mint,
        symbol: t.symbol ?? undefined,
        side: isBuy ? 'buy' : 'sell',
        sol_amount: Math.abs(nativeDelta) / 1e9,
        token_amount: Math.abs(t.tokenAmount ?? 0),
        price_usd: 0,
        timestamp: tx.timestamp ?? 0,
        tx_signature: tx.signature,
      })
    }
  }

  return trades
}

function estimateNativeDelta(tx: any, address: string, isBuy: boolean): number {
  const nativeTransfers: any[] = tx.nativeTransfers ?? []
  let delta = 0
  for (const nt of nativeTransfers) {
    if (isBuy && nt.fromUserAccount === address) delta += nt.amount ?? 0
    if (!isBuy && nt.toUserAccount === address) delta += nt.amount ?? 0
  }
  return delta
}

async function fetchGmgnTrades(address: string, limit: number): Promise<WalletTrade[]> {
  try {
    const data = (await gmgnFetch(
      `/wallet/sol/${address}/activity?limit=${limit}&tx_types[]=swap`
    )) as any

    const activities: any[] = data?.data?.activities ?? []
    return activities.slice(0, limit).map((a) => ({
      wallet: address,
      mint: a.token_address ?? '',
      symbol: a.symbol ?? undefined,
      side: a.event_type === 'buy' ? 'buy' : 'sell',
      sol_amount: parseFloat(a.cost_token_amount ?? 0),
      token_amount: parseFloat(a.token_amount ?? 0),
      price_usd: parseFloat(a.price_usd ?? 0),
      timestamp: a.timestamp ?? 0,
      tx_signature: a.tx_hash ?? '',
    }))
  } catch {
    return []
  }
}

/**
 * Check if a wallet is in the smart money / KOL list.
 */
export async function isSmartWallet(address: string): Promise<{
  isKol: boolean
  rank?: number
  pnl_7d?: number
  source?: string
}> {
  try {
    const data = (await gmgnFetch(`/wallet_stat/sol/${address}?period=7d`)) as any
    const stat = data?.data

    if (!stat) return { isKol: false }

    const pnl = parseFloat(stat.pnl_7d ?? stat.realized_profit_7d ?? 0)
    const isKol = !!(
      stat.is_smart_money ||
      stat.tags?.length > 0 ||
      Math.abs(pnl) > 1000
    )

    return {
      isKol,
      pnl_7d: pnl,
      source: 'gmgn',
    }
  } catch {
    return { isKol: false }
  }
}

/**
 * Watch a list of wallets for new trades via polling.
 * Returns a cleanup function.
 */
export function watchWallets(
  addresses: string[],
  onTrade: (trade: WalletTrade) => void | Promise<void>,
  options?: { pollIntervalMs?: number }
): () => void {
  const intervalMs = options?.pollIntervalMs ?? 30_000
  const seen = new Set<string>()
  let stopped = false

  async function poll() {
    for (const address of addresses) {
      if (stopped) return
      try {
        const trades = await getWalletTrades(address, { limit: 10 })
        for (const trade of trades) {
          const key = trade.tx_signature + trade.mint
          if (seen.has(key)) continue
          seen.add(key)
          await onTrade(trade)
        }
      } catch {
        // continue polling on error
      }
    }
  }

  // Seed seen set on first pass without firing callbacks
  getWalletTrades(addresses[0] ?? '', { limit: 10 })
    .then((trades) => { for (const t of trades) seen.add(t.tx_signature + t.mint) })
    .catch(() => {})

  const timer = setInterval(poll, intervalMs)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}
