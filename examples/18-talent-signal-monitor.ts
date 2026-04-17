/**
 * Talent Signal Monitor: executive/engineer movement → strategic intelligence
 *
 * Real data sources:
 *   LinkedIn moves  — Google News RSS search (executive departure/arrival news)
 *                     RapidAPI JSearch if RAPIDAPI_KEY set
 *   SEC filings     — EDGAR EFTS full-text search for 8-K Item 5.02 (director/officer changes)
 *   Entity lookup   — Crunchbase public org page → TechCrunch search → Google News RSS
 *   Hiring signals  — Greenhouse API → Lever API → JSearch → Google News RSS
 *
 * Architecture:
 *   Call 1 — Claude gathers talent movement data via tool use (real HTTP calls)
 *   Call 2 — Claude applies the Signal Taxonomy, surfaces high-strength signals only
 *   Memory  — Weekly snapshots in talent_intel.json; delta context surfaced on each run
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TalentSignal {
  company: string
  signalType:
    | 'stealth_build'
    | 'product_pivot'
    | 'org_collapse'
    | 'acquisition_prep'
    | 'ipo_prep'
    | 'competitor_drain'
    | 'acqui_hire_target'
  strength: number
  affectedCompanies: string[]
  interpretation: string
  actionRecommendation: string
}

interface TalentSnapshot {
  date: string
  company: string
  signals: TalentSignal[]
  rawResults: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// HTTP utilities
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const SEC_UA = 'agenti-talent-monitor nichxbt@gmail.com'
const CACHE_DIR = '.talent_cache'

async function get(url: string, headers?: Record<string, string>, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,application/xml,*/*', ...headers },
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

function trunc(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated at ${max} chars]` : text
}

async function ensureCache() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// RSS parser
// ---------------------------------------------------------------------------

function parseRssItems(
  xml: string,
  limit = 30,
): Array<{ title: string; date: string; link?: string; source?: string }> {
  const items: Array<{ title: string; date: string; link?: string; source?: string }> = []
  const pattern = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = pattern.exec(xml)) !== null && items.length < limit) {
    const body = match[1]!
    const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(body)
    const dateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(body)
    const linkMatch =
      /<link>(.*?)<\/link>/.exec(body) ?? /<guid[^>]*>(.*?)<\/guid>/.exec(body)
    const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/.exec(body)
    if (titleMatch?.[1]?.trim()) {
      items.push({
        title: titleMatch[1].trim(),
        date: dateMatch?.[1]?.trim() ?? '',
        link: linkMatch?.[1]?.trim(),
        source: sourceMatch?.[1]?.trim(),
      })
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// Tool: scan_linkedin_moves
// Google News RSS (executive movement queries) + JSearch via RapidAPI if key set
// ---------------------------------------------------------------------------

async function toolScanLinkedinMoves(
  companyName: string,
  daysBack = 90,
): Promise<unknown> {
  const since = new Date(Date.now() - daysBack * 86_400_000)
  const allItems: Array<{ query: string; items: Array<{ title: string; date: string; link?: string }> }> = []

  const queries = [
    `"${companyName}" ("joins" OR "appointed" OR "named" OR "hired as") (VP OR Director OR Chief OR "Head of")`,
    `"${companyName}" ("departs" OR "leaves" OR "steps down" OR "resigned" OR "exits") (executive OR VP OR Director OR Chief)`,
    `"${companyName}" leadership change executive 2026`,
  ]

  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q)
      const rss = await get(
        `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`,
      )
      const items = parseRssItems(rss)
      const recent = items.filter(item => {
        if (!item.date) return true
        const d = new Date(item.date)
        return isNaN(d.getTime()) || d > since
      })
      if (recent.length > 0) {
        allItems.push({ query: q.slice(0, 60), items: recent.slice(0, 8) })
      }
    } catch {}
  }

  // RapidAPI JSearch for additional LinkedIn-sourced job/people data
  const apiKey = process.env.RAPIDAPI_KEY
  if (apiKey) {
    try {
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(`"${companyName}" executive VP Director`)}&num_pages=1&date_posted=month`
      const raw = await get(url, {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      })
      const data = JSON.parse(raw) as {
        data?: Array<{ job_title: string; employer_name: string; job_posted_at_datetime_utc?: string }>
      }
      if (data.data && data.data.length > 0) {
        allItems.push({
          query: 'jsearch_rapidapi',
          items: data.data
            .slice(0, 8)
            .map(j => ({ title: `${j.job_title} at ${j.employer_name}`, date: j.job_posted_at_datetime_utc ?? '' })),
        })
      }
    } catch {}
  }

  if (allItems.length === 0) {
    return {
      company: companyName,
      days_back: daysBack,
      note: 'No executive movement news found in public sources. SEC 8-K filings may have more for public companies.',
      items: [],
    }
  }

  return {
    company: companyName,
    days_back: daysBack,
    sources: allItems,
    instruction:
      'Extract individual executive departure and arrival events. For each: identify name (if available), title, direction (joined/departed), and destination/origin company. Apply Signal Taxonomy.',
  }
}

// ---------------------------------------------------------------------------
// Tool: check_sec_8k_leadership
// SEC EDGAR EFTS full-text search for 8-K Item 5.02 (director/officer changes)
// ---------------------------------------------------------------------------

async function toolCheckSec8kLeadership(
  companyName: string,
  ticker?: string,
): Promise<unknown> {
  const daysBack = 180
  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString().split('T')[0]

  const allFilings: Array<{
    filed: string
    entity: string
    form: string
    period?: string
    accession?: string
  }> = []

  const searchTerms: string[] = []
  if (ticker) searchTerms.push(`"${ticker}"`)
  searchTerms.push(`"${companyName}"`)

  for (const term of searchTerms) {
    try {
      // 8-K Item 5.02 = departure/appointment of directors and principal officers
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(term)}+%225.02%22&forms=8-K&dateRange=custom&startdt=${since}`
      const raw = await get(url, { 'User-Agent': SEC_UA })
      const data = JSON.parse(raw) as {
        hits?: {
          total?: { value: number }
          hits?: Array<{
            _source: {
              file_date?: string
              entity_name?: string
              form_type?: string
              period_of_report?: string
              accession_no?: string
            }
          }>
        }
      }
      for (const h of (data.hits?.hits ?? []).slice(0, 10)) {
        const s = h._source
        if (!allFilings.find(f => f.accession === s.accession_no)) {
          allFilings.push({
            filed: s.file_date ?? '',
            entity: s.entity_name ?? '',
            form: s.form_type ?? '8-K',
            period: s.period_of_report,
            accession: s.accession_no,
          })
        }
      }
    } catch {}
  }

  // Broader keyword search: departure/resignation/appointed in 8-K filings
  try {
    const q = encodeURIComponent(
      `"${companyName}" ("officer" OR "director") ("departure" OR "resignation" OR "appointed" OR "resigned")`,
    )
    const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&forms=8-K&dateRange=custom&startdt=${since}`
    const raw = await get(url, { 'User-Agent': SEC_UA })
    const data = JSON.parse(raw) as {
      hits?: {
        hits?: Array<{
          _source: {
            file_date?: string
            entity_name?: string
            form_type?: string
            period_of_report?: string
            accession_no?: string
          }
        }>
      }
    }
    for (const h of (data.hits?.hits ?? []).slice(0, 6)) {
      const s = h._source
      if (!allFilings.find(f => f.accession === s.accession_no)) {
        allFilings.push({
          filed: s.file_date ?? '',
          entity: s.entity_name ?? '',
          form: s.form_type ?? '8-K',
          period: s.period_of_report,
          accession: s.accession_no,
        })
      }
    }
  } catch {}

  allFilings.sort((a, b) => b.filed.localeCompare(a.filed))

  return {
    company: companyName,
    ticker: ticker ?? null,
    days_back: daysBack,
    total_8k_502_filings: allFilings.length,
    filings: allFilings.slice(0, 10),
    note:
      allFilings.length === 0
        ? 'No 8-K Item 5.02 filings found. Company may be private — check Google News results.'
        : '8-K Item 5.02 covers: departure of principal officer, election/appointment of new officer, compensatory arrangements.',
  }
}

// ---------------------------------------------------------------------------
// Tool: identify_destination_entity
// Crunchbase public org page → TechCrunch → Google News RSS
// ---------------------------------------------------------------------------

async function toolIdentifyDestinationEntity(companyName: string): Promise<unknown> {
  const cbSlug = companyName
    .toLowerCase()
    .replace(/[\s.,'"]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  // 1. Crunchbase public org page
  try {
    const html = await get(`https://www.crunchbase.com/organization/${cbSlug}`)
    const text = stripHtml(html)
    if (
      text.length > 500 &&
      !text.includes('Page not found') &&
      !text.toLowerCase().includes('404') &&
      !text.toLowerCase().includes('captcha')
    ) {
      return {
        source: 'crunchbase',
        company: companyName,
        url: `https://www.crunchbase.com/organization/${cbSlug}`,
        raw_text: trunc(text, 3500),
        instruction:
          'Extract: company type (public/private/stealth), total funding raised, latest round (type/amount/date), lead investors, employee count, product domain, and any acquisitions.',
      }
    }
  } catch {}

  // 2. TechCrunch search
  try {
    const encoded = encodeURIComponent(`${companyName} funding OR investment OR stealth OR launch OR founded`)
    const html = await get(`https://techcrunch.com/search/?q=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) {
      return {
        source: 'techcrunch',
        company: companyName,
        raw_text: trunc(text, 3000),
        instruction:
          'Extract: any funding announcements, company description, investor names, product domain, and founding team info.',
      }
    }
  } catch {}

  // 3. Google News RSS
  try {
    const q = encodeURIComponent(
      `"${companyName}" (funding OR investment OR "seed round" OR "Series A" OR stealth OR launch OR founded OR "raises")`,
    )
    const rss = await get(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`)
    const items = parseRssItems(rss, 10)
    if (items.length > 0) {
      return {
        source: 'google_news',
        company: companyName,
        news_items: items,
        instruction:
          'From these news items identify: entity type (stealth/startup/established), funding status, investors, and product domain.',
      }
    }
  } catch {}

  return {
    company: companyName,
    note: 'No public information found. Company may be unannounced stealth.',
    crunchbase_check: `https://www.crunchbase.com/organization/${cbSlug}`,
  }
}

// ---------------------------------------------------------------------------
// Tool: check_hiring_for_roles
// Greenhouse → Lever → JSearch (RapidAPI) → Google News
// ---------------------------------------------------------------------------

interface GreenhouseJob {
  title: string
  departments?: Array<{ name: string }>
  updated_at?: string
}

interface LeverPosting {
  text: string
  categories?: { team?: string; department?: string }
}

async function toolCheckHiringForRoles(
  companyName: string,
  roleTypes: string[] = [
    'integration',
    'corporate development',
    'M&A',
    'CFO',
    'general counsel',
    'strategic partnerships',
    'IPO',
    'investor relations',
  ],
): Promise<unknown> {
  const slug = companyName.toLowerCase().replace(/[\s.]/g, '')
  const keywords = roleTypes.map(r => r.toLowerCase())

  function isStrategicRole(title: string): boolean {
    const t = title.toLowerCase()
    return keywords.some(k => t.includes(k))
  }

  // 1. Greenhouse
  try {
    const raw = await get(`https://api.greenhouse.io/v1/boards/${slug}/jobs?content=false`)
    const data = JSON.parse(raw) as { jobs: GreenhouseJob[] }
    if (data.jobs?.length > 0) {
      const all = data.jobs.map(j => ({
        title: j.title,
        dept: j.departments?.[0]?.name ?? 'Uncategorized',
        updated: j.updated_at,
      }))
      const strategic = all.filter(j => isStrategicRole(j.title))
      return {
        source: 'greenhouse',
        company: companyName,
        total_open_roles: data.jobs.length,
        strategic_roles: strategic,
        all_roles_sample: all.slice(0, 25),
      }
    }
  } catch {}

  // 2. Lever
  try {
    const raw = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)
    const data = JSON.parse(raw) as LeverPosting[]
    if (Array.isArray(data) && data.length > 0) {
      const all = data.map(j => ({
        title: j.text,
        team: j.categories?.team ?? j.categories?.department ?? 'Uncategorized',
      }))
      const strategic = all.filter(j => isStrategicRole(j.title))
      return {
        source: 'lever',
        company: companyName,
        total_open_roles: data.length,
        strategic_roles: strategic,
        all_roles_sample: all.slice(0, 25),
      }
    }
  } catch {}

  // 3. JSearch via RapidAPI
  const apiKey = process.env.RAPIDAPI_KEY
  if (apiKey) {
    try {
      const query = `${companyName} ${roleTypes.slice(0, 3).join(' OR ')}`
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1&date_posted=month`
      const raw = await get(url, {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      })
      const data = JSON.parse(raw) as {
        data?: Array<{
          job_title: string
          employer_name: string
          job_posted_at_datetime_utc?: string
        }>
      }
      if (data.data && data.data.length > 0) {
        return {
          source: 'jsearch_rapidapi',
          company: companyName,
          roles: data.data
            .slice(0, 15)
            .map(j => ({ title: j.job_title, company: j.employer_name, posted: j.job_posted_at_datetime_utc })),
        }
      }
    } catch {}
  }

  // 4. Google News fallback
  try {
    const hireTerms = roleTypes.slice(0, 2).join(' OR ')
    const q = encodeURIComponent(`"${companyName}" hiring (${hireTerms})`)
    const rss = await get(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`)
    const items = parseRssItems(rss, 5)
    if (items.length > 0) {
      return {
        source: 'google_news_fallback',
        company: companyName,
        role_types_searched: roleTypes,
        news_items: items,
        note: 'Greenhouse/Lever not found. These articles may mention strategic hires.',
      }
    }
  } catch {}

  return {
    company: companyName,
    note: `No job data found. Greenhouse slug "${slug}" not found. RAPIDAPI_KEY set: ${!!apiKey}`,
    manual_check: `https://api.greenhouse.io/v1/boards/${slug}/jobs`,
  }
}

// ---------------------------------------------------------------------------
// Talent journal
// ---------------------------------------------------------------------------

class TalentJournal {
  private snapshots: TalentSnapshot[] = []
  constructor(private filePath = 'talent_intel.json') {}

  async load() {
    try { this.snapshots = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.snapshots = [] }
  }

  async save() {
    await writeFile(this.filePath, JSON.stringify(this.snapshots, null, 2))
  }

  addSnapshot(s: TalentSnapshot) { this.snapshots.push(s) }

  deltaContext(company: string): string {
    const cutoff = Date.now() - 12 * 7 * 24 * 60 * 60 * 1000
    const history = this.snapshots.filter(
      s => s.company === company && new Date(s.date).getTime() > cutoff,
    )
    if (history.length === 0) return 'No historical snapshots — first run for this company.'
    const prev = history[history.length - 1]!
    if (!prev.signals?.length) return `Last scanned: ${prev.date}. No signals detected previously.`
    return `Last scanned: ${prev.date}. Prior signals:\n${prev.signals.map(s => `- ${s.signalType} (strength ${s.strength}): ${s.interpretation}`).join('\n')}\n\nFocus on NEW developments since this date.`
  }
}

// ---------------------------------------------------------------------------
// System prompt — the signal taxonomy is the moat
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a strategic intelligence analyst specializing in talent flow as a leading indicator.
You built the talent intelligence product at a top-tier executive search firm that tracked 50,000 moves/month.
You know that people are the most honest signal of where organizations are actually going — not their press releases.

## Signal Taxonomy (apply exactly)

### Stealth Build Signal
TRIGGER: 3+ engineers with specific niche expertise (e.g., "GPU compiler", "ZK proofs", "satellite comms")
         leave different companies within 30 days to join an unlisted or new entity
STRENGTH MULTIPLIER: 1.5× if they all previously worked together (prior team reunion)
IMPLICATION: A well-funded stealth company is building something specific; the expertise domain = the product
ACTION: Research the destination entity; if PE-backed, alert BD/M&A team

### Product Pivot Signal
TRIGGER: A company hires 3+ executives with NO background in their stated product
         (e.g., IoT company suddenly hiring ex-Fintech VPs)
STRENGTH MULTIPLIER: 1.3× if CEO just changed or returned from "leave"
IMPLICATION: Strategic pivot or new product line; current roadmap will be delayed/killed
ACTION: Alert customers who depend on current product; competitive opportunity in their neglected market

### Org Collapse Signal
TRIGGER: 3+ VP/Director-level departures from one company within 60 days
         AND no public explanation (layoffs would be announced)
STRENGTH MULTIPLIER: 2× if departures span multiple functions (not just one team)
IMPLICATION: CEO/board conflict, failed acquisition, or quiet restructuring
ACTION: Short signal (public company); check debt covenants; avoid for new vendor relationships

### Acquisition Prep Signal
TRIGGER: Company hires VP Integration, Head of Corp Dev, or former M&A banker as executive
STRENGTH MULTIPLIER: 1.4× if they have cash or just raised
IMPLICATION: Active acquisition hunt; identify likely targets in their sector
ACTION: Run M&A signal detector on 5 adjacent companies in their sector immediately

### IPO Prep Signal
TRIGGER: Hire of CFO with prior public-company experience + Big 4 audit firm switch + GC from Latham/WilmerHale
STRENGTH MULTIPLIER: 1.2× if CEO is from public company background
IMPLICATION: IPO filing within 12–18 months
ACTION: Get on their cap table now if possible; prep for competitor disruption at IPO

### Acqui-Hire Target Signal
TRIGGER: Entire founding team (3+ people) departs the same company within 45 days
         AND all land at the SAME new employer
IMPLICATION: Soft acquisition; expect formal announcement within 90 days
ACTION: Alert M&A team; secondary market buy of departing company equity if available

### Competitor Drain Signal
TRIGGER: Your direct competitor loses 20%+ of named key people in 90 days
IMPLICATION: Competitor is weakening; their customers are becoming available
ACTION: Activate outbound to their top accounts immediately; upgrade competitive messaging

## Noise Reduction Rules
IGNORE unless in signal taxonomy:
- Single departure (natural attrition)
- Departures to obvious competitors (normal competition for talent)
- Arrivals with exact same background as current role (backfill, not pivot)
- LinkedIn changes with no verifiable external confirmation

## Output Format
SIGNAL: **<type>**
COMPANY: <name>
STRENGTH: <0.0-1.0>
EVIDENCE: <bulleted list of specific moves with dates>
INTERPRETATION: <1–2 sentences on what this means strategically>
ACTION: <specific, time-bound recommendation>

Always separate "interesting patterns to monitor" from "act now" signals.
Never report a signal without at least 2 independent data points confirming it.`

// ---------------------------------------------------------------------------
// Main monitor
// ---------------------------------------------------------------------------

async function runTalentMonitor(watchlist: string[], yourCompany: string) {
  const client = new Anthropic()
  const journal = new TalentJournal()
  await journal.load()
  await ensureCache()

  const tools: Anthropic.Tool[] = [
    {
      name: 'scan_linkedin_moves',
      description:
        'Search Google News RSS for recent executive departures and arrivals at a company (VP/Director/C-suite level). Also queries RapidAPI JSearch if RAPIDAPI_KEY is set. Returns news items about leadership moves.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string', description: 'Company to monitor for executive moves' },
          days_back: { type: 'number', description: 'How many days back to search (default 90)' },
        },
        required: ['company_name'],
      },
    },
    {
      name: 'check_sec_8k_leadership',
      description:
        'Query SEC EDGAR full-text search for 8-K Item 5.02 filings (director/officer departure or appointment). Works for public companies. Returns filing dates, entity names, and accession numbers.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string' },
          ticker: { type: 'string', description: 'Stock ticker if company is public (e.g. "GOOG")' },
        },
        required: ['company_name'],
      },
    },
    {
      name: 'identify_destination_entity',
      description:
        'Look up an unknown company on Crunchbase, TechCrunch, and Google News to identify entity type, funding status, investors, and product domain. Use when a destination employer is unfamiliar.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string', description: 'Name of the destination company to investigate' },
        },
        required: ['company_name'],
      },
    },
    {
      name: 'check_hiring_for_roles',
      description:
        'Check if a company is hiring for strategic roles via Greenhouse API, Lever API, JSearch (RapidAPI), or Google News. Returns matching role titles that signal specific strategic initiatives.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string' },
          role_types: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Keywords for strategic roles, e.g. ["integration", "M&A", "corporate development", "CFO", "general counsel", "IPO", "investor relations"]',
          },
        },
        required: ['company_name'],
      },
    },
  ]

  for (const company of watchlist) {
    const deltaCtx = journal.deltaContext(company)

    const userPrompt = `Monitor talent movements at "${company}" for strategic signals.
I work at ${yourCompany} — flag signals relevant to us (competitive threats, partnership opportunities, acquisition targets).

${deltaCtx}

Use ALL available tools in this order:
1. scan_linkedin_moves with days_back=30 AND again with days_back=90 for broader window
2. check_sec_8k_leadership (always run even if private — confirms null result)
3. For any unfamiliar destination employers surfaced in moves, run identify_destination_entity
4. check_hiring_for_roles with role_types matched to signal taxonomy:
   ["integration", "corporate development", "M&A", "CFO", "general counsel", "IPO",
    "investor relations", "strategic partnerships", "stealth"]

Apply the Signal Taxonomy rigorously. Only surface signals with strength ≥ 0.4.
If data is sparse, say so — do not fabricate moves or patterns.`

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

    console.log(`\nScanning talent signals for ${company}…`)

    const call1 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    })

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
    const rawResults: Record<string, unknown> = {}

    for (const block of call1.content) {
      if (block.type !== 'tool_use') continue
      const input = block.input as Record<string, string | string[] | number>

      console.log(`  → ${block.name}(${JSON.stringify(input)})`)

      let result: unknown
      try {
        switch (block.name) {
          case 'scan_linkedin_moves':
            result = await toolScanLinkedinMoves(
              input.company_name as string,
              input.days_back ? Number(input.days_back) : 90,
            )
            break
          case 'check_sec_8k_leadership':
            result = await toolCheckSec8kLeadership(
              input.company_name as string,
              input.ticker as string | undefined,
            )
            break
          case 'identify_destination_entity':
            result = await toolIdentifyDestinationEntity(input.company_name as string)
            break
          case 'check_hiring_for_roles':
            result = await toolCheckHiringForRoles(
              input.company_name as string,
              input.role_types as string[] | undefined,
            )
            break
          default:
            result = { error: `Unknown tool: ${block.name}` }
        }
      } catch (err) {
        result = { error: String(err) }
      }

      rawResults[block.name] = result
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      })
    }

    console.log(`  Analyzing signals…`)

    const call2 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools,
      tool_choice: { type: 'none' },
      messages: [
        ...messages,
        { role: 'assistant', content: call1.content },
        { role: 'user', content: toolResultBlocks },
      ],
    })

    const report = call2.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

    console.log(`\n===== TALENT INTELLIGENCE: ${company.toUpperCase()} =====\n`)
    console.log(report)

    journal.addSnapshot({
      date: new Date().toISOString(),
      company,
      signals: [],
      rawResults,
    })
  }

  await journal.save()
  console.log('\nSnapshots saved to talent_intel.json')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  await runTalentMonitor(
    ['Anthropic', 'Scale AI', 'Cohere', 'Mistral AI'],
    'My AI Infrastructure Company',
  )
}

main().catch(console.error)
