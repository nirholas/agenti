/**
 * Competitor Strategy Decoder
 *
 * Real data sources:
 *   Jobs      — Greenhouse API → Lever API → /careers page HTML
 *   Pricing   — fetch + local diff against .intel_cache/ snapshot
 *   Changelog — RSS/Atom feeds → common changelog URLs
 *   Reviews   — G2/Capterra best-effort scrape (no API key needed; may rate-limit)
 *   Funding   — Crunchbase public org page
 *
 * Two-call architecture:
 *   Call 1 — Claude gathers all signals via tool use (real HTTP fetches)
 *   Call 2 — Claude applies Initiative Inference Framework, outputs threats + counter-moves
 *
 * Delta tracking: IntelJournal persists snapshots and surfaces what changed since last run.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompetitorProfile {
  name: string
  domain: string
  primaryProduct: string
  knownStrategicPriorities: string[]
}

interface IntelSnapshot {
  competitor: string
  date: string
  jobTotal: number
  topDepts: Array<{ dept: string; count: number }>
  changelogEntries: string[]
  pricingHash: string
  reviewSummary: string
  fundingSummary: string
}

// ---------------------------------------------------------------------------
// HTTP / HTML utilities
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const CACHE_DIR = '.intel_cache'

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

function trunc(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated at ${max} chars]` : text
}

async function ensureCache() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// Tool: scrape_job_postings
// Greenhouse API → Lever API → /careers HTML fallback
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

async function toolScrapeJobPostings(
  companyName: string,
  domain?: string,
): Promise<unknown> {
  const slug = companyName.toLowerCase().replace(/\s+/g, '')

  // Greenhouse
  try {
    const raw = await get(`https://api.greenhouse.io/v1/boards/${slug}/jobs?content=false`)
    const data = JSON.parse(raw) as { jobs: GreenhouseJob[] }
    if (data.jobs?.length > 0) {
      const byDept: Record<string, string[]> = {}
      for (const job of data.jobs) {
        const dept = job.departments?.[0]?.name ?? 'Uncategorized'
        if (!byDept[dept]) byDept[dept] = []
        byDept[dept]!.push(job.title)
      }
      return {
        source: 'greenhouse',
        company: companyName,
        total: data.jobs.length,
        by_department: Object.entries(byDept)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([dept, roles]) => ({ dept, count: roles.length, sample_roles: roles.slice(0, 6) })),
      }
    }
  } catch {}

  // Lever
  try {
    const raw = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)
    const data = JSON.parse(raw) as LeverPosting[]
    if (Array.isArray(data) && data.length > 0) {
      const byTeam: Record<string, string[]> = {}
      for (const job of data) {
        const team = job.categories?.team ?? job.categories?.department ?? 'Uncategorized'
        if (!byTeam[team]) byTeam[team] = []
        byTeam[team]!.push(job.text)
      }
      return {
        source: 'lever',
        company: companyName,
        total: data.length,
        by_department: Object.entries(byTeam)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([dept, roles]) => ({ dept, count: roles.length, sample_roles: roles.slice(0, 6) })),
      }
    }
  } catch {}

  // Careers page fallback
  if (domain) {
    for (const path of ['/careers', '/jobs', '/about/careers']) {
      try {
        const html = await get(`https://${domain}${path}`)
        const text = stripHtml(html)
        if (text.length > 800) {
          return {
            source: 'careers_page',
            url: `https://${domain}${path}`,
            company: companyName,
            raw_text: trunc(text, 3500),
            note: 'Greenhouse/Lever not found; extract job counts and roles from this text.',
          }
        }
      } catch {}
    }
  }

  return { error: `Could not fetch jobs for ${companyName} from Greenhouse, Lever, or careers page.` }
}

// ---------------------------------------------------------------------------
// Tool: diff_pricing_page
// Fetches current pricing page and diffs against last cached version
// ---------------------------------------------------------------------------

async function toolDiffPricingPage(domain: string): Promise<unknown> {
  await ensureCache()
  const key = domain.replace(/[^a-z0-9]/gi, '_')
  const cachePath = `${CACHE_DIR}/pricing_${key}.txt`

  let previous = ''
  try { previous = await readFile(cachePath, 'utf-8') } catch {}

  let current = ''
  for (const path of ['/pricing', '/plans', '/pricing-plans']) {
    try {
      const html = await get(`https://${domain}${path}`)
      const text = stripHtml(html)
      if (text.length > 500) { current = text; break }
    } catch {}
  }

  if (!current) return { error: `Could not fetch pricing page for ${domain}` }

  await writeFile(cachePath, current)

  if (!previous) {
    return {
      domain,
      status: 'first_run',
      current: trunc(current, 4000),
      note: 'No cached version yet — current page saved. Describe what pricing tiers and features you see.',
    }
  }

  return {
    domain,
    previous: trunc(previous, 2500),
    current: trunc(current, 2500),
    instruction:
      'Compare previous vs current. Identify: price changes, features moved between tiers, new/removed tiers, usage limits added, free tier changes.',
  }
}

// ---------------------------------------------------------------------------
// Tool: fetch_changelog
// Tries RSS/Atom feeds first (structured), then common changelog HTML paths
// ---------------------------------------------------------------------------

function parseRssEntries(xml: string, limit = 20): string[] {
  const entries: string[] = []
  const patterns = [
    /<item>([\s\S]*?)<\/item>/g,
    /<entry>([\s\S]*?)<\/entry>/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(xml)) !== null && entries.length < limit) {
      const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(match[1]!)
      const dateMatch =
        /<pubDate>(.*?)<\/pubDate>/.exec(match[1]!) ??
        /<published>(.*?)<\/published>/.exec(match[1]!) ??
        /<updated>(.*?)<\/updated>/.exec(match[1]!)
      if (titleMatch?.[1]?.trim()) {
        const title = titleMatch[1].trim()
        entries.push(dateMatch ? `[${dateMatch[1]!.trim()}] ${title}` : title)
      }
    }
    if (entries.length > 0) break
  }
  return entries
}

async function toolFetchChangelog(domain: string): Promise<unknown> {
  const rssPaths = [
    '/changelog.rss', '/changelog/feed', '/releases.rss',
    '/rss.xml', '/feed.xml', '/atom.xml', '/blog.rss', '/blog/feed',
  ]
  const htmlPaths = [
    '/changelog', '/releases', '/whats-new', '/updates',
    '/release-notes', '/blog/changelog', '/product-updates',
  ]

  for (const path of rssPaths) {
    try {
      const xml = await get(`https://${domain}${path}`)
      if (xml.includes('<rss') || xml.includes('<feed') || xml.includes('<channel')) {
        const entries = parseRssEntries(xml)
        if (entries.length > 0) {
          return {
            source: 'rss',
            feed_url: `https://${domain}${path}`,
            entries,
          }
        }
      }
    } catch {}
  }

  for (const path of htmlPaths) {
    try {
      const html = await get(`https://${domain}${path}`)
      const text = stripHtml(html)
      if (text.length > 800) {
        return {
          source: 'html',
          url: `https://${domain}${path}`,
          raw_text: trunc(text, 4000),
          instruction:
            'Extract individual changelog/release entries with dates. Classify each as: new_feature, improvement, bugfix, deprecation, or breaking_change.',
        }
      }
    } catch {}
  }

  return { error: `No changelog found for ${domain}. Tried RSS feeds and common paths.` }
}

// ---------------------------------------------------------------------------
// Tool: scrape_review_themes
// G2/Capterra best-effort (server-rendered pages only; JS-rendered ones will fail)
// ---------------------------------------------------------------------------

async function toolScrapeReviewThemes(companyName: string): Promise<unknown> {
  const slug = companyName.toLowerCase().replace(/[\s.]/g, '-')

  const candidates = [
    `https://www.g2.com/products/${slug}/reviews`,
    `https://www.capterra.com/reviews/${slug}`,
    `https://www.trustpilot.com/review/${slug}`,
  ]

  for (const url of candidates) {
    try {
      const html = await get(url)
      const text = stripHtml(html)
      if (
        text.length > 1000 &&
        !text.toLowerCase().includes('access denied') &&
        !text.toLowerCase().includes('captcha') &&
        !text.toLowerCase().includes('robot')
      ) {
        return {
          source: new URL(url).hostname,
          company: companyName,
          url,
          raw_text: trunc(text, 4000),
          instruction:
            'Extract: overall rating, top positive themes (with approximate frequency), top negative themes (with approximate frequency), any recurring feature requests.',
        }
      }
    } catch {}
  }

  return {
    status: 'blocked',
    company: companyName,
    note: 'Review sites returned rate-limit / JS-only pages. G2 Buyer Intent API or SerpAPI recommended for production.',
    manual: candidates[0],
  }
}

// ---------------------------------------------------------------------------
// Tool: check_funding_news
// Crunchbase public org page + TechCrunch search
// ---------------------------------------------------------------------------

async function toolCheckFundingNews(companyName: string): Promise<unknown> {
  const cbSlug = companyName.toLowerCase().replace(/\s+/g, '-')

  try {
    const html = await get(`https://www.crunchbase.com/organization/${cbSlug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.includes('Page not found')) {
      return {
        source: 'crunchbase',
        url: `https://www.crunchbase.com/organization/${cbSlug}`,
        raw_text: trunc(text, 3000),
        instruction:
          'Extract: total funding raised, latest round (type, amount, date), lead investors, and any acquisitions or strategic partnerships.',
      }
    }
  } catch {}

  // TechCrunch search fallback
  try {
    const encoded = encodeURIComponent(`${companyName} funding OR acquisition OR partnership`)
    const html = await get(`https://techcrunch.com/search/?q=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) {
      return {
        source: 'techcrunch_search',
        company: companyName,
        raw_text: trunc(text, 3000),
        instruction: 'Extract any recent funding rounds, acquisitions, or strategic partnerships announced in the last 6 months.',
      }
    }
  } catch {}

  return {
    error: `Could not fetch funding news for ${companyName}.`,
    manual_check: `https://www.crunchbase.com/organization/${cbSlug}`,
  }
}

// ---------------------------------------------------------------------------
// Intel journal — persists snapshots, surfaces deltas
// ---------------------------------------------------------------------------

class IntelJournal {
  private snapshots: Record<string, IntelSnapshot[]> = {}
  constructor(private filePath = 'competitor_intel.json') {}

  async load() {
    try { this.snapshots = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.snapshots = {} }
  }

  async save() { await writeFile(this.filePath, JSON.stringify(this.snapshots, null, 2)) }

  add(snap: IntelSnapshot) {
    if (!this.snapshots[snap.competitor]) this.snapshots[snap.competitor] = []
    this.snapshots[snap.competitor]!.push(snap)
  }

  history(competitor: string, weeks = 8): IntelSnapshot[] {
    const all = this.snapshots[competitor] ?? []
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000
    return all.filter(s => new Date(s.date).getTime() > cutoff)
  }

  deltaContext(competitor: string): string {
    const history = this.history(competitor)
    if (history.length === 0) return 'No historical intel — this is the first run.'

    const prev = history[history.length - 1]!
    const lines: string[] = [`Prior snapshots: ${history.length} (oldest: ${history[0]!.date})`]

    if (prev.jobTotal > 0) lines.push(`Last known headcount (open roles): ${prev.jobTotal}`)
    if (prev.topDepts.length > 0) {
      lines.push(`Last known hiring focus: ${prev.topDepts.map(d => `${d.dept} (${d.count})`).join(', ')}`)
    }
    if (prev.changelogEntries.length > 0) {
      lines.push(`Last known changelog entries: ${prev.changelogEntries.slice(0, 4).join(' | ')}`)
    }
    if (prev.pricingHash) lines.push(`Pricing page hash at last run: ${prev.pricingHash}`)
    if (prev.reviewSummary) lines.push(`Last review summary: ${prev.reviewSummary}`)
    if (prev.fundingSummary) lines.push(`Last funding summary: ${prev.fundingSummary}`)

    lines.push('\nFocus on CHANGES since this last snapshot, not the absolute current state.')
    return lines.join('\n')
  }
}

// ---------------------------------------------------------------------------
// Extract a storable snapshot from raw tool results
// ---------------------------------------------------------------------------

function buildSnapshot(
  competitor: string,
  toolResults: Record<string, unknown>,
): IntelSnapshot {
  const jobs = toolResults['scrape_job_postings'] as Record<string, unknown> | undefined
  const changelog = toolResults['fetch_changelog'] as Record<string, unknown> | undefined
  const pricing = toolResults['diff_pricing_page'] as Record<string, unknown> | undefined
  const reviews = toolResults['scrape_review_themes'] as Record<string, unknown> | undefined
  const funding = toolResults['check_funding_news'] as Record<string, unknown> | undefined

  const byDept = (jobs?.by_department as Array<{ dept: string; count: number }> | undefined) ?? []
  const jobTotal = (jobs?.total as number | undefined) ?? 0

  const entries = (changelog?.entries as string[] | undefined) ?? []

  const currentPricing = (pricing?.current as string | undefined) ?? ''
  const pricingHash = currentPricing.length > 0
    ? `len:${currentPricing.length},start:${currentPricing.slice(0, 40).replace(/\s+/g, '_')}`
    : ''

  const reviewText = (reviews?.raw_text as string | undefined) ?? ''
  const reviewSummary = reviewText.slice(0, 120).replace(/\s+/g, ' ')

  const fundingText = (funding?.raw_text as string | undefined) ?? ''
  const fundingSummary = fundingText.slice(0, 120).replace(/\s+/g, ' ')

  return {
    competitor,
    date: new Date().toISOString(),
    jobTotal,
    topDepts: byDept.slice(0, 5),
    changelogEntries: entries.slice(0, 10),
    pricingHash,
    reviewSummary,
    fundingSummary,
  }
}

// ---------------------------------------------------------------------------
// System prompt — the intent inference framework
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a competitive intelligence analyst who has advised Fortune 100 product teams.
You specialize in reading weak signals from public data to infer strategic roadmaps 6–18 months ahead.

## Initiative Inference Framework

You decode competitor intent from BEHAVIORAL SIGNALS, not their stated strategy (which is always noise).

### Signal → Intent Mapping

**Hiring Signals:**
- "Enterprise Account Executive" surge → going upmarket, expect price increase and enterprise features
- "Platform Engineer" + "API developer" surge → building a marketplace/ecosystem strategy
- "ML Engineer" + "Data Scientist" without "Research" → productizing AI, not researching it (6–9 month timeline)
- "Implementation Specialist" surge → product is complex; they know churn is a problem
- "Partner Manager" + "ISV" → ecosystem play, they are losing direct sales to larger competitors
- Mass layoffs in sales → moving to product-led growth; pricing simplification incoming

**Pricing Signals:**
- Feature moved from Pro to Enterprise tier → monetizing enterprise, annoying mid-market (vulnerability)
- New "Starter" or "Free" tier added → facing top-of-funnel pressure; PLG pivot
- Usage-based pricing added → they've found customers resist seat-based in downturn
- Removing annual discount → confident in retention; or struggling with cash flow

**Changelog Signals:**
- 3+ consecutive releases with "Improved" not "New": paying down tech debt — platform rewrite underway
- Frequent API versioning → breaking changes ahead; customer disruption risk
- "SSO", "SCIM", "Audit logs" in one quarter → enterprise readiness sprint (sales-driven)
- Mobile app releases accelerating → consumer push or SMB pivot

**Review Theme Signals:**
- Spike in "too expensive" reviews → pricing backlash, churn risk for them = opportunity for you
- "Support is slow" + hiring CSM roles → scaling pains (attack their enterprise deals NOW)
- "Missing X feature" repeated → their roadmap gap; build X and market aggressively

## Counter-Move Recommendation Framework
For each inferred initiative, recommend ONE of:
1. **Pre-empt**: Build/announce the feature before they ship (if you can in 60 days)
2. **Leapfrog**: Don't match — build the next version of what they're building
3. **Exploit gap**: Their initiative creates a neglected segment — own it
4. **Defend**: Harden retention in accounts most vulnerable to their new offering
5. **Ignore**: Initiative does not affect your ICP — monitor only

## Output Format
INITIATIVE: **<name>**
CONFIDENCE: <0-100>%
TIMELINE: <estimate>
THREAT: <LOW|MEDIUM|HIGH|CRITICAL>
COUNTER: <PRE-EMPT|LEAPFROG|EXPLOIT_GAP|DEFEND|IGNORE>
ACTION: <1–2 sentences on exactly what to do>

Always end with a WATCHLIST: 3 specific metrics to monitor in the next 30 days that would confirm or deny these inferences.`

// ---------------------------------------------------------------------------
// Main intelligence run
// ---------------------------------------------------------------------------

async function runCompetitorIntel(
  competitors: CompetitorProfile[],
  yourProduct: string,
  yourIcp: string,
) {
  const client = new Anthropic()
  const journal = new IntelJournal()
  await journal.load()

  const tools: Anthropic.Tool[] = [
    {
      name: 'scrape_job_postings',
      description: 'Fetch current open roles for a company. Tries Greenhouse and Lever public APIs, falls back to careers page.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string', description: 'Company name as it appears in their Greenhouse/Lever slug (e.g. "notion", "linear")' },
          domain: { type: 'string', description: 'Company domain for careers page fallback, e.g. "notion.so"' },
        },
        required: ['company_name'],
      },
    },
    {
      name: 'diff_pricing_page',
      description: 'Fetch the current pricing page and diff it against the last cached version. Returns both versions for comparison.',
      input_schema: {
        type: 'object' as const,
        properties: { domain: { type: 'string', description: 'Company domain, e.g. "notion.so"' } },
        required: ['domain'],
      },
    },
    {
      name: 'fetch_changelog',
      description: 'Fetch the last 90 days of product changelog or release notes. Tries RSS feeds first, then common changelog URLs.',
      input_schema: {
        type: 'object' as const,
        properties: { domain: { type: 'string', description: 'Company domain, e.g. "notion.so"' } },
        required: ['domain'],
      },
    },
    {
      name: 'scrape_review_themes',
      description: 'Scrape G2/Capterra/Trustpilot reviews for the company. Returns raw review text for theme extraction.',
      input_schema: {
        type: 'object' as const,
        properties: { company_name: { type: 'string' } },
        required: ['company_name'],
      },
    },
    {
      name: 'check_funding_news',
      description: 'Check Crunchbase and TechCrunch for recent funding rounds, acquisitions, or strategic partnerships.',
      input_schema: {
        type: 'object' as const,
        properties: { company_name: { type: 'string' } },
        required: ['company_name'],
      },
    },
  ]

  for (const competitor of competitors) {
    const deltaCtx = journal.deltaContext(competitor.name)

    const userPrompt = `Decode the strategic intent of ${competitor.name} (${competitor.domain}).
Their primary product: ${competitor.primaryProduct}
Known stated priorities (treat as noise — look for what they're ACTUALLY doing): ${competitor.knownStrategicPriorities.join(', ')}

Your product: ${yourProduct}
Your ICP: ${yourIcp}

## Historical context
${deltaCtx}

Gather ALL signals: job postings (use company_name="${competitor.name.toLowerCase()}" and domain="${competitor.domain}"), pricing diffs, changelog, reviews, and funding news.
Focus on changes since last run. Then apply the Initiative Inference Framework and output ranked initiatives by threat level to our ICP.`

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

    console.log(`\nGathering signals for ${competitor.name}…`)

    const call1 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    // Execute all tool calls, accumulate results
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
    const rawResults: Record<string, unknown> = {}

    for (const block of call1.content) {
      if (block.type !== 'tool_use') continue
      const input = block.input as Record<string, string>

      console.log(`  → ${block.name}(${JSON.stringify(input)})`)

      let result: unknown
      try {
        switch (block.name) {
          case 'scrape_job_postings':
            result = await toolScrapeJobPostings(input.company_name!, input.domain)
            break
          case 'diff_pricing_page':
            result = await toolDiffPricingPage(input.domain!)
            break
          case 'fetch_changelog':
            result = await toolFetchChangelog(input.domain!)
            break
          case 'scrape_review_themes':
            result = await toolScrapeReviewThemes(input.company_name!)
            break
          case 'check_funding_news':
            result = await toolCheckFundingNews(input.company_name!)
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

    // Call 2 — intent inference
    console.log(`  Analyzing signals…\n`)

    const call2 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'none' },
      messages: [
        ...messages,
        { role: 'assistant', content: call1.content },
        { role: 'user', content: toolResultBlocks },
      ],
    })

    const analysis = call2.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

    console.log(`===== ${competitor.name.toUpperCase()} INTELLIGENCE REPORT =====\n`)
    console.log(analysis)

    // Persist snapshot from real data
    journal.add(buildSnapshot(competitor.name, rawResults))
  }

  await journal.save()
  console.log('\nSnapshots saved to competitor_intel.json')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  await runCompetitorIntel(
    [
      {
        name: 'Notion',
        domain: 'notion.so',
        primaryProduct: 'All-in-one workspace / knowledge management',
        knownStrategicPriorities: ['AI features', 'Enterprise expansion'],
      },
    ],
    'Structured project management for engineering teams',
    'Series B–D SaaS companies, 50–500 engineers, CTO buyer',
  )
}

main().catch(console.error)
