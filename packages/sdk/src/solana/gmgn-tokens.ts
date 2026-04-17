const GMGN_BASE = 'https://gmgn.ai/defi/quotation/v1'
const GMGN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://gmgn.ai/',
}

async function gmgnFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GMGN_BASE}${path}`, { headers: GMGN_HEADERS })
  if (!res.ok) throw new Error(`GMGN fetch failed: ${res.status} ${path}`)
  return res.json()
}

export interface GmgnToken {
  mint: string
  symbol: string
  name: string
  price_usd: number
  market_cap_usd: number
  volume_24h: number
  price_change_1h: number
  price_change_6h: number
  price_change_24h: number
  holder_count: number
  liquidity_usd: number
  created_timestamp: number
  is_pump: boolean
  graduated: boolean
}

export interface GmgnTokenStat {
  mint: string
  symbol: string
  name: string
  price_usd: number
  market_cap_usd: number
  volume_1h: number
  volume_6h: number
  volume_24h: number
  buy_count_24h: number
  sell_count_24h: number
  holder_count: number
  top10_holder_pct: number
  dev_holding_pct: number
  liquidity_usd: number
  is_honeypot: boolean
  renounced: boolean
  freeze_authority: boolean
  mint_authority: boolean
  created_timestamp: number
}

export interface GmgnNewPair {
  mint: string
  symbol: string
  name: string
  created_timestamp: number
  initial_liquidity_usd: number
  current_liquidity_usd: number
  market_cap_usd: number
  dev_wallet: string
  is_pump: boolean
}

function mapToken(t: any): GmgnToken {
  return {
    mint: t.address ?? t.token_address ?? '',
    symbol: t.symbol ?? '',
    name: t.name ?? '',
    price_usd: parseFloat(t.price ?? t.price_usd ?? 0),
    market_cap_usd: parseFloat(t.market_cap ?? t.usd_market_cap ?? 0),
    volume_24h: parseFloat(t.volume_24h ?? 0),
    price_change_1h: parseFloat(t.price_change_percent1h ?? t.price_1h ?? 0),
    price_change_6h: parseFloat(t.price_change_percent6h ?? t.price_6h ?? 0),
    price_change_24h: parseFloat(t.price_change_percent24h ?? t.price_24h ?? 0),
    holder_count: parseInt(t.holder_count ?? t.holder ?? 0),
    liquidity_usd: parseFloat(t.liquidity ?? t.pool_info?.liquidity ?? 0),
    created_timestamp: t.open_timestamp ?? t.created_timestamp ?? 0,
    is_pump: !!(t.pump_progress !== undefined || t.is_show_alert),
    graduated: !!(t.complete),
  }
}

/**
 * Get trending tokens on Solana from GMGN.
 * Timeframe: 1m, 5m, 1h, 6h, 24h
 */
export async function getGmgnTrending(options?: {
  timeframe?: '1m' | '5m' | '1h' | '6h' | '24h'
  limit?: number
  minLiquidityUsd?: number
  pumpOnly?: boolean
}): Promise<GmgnToken[]> {
  const tf = options?.timeframe ?? '1h'
  const limit = options?.limit ?? 20

  const data = (await gmgnFetch(
    `/rank/sol/swaps/${tf}?orderby=swaps&direction=desc&limit=50`
  )) as any

  const tokens: any[] = data?.data?.rank ?? data?.rank ?? []
  let results = tokens.map(mapToken)

  if (options?.minLiquidityUsd) {
    results = results.filter((t) => t.liquidity_usd >= options.minLiquidityUsd!)
  }
  if (options?.pumpOnly) {
    results = results.filter((t) => t.is_pump)
  }

  return results.slice(0, limit)
}

/**
 * Get detailed stats for a specific token by mint address.
 */
export async function getGmgnTokenStat(mint: string): Promise<GmgnTokenStat> {
  const data = (await gmgnFetch(`/token/sol/${mint}`)) as any
  const t = data?.data?.token ?? data?.data ?? data

  return {
    mint: t.address ?? mint,
    symbol: t.symbol ?? '',
    name: t.name ?? '',
    price_usd: parseFloat(t.price ?? t.price_usd ?? 0),
    market_cap_usd: parseFloat(t.market_cap ?? t.usd_market_cap ?? 0),
    volume_1h: parseFloat(t.volume_1h ?? 0),
    volume_6h: parseFloat(t.volume_6h ?? 0),
    volume_24h: parseFloat(t.volume_24h ?? 0),
    buy_count_24h: parseInt(t.buy_24h ?? 0),
    sell_count_24h: parseInt(t.sell_24h ?? 0),
    holder_count: parseInt(t.holder_count ?? t.holder ?? 0),
    top10_holder_pct: parseFloat(t.top_10_holder_rate ?? 0),
    dev_holding_pct: parseFloat(t.dev_token_burn_ratio ?? t.creator_token_status ?? 0),
    liquidity_usd: parseFloat(t.liquidity ?? 0),
    is_honeypot: !!(t.is_honeypot),
    renounced: !!(t.renounced || t.revoked),
    freeze_authority: !!(t.freeze_authority),
    mint_authority: !!(t.mint_authority),
    created_timestamp: t.open_timestamp ?? t.created_timestamp ?? 0,
  }
}

/**
 * Get newly created token pairs on Solana from GMGN.
 */
export async function getGmgnNewPairs(options?: {
  limit?: number
  pumpOnly?: boolean
  minLiquidityUsd?: number
}): Promise<GmgnNewPair[]> {
  const limit = options?.limit ?? 20

  const data = (await gmgnFetch(
    `/pairs/sol/new_pairs?limit=50&orderby=open_timestamp&direction=desc`
  )) as any

  const pairs: any[] = data?.data?.pairs ?? data?.pairs ?? []

  let results: GmgnNewPair[] = pairs.map((p: any) => ({
    mint: p.base_address ?? p.token_address ?? '',
    symbol: p.base_symbol ?? p.symbol ?? '',
    name: p.base_name ?? p.name ?? '',
    created_timestamp: p.open_timestamp ?? p.created_timestamp ?? 0,
    initial_liquidity_usd: parseFloat(p.initial_liquidity ?? 0),
    current_liquidity_usd: parseFloat(p.liquidity ?? 0),
    market_cap_usd: parseFloat(p.market_cap ?? p.usd_market_cap ?? 0),
    dev_wallet: p.creator ?? p.dev_wallet ?? '',
    is_pump: !!(p.launchpad === 'pump.fun' || p.is_pump || p.pump_progress !== undefined),
  }))

  if (options?.pumpOnly) {
    results = results.filter((p) => p.is_pump)
  }
  if (options?.minLiquidityUsd) {
    results = results.filter((p) => p.current_liquidity_usd >= options.minLiquidityUsd!)
  }

  return results.slice(0, limit)
}
