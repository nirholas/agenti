/**
 * Phase 1: Market Microstructure
 *
 * Demonstrates:
 *   - Synthetic L2 order book from Jupiter (real liquidity depth across all Solana DEXs)
 *   - Spread metrics (absolute, bps, effective)
 *   - VPIN computation from a simulated trade tape
 *   - Real-time order book polling with VPIN updating
 */

import {
  getOrderBook,
  computeSpreadMetrics,
  computeVPIN,
  inferBucketSize,
  liquidityWithinBand,
  estimateFillPrice,
  classifyPriceSeries,
  watchOrderBook,
} from '@agenti/sdk'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

async function main() {
  console.log('── Phase 1: Market Microstructure Demo ──\n')

  // ── 1. Fetch L2 Order Book ────────────────────────────────────────────────

  console.log('Fetching SOL/USDC order book from Jupiter...')
  const book = await getOrderBook({
    mint: SOL_MINT,
    quoteMint: USDC_MINT,
    baseDecimals: 9,    // SOL has 9 decimals
    quoteDecimals: 6,   // USDC has 6 decimals
    depthUsd: [10, 50, 100, 500, 1_000, 5_000, 10_000, 50_000],
  })

  console.log(`\nSOL/USDC Order Book (${new Date(book.timestamp).toISOString()})`)
  console.log(`  Mid:      $${book.midPrice.toFixed(4)}`)
  console.log(`  Best Bid: $${book.bestBid.toFixed(4)}`)
  console.log(`  Best Ask: $${book.bestAsk.toFixed(4)}`)

  const spread = computeSpreadMetrics(book)
  console.log(`  Spread:   $${spread.absoluteSpread.toFixed(4)} | ${spread.spreadBps.toFixed(1)} bps | ${spread.effectiveSpreadPct.toFixed(3)}% effective`)

  console.log('\n  Ask side (what you pay to BUY):')
  for (const level of book.asks.slice(0, 5)) {
    console.log(`    $${level.price.toFixed(4)}  |  ${level.size.toFixed(2)} SOL  |  $${level.sizeUsd.toFixed(0)} notional  |  ${level.priceImpactPct.toFixed(3)}% impact`)
  }

  console.log('\n  Bid side (what you receive to SELL):')
  for (const level of book.bids.slice(0, 5)) {
    console.log(`    $${level.price.toFixed(4)}  |  ${level.size.toFixed(2)} SOL  |  $${level.sizeUsd.toFixed(0)} notional  |  ${level.priceImpactPct.toFixed(3)}% impact`)
  }

  // ── 2. Depth & Fill Estimation ────────────────────────────────────────────

  console.log('\n── Liquidity Depth ──')
  const band100 = liquidityWithinBand(book, 100)   // 1% band
  const band50  = liquidityWithinBand(book, 50)    // 0.5% band
  console.log(`  Within 0.5% of mid: $${band50.totalUsd.toFixed(0)} (bid $${band50.bidUsd.toFixed(0)} / ask $${band50.askUsd.toFixed(0)})`)
  console.log(`  Within 1.0% of mid: $${band100.totalUsd.toFixed(0)} (bid $${band100.bidUsd.toFixed(0)} / ask $${band100.askUsd.toFixed(0)})`)

  const buy10k  = estimateFillPrice(book, 'buy', 10_000)
  const sell10k = estimateFillPrice(book, 'sell', 10_000)
  console.log(`\n  Buy  $10k of SOL → avg fill $${buy10k.avgFillPrice.toFixed(4)} (+${buy10k.priceImpactPct.toFixed(3)}% impact)`)
  console.log(`  Sell $10k of SOL → avg fill $${sell10k.avgFillPrice.toFixed(4)} (-${sell10k.priceImpactPct.toFixed(3)}% impact)`)

  // ── 3. VPIN from Simulated Tape ───────────────────────────────────────────
  //
  // In production you'd feed real on-chain swap events here.
  // This simulates a 200-trade tape with a burst of informed buying at trade 150.

  console.log('\n── VPIN (Simulated Tape) ──')

  const prices: Array<{ timestamp: number; price: number; size: number }> = []
  let price = book.midPrice
  for (let i = 0; i < 200; i++) {
    // Simulate informed buying burst: sustained upward pressure from trade 150
    const drift = i >= 150 ? 0.003 : 0
    price = price * (1 + (Math.random() - 0.45 + drift) * 0.002)
    prices.push({ timestamp: Date.now() + i * 1000, price, size: Math.random() * 10 + 1 })
  }

  const ticks = classifyPriceSeries(prices)
  const bucketSize = inferBucketSize(ticks, 100)
  const vpin = computeVPIN(ticks, bucketSize, 50)

  console.log(`  VPIN: ${vpin.vpin.toFixed(3)} → ${vpin.interpretation.toUpperCase()}`)
  console.log(`  Buckets: ${vpin.buckets.length}`)
  console.log(`  Pause threshold: ${vpin.pauseThreshold} (stop quoting above this)`)

  if (vpin.interpretation === 'high' || vpin.interpretation === 'extreme') {
    console.log('  ⚠  Toxic flow detected — a market maker would widen quotes or pause.')
  } else {
    console.log('  ✓  Flow looks uninformed — safe to tighten quotes.')
  }

  // ── 4. Real-time Polling (5 ticks then stop) ──────────────────────────────

  console.log('\n── Live Order Book Polling (5 updates) ──')
  let count = 0
  const stop = watchOrderBook(
    { mint: SOL_MINT, quoteMint: USDC_MINT, baseDecimals: 9, quoteDecimals: 6 },
    (liveBook, liveVpin) => {
      count++
      const s = computeSpreadMetrics(liveBook)
      process.stdout.write(`  [${count}] mid $${liveBook.midPrice.toFixed(4)}  spread ${s.spreadBps.toFixed(1)} bps`)
      if (liveVpin) process.stdout.write(`  VPIN ${liveVpin.vpin.toFixed(3)} (${liveVpin.interpretation})`)
      process.stdout.write('\n')
      if (count >= 5) {
        stop()
        console.log('\nDone.')
      }
    },
    { intervalMs: 3_000 },
  )
}

main().catch(console.error)
