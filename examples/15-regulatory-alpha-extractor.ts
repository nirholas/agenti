/**
 * Regulatory Alpha Extractor: FDA/SEC/FCC/EPA filings → pre-market intelligence
 *
 * Real data sources:
 *   openFDA     — drug approvals, PDUFA actions, NDAs (free, no key for basic use)
 *   SEC EDGAR   — Form 4 clusters, novel structure filings (free)
 *   FCC ECFS    — electronic comment filing system (free public API)
 *   EPA ECHO    — enforcement and compliance (free public API)
 *
 * Two-call architecture:
 *   Call 1 — Claude scans databases via real HTTP tool calls
 *   Call 2 — Claude applies materiality filter + alpha decay model, outputs catalyst calendar
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Agency = 'FDA' | 'SEC' | 'FCC' | 'EPA'

interface CatalystRecord {
  date: string
  entity: string
  agency: Agency
  alphaScore: number
  direction: 'long' | 'short' | 'neutral'
  outcome?: { ticker: string; move_pct: number; days_to_move: number }
}

// ---------------------------------------------------------------------------
// Catalyst journal
// ---------------------------------------------------------------------------

class CatalystJournal {
  private records: CatalystRecord[] = []
  constructor(private filePath = 'reg_catalysts.json') {}
  async load() { try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.records = [] } }
  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }
  add(r: CatalystRecord) { this.records.push(r) }
  getPast(n = 10): CatalystRecord[] { return this.records.slice(-n) }
}

// ---------------------------------------------------------------------------
// Real tool implementations
// ---------------------------------------------------------------------------

const UA = 'agenti-regulatory-alpha nichxbt@gmail.com'

interface FdaProduct {
  application_number?: string
  sponsor_name?: string
  brand_name?: string
  generic_name?: string
  action_date?: string
  action_type?: string
  drug_name?: string
  marketing_status?: string
}

interface FdaApiResponse {
  results?: FdaProduct[]
  meta?: { results?: { total?: number } }
}

async function toolScanFdaApprovals(daysBack = 90, limit = 20): Promise<unknown> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10).replace(/-/g, '')

  // openFDA drug approval actions — no API key required for < 1000 req/day
  const url = `https://api.fda.gov/drug/nda.json?search=action_date:[${since}+TO+99999999]&sort=action_date:desc&limit=${limit}`

  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    // Try the simpler drugsfda endpoint
    const fallback = `https://api.fda.gov/drug/drugsfda.json?search=submissions.action_date:[${since}+TO+99999999]&sort=submissions.action_date:desc&limit=${limit}`
    const res2 = await fetch(fallback, { headers: { 'User-Agent': UA } })
    if (!res2.ok) throw new Error(`openFDA both endpoints failed: ${res.status}, ${res2.status}`)
    const data2 = await res2.json() as FdaApiResponse
    const results = data2.results ?? []
    return {
      source: 'openFDA drugsfda',
      total_found: data2.meta?.results?.total ?? results.length,
      recent_actions: results.slice(0, 10).map(r => ({
        sponsor: r.sponsor_name,
        brand: r.brand_name,
        drug: r.generic_name,
        application: r.application_number,
        action_date: r.action_date,
        action_type: r.action_type,
      })),
    }
  }

  const data = await res.json() as FdaApiResponse
  const results = data.results ?? []

  return {
    source: 'openFDA nda',
    total_found: data.meta?.results?.total ?? results.length,
    recent_actions: results.map(r => ({
      drug_name: r.drug_name,
      marketing_status: r.marketing_status,
      application: r.application_number,
      sponsor: r.sponsor_name,
    })),
  }
}

interface FdaWarning {
  company_name?: string
  product_description?: string
  posted_date?: string
  subject?: string
}

interface FdaWarningResponse {
  results?: FdaWarning[]
  meta?: { results?: { total?: number } }
}

async function toolScanFdaWarnings(daysBack = 60): Promise<unknown> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10)
  const url = `https://api.fda.gov/food/enforcement.json?search=report_date:[${since.replace(/-/g, '')}+TO+99999999]&sort=report_date:desc&limit=15`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })

  // Also scan drug warning letters via EDGAR
  const edgarUrl = `https://efts.sec.gov/LATEST/search-index?q=%22warning+letter%22+%22FDA%22&forms=8-K&dateRange=custom&startdt=${since}`
  const edgarRes = await fetch(edgarUrl, { headers: { 'User-Agent': UA } })

  const results: unknown[] = []

  if (res.ok) {
    const data = await res.json() as FdaWarningResponse
    for (const r of (data.results ?? []).slice(0, 8)) {
      results.push({ type: 'enforcement_recall', company: r.company_name, product: r.product_description, date: r.posted_date, subject: r.subject })
    }
  }

  if (edgarRes.ok) {
    const edgarData = await edgarRes.json() as { hits?: { hits?: Array<{ _source?: { entity_name?: string; file_date?: string } }> } }
    for (const h of (edgarData.hits?.hits ?? []).slice(0, 6)) {
      results.push({ type: '8K_fda_warning', company: h._source?.entity_name, filed: h._source?.file_date })
    }
  }

  return { findings: results, total: results.length }
}

interface EdgarForm4Hit {
  _source?: {
    entity_name?: string
    file_date?: string
    period_of_report?: string
  }
}

interface EdgarSearchResult {
  hits?: { hits?: EdgarForm4Hit[]; total?: { value?: number } }
}

async function toolScanForm4Clusters(sector: string, daysBack = 30): Promise<unknown> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10)

  // Form 4 = insider transactions; look for clusters by searching filings
  const sectorTerms: Record<string, string> = {
    biotech: 'pharmaceutical+biotechnology+drug',
    'ai/software': 'artificial+intelligence+software+platform',
    energy: 'energy+oil+gas+renewable',
    fintech: 'financial+technology+payments+banking',
    semiconductor: 'semiconductor+chip+silicon',
  }

  const terms = sectorTerms[sector.toLowerCase()] ?? encodeURIComponent(sector)
  const url = `https://efts.sec.gov/LATEST/search-index?q=${terms}&forms=4&dateRange=custom&startdt=${since}&_source=entity_name,file_date,period_of_report`

  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`SEC Form4 ${res.status}`)

  const data = await res.json() as EdgarSearchResult
  const hits = data.hits?.hits ?? []

  // Group by entity to find clusters (multiple insiders same company)
  const byCompany: Record<string, number> = {}
  for (const h of hits) {
    const name = h._source?.entity_name ?? 'unknown'
    byCompany[name] = (byCompany[name] ?? 0) + 1
  }

  const clusters = Object.entries(byCompany)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([company, count]) => ({ company, insider_transactions: count }))

  return {
    sector,
    total_form4_filings: data.hits?.total?.value ?? hits.length,
    cluster_detections: clusters.slice(0, 10),
    note: clusters.length > 0 ? 'Clusters = 3+ insider transactions at same company = potential buy signal' : 'No meaningful clusters detected in this window',
  }
}

interface FccFiling {
  id_submission?: string
  applicant_name?: string
  date_submission?: string
  bureaus?: string[]
  proceedings?: string[]
  text_data?: string
  submittions_type?: string
}

interface FccApiResponse {
  filing?: FccFiling[]
  total_record_count?: number
}

async function toolScanFccFilings(query: string, daysBack = 60): Promise<unknown> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10)

  // FCC ECFS API — electronic comment filing system
  const url = `https://efts.fcc.gov/easy-search/public/search?query=${encodeURIComponent(query)}&date_received=[${since}+TO+*]&limit=15&sort=date_received,DESC`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })

  if (!res.ok) {
    // Fallback to ECFS search endpoint
    const fallback = `https://www.fcc.gov/ecfs/api/filings?q.filers.name=${encodeURIComponent(query)}&limit=10&sort=date_received,DESC`
    const res2 = await fetch(fallback, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (!res2.ok) return { error: `FCC ECFS both endpoints failed: ${res.status}, ${res2.status}`, query }
    const data2 = await res2.json() as FccApiResponse
    return {
      source: 'FCC ECFS fallback',
      total: data2.total_record_count ?? 0,
      filings: (data2.filing ?? []).slice(0, 8).map(f => ({
        id: f.id_submission,
        filer: f.applicant_name,
        date: f.date_submission,
        bureau: f.bureaus?.join(', '),
        proceeding: f.proceedings?.join(', '),
      })),
    }
  }

  const data = await res.json() as { hits?: { total?: number; hits?: Array<{ _source?: FccFiling }> } }
  const hits = data.hits?.hits ?? []

  return {
    source: 'FCC ECFS',
    query,
    total: data.hits?.total ?? 0,
    filings: hits.slice(0, 8).map(h => ({
      filer: h._source?.applicant_name,
      date: h._source?.date_submission,
      type: h._source?.submittions_type,
      bureaus: h._source?.bureaus?.join(', '),
    })),
  }
}

interface EpaFacility {
  REGISTRY_ID?: string
  FAC_NAME?: string
  FAC_STREET?: string
  FAC_CITY?: string
  FAC_STATE?: string
  DERIVED_VIOLATIONS?: string
  DERIVED_INSPECTION_COUNT?: string
}

interface EpaApiResponse {
  Results?: { Facilities?: EpaFacility[] }
}

async function toolScanEpaEnforcement(query: string): Promise<unknown> {
  // EPA ECHO (Enforcement and Compliance History Online) — free REST API
  const url = `https://echo.epa.gov/api/getFacilities?output=JSON&p_fn=${encodeURIComponent(query)}&p_st=&responseset=20&qcolumns=1,3,4,5,9,23`

  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return { error: `EPA ECHO ${res.status}`, query }

  const data = await res.json() as EpaApiResponse
  const facilities = data?.Results?.Facilities ?? []

  return {
    source: 'EPA ECHO',
    query,
    total_facilities: facilities.length,
    facilities_with_violations: facilities
      .filter(f => parseInt(f.DERIVED_VIOLATIONS ?? '0') > 0)
      .map(f => ({
        name: f.FAC_NAME,
        location: `${f.FAC_CITY}, ${f.FAC_STATE}`,
        violations: f.DERIVED_VIOLATIONS,
        inspections: f.DERIVED_INSPECTION_COUNT,
      }))
      .slice(0, 8),
    clean_record_count: facilities.filter(f => parseInt(f.DERIVED_VIOLATIONS ?? '0') === 0).length,
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a regulatory intelligence analyst who spent 12 years at the SEC and 5 years at a healthcare-focused hedge fund.
You know which regulatory filings contain market-moving information that the market hasn't priced yet,
and which are bureaucratic noise.

## Materiality Filter

### FDA Alpha Signals (HIGH signal-to-noise)
- Novel drug approval in small-cap sponsor: massive rerating catalyst, market often slow to price
- FDA enforcement action / warning letter against public company: short signal, often unreported for days
- CRL (Complete Response Letter) 8-K: market oversells rejection; look for appeal plays 30–60 days later

### SEC Alpha Signals
- Form 4 cluster: 3+ insider transactions at same company in 30 days = informed buy signal
- Novel corporate structure filing (EX-10 with unusual terms): potential strategic transaction

### FCC Alpha Signals
- License transfer application by non-obvious entity: acquisition precursor
- New spectrum application from PE-backed company: strategic pivot signal

### EPA Alpha Signals
- Enforcement action removal or clean bill: removes project overhang for infrastructure companies
- New major facility permit: greenfield expansion signal for industrial companies

## Alpha Decay Model
How fast will the market price this?
- Covered by 3+ analyst firms in same week: 90% decayed — SKIP
- Mentioned in one trade publication: 50% decayed — LOW
- Only in regulatory database, no coverage: 10% decayed — HIGH
- Novel/unprecedented action: 5% decayed — EXTREME

## Output Format
CATALYST: **<entity>**
AGENCY: <FDA|SEC|FCC|EPA>
ALPHA_SCORE: <0-100>
DIRECTION: <LONG|SHORT|NEUTRAL>
DECAY_DAYS: <number>
MAGNITUDE: <pct>%
ACTION: <exactly what to monitor or do>

SKIP: <any finding with alpha score < 40>

Always explain WHY this hasn't been priced by the market.
Prioritize small/mid-cap situations where institutional coverage is sparse.`

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

async function extractRegulatoryAlpha(agencies: Agency[], sectorFocus: string[]) {
  const client = new Anthropic()
  const journal = new CatalystJournal()
  await journal.load()

  const pastCatalysts = journal.getPast(5)
  const trackRecord = pastCatalysts.length > 0
    ? `Recent catalysts:\n${pastCatalysts.map(c => `${c.entity}: score ${c.alphaScore}${c.outcome ? `, outcome: ${c.outcome.move_pct.toFixed(1)}%` : ', pending'}`).join('\n')}`
    : 'No historical data.'

  const tools: Anthropic.Tool[] = [
    {
      name: 'scan_fda_approvals',
      description: 'Scan openFDA for recent NDA/BLA drug approval actions in the last 90 days.',
      input_schema: { type: 'object' as const, properties: { days_back: { type: 'number' } }, required: [] },
    },
    {
      name: 'scan_fda_warnings',
      description: 'Scan openFDA enforcement actions and EDGAR 8-K filings mentioning FDA warning letters.',
      input_schema: { type: 'object' as const, properties: { days_back: { type: 'number' } }, required: [] },
    },
    {
      name: 'scan_form4_clusters',
      description: 'Scan SEC EDGAR Form 4 filings for insider transaction clusters (3+ transactions at same company).',
      input_schema: { type: 'object' as const, properties: { sector: { type: 'string' }, days_back: { type: 'number' } }, required: ['sector'] },
    },
    {
      name: 'scan_fcc_filings',
      description: 'Scan FCC ECFS for recent license transfer applications and spectrum filings.',
      input_schema: { type: 'object' as const, properties: { query: { type: 'string' }, days_back: { type: 'number' } }, required: ['query'] },
    },
    {
      name: 'scan_epa_enforcement',
      description: 'Search EPA ECHO for enforcement actions and violations for companies in a sector.',
      input_schema: { type: 'object' as const, properties: { query: { type: 'string' } }, required: ['query'] },
    },
  ]

  const agencyToTools: Record<Agency, string[]> = {
    FDA: ['scan_fda_approvals', 'scan_fda_warnings'],
    SEC: ['scan_form4_clusters'],
    FCC: ['scan_fcc_filings'],
    EPA: ['scan_epa_enforcement'],
  }

  const toolsToCall = agencies.flatMap(a => agencyToTools[a] ?? [])

  const userPrompt = `Scan regulatory databases for unpriced alpha catalysts.
Active agencies: ${agencies.join(', ')}
Sector focus: ${sectorFocus.join(', ')}

${trackRecord}

Call these tools: ${[...new Set(toolsToCall)].join(', ')}

For Form 4 clusters, scan each sector separately.
Apply the Materiality Filter. Output only catalysts with ALPHA_SCORE ≥ 40.
Rank by expected return.`

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
    const input = block.input as Record<string, string | number>
    let result: unknown

    console.log(`  → ${block.name}(${JSON.stringify(input)})`)

    if (block.name === 'scan_fda_approvals') {
      result = await toolScanFdaApprovals(typeof input.days_back === 'number' ? input.days_back : 90)
    } else if (block.name === 'scan_fda_warnings') {
      result = await toolScanFdaWarnings(typeof input.days_back === 'number' ? input.days_back : 60)
    } else if (block.name === 'scan_form4_clusters') {
      result = await toolScanForm4Clusters(String(input.sector), typeof input.days_back === 'number' ? input.days_back : 30)
    } else if (block.name === 'scan_fcc_filings') {
      result = await toolScanFccFilings(String(input.query), typeof input.days_back === 'number' ? input.days_back : 60)
    } else if (block.name === 'scan_epa_enforcement') {
      result = await toolScanEpaEnforcement(String(input.query))
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

  console.log('\n===== REGULATORY ALPHA REPORT =====\n')
  console.log(analysis)

  journal.add({ date: new Date().toISOString(), entity: 'batch-run', agency: 'FDA', alphaScore: 0, direction: 'neutral' })
  await journal.save()
  return analysis
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log('Scanning regulatory databases for live alpha...\n')
  await extractRegulatoryAlpha(
    ['FDA', 'SEC', 'FCC', 'EPA'],
    ['biotech/pharma', 'energy infrastructure', 'fintech', 'telecom'],
  )
}

main().catch(console.error)
