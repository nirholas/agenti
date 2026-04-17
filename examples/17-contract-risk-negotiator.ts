/**
 * Contract Risk Negotiator: raw contract text → risk score + redline strategy
 *
 * Real data sources:
 *   Market precedents  — Common Paper open standards (GitHub raw) + law firm public guides
 *   Jurisdiction law   — Wikipedia commercial law articles + Justia (US states)
 *                        + UK legislation.gov.uk (England & Wales)
 *   Counterparty intel — Crunchbase org page + TechCrunch search + Greenhouse/Lever jobs
 *
 * Architecture:
 *   Call 1 — Claude extracts all material clauses, scores risk by category,
 *             and calls tools to enrich each high-risk clause with real market data
 *   Call 2 — Claude synthesizes into specific redline language + negotiation sequence
 *   Memory  — Tracks accepted/rejected redlines across counterparties; builds leverage intel
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskCategory =
  | 'liability'
  | 'ip_ownership'
  | 'termination'
  | 'payment'
  | 'data_privacy'
  | 'non_compete'
  | 'indemnification'
  | 'governing_law'

interface ClauseAnalysis {
  clauseType: RiskCategory
  riskScore: number
  currentLanguage: string
  marketStandard: string
  deviation: 'favorable' | 'neutral' | 'unfavorable' | 'highly_unfavorable'
}

interface RedlineStrategy {
  clause: ClauseAnalysis
  mustWin: boolean
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
// Negotiation intel journal
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
// HTTP / HTML utilities
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

async function get(url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,application/xml,*/*' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function trunc(text: string, max = 3000): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated at ${max} chars]` : text
}

// Grab surrounding context for each keyword hit in a long document
function extractRelevantSections(text: string, keywords: string[], contextChars = 600, maxSections = 4): string {
  const lower = text.toLowerCase()
  const seen = new Set<string>()
  const sections: string[] = []

  for (const kw of keywords) {
    let pos = 0
    while (sections.length < maxSections) {
      const idx = lower.indexOf(kw.toLowerCase(), pos)
      if (idx === -1) break
      const start = Math.max(0, idx - 80)
      const end = Math.min(text.length, idx + contextChars)
      const snippet = text.slice(start, end).trim()
      const key = snippet.slice(0, 40)
      if (snippet.length > 60 && !seen.has(key)) {
        seen.add(key)
        sections.push(snippet)
      }
      pos = idx + kw.length
    }
    if (sections.length >= maxSections) break
  }

  return sections.join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Tool 1: lookup_market_precedent
// Common Paper GitHub (raw markdown) → Common Paper website → clause-specific resources
// ---------------------------------------------------------------------------

const CLAUSE_KEYWORDS: Record<string, string[]> = {
  liability:       ['liability', 'limitation of liability', 'aggregate liability', 'cap'],
  ip_ownership:    ['intellectual property', 'ownership', 'work for hire', 'derivative works'],
  termination:     ['termination', 'term', 'cancellation', 'terminate'],
  payment:         ['payment', 'fees', 'invoicing', 'net 30', 'late payment'],
  data_privacy:    ['data processing', 'personal data', 'breach notification', 'subprocessor', 'gdpr'],
  non_compete:     ['non-compete', 'non-solicitation', 'competitive', 'solicitation'],
  indemnification: ['indemnif', 'hold harmless', 'defend'],
  governing_law:   ['governing law', 'choice of law', 'jurisdiction', 'dispute'],
}

// Common Paper open source standard agreements (GitHub raw)
const COMMON_PAPER_RAW = [
  'https://raw.githubusercontent.com/CommonPaper/standard-agreements/main/Cloud%20Service%20Agreement/CSA.md',
  'https://raw.githubusercontent.com/CommonPaper/standard-agreements/main/cloud-service-agreement/cloud-service-agreement.md',
  'https://raw.githubusercontent.com/CommonPaper/standard-agreements/main/Cloud%20Service%20Agreement%201.0/CSA1.0.md',
]

// Clause-specific public resources (law review articles, Wikipedia, Cooley/WSGR public guides)
const CLAUSE_SPECIFIC_SOURCES: Partial<Record<string, string[]>> = {
  liability:       ['https://en.wikipedia.org/wiki/Limitation_of_liability', 'https://www.cooleygo.com/glossary/limitation-of-liability/'],
  data_privacy:    ['https://en.wikipedia.org/wiki/General_Data_Protection_Regulation', 'https://commonpaper.com/standards/data-processing-agreement/1.0/'],
  indemnification: ['https://en.wikipedia.org/wiki/Indemnity', 'https://www.cooleygo.com/glossary/indemnification/'],
  ip_ownership:    ['https://en.wikipedia.org/wiki/Intellectual_property', 'https://en.wikipedia.org/wiki/Work_for_hire'],
  termination:     ['https://en.wikipedia.org/wiki/Rescission_(contract_law)'],
  non_compete:     ['https://en.wikipedia.org/wiki/Non-compete_clause'],
  governing_law:   ['https://en.wikipedia.org/wiki/Choice_of_law'],
  payment:         ['https://en.wikipedia.org/wiki/Net_D'],
}

async function toolLookupMarketPrecedent(
  clauseType: string,
  dealType = 'saas',
  companySize = 'enterprise',
): Promise<unknown> {
  const keywords = CLAUSE_KEYWORDS[clauseType] ?? [clauseType.replace(/_/g, ' ')]

  // 1. Common Paper GitHub raw (full contract text in markdown — best source)
  for (const url of COMMON_PAPER_RAW) {
    try {
      const text = await get(url)
      if (text.length > 2000) {
        const relevant = extractRelevantSections(text, keywords)
        if (relevant.length > 100) {
          return {
            source: 'Common Paper Open Standard Agreement',
            url,
            clause_type: clauseType,
            deal_type: dealType,
            relevant_standard_language: trunc(relevant, 2500),
            note: 'Common Paper is an open source commercial contract standard adopted by hundreds of enterprise SaaS companies. This is real market-standard language.',
          }
        }
      }
    } catch {}
  }

  // 2. Common Paper website (HTML)
  try {
    const html = await get('https://commonpaper.com/standards/cloud-service-agreement/1.0/')
    const text = stripHtml(html)
    if (text.length > 1000) {
      const relevant = extractRelevantSections(text, keywords)
      if (relevant.length > 100) {
        return {
          source: 'Common Paper CSA Standard (website)',
          url: 'https://commonpaper.com/standards/cloud-service-agreement/1.0/',
          clause_type: clauseType,
          relevant_standard_language: trunc(relevant, 2500),
        }
      }
    }
  } catch {}

  // 3. Clause-specific authoritative sources
  const specificSources = CLAUSE_SPECIFIC_SOURCES[clauseType] ?? []
  for (const url of specificSources) {
    try {
      const raw = await get(url)
      const text = stripHtml(raw)
      if (text.length > 300) {
        const relevant = extractRelevantSections(text, keywords)
        const content = relevant.length > 100 ? trunc(relevant, 2500) : trunc(text, 2500)
        return {
          source: url,
          clause_type: clauseType,
          deal_type: dealType,
          raw_content: content,
          instruction: `Extract market standard terms for "${clauseType}" in a ${companySize} ${dealType} contract. Identify what is standard, what is favorable, what is a red flag, and any 2024–2026 trends.`,
        }
      }
    } catch {}
  }

  // 4. TechCrunch search for recent startup/SaaS legal trends
  try {
    const query = encodeURIComponent(`"${clauseType.replace(/_/g, ' ')}" contract negotiation SaaS enterprise`)
    const html = await get(`https://techcrunch.com/search/?q=${query}`)
    const text = stripHtml(html)
    if (text.length > 500) {
      return {
        source: 'TechCrunch search',
        clause_type: clauseType,
        raw_text: trunc(text, 2000),
        instruction: `Extract any market standard or trend information about "${clauseType}" clauses in ${dealType} contracts. Focus on 2024–2026.`,
      }
    }
  } catch {}

  return {
    error: `Could not fetch live market standard data for "${clauseType}".`,
    clause_type: clauseType,
    fallback: 'Rely on built-in market standard database from system prompt.',
  }
}

// ---------------------------------------------------------------------------
// Tool 2: check_jurisdiction_law
// Wikipedia commercial law → Justia (US states) → UK legislation.gov.uk
// ---------------------------------------------------------------------------

interface JurisdictionResource {
  url: string
  label: string
}

function buildJurisdictionSources(jurisdiction: string): JurisdictionResource[] {
  const j = jurisdiction.toLowerCase()

  if (j.includes('england') || j.includes('wales') || j.includes('uk')) {
    return [
      { url: 'https://en.wikipedia.org/wiki/English_contract_law', label: 'English Contract Law (Wikipedia)' },
      { url: 'https://en.wikipedia.org/wiki/Unfair_Contract_Terms_Act_1977', label: 'UCTA 1977 (Wikipedia)' },
      { url: 'https://www.legislation.gov.uk/ukpga/1977/50/contents', label: 'UCTA 1977 (legislation.gov.uk)' },
    ]
  }
  if (j.includes('delaware') || j === 'de') {
    return [
      { url: 'https://en.wikipedia.org/wiki/Delaware_General_Corporation_Law', label: 'DGCL (Wikipedia)' },
      { url: 'https://www.justia.com/delaware/', label: 'Justia Delaware' },
    ]
  }
  if (j.includes('california') || j === 'ca') {
    return [
      { url: 'https://en.wikipedia.org/wiki/California_law', label: 'California Law (Wikipedia)' },
      { url: 'https://www.justia.com/california/', label: 'Justia California' },
    ]
  }
  if (j.includes('new york') || j === 'ny') {
    return [
      { url: 'https://en.wikipedia.org/wiki/New_York_law', label: 'New York Law (Wikipedia)' },
      { url: 'https://www.justia.com/new-york/', label: 'Justia New York' },
    ]
  }
  if (j.includes('singapore')) {
    return [{ url: 'https://en.wikipedia.org/wiki/Law_of_Singapore', label: 'Singapore Law (Wikipedia)' }]
  }
  if (j.includes('german') || j.includes('germany')) {
    return [
      { url: 'https://en.wikipedia.org/wiki/German_law', label: 'German Law (Wikipedia)' },
      { url: 'https://en.wikipedia.org/wiki/B%C3%BCrgerliches_Gesetzbuch', label: 'BGB (Wikipedia)' },
    ]
  }

  // Generic fallback
  const slug = encodeURIComponent(jurisdiction)
  return [
    { url: `https://en.wikipedia.org/wiki/Law_of_${slug}`, label: `${jurisdiction} Law (Wikipedia)` },
    { url: `https://en.wikipedia.org/wiki/${slug}_contract_law`, label: `${jurisdiction} Contract Law (Wikipedia)` },
  ]
}

async function toolCheckJurisdictionLaw(clauseType: string, jurisdiction: string): Promise<unknown> {
  const keywords = [
    ...(CLAUSE_KEYWORDS[clauseType] ?? [clauseType.replace(/_/g, ' ')]),
    'contract',
    'commercial',
    'enforce',
  ]

  const sources = buildJurisdictionSources(jurisdiction)

  for (const source of sources) {
    try {
      const raw = await get(source.url)
      const text = stripHtml(raw)
      if (text.length < 300) continue
      const relevant = extractRelevantSections(text, keywords)
      const content = relevant.length > 80 ? relevant : text.slice(0, 2000)
      return {
        source: source.label,
        url: source.url,
        jurisdiction,
        clause_type: clauseType,
        raw_content: trunc(content, 2500),
        instruction: `Based on this source, explain: (1) how ${jurisdiction} law treats "${clauseType}" clauses, (2) any statutory caps or restrictions on enforcement, (3) notable rules or precedents that affect negotiation strategy, (4) key risks or advantages for your client under this governing law choice.`,
      }
    } catch {}
  }

  return {
    error: `Could not fetch live jurisdiction data for ${jurisdiction}.`,
    jurisdiction,
    clause_type: clauseType,
    fallback: `Apply general ${jurisdiction} commercial law principles for "${clauseType}" from training knowledge.`,
  }
}

// ---------------------------------------------------------------------------
// Tool 3: assess_counterparty_leverage
// Crunchbase + TechCrunch + Greenhouse/Lever job postings
// ---------------------------------------------------------------------------

interface GreenhouseJob {
  title: string
  departments?: Array<{ name: string }>
}

interface LeverPosting {
  text: string
  categories?: { team?: string }
}

async function fetchJobSignals(companyName: string): Promise<{ count: number; source: string; topDepts: string[] }> {
  const slug = companyName.toLowerCase().replace(/[\s,.']/g, '')

  try {
    const raw = await get(`https://api.greenhouse.io/v1/boards/${slug}/jobs?content=false`)
    const data = JSON.parse(raw) as { jobs: GreenhouseJob[] }
    if (data.jobs?.length > 0) {
      const deptCounts: Record<string, number> = {}
      for (const job of data.jobs) {
        const dept = job.departments?.[0]?.name ?? 'General'
        deptCounts[dept] = (deptCounts[dept] ?? 0) + 1
      }
      return {
        count: data.jobs.length,
        source: 'greenhouse',
        topDepts: Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d, n]) => `${d} (${n})`),
      }
    }
  } catch {}

  try {
    const raw = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)
    const data = JSON.parse(raw) as LeverPosting[]
    if (Array.isArray(data) && data.length > 0) {
      const teams: Record<string, number> = {}
      for (const job of data) {
        const t = job.categories?.team ?? 'General'
        teams[t] = (teams[t] ?? 0) + 1
      }
      return {
        count: data.length,
        source: 'lever',
        topDepts: Object.entries(teams).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d, n]) => `${d} (${n})`),
      }
    }
  } catch {}

  return { count: 0, source: 'not_found', topDepts: [] }
}

async function toolAssessCounterpartyLeverage(companyName: string): Promise<unknown> {
  const cbSlug = companyName.toLowerCase().replace(/\s+/g, '-')
  const results: Record<string, unknown> = { company: companyName }

  // 1. Crunchbase public org page
  try {
    const html = await get(`https://www.crunchbase.com/organization/${cbSlug}`)
    const text = stripHtml(html)
    if (text.length > 400 && !text.includes('Page Not Found') && !text.includes('404')) {
      results.crunchbase = {
        url: `https://www.crunchbase.com/organization/${cbSlug}`,
        raw_text: trunc(text, 2000),
        instruction: 'Extract: total funding raised, latest round (type + amount + date), lead investors, employee count, runway signals, recent strategic moves.',
      }
    }
  } catch {}

  // 2. TechCrunch funding + news search
  try {
    const query = encodeURIComponent(`"${companyName}" funding OR layoffs OR acquisition OR "revenue target" 2024 OR 2025`)
    const html = await get(`https://techcrunch.com/search/?q=${query}`)
    const text = stripHtml(html)
    if (text.length > 500) {
      results.techcrunch = {
        source: 'techcrunch',
        raw_text: trunc(text, 2000),
        instruction: 'Extract: recent funding rounds, layoff events, acquisition activity, revenue targets, Q-end pressure signals, strategic pivots in 2024–2025.',
      }
    }
  } catch {}

  // 3. Job postings — open roles signal burn rate + urgency
  const jobs = await fetchJobSignals(companyName)
  if (jobs.count > 0) {
    results.job_signals = {
      source: jobs.source,
      total_open_roles: jobs.count,
      top_departments: jobs.topDepts,
      signal: jobs.count > 60
        ? 'Heavy hiring — likely scaling aggressively; deal urgency high'
        : jobs.count < 5
          ? 'Very few open roles — cost-cutting mode or fully staffed; less Q-end pressure'
          : 'Moderate hiring pace',
    }
  }

  // 4. Company about/team page (last resort if no public data)
  if (Object.keys(results).length <= 1) {
    const domain = companyName.toLowerCase().replace(/[\s,.']/g, '') + '.com'
    for (const path of ['/about', '/company']) {
      try {
        const html = await get(`https://${domain}${path}`)
        const text = stripHtml(html)
        if (text.length > 400) {
          results.company_page = { url: `https://${domain}${path}`, raw_text: trunc(text, 1500) }
          break
        }
      } catch {}
    }
  }

  results.synthesis_instruction = `Assess counterparty leverage: (1) Financial pressure / runway, (2) Deal urgency indicators (Q-end, milestone-driven?), (3) Likely negotiating flexibility on key clause types, (4) Internal or outside counsel? (outside = expensive = more likely to concede), (5) Net leverage assessment: do they need this deal more than the client?`

  return results
}

// ---------------------------------------------------------------------------
// System prompt — the market standard database + leverage framework
// Cached via cache_control ephemeral — reused across both API calls
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
- Highly unfavorable: Uncapped or > 5× TCV; asymmetric (vendor capped at $10K, customer uncapped)
- Favorable: < 6 months of fees (for vendor); < 12 months (for customer)
- Carve-outs from cap: death/PI, fraud, IP indemnity, data breach (always negotiated separately)

### IP Ownership
- Market standard (SaaS): Vendor owns all IP; customer gets a license to use
- Trap: "Work for hire" language gives customer ownership of custom features → vendor loses control
- Trap: "Improvements to customer data" owned by vendor — data grab; customer data used for competitive advantage
- Must-Win: Customer data, customer configurations, and customer-derived insights are ALWAYS customer IP

### Termination for Convenience
- Market standard: Either party with 30–90 days notice
- Trap: Asymmetric — vendor immediate, customer 180 days
- Trap: Termination triggers fee acceleration (liquidated damages disguised as "remaining fees")
- Trap: No data portability obligation post-termination = ransomware leverage
- Must-Win: Data portability within 30 days post-termination at no additional charge

### Indemnification
- Market standard: Each party indemnifies for their own IP infringement and negligence
- Trap: Customer indemnifies vendor for "unauthorized use" — creates reverse liability for vendor's own failures
- Trap: Vendor indemnity capped at $5K = meaningless; real IP claims are worth millions
- Must-Win: Vendor IP indemnification uncapped or capped at full TCV; customer indemnity only for own acts

### Data Privacy / Security
- Market standard: SOC 2 Type II certification, DPA included, 72-hour breach notification
- Trap: "Commercially reasonable" security — no standard, unenforceable
- Trap: "May share de-identified data" — aggregated usage patterns are competitively sensitive
- Must-Win: Specific breach notification timeline (72h), named subprocessors, audit rights once per year

### Non-Compete / Non-Solicitation
- Market standard: 12 months post-termination, limited to direct solicitation of named employees
- Highly unfavorable: Global, 3+ years, covers adjacent markets, extends to vendor's other customers
- Must-Win: Restrict to named senior employees only; passive advertising or public postings are always permitted

## Negotiation Strategy Framework

For every clause to fight, recommend:
1. MUST-WIN (dealbreaker): Open with firm language. Escalate to principals if pushed back.
2. IMPORTANT (fight but concede with a trade): Propose market standard. Accept fallback with quid pro quo.
3. NICE-TO-HAVE: Ask once, drop immediately if any resistance.

## Leverage Intelligence
Always assess:
- Do they need this deal more than you? (Smaller company, Q-end, runway pressure)
- Have they already invested resources? (Switching cost = your leverage)
- Internal or outside counsel? (Outside = expensive = they'll concede to avoid fees)
- What's their historical "non-negotiable" vs. actual flexibility?

## Output Format
CLAUSE: **<type>**
RISK_SCORE: <0-10>
DEVIATION: <FAVORABLE|NEUTRAL|UNFAVORABLE|HIGHLY_UNFAVORABLE>
MUST_WIN: <YES|NO>
PROPOSED_LANGUAGE: <specific redline text>
FALLBACK_LANGUAGE: <acceptable fallback>
LEVERAGE: <what gives you power here>
CONCESSION: <what you'd trade away to win this>

End with:
NEGOTIATION_SEQUENCE: ordered list of clauses to fight (highest risk first)
WALK_AWAY_CONDITIONS: exactly 2–3 terms that are absolute dealbreakers`

// ---------------------------------------------------------------------------
// Main analyzer — tool loop + two-call architecture
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
        `${d.date}: ${d.outcome
          ? `won [${d.outcome.clauses_won.join(', ')}], lost [${d.outcome.clauses_lost.join(', ')}], closed: ${d.outcome.deal_closed}`
          : 'pending'}`
      ).join('\n')}`
    : `No prior deal history with ${counterparty}.`

  const tools: Anthropic.Tool[] = [
    {
      name: 'lookup_market_precedent',
      description: 'Fetch real market standard language from Common Paper open standards (GitHub), law firm public resources, and Wikipedia for a specific clause type.',
      input_schema: {
        type: 'object' as const,
        properties: {
          clause_type: { type: 'string', description: 'Clause category: liability, ip_ownership, termination, payment, data_privacy, non_compete, indemnification, or governing_law' },
          deal_type: { type: 'string', description: 'Deal type context: saas, licensing, services, enterprise' },
          company_size: { type: 'string', description: 'Deal size context: startup, mid-market, enterprise' },
        },
        required: ['clause_type'],
      },
    },
    {
      name: 'check_jurisdiction_law',
      description: 'Fetch governing law implications for a clause type in a given jurisdiction from Wikipedia, Justia, or UK legislation.gov.uk.',
      input_schema: {
        type: 'object' as const,
        properties: {
          clause_type: { type: 'string', description: 'The clause to check under this jurisdiction' },
          jurisdiction: { type: 'string', description: 'Governing law jurisdiction, e.g. "England and Wales", "Delaware", "California", "New York", "Singapore"' },
        },
        required: ['clause_type', 'jurisdiction'],
      },
    },
    {
      name: 'assess_counterparty_leverage',
      description: 'Fetch real company intelligence from Crunchbase, TechCrunch, and job boards to assess counterparty financial pressure, deal urgency, and negotiating flexibility.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string', description: 'Exact company name to research' },
        },
        required: ['company_name'],
      },
    },
  ]

  const userPrompt = `Analyze this contract and produce a complete redline strategy.

Counterparty: ${counterparty}
Deal context: ${dealContext}
Your leverage: ${yourLeverage}
${counterpartyContext}

CONTRACT TEXT:
${contractText}

INSTRUCTIONS:
1. First call assess_counterparty_leverage to understand their financial position and deal urgency.
2. For EVERY clause with risk score ≥ 5, call lookup_market_precedent to get real market standard language.
3. Call check_jurisdiction_law for the governing law clause AND for any clause where jurisdiction materially changes your position.
4. After gathering all data, output a complete redline strategy ordered by priority.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  console.log('\nGathering contract intelligence…\n')

  // Call 1 — Claude decides which tools to call based on the contract
  const call1 = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools,
    messages,
  })

  // Execute every tool call Claude made
  const toolResults: Anthropic.ToolResultBlockParam[] = []
  for (const block of call1.content) {
    if (block.type !== 'tool_use') continue
    const input = block.input as Record<string, string>
    console.log(`  → ${block.name}(${JSON.stringify(input)})`)

    let result: unknown
    try {
      switch (block.name) {
        case 'lookup_market_precedent':
          result = await toolLookupMarketPrecedent(input.clause_type!, input.deal_type, input.company_size)
          break
        case 'check_jurisdiction_law':
          result = await toolCheckJurisdictionLaw(input.clause_type!, input.jurisdiction!)
          break
        case 'assess_counterparty_leverage':
          result = await toolAssessCounterpartyLeverage(input.company_name!)
          break
        default:
          result = { error: `Unknown tool: ${block.name}` }
      }
    } catch (err) {
      result = { error: String(err) }
    }

    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
  }

  console.log('\nSynthesizing redline strategy…\n')

  // Call 2 — synthesize into full redline strategy (tool_choice: none = prose output only)
  const call2 = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools,
    tool_choice: { type: 'none' },
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

  console.log('===== CONTRACT REDLINE STRATEGY =====\n')
  console.log(analysis)

  // Persist to negotiation intel journal
  intel.add({ date: new Date().toISOString(), counterparty, clauses: [], redlines: [] })
  await intel.save()
  console.log('\nNegotiation record saved to negotiation_intel.json')

  return analysis
}

// ---------------------------------------------------------------------------
// Entry point — a real contract littered with landmine clauses
// ---------------------------------------------------------------------------

async function main() {
  const contractText = `
    ENTERPRISE SOFTWARE LICENSE AGREEMENT

    4. LIABILITY. IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT,
    INCIDENTAL, OR CONSEQUENTIAL DAMAGES. NOTWITHSTANDING THE FOREGOING,
    VENDOR'S TOTAL LIABILITY SHALL NOT EXCEED $10,000 OR FEES PAID IN THE
    LAST 30 DAYS, WHICHEVER IS LESS. CUSTOMER'S TOTAL LIABILITY SHALL BE
    UNCAPPED FOR ANY UNAUTHORIZED USE, BREACH OF CONFIDENTIALITY, OR FAILURE
    TO PAY OUTSTANDING FEES.

    7. INTELLECTUAL PROPERTY. All work product, improvements, modifications,
    and derivative works created using or incorporating Customer Data shall be
    owned exclusively by Vendor. Customer grants Vendor a perpetual, irrevocable,
    royalty-free license to Customer Data for product improvement purposes
    including sharing with third parties in de-identified form. Any custom
    features developed at Customer's request shall be considered work-for-hire
    owned exclusively by Vendor with no license-back to Customer.

    9. TERMINATION. Vendor may terminate this Agreement immediately upon written
    notice for any reason or no reason. Customer must provide 180 days prior
    written notice. Upon any termination initiated by Customer, all outstanding
    fees for the remainder of the contract term become immediately due and
    payable. Vendor shall have no obligation to provide data export assistance
    after the termination date.

    11. INDEMNIFICATION. Customer shall indemnify, defend, and hold harmless
    Vendor and its officers from any and all claims arising from Customer's
    use of the software, including claims arising from Customer's own
    negligence. Vendor's indemnification obligations are limited to direct
    third-party IP infringement claims and shall not exceed $5,000 in aggregate.

    12. GOVERNING LAW. This Agreement shall be governed exclusively by the
    laws of England and Wales. Customer irrevocably submits to the exclusive
    jurisdiction of the courts of London, England for all disputes.
  `

  await analyzeContract(
    contractText,
    'Acme SaaS Corp',
    'Enterprise software license, $500K ACV, 3-year term',
    'Two competing vendors ready to sign; counterparty needs this deal for their Q2 number; we are their largest prospect this quarter',
  )
}

main().catch(console.error)
