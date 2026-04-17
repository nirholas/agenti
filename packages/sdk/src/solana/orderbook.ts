// Market microstructure: synthetic L2 order book + VPIN for Solana DEXs.
//
// Order book is constructed by quoting Jupiter at multiple sizes — this reflects
// true available liquidity across all Orca/Raydium/Meteora pools in one call,
// matching what production market makers actually see at the DEX aggregator layer.
//
// VPIN (Easley, López de Prado & O'Hara 2012) measures the probability that the
// next trade is initiated by an informed participant. Readings above 0.7 indicate
// toxic flow — tighten quotes or pause market making until flow normalizes.

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface L2Level {
  price: number
  size: number
  sizeUsd: number
  priceImpactPct: number
}

export interface OrderBook {
  mint: string
  quoteMint: string
  bids: L2Level[]
  asks: L2Level[]
  /** Best bid price */
  bestBid: number
  /** Best ask price */
  bestAsk: number
  /** Absolute spread in quote currency */
  spread: number
  /** Spread in basis points */
  spreadBps: number
  /** (bestBid + bestAsk) / 2 */
  midPrice: number
  timestamp: number
  venue: 'jupiter'
}

export interface TradeTick {
  timestamp: number
  price: number
  /** Volume in base token (human units) */
  size: number
  side: 'buy' | 'sell'
}

export interface VPINBucket {
  buyVolume: number
  sellVolume: number
  totalVolume: number
  imbalance: number
}

export interface VPINResult {
  /** 0–1: probability of informed trading */
  vpin: number
  buckets: VPINBucket[]
  interpretation: 'low' | 'elevated' | 'high' | 'extreme'
  /** Basis for interpreting: > this = pause quoting */
  pauseThreshold: number
}

export interface SpreadMetrics {
  /** Best ask − best bid */
  absoluteSpread: number
  /** Spread in basis points */
  spreadBps: number
  /** Spread as a % of mid — the true cost paid by a market order */
  effectiveSpreadPct: number
}

// ── Order Book Construction ───────────────────────────────────────────────────

/**
 * Build a synthetic L2 order book by quoting Jupiter at multiple sizes.
 *
 * Each quote at size S reveals the marginal price impact of a trade of that
 * size. Comparing consecutive quotes gives depth buckets that together form
 * a realistic order book from the perspective of a taker.
 *
 * @param mint        Base token mint address
 * @param quoteMint   Quote token mint (default: USDC)
 * @param baseDecimals Decimals for the base token (default: 6)
 * @param quoteDecimals Decimals for the quote token (default: 6 for USDC)
 * @param depthUsd    USD sizes to quote at (defines depth resolution)
 */
export async function getOrderBook(params: {
  mint: string
  quoteMint?: string
  baseDecimals?: number
  quoteDecimals?: number
  /** USD notional sizes at which to query depth. More = higher resolution, more API calls. */
  depthUsd?: number[]
}): Promise<OrderBook> {
  const {
    mint,
    quoteMint = USDC_MINT,
    baseDecimals = 6,
    quoteDecimals = 6,
    depthUsd = [10, 50, 100, 500, 1_000, 5_000, 10_000],
  } = params

  // Get mid-price first (tiny quote to minimize impact)
  const midQuoteRaw = await fetchJupiterQuote(mint, quoteMint, 1_000n, quoteDecimals)
  if (!midQuoteRaw) throw new Error(`No Jupiter route found for ${mint}`)

  const midPrice =
    (Number(midQuoteRaw.inAmount) / 10 ** quoteDecimals) /
    (Number(midQuoteRaw.outAmount) / 10 ** baseDecimals)

  // Asks: what do we pay in USDC to buy the token at each USD size?
  // Bids: what do we receive in USDC to sell the token at each USD size?
  const [askLevels, bidLevels] = await Promise.all([
    buildAskSide(mint, quoteMint, baseDecimals, quoteDecimals, depthUsd, midPrice),
    buildBidSide(mint, quoteMint, baseDecimals, quoteDecimals, depthUsd, midPrice),
  ])

  const bestAsk = askLevels[0]?.price ?? midPrice * 1.001
  const bestBid = bidLevels[0]?.price ?? midPrice * 0.999
  const spread = bestAsk - bestBid
  const spreadBps = (spread / midPrice) * 10_000

  return {
    mint,
    quoteMint,
    bids: bidLevels,
    asks: askLevels,
    bestBid,
    bestAsk,
    spread,
    spreadBps,
    midPrice: (bestBid + bestAsk) / 2,
    timestamp: Date.now(),
    venue: 'jupiter',
  }
}

async function buildAskSide(
  mint: string,
  quoteMint: string,
  baseDecimals: number,
  quoteDecimals: number,
  depthUsd: number[],
  midPrice: number,
): Promise<L2Level[]> {
  const levels: L2Level[] = []

  for (const usdSize of depthUsd) {
    const quoteAtoms = BigInt(Math.round(usdSize * 10 ** quoteDecimals))
    const quote = await fetchJupiterQuote(mint, quoteMint, quoteAtoms, quoteDecimals)
    if (!quote) break

    const quoteIn = Number(quote.inAmount) / 10 ** quoteDecimals
    const baseOut = Number(quote.outAmount) / 10 ** baseDecimals
    if (baseOut === 0) break

    const price = quoteIn / baseOut
    const priceImpactPct = parseFloat(quote.priceImpactPct) * 100

    levels.push({ price, size: baseOut, sizeUsd: quoteIn, priceImpactPct })
  }

  return levels
}

async function buildBidSide(
  mint: string,
  quoteMint: string,
  baseDecimals: number,
  quoteDecimals: number,
  depthUsd: number[],
  midPrice: number,
): Promise<L2Level[]> {
  const levels: L2Level[] = []

  for (const usdSize of depthUsd) {
    // Sell side: we quote base token in → USDC out
    const baseAtomsPerUsd = 10 ** baseDecimals / midPrice
    const baseAtoms = BigInt(Math.round(usdSize * baseAtomsPerUsd))
    const quote = await fetchJupiterQuote(quoteMint, mint, baseAtoms, baseDecimals)
    if (!quote) break

    const baseIn = Number(quote.inAmount) / 10 ** baseDecimals
    const quoteOut = Number(quote.outAmount) / 10 ** quoteDecimals
    if (baseIn === 0) break

    const price = quoteOut / baseIn
    const priceImpactPct = parseFloat(quote.priceImpactPct) * 100

    levels.push({ price, size: baseIn, sizeUsd: quoteOut, priceImpactPct })
  }

  return levels
}

// Jupiter quote: inputMint → outputMint for inputAmount atoms of inputMint
async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  inputAmount: bigint,
  _inputDecimals: number,
): Promise<{ inAmount: string; outAmount: string; priceImpactPct: string } | null> {
  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: inputAmount.toString(),
    slippageBps: '0',
    onlyDirectRoutes: 'false',
  })

  try {
    const res = await fetch(`${JUPITER_QUOTE_API}/quote?${qs}`)
    if (!res.ok) return null
    const data = (await res.json()) as { inAmount: string; outAmount: string; priceImpactPct: string }
    return data
  } catch {
    return null
  }
}

// ── Spread Metrics ────────────────────────────────────────────────────────────

export function computeSpreadMetrics(book: OrderBook): SpreadMetrics {
  const absoluteSpread = book.bestAsk - book.bestBid
  const spreadBps = book.spreadBps
  const effectiveSpreadPct = (absoluteSpread / book.midPrice) * 100

  return { absoluteSpread, spreadBps, effectiveSpreadPct }
}

// ── Trade Classification (Lee-Ready) ─────────────────────────────────────────

/**
 * Lee-Ready (1991) trade direction classification.
 *
 * If price moved up → buy-initiated (aggressive buyer lifted the ask).
 * If price moved down → sell-initiated (aggressive seller hit the bid).
 * If unchanged → inherit direction from the previous tick (tick rule).
 */
export function classifyTrade(
  price: number,
  prevPrice: number,
  prevSide?: 'buy' | 'sell',
): 'buy' | 'sell' {
  if (price > prevPrice) return 'buy'
  if (price < prevPrice) return 'sell'
  return prevSide ?? 'buy'
}

export function classifyPriceSeries(
  prices: Array<{ timestamp: number; price: number; size: number }>,
): TradeTick[] {
  const result: TradeTick[] = []
  for (const p of prices) {
    const prev = result[result.length - 1]
    const side = classifyTrade(p.price, prev?.price ?? p.price, prev?.side)
    result.push({ ...p, side })
  }
  return result
}

// ── VPIN ──────────────────────────────────────────────────────────────────────

/**
 * Compute VPIN (Volume-Synchronized Probability of Informed Trading).
 *
 * Algorithm (Easley, López de Prado & O'Hara 2012):
 *   1. Sort trades into equal-volume buckets of size V_τ
 *   2. In each bucket, sum buy volume and sell volume
 *   3. VPIN = mean(|V_buy − V_sell|) / V_τ over the last n buckets
 *
 * V_τ is typically set to (average daily volume) / 50. If you don't know ADV,
 * set bucketSize to totalVolume / (windowBuckets * 2) as a reasonable default.
 *
 * Interpretation:
 *   < 0.25 → Low: flow is mostly uninformed, safe to tighten quotes
 *   0.25–0.50 → Elevated: mixed flow, quote normally
 *   0.50–0.70 → High: flow is toxic, widen quotes
 *   > 0.70 → Extreme: stop quoting, informed trading event in progress
 *
 * @param ticks        Classified trade ticks (buy/sell)
 * @param bucketSize   Total volume per bucket (base token units)
 * @param windowBuckets Number of buckets in rolling window (default 50)
 */
export function computeVPIN(
  ticks: TradeTick[],
  bucketSize: number,
  windowBuckets = 50,
): VPINResult {
  if (ticks.length === 0 || bucketSize <= 0) {
    return { vpin: 0, buckets: [], interpretation: 'low', pauseThreshold: 0.7 }
  }

  const buckets: VPINBucket[] = []
  let bucketBuy = 0
  let bucketSell = 0
  let bucketTotal = 0

  for (const tick of ticks) {
    let remaining = tick.size

    while (remaining > 0) {
      const capacity = bucketSize - bucketTotal
      const fill = Math.min(remaining, capacity)

      if (tick.side === 'buy') bucketBuy += fill
      else bucketSell += fill
      bucketTotal += fill
      remaining -= fill

      if (bucketTotal >= bucketSize) {
        buckets.push({
          buyVolume: bucketBuy,
          sellVolume: bucketSell,
          totalVolume: bucketTotal,
          imbalance: Math.abs(bucketBuy - bucketSell) / bucketTotal,
        })
        bucketBuy = 0
        bucketSell = 0
        bucketTotal = 0
      }
    }
  }

  if (buckets.length === 0) {
    return { vpin: 0, buckets: [], interpretation: 'low', pauseThreshold: 0.7 }
  }

  // Rolling window: take the last `windowBuckets` completed buckets
  const window = buckets.slice(-windowBuckets)
  const vpin = window.reduce((sum, b) => sum + b.imbalance, 0) / window.length

  return {
    vpin,
    buckets: window,
    interpretation: vpinInterpretation(vpin),
    pauseThreshold: 0.7,
  }
}

function vpinInterpretation(vpin: number): 'low' | 'elevated' | 'high' | 'extreme' {
  if (vpin >= 0.7) return 'extreme'
  if (vpin >= 0.5) return 'high'
  if (vpin >= 0.25) return 'elevated'
  return 'low'
}

/**
 * Compute a suitable bucket size from a tick series.
 * Sets V_τ = totalVolume / (targetBuckets * 2) — targets roughly targetBuckets
 * completed buckets from the series, which gives enough history for VPIN.
 */
export function inferBucketSize(ticks: TradeTick[], targetBuckets = 100): number {
  const total = ticks.reduce((sum, t) => sum + t.size, 0)
  return total / (targetBuckets * 2)
}

// ── Depth Metrics ─────────────────────────────────────────────────────────────

/**
 * Estimate the total available liquidity within a price band around mid.
 * bandBps = 100 means within 1% of mid on each side.
 */
export function liquidityWithinBand(
  book: OrderBook,
  bandBps: number,
): { bidUsd: number; askUsd: number; totalUsd: number } {
  const bandFactor = bandBps / 10_000
  const bidFloor = book.midPrice * (1 - bandFactor)
  const askCeiling = book.midPrice * (1 + bandFactor)

  const bidUsd = book.bids
    .filter((l) => l.price >= bidFloor)
    .reduce((sum, l) => sum + l.sizeUsd, 0)

  const askUsd = book.asks
    .filter((l) => l.price <= askCeiling)
    .reduce((sum, l) => sum + l.sizeUsd, 0)

  return { bidUsd, askUsd, totalUsd: bidUsd + askUsd }
}

/**
 * Find the price at which a market order of `sizeUsd` would exhaust the book.
 * Returns the average fill price (VWAP of the levels consumed).
 */
export function estimateFillPrice(
  book: OrderBook,
  side: 'buy' | 'sell',
  sizeUsd: number,
): { avgFillPrice: number; priceImpactPct: number; fullFill: boolean } {
  const levels = side === 'buy' ? book.asks : book.bids
  let remaining = sizeUsd
  let weightedPrice = 0
  let totalFilled = 0

  for (const level of levels) {
    const fill = Math.min(remaining, level.sizeUsd)
    weightedPrice += level.price * fill
    totalFilled += fill
    remaining -= fill
    if (remaining <= 0) break
  }

  if (totalFilled === 0) return { avgFillPrice: 0, priceImpactPct: 0, fullFill: false }

  const avgFillPrice = weightedPrice / totalFilled
  const ref = side === 'buy' ? book.bestAsk : book.bestBid
  const priceImpactPct = ref > 0 ? Math.abs((avgFillPrice - ref) / ref) * 100 : 0

  return { avgFillPrice, priceImpactPct, fullFill: remaining <= 0 }
}

// ── Real-time polling ─────────────────────────────────────────────────────────

/**
 * Poll the order book at a fixed interval and invoke callback on each update.
 * Returns a stop function.
 *
 * @param intervalMs  Polling interval in ms (default 5000 — don't go below 1000 to respect Jupiter rate limits)
 */
export function watchOrderBook(
  params: Parameters<typeof getOrderBook>[0],
  callback: (book: OrderBook, vpin?: VPINResult) => void,
  options?: {
    intervalMs?: number
    /** If provided, track ticks and compute VPIN on each poll */
    vpinBucketSize?: number
    vpinWindowBuckets?: number
  },
): () => void {
  const intervalMs = options?.intervalMs ?? 5_000
  const tapeBuffer: TradeTick[] = []
  let prevBook: OrderBook | null = null
  let active = true

  async function poll() {
    if (!active) return
    try {
      const book = await getOrderBook(params)

      // Synthetic tick: treat mid-price move as a trade tick for VPIN
      if (prevBook && options?.vpinBucketSize) {
        const midMoved = book.midPrice !== prevBook.midPrice
        if (midMoved) {
          const side = classifyTrade(book.midPrice, prevBook.midPrice, tapeBuffer[tapeBuffer.length - 1]?.side)
          // Use best-bid liquidity as a proxy for trade size
          tapeBuffer.push({
            timestamp: book.timestamp,
            price: book.midPrice,
            size: book.bids[0]?.size ?? 0,
            side,
          })
          // Keep tape bounded: 10k ticks
          if (tapeBuffer.length > 10_000) tapeBuffer.splice(0, tapeBuffer.length - 10_000)
        }
      }

      let vpin: VPINResult | undefined
      if (options?.vpinBucketSize && tapeBuffer.length > 0) {
        vpin = computeVPIN(tapeBuffer, options.vpinBucketSize, options.vpinWindowBuckets)
      }

      prevBook = book
      callback(book, vpin)
    } catch {
      // silently skip failed polls — network hiccups shouldn't kill the watcher
    }

    if (active) setTimeout(poll, intervalMs)
  }

  poll()
  return () => { active = false }
}
