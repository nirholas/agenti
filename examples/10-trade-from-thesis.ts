/**
 * Example: Agent reads a tweet/thesis, extracts trading ideas,
 * routes to the best market, and calculates P&L on an existing position.
 */

import { extractTradingIdeas, routeIdea, calculatePnl } from '@agenti/sdk'
import type { TradeRecord } from '@agenti/sdk'

async function main() {
  // --- 1. Extract trading ideas from raw text ---
  const tweet = `
    BTC looking really bullish after the ETF approval news today.
    I'm long BTC and also accumulating SOL at these levels.
    ETH needs to hold 3k or we could see more downside.
  `

  console.log('Extracting trading ideas from text...\n')
  const ideas = await extractTradingIdeas(tweet)

  for (const idea of ideas) {
    console.log(`[${idea.instrument}] ${idea.direction.toUpperCase()} — confidence: ${(idea.confidence * 100).toFixed(0)}%`)
    console.log(`  Timeframe: ${idea.timeframe}`)
    console.log(`  Thesis: ${idea.thesis}`)
    console.log(`  Suggested markets:`)
    for (const market of idea.suggestedMarkets) {
      console.log(`    - ${market.name} (${market.type})`)
    }
    console.log()
  }

  // --- 2. Manually route an idea to best available market ---
  if (ideas.length > 0) {
    const topIdea = ideas[0]!
    console.log(`\nRouting ${topIdea.instrument} ${topIdea.direction} trade...`)

    const markets = routeIdea(topIdea, {
      hasEvm: true,    // have an EVM wallet → Hyperliquid perps available
      hasSolana: true, // have a Solana wallet → Jupiter/pump.fun available
      hasBinance: false,
    })

    console.log('Best market:', markets[0])
    console.log('All options:', markets.map(m => m.name).join(', '))
  }

  // --- 3. Calculate P&L on a hypothetical BTC long entered at 84k ---
  console.log('\nCalculating P&L for a BTC long from $84,000...')
  const trade: TradeRecord = {
    id: 'example-trade-1',
    instrument: 'BTC',
    direction: 'long',
    market: 'Hyperliquid BTC-PERP',
    entryPrice: 84_000,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 1 week ago
    thesis: 'BTC bullish after ETF approval',
    author: '@trader',
  }

  try {
    const pnl = await calculatePnl(trade)
    console.log(`Current BTC price: $${pnl.currentPrice.toLocaleString()}`)
    console.log(`P&L: ${pnl.pnlPercent.toFixed(2)}% ($${pnl.pnlUsd.toFixed(2)} per BTC)`)
    console.log(pnl.pnlPercent > 0 ? '✓ Position is profitable' : '✗ Position is underwater')
  } catch (err) {
    console.error('P&L fetch failed (likely rate limited):', err instanceof Error ? err.message : err)
  }
}

main().catch(console.error)
