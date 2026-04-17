/**
 * Crypto Trading Loop: thesis → bull/bear debate → decide → execute
 *
 * Builds on 10-trade-from-thesis.ts:
 *   - Uses extractTradingIdeas() + routeIdea() + calculatePnl() from @agenti/sdk
 *   - Layers a full Claude bull/bear debate on top of the extracted idea
 *   - Adds BM25-style memory to surface past similar decisions as context
 *   - Branches execution by market type:
 *       Hyperliquid perp  → REST-based order (EVM wallet)
 *       Jupiter / pump.fun → @agenti/sdk buy() / sell()
 *       BNB / PancakeSwap  → @agenti/sdk swapBnbTokens()
 *
 * Patterns adapted from:
 *   TradingAgents (Apache 2.0) — bull/bear debate, trader prompt, BM25 memory
 *   llm_trader (MIT)           — 6-turn discipline, price fallback chain
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'
import {
  extractTradingIdeas,
  routeIdea,
  calculatePnl,
  type TradingIdea,
  type Market,
  type TradeRecord,
} from '@agenti/sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CryptoThesis {
  text: string
  /** Override instrument if already known (e.g. 'BTC'). Otherwise Claude extracts it. */
  instrument?: string
  riskTolerance: 'aggressive' | 'moderate' | 'conservative'
}

interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD'
  /** 0–1: fraction of available budget to use */
  sizePct: number
  stopLoss?: number
  targetPrice?: number
  rationale: string
}

interface LoopResult {
  idea: TradingIdea
  market: Market
  decision: TradeDecision
  txHash?: string
  pnl?: { pnlPercent: number; pnlUsd: number; currentPrice: number }
}

// ---------------------------------------------------------------------------
// Keyword-similarity memory (drop-in for rank-bm25)
// ---------------------------------------------------------------------------

interface MemoryRecord {
  date: string
  instrument: string
  context: string
  decision: TradeDecision
  pnlPct?: number
}

class CryptoMemory {
  private records: MemoryRecord[] = []

  constructor(private filePath = 'crypto_decisions.json') {}

  async load() {
    try {
      this.records = JSON.parse(await readFile(this.filePath, 'utf-8'))
    } catch {
      this.records = []
    }
  }

  async save() {
    await writeFile(this.filePath, JSON.stringify(this.records, null, 2))
  }

  add(record: MemoryRecord) { this.records.push(record) }

  similar(context: string, n = 2): MemoryRecord[] {
    if (!this.records.length) return []
    const tokens = new Set(context.toLowerCase().split(/\W+/).filter(Boolean))
    return [...this.records]
      .map(r => ({
        r,
        score: r.context.toLowerCase().split(/\W+/).filter(t => tokens.has(t)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(x => x.r)
  }
}

// ---------------------------------------------------------------------------
// Hyperliquid perp execution (REST, EVM-signed)
// Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
// ---------------------------------------------------------------------------

async function placeHyperliquidOrder(
  coin: string,
  side: 'A' | 'B',  // A = ask/sell, B = bid/buy
  sizeUsd: number,
  limitPx: number,
  privateKey?: string,
): Promise<string> {
  if (!privateKey) {
    console.log(`  [dry-run] Hyperliquid ${side === 'B' ? 'BUY' : 'SELL'} ${coin}-PERP ~$${sizeUsd}`)
    return `dry-run-${Date.now()}`
  }
  // Full signing requires viem + Hyperliquid action hashing.
  // See: https://github.com/hyperliquid-dex/hyperliquid-ts-sdk
  // Stub: log the intent and return a placeholder until SDK integration is added.
  console.log(`  Hyperliquid order: ${side === 'B' ? 'BUY' : 'SELL'} ${coin}-PERP ~$${sizeUsd} @ ${limitPx}`)
  return `hl-stub-${Date.now()}`
}

// ---------------------------------------------------------------------------
// CoinGecko price + metrics (passed directly to Claude as live context)
// ---------------------------------------------------------------------------

const GECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  AVAX: 'avalanche-2', LINK: 'chainlink', ARB: 'arbitrum', OP: 'optimism',
  SUI: 'sui', INJ: 'injective-protocol', WIF: 'dogwifcoin',
  BONK: 'bonk', PEPE: 'pepe', JUP: 'jupiter-exchange-solana',
}

async function fetchCryptoMetrics(instrument: string): Promise<Record<string, unknown>> {
  const id = GECKO_IDS[instrument.toUpperCase()] ?? instrument.toLowerCase()
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`,
      { signal: AbortSignal.timeout(8_000) },
    )
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
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
      price: md?.current_price?.usd,
      marketCapUsd: md?.market_cap?.usd,
      volume24hUsd: md?.total_volume?.usd,
      change24hPct: md?.price_change_percentage_24h,
      change7dPct: md?.price_change_percentage_7d,
      athUsd: md?.ath?.usd,
      athDrawdownPct: md?.ath_change_percentage?.usd,
    }
  } catch {
    return { instrument, error: 'price fetch failed' }
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

export async function runCryptoThesisLoop(
  thesis: CryptoThesis,
  opts: {
    budgetUsd?: number
    evmPrivateKey?: string
    solanaKeypair?: unknown
    bnbPrivateKey?: `0x${string}`
    dryRun?: boolean
  } = {},
): Promise<LoopResult> {
  const client = new Anthropic()
  const memory = new CryptoMemory()
  await memory.load()

  const budget = opts.budgetUsd ?? 100
  const dryRun = opts.dryRun ?? true

  // --- 1. Extract trading idea from thesis text ---
  console.log('\nExtracting trading ideas...')
  const ideas = await extractTradingIdeas(thesis.text)
  const idea = thesis.instrument
    ? (ideas.find(i => i.instrument === thesis.instrument) ?? ideas[0])
    : ideas[0]

  if (!idea) throw new Error('No tradeable idea found in thesis text')

  const markets = routeIdea(idea, {
    hasEvm: !!opts.evmPrivateKey || dryRun,
    hasSolana: !!opts.solanaKeypair || dryRun,
    hasBinance: false,
  })
  const market = markets[0]!

  console.log(`Idea: ${idea.direction.toUpperCase()} ${idea.instrument} (${(idea.confidence * 100).toFixed(0)}% confidence)`)
  console.log(`Market: ${market.name}`)

  // --- 2. Load past similar decisions for context ---
  const past = memory.similar(`${idea.instrument} ${thesis.text}`, 2)
  const pastContext = past.length
    ? past.map(p =>
        `${p.date.slice(0, 10)} | ${p.instrument} | ${p.decision.action} | P&L: ${p.pnlPct != null ? p.pnlPct.toFixed(1) + '%' : 'open'}\n${p.decision.rationale.slice(0, 200)}`
      ).join('\n---\n')
    : 'No past decisions on record.'

  // --- 3. Fetch live metrics upfront (avoids a tool call round-trip) ---
  console.log(`Fetching market data for ${idea.instrument}...`)
  const metrics = await fetchCryptoMetrics(idea.instrument)

  // --- 4. Claude: bull/bear debate + final decision ---
  // System prompt adapts TradingAgents' trader + researcher prompts.
  // Turn discipline (≤2 Claude calls) adapts llm_trader's 6-turn rule.

  const systemPrompt = `You are a crypto trading analyst. Steps:
1. Use the provided tools to check market sentiment and funding rate
2. Write a concise BULL argument (2–3 sentences)
3. Write a concise BEAR argument (2–3 sentences)
4. As the Trader, weigh both sides and commit to a firm decision

Apply lessons from past decisions:
${pastContext}

End your response with EXACTLY this block:
FINAL TRANSACTION PROPOSAL: **<BUY|SELL|HOLD>**
POSITION SIZE: <0.0-1.0>
STOP LOSS: <price or N/A>
TARGET PRICE: <price or N/A>`

  const userPrompt = `Thesis: "${thesis.text}"

Extracted idea: ${idea.direction.toUpperCase()} ${idea.instrument}
Confidence: ${(idea.confidence * 100).toFixed(0)}%  |  Risk tolerance: ${thesis.riskTolerance}  |  Budget: $${budget}
Target market: ${market.name}

Live market snapshot:
${JSON.stringify(metrics, null, 2)}

Use the tools to gather sentiment and funding rate, then write your bull/bear debate and commit.`

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_sentiment',
      description: 'Get fear/greed index and social sentiment for a crypto asset.',
      input_schema: {
        type: 'object' as const,
        properties: { instrument: { type: 'string' } },
        required: ['instrument'],
      },
    },
    {
      name: 'get_funding_rate',
      description: 'Get perpetual funding rate (positive = longs pay shorts, signals over-leveraging).',
      input_schema: {
        type: 'object' as const,
        properties: { instrument: { type: 'string' } },
        required: ['instrument'],
      },
    },
  ]

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  const call1 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 1500,
    system: systemPrompt,
    tools,
    messages,
  })

  // --- 5. Execute tool calls ---
  const toolResults: Anthropic.ToolResultBlockParam[] = []

  for (const block of call1.content) {
    if (block.type !== 'tool_use') continue
    const input = block.input as { instrument: string }
    let result: unknown

    if (block.name === 'get_sentiment') {
      // Replace with Santiment / LunarCrush API for production
      result = {
        instrument: input.instrument,
        fearGreedIndex: Math.floor(Math.random() * 100),
        fearGreedLabel: ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'][Math.floor(Math.random() * 5)],
        socialMentions24h: Math.floor(Math.random() * 50000 + 5000),
        sentimentScore: +(Math.random() * 2 - 1).toFixed(2),
      }
    } else if (block.name === 'get_funding_rate') {
      // Replace with Hyperliquid /info endpoint for production
      const rate = Math.random() * 0.02 - 0.005
      result = {
        instrument: input.instrument,
        fundingRate: +rate.toFixed(4),
        annualized: +(rate * 3 * 365 * 100).toFixed(1) + '%',
        note: rate > 0.01 ? 'Longs overextended' : rate < -0.005 ? 'Shorts overextended' : 'Neutral',
      }
    }

    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
  }

  // --- 6. Call 2: analysis with tool results → final decision ---
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

  // --- 7. Parse decision ---
  const proposalMatch = analysis.match(/FINAL TRANSACTION PROPOSAL:\s*\*\*(\w+)\*\*/)
  const sizeMatch     = analysis.match(/POSITION SIZE:\s*([\d.]+)/)
  const stopMatch     = analysis.match(/STOP LOSS:\s*([\d.]+|N\/A)/)
  const targetMatch   = analysis.match(/TARGET PRICE:\s*([\d.]+|N\/A)/)

  const decision: TradeDecision = {
    action:      (proposalMatch?.[1] ?? 'HOLD') as TradeDecision['action'],
    sizePct:     parseFloat(sizeMatch?.[1] ?? '0') || 0,
    stopLoss:    stopMatch?.[1] !== 'N/A'    ? parseFloat(stopMatch?.[1]  ?? '') || undefined : undefined,
    targetPrice: targetMatch?.[1] !== 'N/A'  ? parseFloat(targetMatch?.[1] ?? '') || undefined : undefined,
    rationale:   analysis,
  }

  // --- 8. Execute based on market type ---
  let txHash: string | undefined

  if (decision.action !== 'HOLD') {
    const tradeUsd = budget * decision.sizePct

    if (market.type === 'perp') {
      // Hyperliquid perpetual
      const price = typeof metrics.price === 'number' ? metrics.price : 0
      const side  = decision.action === 'BUY' ? 'B' : 'A'
      txHash = await placeHyperliquidOrder(idea.instrument, side, tradeUsd, price, opts.evmPrivateKey)

    } else if (market.type === 'dex' && market.chain === 'solana' && opts.solanaKeypair) {
      // Solana — pump.fun / Jupiter via @agenti/sdk
      const { buy, sell }    = await import('@agenti/sdk')
      const { Connection, Keypair } = await import('@solana/web3.js') as any
      const connection = new Connection(process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com')
      const keypair    = opts.solanaKeypair as InstanceType<typeof Keypair>
      const solPrice   = typeof metrics.price === 'number' ? metrics.price : 1

      if (decision.action === 'BUY') {
        const res = await buy({ mint: idea.instrument, solAmount: tradeUsd / solPrice, slippage: 5, keypair, connection })
        txHash = res.signature
        console.log(`  Solana tx: ${res.explorerUrl}`)
      } else {
        const res = await sell({ mint: idea.instrument, tokenAmount: tradeUsd, slippage: 5, keypair, connection })
        txHash = res.signature
        console.log(`  Solana tx: ${res.explorerUrl}`)
      }

    } else if (market.chain === 'bnb' && opts.bnbPrivateKey) {
      // BNB chain via @agenti/sdk
      const { swapBnbTokens } = await import('@agenti/sdk')
      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
      txHash = await swapBnbTokens(
        { wallet: { privateKey: opts.bnbPrivateKey } },
        { tokenIn: WBNB, tokenOut: WBNB, amountIn: BigInt(Math.floor(tradeUsd * 1e18)), slippageBps: 50 },
      )
      console.log(`  BNB tx: ${txHash}`)

    } else {
      // dry-run
      console.log(`  [dry-run] ${decision.action} ${idea.instrument} on ${market.name} — $${tradeUsd.toFixed(2)}`)
      txHash = `dry-${Date.now()}`
    }
  }

  // --- 9. P&L on current price vs entry ---
  let pnl: LoopResult['pnl']
  const price = typeof metrics.price === 'number' ? metrics.price : undefined

  if (price) {
    const record: TradeRecord = {
      id:          `thesis-${Date.now()}`,
      instrument:  idea.instrument,
      direction:   idea.direction === 'short' ? 'short' : 'long',
      market:      market.name,
      entryPrice:  price,
      createdAt:   Date.now(),
      thesis:      idea.thesis,
    }
    try { pnl = await calculatePnl(record) } catch { /* rate-limited or unknown ticker */ }
  }

  // --- 10. Persist to memory ---
  memory.add({ date: new Date().toISOString(), instrument: idea.instrument, context: `${idea.instrument} ${thesis.text}`, decision })
  await memory.save()

  // --- Summary ---
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Instrument:    ${idea.instrument}`)
  console.log(`Market:        ${market.name}`)
  console.log(`Decision:      ${decision.action}`)
  console.log(`Position size: ${(decision.sizePct * 100).toFixed(0)}% ($${(budget * decision.sizePct).toFixed(2)})`)
  if (decision.stopLoss)    console.log(`Stop loss:     $${decision.stopLoss}`)
  if (decision.targetPrice) console.log(`Target:        $${decision.targetPrice}`)
  if (txHash)               console.log(`Tx:            ${txHash}`)
  if (pnl)                  console.log(`P&L:           ${pnl.pnlPercent.toFixed(2)}%`)
  console.log(`${'─'.repeat(60)}\n`)

  return { idea, market, decision, txHash, pnl }
}

// ---------------------------------------------------------------------------
// Entry point — three theses, one per venue
// ---------------------------------------------------------------------------

async function main() {
  // Hyperliquid perp (EVM)
  await runCryptoThesisLoop({
    text: `BTC broke above its 200-day MA on strong volume after the Fed signaled a pause.
    ETF inflows are accelerating but funding rates on perps are dangerously elevated.`,
    riskTolerance: 'moderate',
  }, { budgetUsd: 500, dryRun: true })

  // Jupiter / pump.fun (Solana)
  await runCryptoThesisLoop({
    text: `WIF has been consolidating at support for 3 weeks while BTC rallies.
    Strong community, trending on CT. Looks ready for a move up.`,
    instrument: 'WIF',
    riskTolerance: 'aggressive',
  }, { budgetUsd: 50, dryRun: true })

  // BNB chain / PancakeSwap
  await runCryptoThesisLoop({
    text: `BNB strength ahead of the quarterly token burn. On-chain activity picking up.
    Risk: ongoing regulatory overhang on Binance.`,
    instrument: 'BNB',
    riskTolerance: 'moderate',
  }, { budgetUsd: 200, dryRun: true })
}

main().catch(console.error)
