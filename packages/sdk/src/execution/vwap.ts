// VWAP (Volume-Weighted Average Price) executor.
//
// Participates in the market proportional to the historical intraday volume profile.
// If 30% of daily volume trades in the 9–10am window, VWAP sends 30% of the order then.
//
// VWAP minimizes market impact relative to the market VWAP benchmark —
// the standard performance metric for institutional execution desks.
//
// For crypto on Solana: we approximate the volume profile from OHLCV candle data.
// In production, replace with a rolling 30-day average profile per token.

import type { Keypair, Connection } from '@solana/web3.js'
import { jupiterSwap } from '../solana/jupiter.js'
import type { JupiterSwapResult } from '../solana/jupiter.js'

// ── Volume Profile ────────────────────────────────────────────────────────────

export interface VolumeBucket {
  /** Start of this bucket (Unix timestamp in ms) */
  startMs: number
  /** Duration of this bucket in ms */
  durationMs: number
  /** Fraction of daily volume that trades in this bucket (0–1, sums to 1) */
  volumeFraction: number
}

/**
 * Build a flat volume profile (equal participation) — fallback when no data.
 */
export function flatVolumeProfile(numBuckets: number, windowMs: number): VolumeBucket[] {
  const fraction = 1 / numBuckets
  const bucketMs = windowMs / numBuckets
  const now = Date.now()
  return Array.from({ length: numBuckets }, (_, i) => ({
    startMs: now + i * bucketMs,
    durationMs: bucketMs,
    volumeFraction: fraction,
  }))
}

/**
 * Build a volume profile from OHLCV candle volumes.
 * Normalizes raw volumes so fractions sum to 1.
 *
 * @param candles Array of { timestamp, volume } — oldest first
 * @param startMs When the execution window begins
 * @param windowMs Total execution window in ms
 */
export function buildVolumeProfile(
  candles: Array<{ timestamp: number; volume: number }>,
  startMs: number,
  windowMs: number,
): VolumeBucket[] {
  if (candles.length === 0) return flatVolumeProfile(12, windowMs)

  const totalVol = candles.reduce((s, c) => s + c.volume, 0)
  if (totalVol === 0) return flatVolumeProfile(candles.length, windowMs)

  const bucketMs = windowMs / candles.length
  return candles.map((c, i) => ({
    startMs: startMs + i * bucketMs,
    durationMs: bucketMs,
    volumeFraction: c.volume / totalVol,
  }))
}

// ── VWAP Execution ────────────────────────────────────────────────────────────

export interface VwapConfig {
  totalSize: number
  side: 'buy' | 'sell'
  baseMint: string
  quoteMint: string
  baseDecimals: number
  quoteDecimals?: number
  slippageBps?: number
  /** Minimum slice size — skip buckets whose allocation < this to avoid dust */
  minSliceSize?: number
}

export interface VwapSlice {
  index: number
  scheduledAt: number
  executedAt?: number
  /** Allocated size per volume profile */
  allocatedSize: number
  /** Actual size sent (may differ from allocated if minSlice filtering applied) */
  size: number
  volumeFraction: number
  status: 'pending' | 'filled' | 'failed' | 'skipped'
  fillPrice?: number
  fillSize?: number
  txSignature?: string
  error?: string
}

export interface VwapResult {
  config: VwapConfig
  slices: VwapSlice[]
  avgFillPrice: number
  totalFilled: number
  totalQuoteSpent: number
  /** Market VWAP over the execution window (set externally if you have it) */
  marketVwap?: number
  /** Performance vs market VWAP in bps (negative = outperformed) */
  vwapSlippageBps?: number
  startedAt: number
  completedAt: number
}

export interface VwapCallbacks {
  onBeforeSlice?: (slice: VwapSlice) => boolean | Promise<boolean>
  onSliceFill?: (slice: VwapSlice, result: VwapResult) => void
  onComplete?: (result: VwapResult) => void
}

/**
 * Execute a VWAP order following the given volume profile.
 *
 * Each bucket fires at its scheduled time and sends a child order sized
 * proportionally to that bucket's share of daily volume.
 */
export async function executeVwap(
  config: VwapConfig,
  profile: VolumeBucket[],
  keypair: Keypair,
  connection: Connection,
  callbacks?: VwapCallbacks,
): Promise<VwapResult> {
  const {
    totalSize,
    side,
    baseMint,
    quoteMint,
    baseDecimals,
    quoteDecimals = 6,
    slippageBps = 50,
    minSliceSize = 0,
  } = config

  const startedAt = Date.now()

  const slices: VwapSlice[] = profile.map((bucket, i) => ({
    index: i,
    scheduledAt: bucket.startMs,
    allocatedSize: totalSize * bucket.volumeFraction,
    size: totalSize * bucket.volumeFraction,
    volumeFraction: bucket.volumeFraction,
    status: 'pending' as const,
  }))

  let totalFilled = 0
  let totalQuoteSpent = 0
  let weightedPriceSum = 0

  for (const slice of slices) {
    const waitMs = slice.scheduledAt - Date.now()
    if (waitMs > 0) await sleep(waitMs)

    if (slice.size < minSliceSize) {
      slice.status = 'skipped'
      continue
    }

    if (callbacks?.onBeforeSlice) {
      const proceed = await callbacks.onBeforeSlice(slice)
      if (proceed === false) {
        slice.status = 'skipped'
        continue
      }
    }

    slice.executedAt = Date.now()

    try {
      const inputMint    = side === 'buy' ? quoteMint : baseMint
      const outputMint   = side === 'buy' ? baseMint  : quoteMint
      const inputDecimals = side === 'buy' ? quoteDecimals : baseDecimals

      const fill: JupiterSwapResult = await jupiterSwap({
        inputMint,
        outputMint,
        amount: slice.size,
        inputDecimals,
        slippageBps,
        keypair,
        connection,
      })

      const inAmt  = Number(fill.inputAmount)  / 10 ** inputDecimals
      const outAmt = Number(fill.outputAmount) / 10 ** (side === 'buy' ? baseDecimals : quoteDecimals)
      const fillPrice = side === 'buy' ? inAmt / outAmt : outAmt / inAmt

      slice.status      = 'filled'
      slice.fillPrice   = fillPrice
      slice.fillSize    = side === 'buy' ? outAmt : inAmt
      slice.txSignature = fill.signature

      totalFilled     += slice.fillSize
      totalQuoteSpent += side === 'buy' ? inAmt : outAmt
      weightedPriceSum += fillPrice * slice.fillSize
    } catch (err) {
      slice.status = 'failed'
      slice.error  = err instanceof Error ? err.message : String(err)
    }

    const partial = buildResult(config, slices, totalFilled, totalQuoteSpent, weightedPriceSum, startedAt)
    callbacks?.onSliceFill?.(slice, partial)
  }

  const result = buildResult(config, slices, totalFilled, totalQuoteSpent, weightedPriceSum, startedAt)
  callbacks?.onComplete?.(result)
  return result
}

function buildResult(
  config: VwapConfig,
  slices: VwapSlice[],
  totalFilled: number,
  totalQuoteSpent: number,
  weightedPriceSum: number,
  startedAt: number,
): VwapResult {
  return {
    config,
    slices,
    avgFillPrice: totalFilled > 0 ? weightedPriceSum / totalFilled : 0,
    totalFilled,
    totalQuoteSpent,
    startedAt,
    completedAt: Date.now(),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Compute the realized VWAP of a set of fills.
 * Use this to benchmark your execution against the market VWAP.
 */
export function computeRealizedVwap(fills: Array<{ price: number; size: number }>): number {
  const totalSize = fills.reduce((s, f) => s + f.size, 0)
  if (totalSize === 0) return 0
  return fills.reduce((s, f) => s + f.price * f.size, 0) / totalSize
}

/**
 * Annotate a VwapResult with the observed market VWAP for performance attribution.
 */
export function annotateMarketVwap(result: VwapResult, marketVwap: number): VwapResult {
  const vwapSlippageBps =
    marketVwap > 0 ? ((result.avgFillPrice - marketVwap) / marketVwap) * 10_000 : undefined
  return { ...result, marketVwap, vwapSlippageBps }
}
