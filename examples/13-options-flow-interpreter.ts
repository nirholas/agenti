/**
 * Options Flow Interpreter: unusual options activity → directional signal
 *
 * Real data sources:
 *   Yahoo Finance  — options chain (call/put vol, OI, IV) — free, no key
 *   Yahoo Finance  — quote summary / insider transactions — free, no key
 *   FINRA          — short interest data — free public API
 *   openFDA FAERS  — not used here; see 15-regulatory-alpha-extractor.ts
 *
 * Dark pool prints require a paid subscription (Cboe, Nasdaq TotalView, or
 * Unusual Whales API). This example shows where to plug them in and runs
 * the full signal interpretation on the options-only data without them.
 *
 * Two-call architecture:
 *   Call 1 — Claude fetches live options chain + short interest for each ticker
 *   Call 2 — Claude applies informed-vs-noise classifier, outputs ranked signals
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WatchTicker {
  ticker: string
  sector: string
}

interface SignalOutcome {
  ticker: string
  direction: 'bullish' | 'bearish'
  date: string
  outcome?: { hit_target: boolean; days_held: number; max_gain_pct: number }
}

// ---------------------------------------------------------------------------
// Signal accuracy tracker
// ---------------------------------------------------------------------------

class FlowSignalTracker {
  private records: SignalOutcome[] = []
  constructor(private filePath = 'flow_signals.json') {}
  async load() { try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.records = [] } }
  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }
  add(r: SignalOutcome) { this.records.push(r) }
  accuracy(): number {
    const resolved = this.records.filter(r => r.outcome)
    return resolved.length === 0 ? 0 : resolved.filter(r => r.outcome!.hit_target).length / resolved.length
  }
}

// ---------------------------------------------------------------------------
// Real tool implementations
// ---------------------------------------------------------------------------

interface YahooOptionsResult {
  optionChain?: {
    result?: Array<{
      underlyingSymbol?: string
      expirationDates?: number[]
      quote?: { regularMarketPrice?: number; regularMarketVolume?: number }
      options?: Array<{
        expirationDate?: number
        calls?: OptionContract[]
        puts?: OptionContract[]
      }>
    }>
  }
}

interface OptionContract {
  contractSymbol?: string
  strike?: number
  expiration?: number
  lastPrice?: number
  bid?: number
  ask?: number
  volume?: number
  openInterest?: number
  impliedVolatility?: number
  inTheMoney?: boolean
  percentChange?: number
}

async function toolGetOptionsChain(ticker: string): Promise<unknown> {
  const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Yahoo options ${res.status} for ${ticker}`)

  const data = await res.json() as YahooOptionsResult
  const result = data.optionChain?.result?.[0]
  if (!result) return { ticker, error: 'No options data available' }

  const spotPrice = result.quote?.regularMarketPrice ?? 0
  const chain = result.options?.[0]
  if (!chain) return { ticker, error: 'No active options chain' }

  const calls = chain.calls ?? []
  const puts = chain.puts ?? []

  // Calculate aggregate stats
  const callVol = calls.reduce((s, c) => s + (c.volume ?? 0), 0)
  const putVol = puts.reduce((s, p) => s + (p.volume ?? 0), 0)
  const callOI = calls.reduce((s, c) => s + (c.openInterest ?? 0), 0)
  const putOI = puts.reduce((s, p) => s + (p.openInterest ?? 0), 0)

  // Flag unusual: volume > 50% of OI (suggests fresh positioning, not roll)
  const unusualCalls = calls
    .filter(c => (c.volume ?? 0) > 0 && (c.openInterest ?? 0) > 0 && (c.volume! / c.openInterest!) > 0.5)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 5)
    .map(c => ({
      strike: c.strike,
      expiry: c.expiration ? new Date(c.expiration * 1000).toISOString().slice(0, 10) : 'unknown',
      vol: c.volume,
      oi: c.openInterest,
      vol_oi_ratio: c.openInterest ? +(c.volume! / c.openInterest!).toFixed(2) : null,
      iv_pct: c.impliedVolatility ? +(c.impliedVolatility * 100).toFixed(1) : null,
      otm_pct: spotPrice > 0 && c.strike ? +(((c.strike - spotPrice) / spotPrice) * 100).toFixed(1) : null,
      bid_ask_spread: c.bid != null && c.ask != null ? +(c.ask - c.bid).toFixed(2) : null,
    }))

  const unusualPuts = puts
    .filter(p => (p.volume ?? 0) > 0 && (p.openInterest ?? 0) > 0 && (p.volume! / p.openInterest!) > 0.5)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 3)
    .map(p => ({
      strike: p.strike,
      expiry: p.expiration ? new Date(p.expiration * 1000).toISOString().slice(0, 10) : 'unknown',
      vol: p.volume,
      oi: p.openInterest,
      vol_oi_ratio: p.openInterest ? +(p.volume! / p.openInterest!).toFixed(2) : null,
      iv_pct: p.impliedVolatility ? +(p.impliedVolatility * 100).toFixed(1) : null,
    }))

  return {
    ticker,
    spot_price: spotPrice,
    expiry: chain.expirationDate ? new Date(chain.expirationDate * 1000).toISOString().slice(0, 10) : 'unknown',
    call_volume: callVol,
    put_volume: putVol,
    put_call_ratio: putVol / (callVol || 1),
    call_oi: callOI,
    put_oi: putOI,
    vol_oi_ratio_calls: callOI > 0 ? +(callVol / callOI).toFixed(3) : null,
    skew_note: callVol > putVol * 1.8 ? 'CALL_HEAVY' : putVol > callVol * 1.8 ? 'PUT_HEAVY' : 'BALANCED',
    unusual_calls: unusualCalls,
    unusual_puts: unusualPuts,
    total_available_expiries: result.expirationDates?.length ?? 0,
  }
}

interface YahooSummaryResult {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: {
        shortPercentOfFloat?: { raw?: number }
        shortRatio?: { raw?: number }
        sharesShort?: { raw?: number }
        sharesShortPriorMonth?: { raw?: number }
      }
      summaryDetail?: {
        volume?: { raw?: number }
        averageVolume?: { raw?: number }
        fiftyTwoWeekHigh?: { raw?: number }
        fiftyTwoWeekLow?: { raw?: number }
        marketCap?: { raw?: number }
      }
      earningsHistory?: {
        history?: Array<{ surprisePercent?: { raw?: number }; quarter?: { fmt?: string } }>
      }
    }>
  }
}

async function toolGetStockContext(ticker: string): Promise<unknown> {
  const modules = 'defaultKeyStatistics,summaryDetail,earningsHistory'
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      Accept: 'application/json',
    },
  })
  if (!res.ok) return { ticker, error: `Yahoo summary ${res.status}` }

  const data = await res.json() as YahooSummaryResult
  const r = data?.quoteSummary?.result?.[0]
  if (!r) return { ticker, error: 'No summary data' }

  const stats = r.defaultKeyStatistics
  const detail = r.summaryDetail
  const earnings = r.earningsHistory?.history ?? []

  const shortPct = stats?.shortPercentOfFloat?.raw ?? 0
  const shortRatio = stats?.shortRatio?.raw ?? 0
  const sharesShort = stats?.sharesShort?.raw ?? 0
  const sharesShortPrior = stats?.sharesShortPriorMonth?.raw ?? 0
  const shortChange = sharesShortPrior > 0 ? (sharesShort - sharesShortPrior) / sharesShortPrior : 0

  return {
    ticker,
    short_interest_pct_float: +(shortPct * 100).toFixed(1),
    days_to_cover: +shortRatio.toFixed(1),
    short_interest_change_1m: +(shortChange * 100).toFixed(1) + '%',
    squeeze_potential: shortPct > 0.15 ? 'HIGH' : shortPct > 0.08 ? 'MEDIUM' : 'LOW',
    avg_volume_30d: detail?.averageVolume?.raw ?? null,
    today_volume: detail?.volume?.raw ?? null,
    week_52_high: detail?.fiftyTwoWeekHigh?.raw ?? null,
    week_52_low: detail?.fiftyTwoWeekLow?.raw ?? null,
    market_cap_b: detail?.marketCap?.raw ? +(detail.marketCap.raw / 1e9).toFixed(1) : null,
    recent_earnings_surprises: earnings.slice(0, 4).map(e => ({
      quarter: e.quarter?.fmt,
      surprise_pct: e.surprisePercent?.raw != null ? +(e.surprisePercent.raw * 100).toFixed(1) : null,
    })),
  }
}

interface YahooCalendarResult {
  quoteSummary?: {
    result?: Array<{
      calendarEvents?: {
        earnings?: {
          earningsDate?: Array<{ raw?: number }>
          earningsAverage?: { raw?: number }
          earningsHigh?: { raw?: number }
          earningsLow?: { raw?: number }
        }
      }
    }>
  }
}

async function toolCheckEarningsDate(ticker: string): Promise<unknown> {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
  if (!res.ok) return { ticker, next_earnings: null, error: `${res.status}` }

  const data = await res.json() as YahooCalendarResult
  const cal = data?.quoteSummary?.result?.[0]?.calendarEvents?.earnings
  const dates = cal?.earningsDate ?? []

  const nextTs = dates.find(d => d.raw != null && (d.raw as number) * 1000 > Date.now())?.raw
  const daysAway = nextTs ? Math.round(((nextTs as number) * 1000 - Date.now()) / 86400000) : null

  return {
    ticker,
    next_earnings: nextTs ? new Date((nextTs as number) * 1000).toISOString().slice(0, 10) : null,
    days_away: daysAway,
    earnings_disqualifier: daysAway != null && daysAway < 14,
    eps_estimate: cal?.earningsAverage?.raw ?? null,
  }
}

// ---------------------------------------------------------------------------
// System prompt — the classifier rubric is the moat
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a former options market maker with 15 years on the floor of the CBOE.
You have seen every flavor of informed trading, gamma squeeze, hedging artifact, and retail FOMO.
Your job is to separate genuinely informed flow from noise, then define the trade.

## Informed Flow vs. Noise Classifier

Apply these tests to EVERY ticker's flow before scoring:

### Green Flags (informed / directional)
- vol/OI ratio > 0.5 on OTM calls: suggests fresh opening position (not closing): +3
- Call volume > 2× average daily volume: +2
- OTM calls (0–15% out of the money) with < 30 DTE: urgency signal: +2
- Put/call ratio < 0.5 (market pricing out downside): +2
- Short interest > 15% AND call flow heavy: squeeze setup: +5
- Short interest rising month-over-month AND call buying: contrarian squeeze: +3
- Unusual call concentration at single strike (> 30% of total call vol): +4

### Red Flags (noise / hedging artifact)
- Earnings within 14 days: likely hedging / speculative — DISQUALIFY: -8
- Vol/OI < 0.1: stale open interest, not fresh money: -3
- Put volume > call volume 2×: bearish or portfolio hedge (opposite signal): -3
- Low absolute volume (< 500 contracts): insufficient size to be institutional: -2

### Conviction Tiers
- Score ≥ 10: EXTREME — high conviction directional; tight stop, catalyst window
- Score 6–9: HIGH — standard defined-risk position
- Score 3–5: MEDIUM — starter size, wait for confirmation
- Score < 3: MONITOR ONLY

## Output Format
SIGNAL: **<BULLISH|BEARISH>** — <ticker>
CONVICTION: <MONITOR|MEDIUM|HIGH|EXTREME>
SCORE: <number>
ENTRY_ZONE: $<low>–$<high>
TARGET: $<price> (<pct>%)
STOP: $<price>
INFORMED_PROB: <pct>%
KEY_EVIDENCE: <2–3 bullet points of specific data>
THESIS: <1–2 sentences>

DISQUALIFIED: <ticker> — REASON: <specific reason>

Always separate disqualified tickers from actionable signals.
Rank actionable signals by conviction, highest first.`

// ---------------------------------------------------------------------------
// Main interpreter
// ---------------------------------------------------------------------------

async function interpretOptionsFlow(tickers: WatchTicker[]) {
  const client = new Anthropic()
  const tracker = new FlowSignalTracker()
  await tracker.load()

  const historicalAccuracy = tracker.accuracy()

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_options_chain',
      description: 'Fetch live options chain from Yahoo Finance: call/put volumes, OI, unusual activity flags.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
    {
      name: 'get_stock_context',
      description: 'Fetch short interest, days-to-cover, volume context, and earnings history.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
    {
      name: 'check_earnings_date',
      description: 'Check if a ticker has earnings within 14 days (which would disqualify the signal).',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
  ]

  const userPrompt = `Analyze these tickers for unusual options flow and generate directional signals.
Historical signal accuracy from tracker: ${(historicalAccuracy * 100).toFixed(0)}%

Tickers to analyze (all sectors):
${tickers.map(t => `- ${t.ticker} (${t.sector})`).join('\n')}

For EACH ticker:
1. Call check_earnings_date FIRST — if earnings < 14 days, disqualify immediately
2. Call get_options_chain to get live options flow
3. Call get_stock_context to get short interest and squeeze potential

Apply the Informed Flow Classifier. Output only MEDIUM+ conviction signals.
Rank by conviction, highest first.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  const call1 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  })

  const toolResults: Anthropic.ToolResultBlockParam[] = []
  for (const block of call1.content) {
    if (block.type !== 'tool_use') continue
    const input = block.input as { ticker: string }
    let result: unknown

    console.log(`  → ${block.name}(${input.ticker})`)

    if (block.name === 'get_options_chain') {
      result = await toolGetOptionsChain(input.ticker)
    } else if (block.name === 'get_stock_context') {
      result = await toolGetStockContext(input.ticker)
    } else if (block.name === 'check_earnings_date') {
      result = await toolCheckEarningsDate(input.ticker)
    }

    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
  }

  const call2 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages: [
      ...messages,
      { role: 'assistant', content: call1.content },
      { role: 'user', content: toolResults },
    ],
  })

  const analysis = call2.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('\n')

  console.log('\n===== OPTIONS FLOW SIGNALS =====\n')
  console.log(analysis)

  // Persist signals
  const signalMatches = [...analysis.matchAll(/SIGNAL:\s*\*\*(BULLISH|BEARISH)\*\*\s*—\s*(\w+)/g)]
  for (const m of signalMatches) {
    const [, direction, ticker] = m
    tracker.add({ ticker: ticker!, direction: direction!.toLowerCase() as 'bullish' | 'bearish', date: new Date().toISOString() })
  }

  await tracker.save()
  return analysis
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const tickers: WatchTicker[] = [
    { ticker: 'MSTR',  sector: 'BTC proxy / software' },
    { ticker: 'COIN',  sector: 'crypto exchange' },
    { ticker: 'PLTR',  sector: 'data/defense software' },
    { ticker: 'SOUN',  sector: 'voice AI / small-cap' },
    { ticker: 'NVDA',  sector: 'semiconductors / AI' },
  ]

  console.log('Fetching live options flow data...\n')
  await interpretOptionsFlow(tickers)
}

main().catch(console.error)
