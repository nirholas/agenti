/**
 * VC Deal Flow Qualifier
 *
 * Real data sources:
 *   Founders   — Crunchbase person pages + Wellfound + LinkedIn (public profiles)
 *   Market     — Statista, CBInsights free reports, TechCrunch sector search
 *   Competitors— TechCrunch funding news + Crunchbase sector hubs
 *   Traction   — Company website, LinkedIn headcount, ProductHunt, Greenhouse/Lever
 *   Conflicts  — portfolio.json (local file you maintain)
 *   Pitch deck — Claude Files API (PDF → text) or pass pitchDeckText directly
 *
 * Two-call architecture:
 *   Call 1 — Claude gathers all signals via tool use (real HTTP fetches)
 *   Call 2 — Claude applies investment rubric, outputs scored partner-meeting memo
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealSubmission {
  companyName: string
  stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b'
  sector: string
  askAmountM: number
  /** Pre-extracted pitch deck text, or use extractPitchDeck() for PDFs */
  pitchDeckText: string
  founderNames: string[]
  founderLinkedins?: string[]
  websiteUrl?: string
  revenueArr?: number
  revenueGrowthPct?: number
}

interface DealScore {
  companyName: string
  totalScore: number
  recommendation: 'pass' | 'explore' | 'fast-track'
  memoSummary: string
  passReason?: string
}

interface PortfolioRecord {
  date: string
  deal: DealScore
  outcome?: { invested: boolean; followOnRound?: string; exitMultiple?: number }
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
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' },
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
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function trunc(text: string, max = 3000): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text
}

// ---------------------------------------------------------------------------
// PDF pitch deck extraction via Claude Files API
// ---------------------------------------------------------------------------

export async function extractPitchDeck(pdfPath: string): Promise<string> {
  const client = new Anthropic()
  const bytes = await readFile(pdfPath)

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
        } as Anthropic.Base64PDFSource & { type: 'document' },
        { type: 'text', text: 'Extract all text from this pitch deck. Preserve slide structure (titles + bullets). Raw text only, no commentary.' },
      ],
    }],
  })

  return res.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Tool: enrich_founder
// Crunchbase person → Wellfound → LinkedIn public profile
// ---------------------------------------------------------------------------

async function toolEnrichFounder(name: string, linkedinUrl?: string): Promise<unknown> {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  const results: Record<string, unknown> = { name }

  // Crunchbase person page
  try {
    const html = await get(`https://www.crunchbase.com/person/${slug}`)
    const text = stripHtml(html)
    if (text.length > 600 && !text.toLowerCase().includes('page not found')) {
      results.crunchbase = { url: `https://www.crunchbase.com/person/${slug}`, data: trunc(text, 2000) }
    }
  } catch {}

  // Wellfound (AngelList)
  try {
    const html = await get(`https://wellfound.com/u/${slug}`)
    const text = stripHtml(html)
    if (text.length > 600 && !text.toLowerCase().includes('not found')) {
      results.wellfound = trunc(text, 1500)
    }
  } catch {}

  // LinkedIn — public profile if URL provided (often redirects to login)
  if (linkedinUrl) {
    try {
      const html = await get(linkedinUrl)
      const text = stripHtml(html)
      if (text.length > 600 && !text.toLowerCase().includes('sign in to view')) {
        results.linkedin = trunc(text, 1500)
      } else {
        results.linkedin = { status: 'requires_auth', url: linkedinUrl, note: 'LinkedIn requires login to view profiles — check manually.' }
      }
    } catch {}
  }

  if (!results.crunchbase && !results.wellfound) {
    results.status = 'no_public_profile_found'
    results.manual_checks = [
      `https://www.crunchbase.com/person/${slug}`,
      `https://wellfound.com/u/${slug}`,
      linkedinUrl ?? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`,
    ]
  }

  results.instruction = 'Extract: prior companies and roles, any exits (with amounts), years of domain experience, education, any notable investor endorsements or press coverage.'
  return results
}

// ---------------------------------------------------------------------------
// Tool: analyze_market
// Statista free overviews + CBInsights reports + TechCrunch sector coverage
// ---------------------------------------------------------------------------

async function toolAnalyzeMarket(market: string, sector: string): Promise<unknown> {
  const results: Record<string, unknown> = { market, sector }
  const encoded = encodeURIComponent(market)

  // Statista market overview search
  try {
    const html = await get(`https://www.statista.com/search/?q=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) results.statista = trunc(text, 2000)
  } catch {}

  // CBInsights free research pages
  const cbSlug = sector.toLowerCase().replace(/[\s/]+/g, '-')
  try {
    const html = await get(`https://www.cbinsights.com/research/${cbSlug}/`)
    const text = stripHtml(html)
    if (text.length > 500) results.cbinsights = trunc(text, 2000)
  } catch {}

  // TechCrunch for recent market coverage
  try {
    const html = await get(`https://techcrunch.com/search/?q=${encoded}+market+size`)
    const text = stripHtml(html)
    if (text.length > 500) results.techcrunch = trunc(text, 1500)
  } catch {}

  if (!results.statista && !results.cbinsights && !results.techcrunch) {
    results.status = 'no_free_data_found'
    results.note = 'Statista/CBInsights returned no accessible data. Gartner or IDC subscription recommended for TAM validation.'
  }

  results.instruction = 'Estimate: TAM ($B), YoY growth rate (%), key growth drivers, regulatory tailwinds/headwinds, maturity stage (early/growth/mature).'
  return results
}

// ---------------------------------------------------------------------------
// Tool: check_competitor_funding
// TechCrunch funding news + Crunchbase sector hubs
// ---------------------------------------------------------------------------

async function toolCheckCompetitorFunding(sector: string, companyName?: string): Promise<unknown> {
  const results: Record<string, unknown> = { sector }
  const encoded = encodeURIComponent(`${sector} startup funding raised 2024 2025`)

  try {
    const html = await get(`https://techcrunch.com/search/?q=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) results.techcrunch_funding_news = trunc(text, 2500)
  } catch {}

  const sectorSlug = sector.toLowerCase().replace(/[\s/]+/g, '-')
  try {
    const html = await get(`https://www.crunchbase.com/hub/${sectorSlug}-startups`)
    const text = stripHtml(html)
    if (text.length > 500) results.crunchbase_sector = trunc(text, 2000)
  } catch {}

  if (companyName) {
    const cbSlug = companyName.toLowerCase().replace(/\s+/g, '-')
    try {
      const html = await get(`https://www.crunchbase.com/organization/${cbSlug}`)
      const text = stripHtml(html)
      if (text.length > 500 && !text.toLowerCase().includes('page not found')) {
        results.company_crunchbase = trunc(text, 1500)
      }
    } catch {}
  }

  results.instruction = 'Identify: main competitors, total funding raised by each, lead investors, last round stage, and whether any have raised > $50M (potential dominant player).'
  return results
}

// ---------------------------------------------------------------------------
// Tool: validate_traction_claims
// Website social proof + LinkedIn headcount + ProductHunt + job posting count
// ---------------------------------------------------------------------------

async function toolValidateTractionClaims(companyName: string, website?: string): Promise<unknown> {
  const results: Record<string, unknown> = { company: companyName }
  const slug = companyName.toLowerCase().replace(/[\s.]/g, '-')

  if (website) {
    try {
      const html = await get(website)
      const text = stripHtml(html)
      if (text.length > 500) results.website = { url: website, data: trunc(text, 2000) }
    } catch {}
  }

  // LinkedIn company — employee count is sometimes in page source
  try {
    const html = await get(`https://www.linkedin.com/company/${slug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.toLowerCase().includes('join to see')) {
      results.linkedin = trunc(text, 1200)
    } else {
      results.linkedin = { url: `https://www.linkedin.com/company/${slug}`, status: 'requires_auth' }
    }
  } catch {}

  // ProductHunt
  try {
    const html = await get(`https://www.producthunt.com/search?q=${encodeURIComponent(companyName)}`)
    const text = stripHtml(html)
    if (text.length > 500) results.producthunt = trunc(text, 1500)
  } catch {}

  // Job postings as growth proxy (Greenhouse)
  try {
    const raw = await get(`https://api.greenhouse.io/v1/boards/${slug.replace(/-/g, '')}/jobs`)
    const data = JSON.parse(raw) as { jobs: unknown[] }
    if (data.jobs?.length > 0) {
      results.job_postings = { count: data.jobs.length, source: 'greenhouse' }
    }
  } catch {}

  // Lever fallback
  if (!results.job_postings) {
    try {
      const raw = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)
      const data = JSON.parse(raw) as unknown[]
      if (Array.isArray(data) && data.length > 0) {
        results.job_postings = { count: data.length, source: 'lever' }
      }
    } catch {}
  }

  results.instruction = 'Cross-reference traction claims: do customer testimonials or logos appear on the website? Is employee count on LinkedIn consistent with ARR stage? Do job postings reflect claimed growth? Any press coverage or ProductHunt traction? Flag inconsistencies.'
  return results
}

// ---------------------------------------------------------------------------
// Tool: check_portfolio_conflict
// Loads portfolio.json — create this file to enable conflict detection
// ---------------------------------------------------------------------------

interface PortfolioCompany {
  name: string
  sector: string
  description: string
}

async function toolCheckPortfolioConflict(sector: string, description: string): Promise<unknown> {
  let portfolio: PortfolioCompany[] = []

  try {
    portfolio = JSON.parse(await readFile('portfolio.json', 'utf-8')) as PortfolioCompany[]
  } catch {
    return {
      conflict: false,
      note: 'No portfolio.json found. Create it as [{name, sector, description}] to enable conflict detection.',
      example_format: [{ name: 'ExampleCo', sector: 'AI compliance', description: 'Automated audit trail generation for ML models' }],
    }
  }

  const lowerSector = sector.toLowerCase()
  const potentialConflicts = portfolio.filter(p =>
    p.sector.toLowerCase().includes(lowerSector) ||
    lowerSector.includes(p.sector.toLowerCase()),
  )

  return {
    conflict: potentialConflicts.length > 0,
    potential_conflicts: potentialConflicts,
    all_sectors_in_portfolio: [...new Set(portfolio.map(p => p.sector))],
    instruction: 'Determine if any portfolio company directly competes with the incoming deal based on sector and description. Indirect adjacency is not a conflict.',
  }
}

// ---------------------------------------------------------------------------
// Deal journal
// ---------------------------------------------------------------------------

class DealJournal {
  private records: PortfolioRecord[] = []
  constructor(private filePath = 'deal_journal.json') {}

  async load() {
    try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.records = [] }
  }

  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }

  add(r: PortfolioRecord) { this.records.push(r) }

  recentContext(n = 4): string {
    if (this.records.length === 0) return 'No prior deals evaluated yet.'
    const recent = this.records.slice(-n)
    return recent.map(r =>
      `${r.deal.companyName} → ${r.deal.recommendation.toUpperCase()} (score: ${r.deal.totalScore})${r.deal.passReason ? `: ${r.deal.passReason}` : ''}`
    ).join('\n')
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a Partner at a Tier 1 venture fund that has returned 8x DPI over 3 funds.
You evaluate 2,000 companies per year and invest in 12. You have seen every pattern — the real ones and the mimics.
Your job is to apply a rigorous, opinionated rubric and output a memo that would hold up in a Monday partner meeting.

## Investment Rubric (apply exactly — these weights are non-negotiable)

### Founder Quality (35 pts)
- Prior successful exit (> $50M): +12
- Prior failed startup that raised > $2M: +7 (coachable failure > no failure)
- Domain expert (10+ years in this specific problem): +8
- Repeat founder with same co-founding team: +6
- Cold outbound to the problem before the startup (obsessed, not opportunistic): +5
- Academic pedigree alone, no operational experience: -5 RED FLAG

### Market (25 pts)
- Genuine "why now" — technology or regulatory unlock in last 24 months: +10
- TAM > $10B AND evidence they can carve out $100M ARR niche: +8
- Market growing > 20% YoY from independent source: +7
- Founder created the category (no competitors yet): flag separately — could be visionary or delusional

### Traction (20 pts)
- Seed: > $500K ARR growing > 15% MoM: +20
- Seed: > $100K ARR with 3 design partners paying: +12
- Pre-seed: LOIs or paid pilots from name brands: +10
- No revenue but 10K+ MAU with measurable retention: +6
- "Just launched" with no data: +0

### Business Model (10 pts)
- Net revenue retention > 110%: +10
- Gross margin > 65%: +7
- Usage-based with expansion motion: +8
- Services-heavy < 50% gross margin: -5 RED FLAG for SaaS multiple

### Competitive Moat (10 pts)
- Proprietary data network effect: +10
- Switching cost embedded in customer workflow: +8
- Regulatory moat (licensed, patented): +7
- "Better/faster/cheaper" only: +2 (commoditizable)

## Automatic Pass Conditions (override rubric)
Any ONE of these = PASS immediately:
- Competing directly with a portfolio company
- Founder has < 50% equity post-seed (misaligned cap table)
- Revenue is primarily one customer > 60% of ARR
- 3+ well-funded incumbents with > $50M raised
- No defensible differentiation articulable in 2 sentences

## Memo Output Format
RECOMMENDATION: **<PASS|EXPLORE|FAST-TRACK>**
TOTAL_SCORE: <0-100>
CONVICTION: <LOW|MEDIUM|HIGH>

SCORE BREAKDOWN:
- Founder Quality: <pts>/35
- Market: <pts>/25
- Traction: <pts>/20
- Business Model: <pts>/10
- Moat: <pts>/10

RED FLAGS: [bulleted list]
GREEN FLAGS: [bulleted list]

MEMO:
<3–5 paragraph investment memo in the style of a partner writing to the IC>

FOLLOW-UP QUESTIONS:
<5 questions — specific, not generic>

PASS REASON (if applicable):
<direct, honest 1–2 sentences — founders deserve honesty>

Never soften a pass with false hope. Never fast-track without specific evidence.`

// ---------------------------------------------------------------------------
// Main qualifier
// ---------------------------------------------------------------------------

async function qualifyDeal(submission: DealSubmission, fundThesis: string): Promise<DealScore> {
  const client = new Anthropic()
  const journal = new DealJournal()
  await journal.load()

  const tools: Anthropic.Tool[] = [
    {
      name: 'check_portfolio_conflict',
      description: 'Check if this company competes with any existing portfolio company. Call this FIRST — a conflict = immediate PASS.',
      input_schema: {
        type: 'object' as const,
        properties: {
          sector: { type: 'string' },
          description: { type: 'string', description: 'One-sentence description of what the company does' },
        },
        required: ['sector', 'description'],
      },
    },
    {
      name: 'enrich_founder',
      description: 'Fetch founder background from Crunchbase, Wellfound, and LinkedIn. Returns prior companies, exits, education.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          linkedin_url: { type: 'string', description: 'Full LinkedIn profile URL if available' },
        },
        required: ['name'],
      },
    },
    {
      name: 'analyze_market',
      description: 'Fetch market size, growth rate, and competitive landscape from Statista, CBInsights, and TechCrunch.',
      input_schema: {
        type: 'object' as const,
        properties: {
          market: { type: 'string', description: 'Specific market name, e.g. "AI compliance software"' },
          sector: { type: 'string', description: 'Broader sector, e.g. "AI governance"' },
        },
        required: ['market', 'sector'],
      },
    },
    {
      name: 'check_competitor_funding',
      description: 'Check funding history of competitors in the space from TechCrunch and Crunchbase.',
      input_schema: {
        type: 'object' as const,
        properties: {
          sector: { type: 'string' },
          company_name: { type: 'string', description: 'The company being evaluated, to check their own Crunchbase profile' },
        },
        required: ['sector'],
      },
    },
    {
      name: 'validate_traction_claims',
      description: 'Cross-reference traction claims against public signals: website, LinkedIn headcount, ProductHunt, job postings.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string' },
          website: { type: 'string', description: 'Company website URL' },
        },
        required: ['company_name'],
      },
    },
  ]

  const foundersList = submission.founderNames
    .map((name, i) => `${name}${submission.founderLinkedins?.[i] ? ` (${submission.founderLinkedins[i]})` : ''}`)
    .join(', ')

  const userPrompt = `Evaluate this inbound deal and output a partner-meeting memo.

Fund thesis: ${fundThesis}
Recent deal context:\n${journal.recentContext()}

---
Company: ${submission.companyName}
Stage: ${submission.stage} | Sector: ${submission.sector}
Raising: $${submission.askAmountM}M
ARR: ${submission.revenueArr ? `$${(submission.revenueArr / 1_000).toFixed(0)}K` : 'not disclosed'}
MoM Growth: ${submission.revenueGrowthPct ? `${submission.revenueGrowthPct}%` : 'not disclosed'}
Website: ${submission.websiteUrl ?? 'not provided'}
Founders: ${foundersList}

PITCH DECK:
${submission.pitchDeckText}
---

Protocol:
1. Call check_portfolio_conflict FIRST. If conflict = true, output PASS immediately.
2. Enrich each founder individually via enrich_founder.
3. Analyze the market and check competitor funding.
4. Validate traction claims against public signals.
5. Apply the rubric and output the full memo.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  console.log(`\nEnriching deal: ${submission.companyName}…`)

  const call1 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  })

  const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []

  for (const block of call1.content) {
    if (block.type !== 'tool_use') continue
    const input = block.input as Record<string, string>
    console.log(`  → ${block.name}(${JSON.stringify(input)})`)

    let result: unknown
    try {
      switch (block.name) {
        case 'check_portfolio_conflict':
          result = await toolCheckPortfolioConflict(input.sector!, input.description!)
          break
        case 'enrich_founder':
          result = await toolEnrichFounder(input.name!, input.linkedin_url)
          break
        case 'analyze_market':
          result = await toolAnalyzeMarket(input.market!, input.sector!)
          break
        case 'check_competitor_funding':
          result = await toolCheckCompetitorFunding(input.sector!, input.company_name)
          break
        case 'validate_traction_claims':
          result = await toolValidateTractionClaims(input.company_name!, input.website)
          break
        default:
          result = { error: `Unknown tool: ${block.name}` }
      }
    } catch (err) {
      result = { error: String(err) }
    }

    toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
  }

  console.log('  Scoring…\n')

  const call2 = await client.messages.create({
    model: 'claude-opus-4-7-20251101',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    tool_choice: { type: 'none' },
    messages: [
      ...messages,
      { role: 'assistant', content: call1.content },
      { role: 'user', content: toolResultBlocks },
    ],
  })

  const memo = call2.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('\n')

  console.log('===== DEAL MEMO =====\n')
  console.log(memo)

  const recMatch = memo.match(/RECOMMENDATION:\s*\*\*(PASS|EXPLORE|FAST-TRACK)\*\*/)
  const scoreMatch = memo.match(/TOTAL_SCORE:\s*(\d+)/)
  const passMatch = memo.match(/PASS REASON.*?:\n(.*?)(?:\n\n|\n[A-Z]|$)/s)

  const score: DealScore = {
    companyName: submission.companyName,
    totalScore: parseInt(scoreMatch?.[1] ?? '0'),
    recommendation: (recMatch?.[1]?.toLowerCase().replace('-', '-') ?? 'pass') as DealScore['recommendation'],
    memoSummary: memo,
    passReason: passMatch?.[1]?.trim(),
  }

  journal.add({ date: new Date().toISOString(), deal: score })
  await journal.save()

  return score
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  // To use a real PDF pitch deck:
  //   const pitchDeckText = await extractPitchDeck('./pitch.pdf')
  //
  // To run conflict detection, create portfolio.json:
  //   [{ "name": "CompanyX", "sector": "AI compliance", "description": "..." }]

  const submission: DealSubmission = {
    companyName: 'Lumen AI',
    stage: 'seed',
    sector: 'AI compliance / governance',
    askAmountM: 4,
    revenueArr: 400_000,
    revenueGrowthPct: 22,
    websiteUrl: 'https://www.lumenai.com',
    founderNames: ['Jane Doe', 'John Smith'],
    founderLinkedins: ['https://www.linkedin.com/in/jane-doe', 'https://www.linkedin.com/in/john-smith'],
    pitchDeckText: `
      Problem: Enterprise AI teams spend 40% of time on compliance documentation and audit prep.
      EU AI Act goes live 2026 — most companies are unprepared.

      Solution: Lumen AI auto-generates audit-ready compliance documentation from model cards,
      training data lineage, and deployment configs.

      Traction: $400K ARR, 8 customers, 22% MoM growth. 2 F500 customers.

      Team: Jane Doe (ex-Segment PM, 8 years AI/ML), John Smith (ex-Google AI safety, PhD Stanford).

      Ask: $4M seed at $20M pre-money. Use of funds: 3 engineers + 2 enterprise sales reps.
    `,
  }

  await qualifyDeal(
    submission,
    'B2B SaaS infrastructure for AI teams; seed stage; technical founders; $500K–$2M ARR sweet spot',
  )
}

main().catch(console.error)
