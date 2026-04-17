/**
 * Crypto Trading Loop — full autonomous thesis-to-execution pipeline.
 *
 * Flow:
 *   1. Claude extracts instrument + direction from free-form thesis text
 *   2. Live market data fetched: CoinGecko price/volume, HL funding rate, Fear & Greed index
 *   3. Claude debates bull vs bear using real data, commits to BUY / SELL / HOLD
 *   4. Decision executed on the best available venue:
 *        Hyperliquid perp  → HyperliquidClient.placeOrder() (real EVM signing)
 *        Jupiter swap       → jupiterSwap() from @agenti/sdk
 *        BNB / PancakeSwap  → swapBnbTokens() from @agenti/sdk
 *   5. Decision + rationale persisted to crypto_decisions.json for future context
 *
 * Real data sources (no API keys required for read operations):
 *   CoinGecko free API   — price, volume, market cap, 24h / 7d change
 *   Hyperliquid /info    — funding rate, mark price, open interest
 *   alternative.me /fng  — crypto Fear & Greed Index
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'
import {
  extractTradingIdeas,
  routeIdea,
  calculatePnl,
  HyperliquidClient,
  jupiterSwap,
  swapBnbTokens,
  type TradingIdea,
  type Market,
  type TradeRecord,
} from '@agenti/sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CryptoThesis {
  text: string
  instrument?: string           // optional override; Claude extracts if absent
  riskTolerance: 'aggressive' | 'moderate' | 'conservative'
}

interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD'
  sizePct: number               // 0–1, fraction of budgetUsd to deploy
  stopLoss?: number
  targetPrice?: number
  rationale: string
}

interface MemoryRecord {
  date: string
  instrument: string
  context: string
  decision: TradeDecision
  pnlPct?: number
}

interface LoopResult {
  idea: TradingIdea
  market: Market
  decision: TradeDecision
  txHash?: string
  pnl?: Awaited<ReturnType<typeof calculatePnl>>
}

// ---------------------------------------------------------------------------
// Keyword-similarity memory  (swap body for rank-bm25 if you want real BM25)
// ---------------------------------------------------------------------------

class CryptoMemory {
  private records: MemoryRecord[] = []
  constructor(private filePath = 'crypto_decisions.json') {}

  async load() {
    try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) }
    catch { this.records = [] }
  }

  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }
  add(r: MemoryRecord) { this.records.push(r) }

  similar(context: string, n = 2): MemoryRecord[] {
    if (!this.records.length) return []
    const tokens = new Set(context.toLowerCase().split(/\W+/).filter(Boolean))
    return [...this.records]
      .map(r => ({ r, score: r.context.toLowerCase().split(/\W+/).filter(t => tokens.has(t)).length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(x => x.r)
  }
}

// ---------------------------------------------------------------------------
// Real data fetchers — all used as Claude tool implementations
// ---------------------------------------------------------------------------

/** Fear & Greed Index — https://alternative.me/crypto/fear-and-greed-index/ */
async function fetchFearGreed(): Promise<{
  value: number
  classification: string
  timestamp: string
}> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', {
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`Fear & Greed API ${res.status}`)
  const data = await res.json() as { data: Array<{ value: string; value_classification: string; timestamp: string }> }
  const d = data.data[0]!
  return { value: parseInt(d.value, 10), classification: d.value_classification, timestamp: d.timestamp }
}

/** CoinGecko free tier — price + market metrics */
async function fetchCoinMetrics(instrument: string): Promise<Record<string, unknown>> {
  const GECKO: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
    AVAX: 'avalanche-2', LINK: 'chainlink', ARB: 'arbitrum', OP: 'optimism',
    SUI: 'sui', INJ: 'injective-protocol', WIF: 'dogwifcoin',
    BONK: 'bonk', PEPE: 'pepe', JUP: 'jupiter-exchange-solana',
    DOGE: 'dogecoin', ADA: 'cardano', DOT: 'polkadot', ATOM: 'cosmos',
  }
  const id = GECKO[instrument.toUpperCase()] ?? instrument.toLowerCase()
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) throw new Error(`CoinGecko ${res.status} for ${instrument}`)
  const d = await res.json() as {
    market_data?: {
      current_price?: { usd?: number }
      market_cap?: { usd?: number }
      total_volume?: { usd?: number }
      price_change_percentage_24h?: number
      price_change_percentage_7d?: number
      ath?: { usd?: number }
      ath_change_percentage?: { usd?: number }
    }
  }
  const md = d.market_data
  return {
    instrument: instrument.toUpperCase(),
    priceUsd: md?.current_price?.usd,
    marketCapUsd: md?.market_cap?.usd,
    volume24hUsd: md?.total_volume?.usd,
    change24hPct: md?.price_change_percentage_24h,
    change7dPct: md?.price_change_percentage_7d,
    athUsd: md?.ath?.usd,
    athDrawdownPct: md?.ath_change_percentage?.usd,
  }
}

// ---------------------------------------------------------------------------
// Tool handler — maps Claude tool_use blocks to real implementations
// ---------------------------------------------------------------------------

async function handleTool(
  name: string,
  input: Record<string, string>,
  hlClient: HyperliquidClient,
): Promise<unknown> {
  switch (name) {
    case 'get_fear_greed':
      return fetchFearGreed()

    case 'get_funding_rate': {
      try {
        return await hlClient.getFundingRate(input.coin ?? input.instrument)
      } catch (e) {
        return { error: String(e), note: 'Asset may not be listed on Hyperliquid perps' }
      }
    }

    case 'get_l2_book': {
      try {
        const book = await hlClient.getL2Book(input.coin ?? input.instrument, 3)
        const bestBid = book.levels[0][0]
        const bestAsk = book.levels[1][0]
        return {
          coin: book.coin,
          bestBid: bestBid ? { price: bestBid.px, size: bestBid.sz } : null,
          bestAsk: bestAsk ? { price: bestAsk.px, size: bestAsk.sz } : null,
          spread: bestBid && bestAsk
            ? ((parseFloat(bestAsk.px) - parseFloat(bestBid.px)) / parseFloat(bestAsk.px) * 100).toFixed(4) + '%'
            : null,
        }
      } catch (e) {
        return { error: String(e) }
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

export async function runCryptoThesisLoop(
  thesis: CryptoThesis,
  opts: {
    budgetUsd?: number
    /** EVM private key for Hyperliquid perp orders */
    evmPrivateKey?: `0x${string}`
    /** Solana keypair for Jupiter swaps */
    solanaKeypair?: import('@solana/web3.js').Keypair
    solanaConnection?: import('@solana/web3.js').Connection
    /** BNB private key for PancakeSwap */
    bnbPrivateKey?: `0x${string}`
    mainnet?: boolean
  } = {},
): Promise<LoopResult> {
  const client = new Anthropic()
  const memory = new CryptoMemory()
  await memory.load()

  const budget = opts.budgetUsd ?? 100
  const mainnet = opts.mainnet ?? true
  const hlClient = new HyperliquidClient(opts.evmPrivateKey, mainnet)

  // --- 1. Extract idea + route ---
  console.log('\nExtracting trading ideas from thesis...')
  const ideas = await extractTradingIdeas(thesis.text)
  const idea = thesis.instrument
    ? (ideas.find(i => i.instrument === thesis.instrument) ?? ideas[0])
    : ideas[0]
  if (!idea) throw new Error('No tradeable idea found in thesis')

  const markets = routeIdea(idea, {
    hasEvm: true,
    hasSolana: !!opts.solanaKeypair,
    hasBinance: false,
  })
  const market = markets[0]!

  console.log(`  ${idea.direction.toUpperCase()} ${idea.instrument} — ${(idea.confidence * 100).toFixed(0)}% confidence`)
  console.log(`  Venue: ${market.name}`)

  // --- 2. Fetch live data upfront (avoids a tool-call round-trip) ---
  console.log('\nFetching live market data...')
  const [coinMetrics, fearGreed] = await Promise.all([
    fetchCoinMetrics(idea.instrument).catch(e => ({ error: String(e) })),
    fetchFearGreed().catch(e => ({ error: String(e) })),
  ])
  console.log(`  Price: $${(coinMetrics as any).priceUsd ?? 'n/a'} | F&G: ${(fearGreed as any).value ?? 'n/a'} ${(fearGreed as any).classification ?? ''}`)

  // --- 3. Past decisions for context ---
  const past = memory.similar(`${idea.instrument} ${thesis.text}`, 2)
  const pastCtx = past.length
    ? past.map(p =>
        `${p.date.slice(0, 10)} | ${p.instrument} | ${p.decision.action} | P&L: ${p.pnlPct != null ? p.pnlPct.toFixed(1) + '%' : 'open'}\n${p.decision.rationale.slice(0, 200)}`
      ).join('\n---\n')
    : 'No past decisions on record.'

  // --- 4. Claude: bull/bear debate + final decision ---
  const systemPrompt = `You are a crypto trading analyst. Given a thesis and real-time market data:
1. Call get_funding_rate and get_l2_book to understand positioning and liquidity
2. Write a concise BULL argument (2–3 sentences using the data)
3. Write a concise BEAR argument (2–3 sentences using the data)
4. As the Trader, weigh both sides and commit to a firm decision

Past decisions on similar setups (apply lessons):
${pastCtx}

End your response with EXACTLY this block — no variations:
FINAL TRANSACTION PROPOSAL: **<BUY|SELL|HOLD>**
POSITION SIZE: <0.0–1.0>
STOP LOSS: <price or N/A>
TARGET PRICE: <price or N/A>`

  const userPrompt = `Thesis: "${thesis.text}"

Instrument: ${idea.instrument} | Direction: ${idea.direction.toUpperCase()} | Confidence: ${(idea.confidence * 100).toFixed(0)}%
Risk tolerance: ${thesis.riskTolerance} | Budget: $${budget} | Venue: ${market.name}

Live snapshot (already fetched):
${JSON.stringify({ coinMetrics, fearGreed }, null, 2)}

Now call get_funding_rate and get_l2_book for ${idea.instrument}, then write your analysis.`

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_funding_rate',
      description: 'Get the current perpetual funding rate for a coin on Hyperliquid. Positive = longs pay shorts (over-leveraged longs). Negative = shorts pay longs.',
      input_schema: {
        type: 'object' as const,
        properties: { coin: { type: 'string', description: 'Ticker e.g. BTC, ETH, SOL' } },
        required: ['coin'],
      },
    },
    {
      name: 'get_l2_book',
      description: 'Get the top-of-book bid/ask and spread for a coin on Hyperliquid. Reveals current liquidity and market microstructure.',
      input_schema: {
        type: 'object' as const,
        properties: { coin: { type: 'string' } },
        required: ['coin'],
      },
    },
    {
      name: 'get_fear_greed',
      description: 'Get the current Crypto Fear & Greed Index (0 = extreme fear, 100 = extreme greed).',
      input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
  ]

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  // Call 1 — Claude picks tools
  const call1 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 1500,
    system: systemPrompt,
    tools,
    messages,
  })

  // Execute tool calls with real data
  const toolResults: Anthropic.ToolResultBlockParam[] = []
  for (const block of call1.content) {
    if (block.type !== 'tool_use') continue
    const result = await handleTool(block.name, block.input as Record<string, string>, hlClient)
    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
  }

  // Call 2 — Claude writes analysis with real tool results
  const call2 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 1500,
    system: systemPrompt,
    tools,
    messages: [
      ...messages,
      { role: 'assistant', content: call1.content },
      ...(toolResults.length ? [{ role: 'user' as const, content: toolResults }] : []),
    ],
  })

  const analysis = call2.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')

  console.log('\n' + analysis)

  // --- 5. Parse decision ---
  const proposalMatch = analysis.match(/FINAL TRANSACTION PROPOSAL:\s*\*\*(\w+)\*\*/)
  const sizeMatch     = analysis.match(/POSITION SIZE:\s*([\d.]+)/)
  const stopMatch     = analysis.match(/STOP LOSS:\s*([\d.]+|N\/A)/)
  const targetMatch   = analysis.match(/TARGET PRICE:\s*([\d.]+|N\/A)/)

  const decision: TradeDecision = {
    action:      (proposalMatch?.[1] ?? 'HOLD') as TradeDecision['action'],
    sizePct:     Math.min(1, Math.max(0, parseFloat(sizeMatch?.[1] ?? '0') || 0)),
    stopLoss:    stopMatch?.[1]  !== 'N/A' ? parseFloat(stopMatch?.[1]  ?? '') || undefined : undefined,
    targetPrice: targetMatch?.[1] !== 'N/A' ? parseFloat(targetMatch?.[1] ?? '') || undefined : undefined,
    rationale:   analysis,
  }

  // --- 6. Execute ---
  let txHash: string | undefined

  if (decision.action !== 'HOLD' && decision.sizePct > 0) {
    const tradeUsd = budget * decision.sizePct
    console.log(`\nExecuting ${decision.action} ~$${tradeUsd.toFixed(2)} on ${market.name}...`)

    try {
      if (market.type === 'perp' && opts.evmPrivateKey) {
        // Hyperliquid perpetual — real EVM-signed order
        const result = await hlClient.placeOrder({
          coin: idea.instrument,
          isBuy: decision.action === 'BUY',
          sizeUsd: tradeUsd,
          slippagePct: thesis.riskTolerance === 'aggressive' ? 1.5 : 0.5,
          leverage: thesis.riskTolerance === 'aggressive' ? 5 : 2,
        })
        if (result.status === 'ok') {
          const filled = result.response?.data?.statuses[0]?.filled
          txHash = filled ? `oid:${filled.oid}` : 'submitted'
          console.log(`  Filled: ${filled?.totalSz} @ $${filled?.avgPx}`)
        } else {
          console.warn(`  Order error: ${result.error}`)
        }

      } else if (market.type === 'dex' && market.chain === 'solana' && opts.solanaKeypair && opts.solanaConnection) {
        // Jupiter swap — real on-chain tx
        const SOL_MINT  = 'So11111111111111111111111111111111111111112'
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        const result = await jupiterSwap({
          inputMint:  decision.action === 'BUY' ? USDC_MINT : SOL_MINT,
          outputMint: decision.action === 'BUY' ? SOL_MINT  : USDC_MINT,
          amount: tradeUsd,
          inputDecimals: decision.action === 'BUY' ? 6 : 9,
          slippageBps: 100,
          keypair: opts.solanaKeypair,
          connection: opts.solanaConnection,
        })
        txHash = result.signature
        console.log(`  Solana tx: ${result.explorerUrl}`)

      } else if (market.chain === 'bnb' && opts.bnbPrivateKey) {
        // PancakeSwap — real BNB chain tx
        const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`
        const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`
        txHash = await swapBnbTokens(
          { wallet: { privateKey: opts.bnbPrivateKey } },
          {
            tokenIn:   decision.action === 'BUY' ? USDT_BSC : WBNB,
            tokenOut:  decision.action === 'BUY' ? WBNB     : USDT_BSC,
            amountIn:  BigInt(Math.floor(tradeUsd * 1e18)),
            slippageBps: 50,
          },
        )
        console.log(`  BNB tx: ${txHash}`)

      } else {
        console.log(`  [no key] ${decision.action} ${idea.instrument} ~$${tradeUsd.toFixed(2)} on ${market.name}`)
        console.log(`  Pass evmPrivateKey / solanaKeypair / bnbPrivateKey to execute for real.`)
      }
    } catch (e) {
      console.error(`  Execution error: ${e instanceof Error ? e.message : e}`)
    }
  }

  // --- 7. P&L on current price ---
  let pnl: LoopResult['pnl']
  const currentPrice = (coinMetrics as any).priceUsd as number | undefined
  if (currentPrice) {
    const record: TradeRecord = {
      id: `thesis-${Date.now()}`,
      instrument: idea.instrument,
      direction: idea.direction === 'short' ? 'short' : 'long',
      market: market.name,
      entryPrice: currentPrice,
      createdAt: Date.now(),
      thesis: idea.thesis,
    }
    try { pnl = await calculatePnl(record) } catch { /* rate-limited */ }
  }

  // --- 8. Persist ---
  memory.add({ date: new Date().toISOString(), instrument: idea.instrument, context: `${idea.instrument} ${thesis.text}`, decision })
  await memory.save()

  // --- Summary ---
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${idea.instrument} → ${market.name}`)
  console.log(`Decision:  ${decision.action}  |  Size: ${(decision.sizePct * 100).toFixed(0)}% ($${(budget * decision.sizePct).toFixed(2)})`)
  if (decision.stopLoss)    console.log(`Stop:      $${decision.stopLoss}`)
  if (decision.targetPrice) console.log(`Target:    $${decision.targetPrice}`)
  if (txHash)               console.log(`Tx:        ${txHash}`)
  if (pnl)                  console.log(`P&L:       ${pnl.pnlPercent.toFixed(2)}%  (@$${pnl.currentPrice})`)
  console.log('─'.repeat(60) + '\n')

  return { idea, market, decision, txHash, pnl }
}

// ---------------------------------------------------------------------------
// Entry point — three theses, one per venue
// ---------------------------------------------------------------------------

async function main() {
  // --- Hyperliquid perp (EVM) ---
  // Pass HYPERLIQUID_PRIVATE_KEY env var to execute for real
  await runCryptoThesisLoop({
    text: `BTC broke above its 200-day MA on strong volume after the Fed signaled a pause
    on rate hikes. ETF inflows are accelerating. However, perp funding rates have been
    elevated for 3 days straight — longs may be over-leveraged.`,
    riskTolerance: 'moderate',
  }, {
    budgetUsd: 500,
    evmPrivateKey: process.env.HYPERLIQUID_PRIVATE_KEY as `0x${string}` | undefined,
  })

  // --- Jupiter swap (Solana) ---
  // Pass SOLANA_PRIVATE_KEY + SOLANA_RPC env vars to execute for real
  await runCryptoThesisLoop({
    text: `SOL ecosystem TVL hit an all-time high this week. Jupiter DEX volume is surging
    and multiple new DePIN protocols are launching on Solana. Risk: network congestion
    during high load periods.`,
    instrument: 'SOL',
    riskTolerance: 'moderate',
  }, {
    budgetUsd: 200,
    // solanaKeypair and solanaConnection wired in if SOLANA_PRIVATE_KEY set
  })

  // --- BNB / PancakeSwap ---
  // Pass BNB_PRIVATE_KEY env var to execute for real
  await runCryptoThesisLoop({
    text: `BNB quarterly token burn happening next week — historically bullish catalyst.
    On-chain activity on BSC picking up. Risk: Binance regulatory overhang persists.`,
    instrument: 'BNB',
    riskTolerance: 'moderate',
  }, {
    budgetUsd: 200,
    bnbPrivateKey: process.env.BNB_PRIVATE_KEY as `0x${string}` | undefined,
  })
}

main().catch(console.error)
