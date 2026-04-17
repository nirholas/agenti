export interface PriceResult {
  price: number
  confidence?: number
  source: 'pyth' | 'coingecko'
  timestamp: number
}

export interface PriceOracleOptions {
  cacheTtlMs?: number
  timeout?: number
}

export const PYTH_FEEDS: Record<string, string> = {
  SOL:  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  USDT: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  BTC:  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH:  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
}

export const COINGECKO_IDS: Record<string, string> = {
  SOL:  'solana',
  USDC: 'usd-coin',
  USDT: 'tether',
  BTC:  'bitcoin',
  ETH:  'ethereum',
}

const DEFAULT_TTL_MS = 30_000
const DEFAULT_TIMEOUT_MS = 5_000

const _cache = new Map<string, { result: PriceResult; expiresAt: number }>()

async function _fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

async function _getPythPrice(symbol: string, timeoutMs: number): Promise<PriceResult> {
  const feedId = PYTH_FEEDS[symbol]
  if (!feedId) throw new Error(`No Pyth feed for symbol: ${symbol}`)

  const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`
  const res = await _fetchWithTimeout(url, timeoutMs)
  if (!res.ok) throw new Error(`Pyth HTTP ${res.status}`)

  const data = await res.json() as {
    parsed?: Array<{ price: { price: string; conf: string; expo: number } }>
  }
  const parsed = data?.parsed?.[0]
  if (!parsed) throw new Error('Pyth: empty response')

  const { price: p, conf, expo } = parsed.price
  const multiplier = Math.pow(10, expo)

  return {
    price: parseFloat(p) * multiplier,
    confidence: parseFloat(conf) * multiplier,
    source: 'pyth',
    timestamp: Date.now(),
  }
}

async function _getCoinGeckoPrice(symbol: string, timeoutMs: number): Promise<PriceResult> {
  const id = COINGECKO_IDS[symbol]
  if (!id) throw new Error(`No CoinGecko ID for symbol: ${symbol}`)

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
  const res = await _fetchWithTimeout(url, timeoutMs)
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)

  const data = await res.json() as Record<string, { usd?: number }>
  const price = data?.[id]?.usd
  if (typeof price !== 'number') throw new Error('CoinGecko: missing usd price')

  return { price, source: 'coingecko', timestamp: Date.now() }
}

export async function getPrice(
  symbol: string,
  options?: PriceOracleOptions,
): Promise<PriceResult> {
  const ttl = options?.cacheTtlMs ?? DEFAULT_TTL_MS
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS
  const key = symbol.toUpperCase()

  const cached = _cache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.result

  let result: PriceResult
  try {
    result = await _getPythPrice(key, timeout)
  } catch {
    result = await _getCoinGeckoPrice(key, timeout)
  }

  _cache.set(key, { result, expiresAt: Date.now() + ttl })
  return result
}

export async function usdToTokenAmount(
  usdAmount: number,
  symbol: string,
  decimals: number,
  options?: PriceOracleOptions,
): Promise<bigint> {
  const { price } = await getPrice(symbol, options)
  const tokenAmount = usdAmount / price
  return BigInt(Math.round(tokenAmount * Math.pow(10, decimals)))
}

export async function tokenAmountToUsd(
  rawAmount: bigint,
  symbol: string,
  decimals: number,
  options?: PriceOracleOptions,
): Promise<number> {
  const { price } = await getPrice(symbol, options)
  const tokenAmount = Number(rawAmount) / Math.pow(10, decimals)
  return tokenAmount * price
}
