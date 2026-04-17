/**
 * Contract Risk Negotiator: raw contract text → risk score + redline strategy
 *
 * Architecture:
 *   Call 1 — Claude extracts all material clauses, scores risk by category,
 *             and flags positions that deviate from market standard via tool use
 *   Call 2 — Claude generates specific redline language + negotiation strategy:
 *             what to fight for, what to concede, what's a dealbreaker
 *   Memory  — Tracks accepted/rejected redlines across counterparties; builds leverage intel
 *
 * Real data connectors:
 *   lookup_market_precedent  → SEC EDGAR full-text search across EX-10 contract exhibits
 *   check_jurisdiction_law   → CourtListener API (free, no key)
 *   assess_counterparty      → Yahoo Finance financials + SEC EDGAR filings + Crunchbase (CRUNCHBASE_API_KEY)
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskCategory = 'liability' | 'ip_ownership' | 'termination' | 'payment' | 'data_privacy' | 'non_compete' | 'indemnification' | 'governing_law'

interface ClauseAnalysis {
  clauseType: RiskCategory
  riskScore: number         // 0–10; 10 = existential
  currentLanguage: string
  marketStandard: string
  deviation: 'favorable' | 'neutral' | 'unfavorable' | 'highly_unfavorable'
}

interface RedlineStrategy {
  clause: ClauseAnalysis
  mustWin: boolean          // dealbreaker if not changed
  proposedLanguage: string
  fallbackLanguage: string
  negotiatingLeverage: string
  concessionToOffer: string
}

interface NegotiationRecord {
  date: string
  counterparty: string
  clauses: ClauseAnalysis[]
  redlines: RedlineStrategy[]
  outcome?: { clauses_won: string[]; clauses_lost: string[]; deal_closed: boolean }
}

// ---------------------------------------------------------------------------
// Negotiation intel journal (counterparty pattern tracking)
// ---------------------------------------------------------------------------

class NegotiationIntel {
  private records: NegotiationRecord[] = []
  constructor(private filePath = 'negotiation_intel.json') {}
  async load() { try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.records = [] } }
  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }
  add(r: NegotiationRecord) { this.records.push(r) }

  getCounterpartyPatterns(counterparty: string): NegotiationRecord[] {
    return this.records.filter(r => r.counterparty.toLowerCase().includes(counterparty.toLowerCase()))
  }
}

// ---------------------------------------------------------------------------
// Real data connectors
// ---------------------------------------------------------------------------

const UA = 'agenti-contract-analyzer nichxbt@gmail.com'

const CLAUSE_QUERIES: Record<string, string> = {
  liability:        '"liability cap" "months of fees" OR "total fees paid"',
  ip_ownership:     '"intellectual property" "work for hire" software license',
  termination:      '"termination for convenience" "days written notice" software',
  indemnification:  '"shall indemnify" "intellectual property infringement" enterprise',
  data_privacy:     '"data processing agreement" "breach notification" "hours" subprocessor',
  non_compete:      '"non-solicitation" "non-compete" "months following termination"',
  governing_law:    '"governing law" "jurisdiction" enterprise software agreement',
  payment:          '"net 30" OR "net 60" "payment terms" software subscription',
}

async function lookupMarketPrecedent(clauseType: string, dealType = '', companySize = ''): Promise<unknown> {
  const key = clauseType.toLowerCase().replace(/[^a-z_]/g, '_').replace(/_+/g, '_')
  const q = CLAUSE_QUERIES[key] ?? `"${clauseType}" enterprise software agreement`

  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=EX-10,EX-10.1,EX-10.2,EX-10.3&dateRange=custom&startdt=2024-01-01`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`SEC EDGAR ${res.status}`)
  const data = await res.json() as any
  const hits: any[] = data.hits?.hits ?? []
  const total: number = data.hits?.total?.value ?? 0

  return {
    clause_type: clauseType,
    deal_type: dealType,
    company_size: companySize,
    corpus_size: total,
    sample_filers: hits.slice(0, 6).map(h => ({
      company: h._source.entity_name,
      filed: h._source.file_date,
      form: h._source.form_type,
    })),
    market_signal: total > 100
      ? `Strong precedent pool (${total} filings). Pattern analysis reliable.`
      : `Thin precedent pool (${total} filings). Apply more conservative standard.`,
  }
}

// CourtListener jurisdiction slug map
const JCODE: Record<string, string> = {
  'delaware':          'del',
  'new york':          'ny',
  'california':        'cal',
  'texas':             'tex',
  'england':           'enggw',
  'england and wales': 'enggw',
  'uk':                'enggw',
  'federal':           'ca2',
}

async function checkJurisdictionLaw(clauseType: string, jurisdiction: string): Promise<unknown> {
  const jLower = jurisdiction.toLowerCase()
  const jCode = Object.entries(JCODE).find(([k]) => jLower.includes(k))?.[1]

  const q = `${clauseType.replace(/_/g, ' ')} software license agreement`
  const base = 'https://www.courtlistener.com/api/rest/v4/opinions/'
  const params = new URLSearchParams({
    q,
    order_by: 'score desc',
    stat_Precedential: 'on',
    format: 'json',
    page_size: '4',
  })
  if (jCode) params.set('court', jCode)

  const res = await fetch(`${base}?${params}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`CourtListener ${res.status}`)
  const data = await res.json() as any

  return {
    clause_type: clauseType,
    jurisdiction,
    court_code: jCode ?? 'all',
    total_cases: data.count ?? 0,
    relevant_cases: (data.results ?? []).slice(0, 4).map((r: any) => ({
      case_name: r.case_name,
      date: r.date_filed,
      court: r.court,
      url: `https://www.courtlistener.com${r.absolute_url}`,
      snippet: r.snippet ?? null,
    })),
  }
}

async function assessCounterpartyLeverage(companyName: string): Promise<unknown> {
  const result: Record<string, unknown> = { company: companyName }

  // 1. Yahoo Finance: find ticker and pull financials
  try {
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(companyName)}&quotesCount=3&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )
    if (searchRes.ok) {
      const searchData = await searchRes.json() as any
      const equity = (searchData.quotes ?? []).find((q: any) => q.quoteType === 'EQUITY')
      if (equity) {
        result.ticker   = equity.symbol
        result.exchange = equity.exchange
        const summaryRes = await fetch(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${equity.symbol}?modules=financialData,defaultKeyStatistics`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        )
        if (summaryRes.ok) {
          const summary = await summaryRes.json() as any
          const fin  = summary.quoteSummary?.result?.[0]?.financialData ?? {}
          const stat = summary.quoteSummary?.result?.[0]?.defaultKeyStatistics ?? {}
          result.revenue             = fin.totalRevenue?.fmt
          result.revenue_growth_yoy  = fin.revenueGrowth?.fmt
          result.total_cash          = fin.totalCash?.fmt
          result.total_debt          = fin.totalDebt?.fmt
          result.operating_cash_flow = fin.operatingCashflow?.fmt
          result.enterprise_value    = stat.enterpriseValue?.fmt
          result.is_public = true
        }
      } else {
        result.is_public = false
      }
    }
  } catch { result.yahoo_error = 'unavailable' }

  // 2. SEC EDGAR: recent 8-K activity (signals deal urgency, strategic changes)
  try {
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString().split('T')[0]
    const edgarRes = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(companyName)}%22&forms=8-K,10-Q&dateRange=custom&startdt=${since}`,
      { headers: { 'User-Agent': UA } },
    )
    if (edgarRes.ok) {
      const ed = await edgarRes.json() as any
      result.sec_filings_180d = ed.hits?.total?.value ?? 0
      result.recent_sec = (ed.hits?.hits ?? []).slice(0, 3).map((h: any) => ({
        form: h._source.form_type,
        filed: h._source.file_date,
        entity: h._source.entity_name,
      }))
    }
  } catch { result.edgar_error = 'unavailable' }

  // 3. Crunchbase (private companies, if key set)
  const cbKey = process.env.CRUNCHBASE_API_KEY
  if (cbKey) {
    try {
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const cbRes = await fetch(
        `https://api.crunchbase.com/api/v4/entities/organizations/${slug}?card_ids=funding_rounds&user_key=${cbKey}`,
      )
      if (cbRes.ok) {
        const cb = await cbRes.json() as any
        const rounds: any[] = cb.cards?.funding_rounds ?? []
        const latest = rounds[0]
        if (latest) {
          result.last_round_type   = latest.investment_type
          result.last_round_date   = latest.announced_on
          result.last_round_amount = latest.money_raised?.value_usd
          result.total_funding_usd = cb.properties?.total_funding_usd
          result.funding_rounds    = cb.properties?.num_funding_rounds
        }
      }
    } catch { result.crunchbase_error = 'unavailable' }
  }

  return result
}

// ---------------------------------------------------------------------------
// The prompt — market standard database + leverage framework is the moat
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior deal counsel with 20 years of M&A, enterprise SaaS, and technology licensing experience.
You have reviewed 3,000+ contracts and know exactly which clauses are boilerplate vs. which are traps.
Your job is to protect your client, close the deal, and not waste time fighting the wrong battles.

## Risk Scoring Framework (apply to every clause)

Score 0–10 on two axes:
- Probability of harm: How likely is this clause to cause financial or operational damage?
- Magnitude: If triggered, how bad? (0 = nuisance, 10 = company-ending)
- Risk Score = (Probability × 0.4) + (Magnitude × 0.6)

## Market Standard Database (key clauses)

### Liability Cap
- Market standard: 12 months of fees paid (SaaS), or 1× total contract value
- Highly unfavorable: Uncapped or > 5× TCV
- Favorable: < 6 months of fees
- Carve-outs from cap: death/PI, fraud, IP indemnity, data breach (always separate)

### IP Ownership
- Market standard (SaaS): Vendor owns all IP; customer gets license
- Trap: "Work for hire" language buried in exhibit gives customer ownership of custom features
- Red flag: "Improvements to customer data" owned by vendor — potential data grab
- Must-Win: Customer data and customer-specific configurations are ALWAYS customer IP

### Termination for Convenience
- Market standard: Either party with 30–90 days notice
- Trap: Vendor can terminate immediately but customer requires 6 months notice
- Trap: Termination triggers acceleration of all remaining fees (liquidated damages disguised)
- Must-Win: Data portability within 30 days post-termination, no charge

### Indemnification
- Market standard: Each party indemnifies for their own IP infringement and negligence
- Trap: Mutual indemnification with asymmetric carve-outs
- Trap: Customer indemnifies vendor for "unauthorized use" — creates reverse liability
- Must-Win: Uncapped indemnification only for fraud and willful misconduct

### Data Privacy / Security
- Market standard: SOC 2 Type II, DPA included, 72-hour breach notification
- Trap: Vendor "may share de-identified data" — can aggregate your usage data competitively
- Trap: Security standard "commercially reasonable efforts" — unenforceable
- Must-Win: Specific breach notification timeline, subprocessor restrictions, audit rights

### Non-Compete / Non-Solicitation
- Market standard: 12 months post-termination, reasonable geographic scope
- Highly unfavorable: Global, 3+ years, covers adjacent markets
- Trap: Vendor non-solicitation extends to vendor's customers — affects your BD team
- Must-Win: Limit to direct solicitation of named employees, not passive recruitment

## Negotiation Strategy Framework

For every clause to fight, recommend:
1. MUST-WIN (dealbreaker): Open with firm language. If they push back, elevate to principals.
2. IMPORTANT (fight but concede with trade): Propose market standard. Accept fallback with quid pro quo.
3. NICE-TO-HAVE (low stakes): Ask once, drop if any resistance.

## Leverage Intelligence
Always assess counterparty's leverage:
- Do they need this deal more than you? (Smaller company, Q-end, public co with beat pressure)
- Have they already invested engineering resources? (Switching cost = your leverage)
- Is their legal team internal or outside counsel? (Outside counsel = expensive to fight)
- What's their standard "non-negotiable" vs. actual flexibility?

## Output Format
CLAUSE: **<type>**
RISK_SCORE: <0-10>
DEVIATION: <FAVORABLE|NEUTRAL|UNFAVORABLE|HIGHLY_UNFAVORABLE>
MUST_WIN: <YES|NO>
PROPOSED_LANGUAGE: <specific redline text>
FALLBACK_LANGUAGE: <acceptable fallback>
LEVERAGE: <what gives you power here>
CONCESSION: <what you'd trade away to win this>

End with NEGOTIATION_SEQUENCE: ordered list of clauses to fight, from most to least important.
Include WALK_AWAY_CONDITIONS: the 2–3 terms that are absolute dealbreakers.`

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

async function analyzeContract(
  contractText: string,
  counterparty: string,
  dealContext: string,
  yourLeverage: string,
) {
  const client = new Anthropic()
  const intel = new NegotiationIntel()
  await intel.load()

  const priorDeals = intel.getCounterpartyPatterns(counterparty)
  const counterpartyContext = priorDeals.length > 0
    ? `Prior deal history with ${counterparty} (${priorDeals.length} deals):\n${priorDeals.map(d =>
        `${d.date}: ${d.outcome ? `won: [${d.outcome.clauses_won.join(', ')}], lost: [${d.outcome.clauses_lost.join(', ')}]` : 'pending'}`
      ).join('\n')}`
    : `No prior history with ${counterparty}.`

  const tools: Anthropic.Tool[] = [
    {
      name: 'lookup_market_precedent',
      description: 'Search SEC EDGAR contract exhibit filings to find market standard language and precedent corpus size for a specific clause type.',
      input_schema: { type: 'object' as const, properties: { clause_type: { type: 'string' }, deal_type: { type: 'string' }, company_size: { type: 'string' } }, required: ['clause_type'] },
    },
    {
      name: 'check_jurisdiction_law',
      description: 'Search CourtListener for precedential opinions on a clause type in the specified jurisdiction. Returns relevant case citations.',
      input_schema: { type: 'object' as const, properties: { clause_type: { type: 'string' }, jurisdiction: { type: 'string' } }, required: ['clause_type', 'jurisdiction'] },
    },
    {
      name: 'assess_counterparty_leverage',
      description: 'Assess counterparty business position: Yahoo Finance financials (public co), SEC EDGAR recent filings, Crunchbase funding (private co, requires CRUNCHBASE_API_KEY).',
      input_schema: { type: 'object' as const, properties: { company_name: { type: 'string' } }, required: ['company_name'] },
    },
  ]

  const userPrompt = `Analyze this contract and produce a complete redline strategy.

Counterparty: ${counterparty}
Deal context: ${dealContext}
Your leverage: ${yourLeverage}
${counterpartyContext}

CONTRACT TEXT:
${contractText}

Step 1: Call assess_counterparty_leverage to understand their position.
Step 2: For every clause with risk score ≥ 5, call lookup_market_precedent.
Step 3: Call check_jurisdiction_law for the governing law clause and any clause that varies significantly by jurisdiction.
Step 4: Output a complete redline strategy ordered by priority.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  // --- Call 1: gather data via tools ---
  const call1 = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools,
    messages,
  })

  const toolResults: Anthropic.ToolResultBlockParam[] = []
  for (const block of call1.content) {
    if (block.type !== 'tool_use') continue
    const input = block.input as Record<string, string>
    let result: unknown
    try {
      if (block.name === 'lookup_market_precedent') {
        result = await lookupMarketPrecedent(input.clause_type, input.deal_type, input.company_size)
      } else if (block.name === 'check_jurisdiction_law') {
        result = await checkJurisdictionLaw(input.clause_type, input.jurisdiction)
      } else if (block.name === 'assess_counterparty_leverage') {
        result = await assessCounterpartyLeverage(input.company_name)
      }
    } catch (err) {
      result = { error: (err as Error).message }
    }
    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
  }

  // --- Call 2: redline strategy ---
  const call2 = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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

  console.log('\n===== CONTRACT REDLINE STRATEGY =====\n')
  console.log(analysis)

  intel.add({ date: new Date().toISOString(), counterparty, clauses: [], redlines: [] })
  await intel.save()

  return analysis
}

// ---------------------------------------------------------------------------
// Entry point — swap contractText for fs.readFile(...) to analyze a real file
// ---------------------------------------------------------------------------

async function main() {
  const contractText = `
    ENTERPRISE SOFTWARE LICENSE AGREEMENT

    4. LIABILITY. IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT,
    INCIDENTAL, CONSEQUENTIAL DAMAGES. NOTWITHSTANDING THE FOREGOING, VENDOR'S
    TOTAL LIABILITY SHALL NOT EXCEED $10,000 OR FEES PAID IN THE LAST 30 DAYS.
    CUSTOMER'S TOTAL LIABILITY SHALL BE UNCAPPED FOR UNAUTHORIZED USE.

    7. INTELLECTUAL PROPERTY. All work product, improvements, modifications,
    and derivative works created using or incorporating Customer Data shall be
    owned exclusively by Vendor. Customer grants Vendor a perpetual license to
    Customer Data for product improvement purposes including sharing with
    third parties in de-identified form.

    9. TERMINATION. Vendor may terminate immediately upon written notice.
    Customer must provide 180 days written notice. Upon termination for any reason,
    all outstanding fees for the remainder of the contract term become immediately due.

    12. GOVERNING LAW. This Agreement shall be governed by the laws of England and Wales.
  `

  await analyzeContract(
    contractText,
    'Acme SaaS Corp',
    'Enterprise software license, $500K ACV, 3-year term',
    'We have 2 competing vendors ready to sign; they need this deal for their Q2 number',
  )
}

main().catch(console.error)
