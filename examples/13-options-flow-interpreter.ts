/**
 * Options Flow Interpreter: unusual options activity → directional signal
 *
 * Real data sources (no mocks):
 *   Yahoo Finance v7   — options chain: call/put vol, OI, IV, skew — free, no key
 *   Yahoo Finance v10  — short interest, days-to-cover, earnings calendar — free, no key
 *   FINRA OTC ATS API  — weekly dark pool volume by ticker — free, public
 *   SEC EDGAR API      — recent 13F institutional filings — free, public
 *
 * Architecture:
 *   Agentic loop — Claude calls tools until all tickers are covered, then stops
 *   record_signals (forced tool_choice) — structured JSON output, no regex parsing
 *   Prompt caching — SYSTEM_PROMPT cached across all calls (~90% cost reduction)
 *   FlowSignalTracker — persists signals to flow_signals.json, tracks accuracy
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

interface StructuredSignal {
  ticker: string
  direction: 'bullish' | 'bearish' | 'neutral'
  conviction: 'monitor' | 'medium' | 'high' | 'extreme'
  score: number
  entry_low: number
  entry_high: number
  target_price: number
  stop_loss: number
  informed_probability: number
  key_evidence: string[]
  thesis: string
}

interface SignalRecord {
  signal: StructuredSignal
  date: string
  outcome?: { hit_target: boolean; days_held: number; max_gain_pct: number }
}

// ---------------------------------------------------------------------------
// Signal accuracy tracker
// ---------------------------------------------------------------------------

class FlowSignalTracker {
  private records: SignalRecord[] = []
  constructor(private filePath = 'flow_signals.json') {}

  async load() {
    try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.records = [] }
  }
  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }
  add(r: SignalRecord) { this.records.push(r) }

  accuracy(): number {
    const resolved = this.records.filter(r => r.outcome)
    return resolved.length === 0 ? 0 : resolved.filter(r => r.outcome!.hit_target).length / resolved.length
  }
}

// ---------------------------------------------------------------------------
// Yahoo Finance response shapes
// ---------------------------------------------------------------------------

interface OptionContract {
  strike?: number
  expiration?: number
  lastPrice?: number
  bid?: number
  ask?: number
  volume?: number
  openInterest?: number
  impliedVolatility?: number
}

interface YahooOptionsResponse {
  optionChain?: {
    result?: Array<{
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

interface YahooSummaryResponse {
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
      }
    }>
  }
}

interface YahooCalendarResponse {
  quoteSummary?: {
    result?: Array<{
      calendarEvents?: {
        earnings?: { earningsDate?: Array<{ raw?: number }> }
      }
    }>
  }
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

async function fetchJSON(url: string, extraHeaders: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...extraHeaders,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolGetOptionsChain(ticker: string): Promise<unknown> {
  // Nearest expiry: call/put volumes, OI, unusual activity, IV skew, gamma walls
  const data = await fetchJSON(`https://query1.finance.yahoo.com/v7/finance/options/${ticker}`) as YahooOptionsResponse
  const result = data.optionChain?.result?.[0]
  if (!result) return { ticker, error: 'No options data' }

  const spot = result.quote?.regularMarketPrice ?? 0
  const chain = result.options?.[0]
  if (!chain) return { ticker, spot, error: 'No active chain' }

  const calls = chain.calls ?? []
  const puts = chain.puts ?? []
  const expiry = chain.expirationDate ? new Date(chain.expirationDate * 1000).toISOString().slice(0, 10) : 'unknown'

  const callVol = calls.reduce((s, c) => s + (c.volume ?? 0), 0)
  const putVol = puts.reduce((s, p) => s + (p.volume ?? 0), 0)
  const callOI = calls.reduce((s, c) => s + (c.openInterest ?? 0), 0)
  const putOI = puts.reduce((s, p) => s + (p.openInterest ?? 0), 0)

  // Unusual: volume > 50% of OI — fresh positioning, not rolls
  const unusualCalls = calls
    .filter(c => (c.volume ?? 0) > 0 && (c.openInterest ?? 0) > 0 && c.volume! / c.openInterest! > 0.5)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 5)
    .map(c => ({
      strike: c.strike,
      expiry,
      vol: c.volume,
      oi: c.openInterest,
      vol_oi: c.openInterest ? +(c.volume! / c.openInterest!).toFixed(2) : null,
      iv_pct: c.impliedVolatility ? +(c.impliedVolatility * 100).toFixed(1) : null,
      otm_pct: spot && c.strike ? +(((c.strike - spot) / spot) * 100).toFixed(1) : null,
    }))

  const unusualPuts = puts
    .filter(p => (p.volume ?? 0) > 0 && (p.openInterest ?? 0) > 0 && p.volume! / p.openInterest! > 0.5)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 3)
    .map(p => ({
      strike: p.strike,
      expiry,
      vol: p.volume,
      oi: p.openInterest,
      vol_oi: p.openInterest ? +(p.volume! / p.openInterest!).toFixed(2) : null,
      iv_pct: p.impliedVolatility ? +(p.impliedVolatility * 100).toFixed(1) : null,
      otm_pct: spot && p.strike ? +(((spot - p.strike) / spot) * 100).toFixed(1) : null,
    }))

  // Gamma walls: strikes with highest OI = price magnets
  const topCallWall = [...calls].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))[0]
  const topPutWall = [...puts].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))[0]

  // Max pain
  const strikes = [...new Set([...calls, ...puts].map(o => o.strike ?? 0))].sort((a, b) => a - b)
  let maxPain = spot
  let minPain = Infinity
  for (const s of strikes) {
    const p = calls.reduce((acc, c) => acc + Math.max(0, s - (c.strike ?? 0)) * (c.openInterest ?? 0), 0)
            + puts.reduce((acc, p) => acc + Math.max(0, (p.strike ?? 0) - s) * (p.openInterest ?? 0), 0)
    if (p < minPain) { minPain = p; maxPain = s }
  }

  // OTM call IV vs OTM put IV — skew
  const otmCallIV = calls.filter(c => (c.strike ?? 0) > spot * 1.04).slice(0, 5)
    .reduce((s, c, _, a) => s + (c.impliedVolatility ?? 0) / a.length, 0)
  const otmPutIV = puts.filter(p => (p.strike ?? 0) < spot * 0.96).slice(0, 5)
    .reduce((s, p, _, a) => s + (p.impliedVolatility ?? 0) / a.length, 0)
  const skew = otmCallIV > otmPutIV * 1.1 ? 'call_heavy' : otmPutIV > otmCallIV * 1.1 ? 'put_heavy' : 'neutral'

  return {
    ticker,
    spot,
    nearest_expiry: expiry,
    call_volume: callVol,
    put_volume: putVol,
    put_call_ratio: callVol > 0 ? +(putVol / callVol).toFixed(2) : null,
    call_oi: callOI,
    put_oi: putOI,
    vol_oi_ratio_calls: callOI > 0 ? +(callVol / callOI).toFixed(3) : null,
    skew,
    otm_call_iv_avg_pct: +(otmCallIV * 100).toFixed(1),
    otm_put_iv_avg_pct: +(otmPutIV * 100).toFixed(1),
    gamma_wall_call: topCallWall ? { strike: topCallWall.strike, oi: topCallWall.openInterest } : null,
    gamma_wall_put: topPutWall ? { strike: topPutWall.strike, oi: topPutWall.openInterest } : null,
    max_pain: maxPain,
    unusual_calls: unusualCalls,
    unusual_puts: unusualPuts,
    available_expiries: result.expirationDates?.length ?? 0,
  }
}

async function toolGetStockContext(ticker: string): Promise<unknown> {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,summaryDetail`
  const data = await fetchJSON(url) as YahooSummaryResponse

  const r = data?.quoteSummary?.result?.[0]
  if (!r) return { ticker, error: 'No summary data' }

  const stats = r.defaultKeyStatistics
  const detail = r.summaryDetail
  const shortPct = stats?.shortPercentOfFloat?.raw ?? 0
  const shortRatio = stats?.shortRatio?.raw ?? 0
  const sharesShort = stats?.sharesShort?.raw ?? 0
  const sharesShortPrior = stats?.sharesShortPriorMonth?.raw ?? 0
  const shortChange = sharesShortPrior > 0 ? (sharesShort - sharesShortPrior) / sharesShortPrior : 0

  return {
    ticker,
    short_interest_pct_float: +(shortPct * 100).toFixed(1),
    days_to_cover: +shortRatio.toFixed(1),
    short_interest_change_1m_pct: +(shortChange * 100).toFixed(1),
    squeeze_potential: shortPct > 0.15 ? 'HIGH' : shortPct > 0.08 ? 'MEDIUM' : 'LOW',
    avg_volume_30d: detail?.averageVolume?.raw ?? null,
    today_volume: detail?.volume?.raw ?? null,
    week_52_high: detail?.fiftyTwoWeekHigh?.raw ?? null,
    week_52_low: detail?.fiftyTwoWeekLow?.raw ?? null,
  }
}

async function toolCheckEarningsDate(ticker: string): Promise<unknown> {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents`
  const data = await fetchJSON(url) as YahooCalendarResponse

  const cal = data?.quoteSummary?.result?.[0]?.calendarEvents?.earnings
  const nextTs = (cal?.earningsDate ?? []).find(d => d.raw != null && (d.raw as number) * 1000 > Date.now())?.raw
  const daysAway = nextTs ? Math.round(((nextTs as number) * 1000 - Date.now()) / 86400000) : null

  return {
    ticker,
    next_earnings: nextTs ? new Date((nextTs as number) * 1000).toISOString().slice(0, 10) : null,
    days_away: daysAway,
    disqualifier: daysAway != null && daysAway < 14,
    disqualifier_reason: daysAway != null && daysAway < 14 ? `Earnings in ${daysAway}d — flow is likely speculative hedge, not informed directional` : null,
  }
}

async function toolGetDarkPoolVolume(ticker: string): Promise<unknown> {
  // FINRA OTC Transparency ATS data — weekly dark pool volume by venue
  const now = new Date()
  const dayOfWeek = now.getDay()
  const lastMonday = new Date(now)
  lastMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))

  for (let weekOffset = 0; weekOffset <= 2; weekOffset++) {
    const d = new Date(lastMonday)
    d.setDate(d.getDate() - weekOffset * 7)
    const weekDate = d.toISOString().slice(0, 10)

    try {
      const url = `https://otctransparency.finra.org/otctransparency/api/group/AtsIssue?tierIdentifier=T1&weekStartDate=${weekDate}&issueSymbolIdentifier=${ticker}`
      const data = await fetchJSON(url) as { data?: Array<{ totalWeeklyShareQuantity?: number; atsDisplayName?: string; totalWeeklyTradeCount?: number }> }
      const records = data.data ?? []

      if (records.length > 0) {
        const totalShares = records.reduce((s, r) => s + (r.totalWeeklyShareQuantity ?? 0), 0)
        const totalTrades = records.reduce((s, r) => s + (r.totalWeeklyTradeCount ?? 0), 0)
        const venues = records.map(r => r.atsDisplayName).filter(Boolean)
        return {
          ticker,
          week_of: weekDate,
          total_dark_pool_shares: totalShares,
          total_dark_pool_trades: totalTrades,
          num_ats_venues: records.length,
          top_venues: venues.slice(0, 4),
          note: weekOffset > 0 ? `${weekOffset}-week-old data (current week not yet published)` : 'current week',
        }
      }
    } catch { continue }
  }

  return { ticker, total_dark_pool_shares: null, note: 'FINRA ATS data unavailable — may be exchange-listed and not OTC-reported' }
}

async function toolGetInstitutional13F(ticker: string): Promise<unknown> {
  // SEC EDGAR full-text search for recent 13F-HR filings
  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10)
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}`

  try {
    const data = await fetchJSON(url, {
      // SEC requires Company Name + contact email in User-Agent
      'User-Agent': 'options-flow-research nichxbt@gmail.com',
    }) as {
      hits?: {
        total?: { value: number }
        hits?: Array<{ _source?: { entity_name?: string; file_date?: string; period_of_report?: string } }>
      }
    }

    const total = data.hits?.total?.value ?? 0
    const hits = data.hits?.hits ?? []

    return {
      ticker,
      recent_13f_count_90d: total,
      most_recent_filer: hits[0]?._source?.entity_name ?? null,
      most_recent_file_date: hits[0]?._source?.file_date ?? null,
      period_of_report: hits[0]?._source?.period_of_report ?? null,
      top_filers: hits.slice(0, 5).map(h => h._source?.entity_name).filter(Boolean),
    }
  } catch (e) {
    return { ticker, recent_13f_count_90d: null, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// System prompt — cached across all API calls
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a former options market maker with 15 years on the floor of the CBOE.
You have seen every flavor of informed trading, gamma squeeze, hedging artifact, and retail FOMO.
Your job is to separate genuinely informed flow from noise, then define the trade.

## Informed Flow vs. Noise Classifier

Apply these tests to EVERY ticker before scoring:

### Green Flags (informed / directional)
- vol/OI ratio > 0.5 on OTM calls: fresh opening position (not closing): +3
- Call volume > 2× today's average daily volume: +2
- OTM calls (0–15% OTM) with < 30 DTE: urgency signal: +2
- Put/call ratio < 0.4 (market aggressively pricing in upside): +2
- Short interest > 15% AND call flow heavy: squeeze setup: +5
- Short interest rising MoM AND call buying: contrarian squeeze: +3
- Dark pool volume elevated vs recent baseline: institutional accumulation: +4
- Recent 13F activity (institutional disclosed position): +2
- call_heavy skew on IV surface: market pricing upside risk: +2

### Red Flags (noise / hedging artifact)
- Earnings within 14 days: likely hedge or speculative, DISQUALIFY: -8
- vol/OI < 0.1: stale OI, no fresh money entering: -3
- put_heavy skew: market hedging downside, not directional call buying: -2
- Low call volume (< 500 contracts total): not institutional size: -2
- Short interest falling + call buying: momentum chasers, not squeeze: -1

### Conviction Tiers
- Score ≥ 10: EXTREME — high conviction; tight stop, near-term catalyst window
- Score 6–9: HIGH — standard defined-risk position
- Score 3–5: MEDIUM — starter size, wait for confirmation candle
- Score < 3: MONITOR ONLY — log but no position

## Position Sizing from Data
Use gamma_wall_call as upside target (price gets pulled toward it).
Use gamma_wall_put as natural stop (below this = dealer gamma flips bearish).
Use max_pain as neutral magnet — price tends to drift there by expiry.
Entry zone: current spot ± 1% for liquid names, ± 2% for small-cap.

Always separate DISQUALIFIED tickers from actionable signals in your output.
Rank actionable signals by conviction, highest first.`

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

async function dispatchTool(name: string, input: { ticker: string }): Promise<unknown> {
  try {
    switch (name) {
      case 'get_options_chain':       return await toolGetOptionsChain(input.ticker)
      case 'get_stock_context':       return await toolGetStockContext(input.ticker)
      case 'check_earnings_date':     return await toolCheckEarningsDate(input.ticker)
      case 'get_dark_pool_volume':    return await toolGetDarkPoolVolume(input.ticker)
      case 'get_institutional_13f':   return await toolGetInstitutional13F(input.ticker)
      default: return { error: `Unknown tool: ${name}` }
    }
  } catch (e) {
    return { error: (e as Error).message, tool: name, ticker: input.ticker }
  }
}

// ---------------------------------------------------------------------------
// Main interpreter
// ---------------------------------------------------------------------------

async function interpretOptionsFlow(tickers: WatchTicker[]) {
  const client = new Anthropic()
  const tracker = new FlowSignalTracker()
  await tracker.load()

  const historicalAccuracy = tracker.accuracy()

  // Prompt caching: SYSTEM_PROMPT is ~600 tokens, cached after first call
  const cachedSystem: Anthropic.Messages.TextBlockParam[] = [{
    type: 'text',
    text: SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
  }]

  const dataTools: Anthropic.Tool[] = [
    {
      name: 'get_options_chain',
      description: 'Live options chain: call/put volumes, OI, unusual activity, IV skew, gamma walls, max pain.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
    {
      name: 'get_stock_context',
      description: 'Short interest %, days-to-cover, monthly short change, squeeze potential, 52-week range.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
    {
      name: 'check_earnings_date',
      description: 'Next earnings date. Earnings < 14 days = disqualifier. Always call this first.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
    {
      name: 'get_dark_pool_volume',
      description: 'Weekly dark pool (ATS) volume from FINRA OTC Transparency. Elevated dark pool = institutional accumulation signal.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
    {
      name: 'get_institutional_13f',
      description: 'Recent 13F institutional filings from SEC EDGAR mentioning this ticker (last 90 days).',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' } }, required: ['ticker'] },
    },
  ]

  const recordSignalsTool: Anthropic.Tool = {
    name: 'record_signals',
    description: 'Record the final analysis and all signals. Call this once after gathering all data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        analysis_summary: {
          type: 'string',
          description: 'Full narrative: cross-ticker patterns, sector context, key findings, risk factors.',
        },
        signals: {
          type: 'array',
          description: 'All MEDIUM+ conviction signals. Omit MONITOR-only.',
          items: {
            type: 'object',
            properties: {
              ticker: { type: 'string' },
              direction: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
              conviction: { type: 'string', enum: ['monitor', 'medium', 'high', 'extreme'] },
              score: { type: 'number' },
              entry_low: { type: 'number' },
              entry_high: { type: 'number' },
              target_price: { type: 'number' },
              stop_loss: { type: 'number' },
              informed_probability: { type: 'number', description: '0.0–1.0' },
              key_evidence: { type: 'array', items: { type: 'string' }, description: '2–4 specific data points' },
              thesis: { type: 'string', description: '1–2 sentences: why this is informed, not noise' },
            },
            required: ['ticker', 'direction', 'conviction', 'score', 'entry_low', 'entry_high', 'target_price', 'stop_loss', 'informed_probability', 'key_evidence', 'thesis'],
          },
        },
        disqualified: {
          type: 'array',
          description: 'Tickers that were disqualified and why.',
          items: {
            type: 'object',
            properties: {
              ticker: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['ticker', 'reason'],
          },
        },
      },
      required: ['analysis_summary', 'signals', 'disqualified'],
    },
  }

  const userPrompt = `Analyze these tickers for unusual options flow and generate directional signals.
Historical signal accuracy: ${historicalAccuracy > 0 ? `${(historicalAccuracy * 100).toFixed(0)}%` : 'no history yet'}

Tickers to analyze:
${tickers.map(t => `- ${t.ticker} (${t.sector})`).join('\n')}

Instructions:
1. For EACH ticker: call check_earnings_date FIRST — earnings < 14 days = immediate disqualifier
2. For non-disqualified tickers: call get_options_chain and get_stock_context
3. For any ticker with unusual call flow (vol/OI > 0.5 or short interest > 10%): also call get_dark_pool_volume
4. For top 2 tickers by unusual call volume: also call get_institutional_13f
5. Apply the Informed Flow Classifier rubric to every ticker
6. When done with all tickers, call record_signals`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]
  let currentMessages = [...messages]

  // ---------------------------------------------------------------------------
  // Agentic data-gathering loop
  // ---------------------------------------------------------------------------

  for (let iter = 0; iter < 20; iter++) {
    const response = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 4096,
      system: cachedSystem as Anthropic.Messages.TextBlockParam[],
      tools: dataTools,
      messages: currentMessages,
    })

    currentMessages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason !== 'tool_use') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      const input = block.input as { ticker: string }
      console.log(`  [${block.name}] ${input.ticker}`)
      const result = await dispatchTool(block.name, input)
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
    }

    currentMessages.push({ role: 'user', content: toolResults })
  }

  // ---------------------------------------------------------------------------
  // Forced structured output — record_signals tool_choice
  // ---------------------------------------------------------------------------

  currentMessages.push({
    role: 'user',
    content: 'You have gathered all the data. Now call record_signals with your complete analysis and all signals.',
  })

  const synthesis = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 4096,
    system: cachedSystem as Anthropic.Messages.TextBlockParam[],
    tools: [recordSignalsTool],
    tool_choice: { type: 'tool', name: 'record_signals' },
    messages: currentMessages,
  })

  let analysis = ''
  let signals: StructuredSignal[] = []
  let disqualified: Array<{ ticker: string; reason: string }> = []

  for (const block of synthesis.content) {
    if (block.type !== 'tool_use' || block.name !== 'record_signals') continue
    const out = block.input as { analysis_summary: string; signals: StructuredSignal[]; disqualified: typeof disqualified }
    analysis = out.analysis_summary
    signals = out.signals ?? []
    disqualified = out.disqualified ?? []
  }

  // ---------------------------------------------------------------------------
  // Persist and print
  // ---------------------------------------------------------------------------

  for (const sig of signals) {
    tracker.add({ signal: sig, date: new Date().toISOString() })
  }
  await tracker.save()

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('ANALYSIS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(analysis)

  if (disqualified.length > 0) {
    console.log('\n── DISQUALIFIED ──')
    for (const d of disqualified) console.log(`  ${d.ticker}: ${d.reason}`)
  }

  if (signals.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('SIGNALS')
    console.log('═══════════════════════════════════════════════════════════════')
    for (const s of signals) {
      console.log(`\n[${s.conviction.toUpperCase()}] ${s.direction.toUpperCase()} — ${s.ticker}  (score: ${s.score}, informed: ${(s.informed_probability * 100).toFixed(0)}%)`)
      console.log(`  Entry $${s.entry_low}–$${s.entry_high}  |  Target $${s.target_price}  |  Stop $${s.stop_loss}`)
      for (const e of s.key_evidence) console.log(`  • ${e}`)
      console.log(`  Thesis: ${s.thesis}`)
    }
    console.log(`\n${signals.length} signal(s) saved → flow_signals.json`)
  } else {
    console.log('\nNo MEDIUM+ signals found in this scan.')
  }

  return { analysis, signals, disqualified }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const tickers: WatchTicker[] = [
    { ticker: 'MSTR',  sector: 'BTC proxy / software' },
    { ticker: 'COIN',  sector: 'crypto exchange' },
    { ticker: 'PLTR',  sector: 'data / defense software' },
    { ticker: 'SOUN',  sector: 'voice AI / small-cap' },
    { ticker: 'NVDA',  sector: 'semiconductors / AI' },
  ]

  console.log('Fetching live options flow data...\n')
  await interpretOptionsFlow(tickers)
}

main().catch(console.error)
