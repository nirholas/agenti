/**
 * Phase 2: Execution Algorithms
 *
 * Demonstrates:
 *   - Almgren-Chriss schedule: optimal child order sizing for a large trade
 *   - TWAP preview: equal slices over a time window
 *   - VWAP with a historical volume profile
 *   - Jupiter limit orders: place, query, cancel
 */

import {
  // Almgren-Chriss
  computeACSchedule,
  calibrateRiskAversion,
  formatACSchedule,
  // TWAP
  previewTwap,
  // VWAP
  buildVolumeProfile,
  flatVolumeProfile,
  computeRealizedVwap,
  // Limit orders
  limitBuy,
  limitSell,
  cancelLimitOrders,
  getOpenLimitOrders,
} from '@agenti/sdk'

const SOL_MINT  = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

async function main() {
  console.log('── Phase 2: Execution Algorithms ──\n')

  // ── 1. Almgren-Chriss: optimal schedule ───────────────────────────────────

  console.log('── Almgren-Chriss Schedule ──')
  console.log('Goal: sell 1,000 SOL over 2 hours (24 × 5-min periods)')
  console.log()

  const dailyVol = 0.04   // 4% daily volatility
  const T = 2 * 3600      // 2 hours in seconds
  const N = 24            // 24 periods
  const tau = T / N       // 5 min per period
  const periodVol = dailyVol * Math.sqrt(tau / 86_400)

  for (const urgency of ['passive', 'moderate', 'aggressive', 'urgent'] as const) {
    const lambda = calibrateRiskAversion(urgency, T, dailyVol, 288, 0.5)
    const schedule = computeACSchedule({
      totalSize: 1_000,
      numPeriods: N,
      periodSeconds: tau,
      periodVolatility: periodVol,
      riskAversion: lambda,
      temporaryImpact: 0.5,
      permanentImpact: 0.1,
    })

    // Show first 4 slices and last slice
    const first3 = schedule.periods.slice(0, 3)
    const last   = schedule.periods[schedule.periods.length - 1]!
    console.log(`  [${urgency.padEnd(10)}] κ=${schedule.kappa.toFixed(4)}`)
    for (const p of first3) {
      console.log(`    period ${p.period}: ${p.tradeSize.toFixed(1).padStart(7)} SOL (${(p.fraction * 100).toFixed(1)}%)`)
    }
    console.log(`    ...`)
    console.log(`    period ${last.period}: ${last.tradeSize.toFixed(1).padStart(7)} SOL (${(last.fraction * 100).toFixed(1)}%)`)
    console.log(`    Expected cost: ${schedule.expectedCost.toFixed(2)} | Variance: ${schedule.costVariance.toFixed(2)}`)
    console.log()
  }

  // ── 2. TWAP Preview ───────────────────────────────────────────────────────

  console.log('── TWAP Preview: 500 SOL over 1 hour, 12 slices ──')
  const twapSlices = previewTwap({
    totalSize: 500,
    numSlices: 12,
    totalDurationMs: 60 * 60 * 1000,
    side: 'sell',
    baseMint: SOL_MINT,
    quoteMint: USDC_MINT,
    baseDecimals: 9,
  })
  for (const s of twapSlices.slice(0, 4)) {
    console.log(`  Slice ${s.index}: ${s.size.toFixed(2)} SOL at ${s.scheduledAt.toLocaleTimeString()}`)
  }
  console.log(`  ... (${twapSlices.length} total slices, ${twapSlices[0]!.size.toFixed(2)} SOL each)`)

  // ── 3. VWAP with Volume Profile ───────────────────────────────────────────

  console.log('\n── VWAP Volume Profile ──')

  // Simulate historical candle data (in production: fetch from CoinGecko or Helius)
  const mockCandles = Array.from({ length: 12 }, (_, i) => ({
    timestamp: Date.now() + i * 5 * 60 * 1000,
    // U-shaped intraday volume (more at open/close, less midday)
    volume: 1000 + Math.abs(6 - i) * 200 + Math.random() * 100,
  }))

  const windowMs = 60 * 60 * 1000  // 1 hour
  const profile  = buildVolumeProfile(mockCandles, Date.now(), windowMs)

  console.log('  Volume profile (normalized):')
  for (const bucket of profile.slice(0, 6)) {
    const bar = '█'.repeat(Math.round(bucket.volumeFraction * 100))
    console.log(`  ${(bucket.volumeFraction * 100).toFixed(1).padStart(5)}%  ${bar}`)
  }
  console.log(`  ... (${profile.length} buckets)`)

  // Show how 200 SOL would be allocated
  console.log('\n  200 SOL allocation by bucket:')
  for (const bucket of profile.slice(0, 4)) {
    console.log(`    ${(bucket.volumeFraction * 200).toFixed(2)} SOL`)
  }

  // Realized VWAP from mock fills
  const mockFills = profile.map((b) => ({
    price: 140 + Math.random() * 2 - 1,    // ~$140 with noise
    size: b.volumeFraction * 200,
  }))
  const realizedVwap = computeRealizedVwap(mockFills)
  console.log(`\n  Realized VWAP: $${realizedVwap.toFixed(4)}`)

  // ── 4. Limit Orders (read-only query demo) ────────────────────────────────

  console.log('\n── Limit Orders ──')
  console.log('  In production:')
  console.log()
  console.log('  // Buy 10 SOL at $135 (GTC):')
  console.log('  const order = await limitBuy({')
  console.log('    baseMint: SOL_MINT, quoteMint: USDC_MINT,')
  console.log('    baseDecimals: 9, quoteDecimals: 6,')
  console.log('    limitPrice: 135, baseAmount: 10,')
  console.log('    keypair, connection,')
  console.log('  })')
  console.log()
  console.log('  // Sell 5 SOL at $155 expiring in 24h:')
  console.log('  const sellOrder = await limitSell({')
  console.log('    baseMint: SOL_MINT, quoteMint: USDC_MINT,')
  console.log('    baseDecimals: 9, quoteDecimals: 6,')
  console.log('    limitPrice: 155, baseAmount: 5,')
  console.log('    keypair, connection,')
  console.log('    expiredAt: Math.floor(Date.now() / 1000) + 86400,')
  console.log('  })')
  console.log()
  console.log('  // Query open orders:')
  console.log('  const open = await getOpenLimitOrders(wallet, { inputMint: USDC_MINT })')
  console.log()
  console.log('  // Cancel all:')
  console.log('  await cancelLimitOrders([], keypair, connection)')
  console.log()
  console.log('Done.')
}

main().catch(console.error)
