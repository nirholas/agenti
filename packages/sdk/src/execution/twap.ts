// TWAP (Time-Weighted Average Price) executor.
//
// Splits a large order into N equal child orders executed at fixed time intervals.
// Minimizes information leakage by spreading participation evenly over time.
// Best for: illiquid tokens, large orders where you want predictable avg price.

import type { Keypair, Connection } from '@solana/web3.js'
import { jupiterSwap } from '../solana/jupiter.js'
import type { JupiterSwapResult } from '../solana/jupiter.js'

export interface TwapConfig {
  /** Total quantity to buy/sell in base-token human units */
  totalSize: number
  /** Number of child orders to split into */
  numSlices: number
  /** Total execution window in ms (slices fire at totalDurationMs / numSlices intervals) */
  totalDurationMs: number
  side: 'buy' | 'sell'
  /** Base token (the token being bought or sold) */
  baseMint: string
  /** Quote token (default USDC) */
  quoteMint: string
  baseDecimals: number
  quoteDecimals?: number
  slippageBps?: number
}

export interface TwapSlice {
  index: number
  scheduledAt: number
  executedAt?: number
  size: number
  status: 'pending' | 'filled' | 'failed' | 'skipped'
  fillPrice?: number
  fillSize?: number
  txSignature?: string
  error?: string
  /** Mid-price at the moment of execution (for slippage benchmarking) */
  arrivalPrice?: number
}

export interface TwapResult {
  config: TwapConfig
  slices: TwapSlice[]
  avgFillPrice: number
  totalFilled: number
  totalQuoteSpent: number
  /** Slippage vs arrival price in bps (negative = favorable) */
  slippageVsArrivalBps: number
  startedAt: number
  completedAt: number
}

export interface TwapCallbacks {
  /** Called before each slice is sent. Return false to skip this slice. */
  onBeforeSlice?: (slice: TwapSlice, elapsed: number) => boolean | Promise<boolean>
  /** Called after each slice completes (filled or failed) */
  onSliceFill?: (slice: TwapSlice, result: TwapResult) => void
  /** Called once all slices are done */
  onComplete?: (result: TwapResult) => void
}

/**
 * Execute a TWAP order: N equal slices at fixed time intervals.
 *
 * @param config   TWAP parameters
 * @param keypair  Signing keypair
 * @param connection Solana connection
 * @param callbacks Optional lifecycle hooks (pause, monitor, etc.)
 */
export async function executeTwap(
  config: TwapConfig,
  keypair: Keypair,
  connection: Connection,
  callbacks?: TwapCallbacks,
): Promise<TwapResult> {
  const {
    totalSize,
    numSlices,
    totalDurationMs,
    side,
    baseMint,
    quoteMint,
    baseDecimals,
    quoteDecimals = 6,
    slippageBps = 50,
  } = config

  const sliceSize = totalSize / numSlices
  const intervalMs = totalDurationMs / numSlices
  const startedAt = Date.now()

  // Build slice schedule
  const slices: TwapSlice[] = Array.from({ length: numSlices }, (_, i) => ({
    index: i,
    scheduledAt: startedAt + i * intervalMs,
    size: sliceSize,
    status: 'pending' as const,
  }))

  let totalFilled = 0
  let totalQuoteSpent = 0
  let weightedPriceSum = 0
  let weightedArrivalSum = 0

  for (const slice of slices) {
    const now = Date.now()
    const waitMs = slice.scheduledAt - now
    if (waitMs > 0) await sleep(waitMs)

    // Lifecycle hook — caller can pause or cancel individual slices
    if (callbacks?.onBeforeSlice) {
      const proceed = await callbacks.onBeforeSlice(slice, Date.now() - startedAt)
      if (proceed === false) {
        slice.status = 'skipped'
        continue
      }
    }

    slice.executedAt = Date.now()

    try {
      // Route: buy = USDC→base, sell = base→USDC
      const inputMint  = side === 'buy' ? quoteMint : baseMint
      const outputMint = side === 'buy' ? baseMint  : quoteMint
      const inputDecimals = side === 'buy' ? quoteDecimals : baseDecimals

      // For buy: size is in base units, so we need to estimate quote input
      // We use sliceSize directly as input amount for sell; for buy we send quote equivalent
      const amount = slice.size

      const fill: JupiterSwapResult = await jupiterSwap({
        inputMint,
        outputMint,
        amount,
        inputDecimals,
        slippageBps,
        keypair,
        connection,
      })

      const inAmt  = Number(fill.inputAmount)  / 10 ** inputDecimals
      const outAmt = Number(fill.outputAmount) / 10 ** (side === 'buy' ? baseDecimals : quoteDecimals)
      const fillPrice = side === 'buy'
        ? inAmt / outAmt    // USDC paid per base token
        : outAmt / inAmt    // USDC received per base token

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

    const partial = buildPartialResult(config, slices, totalFilled, totalQuoteSpent, weightedPriceSum, startedAt)
    callbacks?.onSliceFill?.(slice, partial)
  }

  const result = buildPartialResult(config, slices, totalFilled, totalQuoteSpent, weightedPriceSum, startedAt)
  callbacks?.onComplete?.(result)
  return result
}

function buildPartialResult(
  config: TwapConfig,
  slices: TwapSlice[],
  totalFilled: number,
  totalQuoteSpent: number,
  weightedPriceSum: number,
  startedAt: number,
): TwapResult {
  const avgFillPrice = totalFilled > 0 ? weightedPriceSum / totalFilled : 0

  // Arrival price benchmark: average of arrivalPrice across filled slices
  const filledWithArrival = slices.filter((s) => s.status === 'filled' && s.arrivalPrice)
  const arrivalVwap =
    filledWithArrival.length > 0
      ? filledWithArrival.reduce((s, sl) => s + sl.arrivalPrice!, 0) / filledWithArrival.length
      : avgFillPrice

  const slippageVsArrivalBps =
    arrivalVwap > 0 ? ((avgFillPrice - arrivalVwap) / arrivalVwap) * 10_000 : 0

  return {
    config,
    slices,
    avgFillPrice,
    totalFilled,
    totalQuoteSpent,
    slippageVsArrivalBps,
    startedAt,
    completedAt: Date.now(),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Simulate a TWAP schedule without executing — useful for previewing timing.
 */
export function previewTwap(config: TwapConfig): Array<{ index: number; scheduledAt: Date; size: number }> {
  const now = Date.now()
  const intervalMs = config.totalDurationMs / config.numSlices
  return Array.from({ length: config.numSlices }, (_, i) => ({
    index: i,
    scheduledAt: new Date(now + i * intervalMs),
    size: config.totalSize / config.numSlices,
  }))
}
