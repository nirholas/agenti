/**
 * Sales Intelligence Orchestrator
 *
 * Real data sources:
 *   Triggers   — Crunchbase funding + TechCrunch news + Greenhouse/Lever job postings
 *   Company    — Crunchbase org page + BuiltWith tech stack + LinkedIn headcount
 *   Person     — Company team page + web search (articles, talks, interviews)
 *   Intent     — G2 reviews + job posting language analysis + website content signals
 *   Mutual     — Best-effort public web; LinkedIn API required for full graph
 *
 * Two-call architecture:
 *   Call 1 — Claude gathers all signals via real HTTP fetches
 *   Call 2 — Claude writes hyper-personalized 4-touch outreach sequence
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prospect {
  firstName: string
  lastName: string
  title: string
  company: string
  linkedinUrl?: string
  email?: string
  companyWebsite: string
  sector: string
  employeeCount: number
  revenueM?: number
}

interface OutreachSequence {
  prospect: string
  company: string
  touchpoints: Touchpoint[]
  primaryAngle: string
  followUpTiming: number[]
}

interface Touchpoint {
  channel: 'email' | 'linkedin' | 'phone' | 'gift'
  subject?: string
  body: string
  callToAction: string
  personalizedHook: string
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
// Tool: find_trigger_events
// Crunchbase funding + TechCrunch news + Greenhouse/Lever job postings with dates
// ---------------------------------------------------------------------------

interface GreenhouseJob { title: string; updated_at?: string; departments?: Array<{ name: string }> }
interface LeverPosting { text: string; createdAt?: number; categories?: { team?: string } }

async function toolFindTriggerEvents(companyName: string, daysBack = 30): Promise<unknown> {
  const slug = companyName.toLowerCase().replace(/[\s.]/g, '-')
  const plain = companyName.toLowerCase().replace(/\s+/g, '')
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000
  const triggers: unknown[] = []

  // Crunchbase for funding and news
  try {
    const html = await get(`https://www.crunchbase.com/organization/${slug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.toLowerCase().includes('page not found')) {
      triggers.push({
        source: 'crunchbase',
        url: `https://www.crunchbase.com/organization/${slug}`,
        raw: trunc(text, 2000),
        instruction: 'Extract any recent funding rounds, acquisitions, or partnership announcements with dates.',
      })
    }
  } catch {}

  // TechCrunch news
  try {
    const encoded = encodeURIComponent(companyName)
    const html = await get(`https://techcrunch.com/search/?q=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) {
      triggers.push({
        source: 'techcrunch',
        raw: trunc(text, 2000),
        instruction: `Extract any news about ${companyName} from the last ${daysBack} days (today is ${new Date().toISOString().split('T')[0]}). Include funding, product launches, expansions, executive changes.`,
      })
    }
  } catch {}

  // Greenhouse job postings with dates
  try {
    const raw = await get(`https://api.greenhouse.io/v1/boards/${plain}/jobs?content=false`)
    const data = JSON.parse(raw) as { jobs: GreenhouseJob[] }
    if (data.jobs?.length > 0) {
      const recent = data.jobs
        .filter(j => !j.updated_at || new Date(j.updated_at).getTime() > cutoff)
        .slice(0, 8)
        .map(j => ({ title: j.title, dept: j.departments?.[0]?.name, posted: j.updated_at }))
      if (recent.length > 0) {
        triggers.push({
          source: 'greenhouse_jobs',
          total_open: data.jobs.length,
          recent_postings: recent,
          instruction: 'Identify what strategic intent the job titles reveal (e.g. "Head of RevOps" = scaling revenue systems, "ML Engineer" surge = productizing AI).',
        })
      }
    }
  } catch {}

  // Lever fallback
  if (!triggers.some(t => (t as Record<string, unknown>).source?.toString().includes('jobs'))) {
    try {
      const raw = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)
      const data = JSON.parse(raw) as LeverPosting[]
      if (Array.isArray(data) && data.length > 0) {
        const recent = data
          .filter(j => !j.createdAt || j.createdAt > cutoff / 1000)
          .slice(0, 8)
          .map(j => ({ title: j.text, team: j.categories?.team, posted: j.createdAt ? new Date(j.createdAt * 1000).toISOString() : null }))
        if (recent.length > 0) {
          triggers.push({ source: 'lever_jobs', total_open: data.length, recent_postings: recent })
        }
      }
    } catch {}
  }

  if (triggers.length === 0) {
    return {
      company: companyName,
      status: 'no_triggers_found',
      note: `No public trigger data found for ${companyName} in the last ${daysBack} days.`,
      manual_checks: [
        `https://www.crunchbase.com/organization/${slug}`,
        `https://techcrunch.com/search/?q=${encodeURIComponent(companyName)}`,
        `https://www.linkedin.com/company/${slug}`,
      ],
    }
  }

  return { company: companyName, days_searched: daysBack, sources: triggers }
}

// ---------------------------------------------------------------------------
// Tool: enrich_company
// Crunchbase org + BuiltWith tech stack + LinkedIn headcount + website
// ---------------------------------------------------------------------------

async function toolEnrichCompany(companyName: string, website?: string): Promise<unknown> {
  const slug = companyName.toLowerCase().replace(/[\s.]/g, '-')
  const domain = website ? website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null
  const results: Record<string, unknown> = { company: companyName }

  // Crunchbase org profile
  try {
    const html = await get(`https://www.crunchbase.com/organization/${slug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.toLowerCase().includes('page not found')) {
      results.crunchbase = { url: `https://www.crunchbase.com/organization/${slug}`, data: trunc(text, 2000) }
    }
  } catch {}

  // BuiltWith for tech stack
  if (domain) {
    try {
      const html = await get(`https://builtwith.com/${domain}`)
      const text = stripHtml(html)
      if (text.length > 500 && !text.toLowerCase().includes('not found')) {
        results.tech_stack = { source: 'builtwith', data: trunc(text, 1500) }
      }
    } catch {}
  }

  // LinkedIn company page
  try {
    const html = await get(`https://www.linkedin.com/company/${slug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.toLowerCase().includes('join to see')) {
      results.linkedin = trunc(text, 1200)
    } else {
      results.linkedin = { url: `https://www.linkedin.com/company/${slug}`, status: 'requires_auth' }
    }
  } catch {}

  // Company website
  if (website) {
    try {
      const html = await get(website.startsWith('http') ? website : `https://${website}`)
      const text = stripHtml(html)
      if (text.length > 500) results.website = trunc(text, 1500)
    } catch {}
  }

  results.instruction = 'Extract: funding stage, total raised, tech stack tools, estimated headcount, recent strategic moves, and any signals about current priorities or pain points.'
  return results
}

// ---------------------------------------------------------------------------
// Tool: profile_decision_maker
// Company team page + web articles/interviews + conference speaker pages
// ---------------------------------------------------------------------------

async function toolProfileDecisionMaker(
  name: string,
  company: string,
  title?: string,
  linkedinUrl?: string,
): Promise<unknown> {
  const results: Record<string, unknown> = { name, company }
  const slug = company.toLowerCase().replace(/[\s.]/g, '-')
  const nameSlug = name.toLowerCase().replace(/\s+/g, '-')
  const encoded = encodeURIComponent(`${name} ${company}`)

  // Company about/team page
  for (const path of ['/about', '/team', '/about/team', '/company/team', '/leadership']) {
    try {
      const html = await get(`https://www.${slug}.com${path}`)
      const text = stripHtml(html)
      if (text.length > 500 && text.toLowerCase().includes(name.split(' ')[0]!.toLowerCase())) {
        results.company_bio = trunc(text, 1500)
        break
      }
    } catch {}
  }

  // LinkedIn public profile
  if (linkedinUrl) {
    try {
      const html = await get(linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`)
      const text = stripHtml(html)
      if (text.length > 500 && !text.toLowerCase().includes('sign in')) {
        results.linkedin = trunc(text, 1500)
      } else {
        results.linkedin = { url: linkedinUrl, status: 'requires_auth' }
      }
    } catch {}
  }

  // TechCrunch byline or mentions
  try {
    const html = await get(`https://techcrunch.com/search/?q=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) results.press_mentions = trunc(text, 1500)
  } catch {}

  // Wellfound / AngelList
  try {
    const html = await get(`https://wellfound.com/u/${nameSlug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.toLowerCase().includes('not found')) {
      results.wellfound = trunc(text, 1000)
    }
  } catch {}

  // Crunchbase person page
  try {
    const html = await get(`https://www.crunchbase.com/person/${nameSlug}`)
    const text = stripHtml(html)
    if (text.length > 500 && !text.toLowerCase().includes('page not found')) {
      results.crunchbase = trunc(text, 1000)
    }
  } catch {}

  if (Object.keys(results).length <= 2) {
    results.status = 'limited_public_data'
    results.manual_checks = [
      linkedinUrl ?? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + ' ' + company)}`,
      `https://www.crunchbase.com/person/${nameSlug}`,
    ]
  }

  results.instruction = `Infer: communication style (data-driven/vision-driven/relationship-driven/results-driven), likely current pain points given their role (${title ?? 'unknown'}) and company stage, any recently stated priorities or public opinions, best angle for cold outreach.`
  return results
}

// ---------------------------------------------------------------------------
// Tool: check_intent_signals
// G2 reviews + job postings that reference competitor tools + website signals
// ---------------------------------------------------------------------------

async function toolCheckIntentSignals(companyName: string, productCategory: string): Promise<unknown> {
  const slug = companyName.toLowerCase().replace(/[\s.]/g, '-')
  const plain = companyName.toLowerCase().replace(/\s+/g, '')
  const results: Record<string, unknown> = { company: companyName, category: productCategory }

  // G2 reviews (are they actively reviewing tools in this category?)
  try {
    const encoded = encodeURIComponent(productCategory)
    const html = await get(`https://www.g2.com/search?query=${encoded}`)
    const text = stripHtml(html)
    if (text.length > 500) results.g2_category = trunc(text, 1500)
  } catch {}

  // Check if job postings mention competitor tool names (strong intent signal)
  try {
    const raw = await get(`https://api.greenhouse.io/v1/boards/${plain}/jobs?content=true`)
    const data = JSON.parse(raw) as { jobs: Array<{ title: string; content?: string }> }
    if (data.jobs?.length > 0) {
      const categoryKeywords = productCategory.toLowerCase().split(/\s+/)
      const relevant = data.jobs.filter(j =>
        categoryKeywords.some(kw => (j.content ?? j.title).toLowerCase().includes(kw))
      )
      if (relevant.length > 0) {
        results.job_intent_signals = {
          matching_postings: relevant.slice(0, 5).map(j => ({ title: j.title, snippet: j.content?.slice(0, 300) })),
          note: `${relevant.length} job posting(s) mention "${productCategory}" — strong buying intent signal.`,
        }
      }
    }
  } catch {}

  // Lever with content
  if (!results.job_intent_signals) {
    try {
      const raw = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)
      const data = JSON.parse(raw) as Array<{ text: string; descriptionPlain?: string }>
      if (Array.isArray(data) && data.length > 0) {
        const categoryKeywords = productCategory.toLowerCase().split(/\s+/)
        const relevant = data.filter(j =>
          categoryKeywords.some(kw => (j.descriptionPlain ?? j.text).toLowerCase().includes(kw))
        )
        if (relevant.length > 0) {
          results.job_intent_signals = {
            matching_postings: relevant.slice(0, 5).map(j => ({ title: j.text })),
          }
        }
      }
    } catch {}
  }

  results.instruction = `Assess buying intent strength (0–100) for "${productCategory}". Signals: Are they actively hiring for roles that need this tool? Are G2 reviews or comparisons in this category visible? What does their current tooling suggest about gaps?`
  return results
}

// ---------------------------------------------------------------------------
// Tool: find_mutual_connections
// Best-effort public web; LinkedIn auth required for full graph
// ---------------------------------------------------------------------------

async function toolFindMutualConnections(prospectLinkedin?: string): Promise<unknown> {
  if (!prospectLinkedin) {
    return {
      status: 'no_linkedin_provided',
      note: 'LinkedIn URL required. Mutual connection mapping requires LinkedIn API or a sales tool like Apollo, Clay, or Sales Navigator.',
    }
  }

  // Try fetching the public profile
  try {
    const url = prospectLinkedin.startsWith('http') ? prospectLinkedin : `https://${prospectLinkedin}`
    const html = await get(url)
    const text = stripHtml(html)

    if (text.length > 500 && !text.toLowerCase().includes('sign in')) {
      return {
        profile_data: trunc(text, 1500),
        instruction: 'From this profile, identify any shared companies, investors, schools, or communities that could be used as warm introduction angles.',
      }
    }
  } catch {}

  return {
    status: 'requires_auth',
    url: prospectLinkedin,
    note: 'LinkedIn requires login for profile access. For mutual connection mapping, use Sales Navigator API, Apollo.io, or Clay.',
    workaround: 'Check if the prospect follows or engages with any of your existing customers on public social media.',
  }
}

// ---------------------------------------------------------------------------
// Outreach performance journal
// ---------------------------------------------------------------------------

class OutreachJournal {
  private records: Array<{ sequence: OutreachSequence; date: string; replied?: boolean; meeting?: boolean }> = []
  constructor(private filePath = 'outreach_journal.json') {}

  async load() {
    try { this.records = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.records = [] }
  }

  async save() { await writeFile(this.filePath, JSON.stringify(this.records, null, 2)) }

  add(sequence: OutreachSequence) { this.records.push({ sequence, date: new Date().toISOString() }) }

  getReplyRateByAngle(): Record<string, number> {
    const byAngle: Record<string, { sent: number; replied: number }> = {}
    for (const r of this.records) {
      const angle = r.sequence.primaryAngle
      if (!byAngle[angle]) byAngle[angle] = { sent: 0, replied: 0 }
      byAngle[angle]!.sent++
      if (r.replied) byAngle[angle]!.replied++
    }
    return Object.fromEntries(
      Object.entries(byAngle).map(([k, v]) => [k, v.sent > 0 ? v.replied / v.sent : 0])
    )
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a world-class B2B sales strategist who has booked 50,000+ enterprise meetings.
You know the difference between outreach that sounds personalized and outreach that IS personalized.
Real personalization references something SPECIFIC and VERIFIABLE that the prospect would recognize as research, not a template.

## Trigger-to-Message Mapping Framework

### Funding Round Trigger
ANGLE: "You're building something ambitious — here's how we help companies scale [relevant function] post-raise"
TIMING: Contact within 7 days of announcement (90% of budget decisions happen in first 30 days)
KEY LINE: Reference the SPECIFIC round size and lead investor
AVOID: "Congratulations on your funding!" (everyone sends this)
DIFFERENTIATE: "Your Series B with Bessemer typically signals a 3–6 month window before teams are locked in to new tooling."

### New Executive Hire Trigger
ANGLE: New exec is evaluating their inherited tech stack RIGHT NOW
TIMING: Contact within 2 weeks of LinkedIn start date
KEY LINE: Reference their background from PRIOR company — imply you understand their playbook
DIFFERENTIATE: "I noticed you came from Stripe. As you build out your function at [company], the playbook you used there might already inform how you think about this."

### Job Posting Trigger (most underused)
ANGLE: The job they're hiring for tells you exactly what problem they're trying to solve
TIMING: Within 14 days of posting going live
KEY LINE: Decode the job — "You're hiring a Head of [X], which usually means [problem they're solving]"
DIFFERENTIATE: "You've had 3 [role] postings open for 60+ days — that usually means the role keeps failing because [root cause], or you need the tool before you hire the person."

### Competitor Issue Trigger
ANGLE: Their competitor just had a public problem you solve
TIMING: Within 48 hours
KEY LINE: "You probably saw what happened to [competitor]. Your [stakeholder] is likely asking questions."

### Conference Speaking Trigger
ANGLE: They just shared their strategic vision publicly — align to that vision
KEY LINE: Reference a SPECIFIC statement from the talk, not the topic
DIFFERENTIATE: "In your talk at [conference], you said [quote]. We're building exactly the infrastructure you described."

## Communication Style Calibration
- **Data-driven**: Lead with benchmarks; "Companies at your stage typically..."
- **Vision-driven**: Lead with future state; "Imagine a world where..."
- **Relationship-driven**: Lead with social proof; "I spoke with [name] who..."
- **Results-driven**: Lead with outcome; "Our last 3 customers at your stage reduced [metric] by X%"

## Personalization Rubric (0–10)
- 0–3: Generic template; NEVER SEND
- 4–6: Category personalized; acceptable for low-priority prospects
- 7–8: Trigger-specific; expected standard
- 9–10: Hyper-specific; reserve for top-20 accounts

## Output Format
PROSPECT: **<Name, Title @ Company>**
PRIMARY_ANGLE: <trigger type and why>
PERSONALIZATION_SCORE: <0-10>

TOUCH 1 — EMAIL (Day 0):
Subject: <≤ 7 words, no exclamation marks>
Body:
<≤ 150 words, no fluff>
CTA: <one specific ask, not "happy to chat">

TOUCH 2 — LINKEDIN (Day 3):
<≤ 300 character connection note>

TOUCH 3 — EMAIL (Day 7):
Subject: <reply thread or new angle>
Body:
<≤ 100 words — different angle, reference touch 1>
CTA: <specific>

TOUCH 4 — BREAKUP (Day 14):
Subject: <permission to close — honest>
Body: <honest close; leave door open>

Always flag if a trigger is > 30 days old — the window may have closed.
Never claim a result you cannot prove. Never use "quick call" or "pick your brain".`

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function runSalesOrchestrator(
  prospects: Prospect[],
  yourProduct: string,
  yourIcp: string,
  valueProposition: string,
) {
  const client = new Anthropic()
  const journal = new OutreachJournal()
  await journal.load()

  const anglePerformance = journal.getReplyRateByAngle()
  const performanceContext = Object.keys(anglePerformance).length > 0
    ? `Historical reply rates by angle:\n${Object.entries(anglePerformance).map(([a, r]) => `- ${a}: ${(r * 100).toFixed(0)}%`).join('\n')}`
    : 'No historical reply data yet.'

  const tools: Anthropic.Tool[] = [
    {
      name: 'find_trigger_events',
      description: 'Find recent trigger events for a company: funding rounds, product launches, job postings, press coverage. Use this first.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string' },
          days_back: { type: 'number', description: 'How many days back to search. Default: 30.' },
        },
        required: ['company_name'],
      },
    },
    {
      name: 'enrich_company',
      description: 'Fetch company funding history, tech stack, headcount growth, and recent strategic moves.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string' },
          website: { type: 'string', description: 'Company website URL' },
        },
        required: ['company_name'],
      },
    },
    {
      name: 'profile_decision_maker',
      description: 'Research a decision maker via company team page, press mentions, and public profiles to infer communication style and current priorities.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          title: { type: 'string' },
          linkedin_url: { type: 'string' },
        },
        required: ['name', 'company'],
      },
    },
    {
      name: 'check_intent_signals',
      description: 'Check if a company shows buying intent for your product category via job postings and public review activity.',
      input_schema: {
        type: 'object' as const,
        properties: {
          company_name: { type: 'string' },
          product_category: { type: 'string', description: 'e.g. "revenue intelligence", "sales engagement platform"' },
        },
        required: ['company_name', 'product_category'],
      },
    },
    {
      name: 'find_mutual_connections',
      description: 'Attempt to find mutual connections between the prospect and your team via public profiles.',
      input_schema: {
        type: 'object' as const,
        properties: {
          prospect_linkedin: { type: 'string', description: 'Full LinkedIn profile URL' },
        },
        required: [],
      },
    },
  ]

  for (const prospect of prospects) {
    const userPrompt = `Generate a hyper-personalized 4-touch outreach sequence for this prospect.

Product: ${yourProduct}
ICP: ${yourIcp}
Value prop: ${valueProposition}

Prospect: ${prospect.firstName} ${prospect.lastName}, ${prospect.title} @ ${prospect.company}
Sector: ${prospect.sector} | Employees: ${prospect.employeeCount}${prospect.revenueM ? ` | Revenue: $${prospect.revenueM}M` : ''}
Website: ${prospect.companyWebsite}
LinkedIn: ${prospect.linkedinUrl ?? 'not provided'}

${performanceContext}

Protocol:
1. find_trigger_events (last 30 days) — find the sharpest angle
2. enrich_company — confirm stage and tech stack
3. profile_decision_maker — infer communication style
4. check_intent_signals — confirm category relevance
5. find_mutual_connections — find warm paths if any

Use the strongest trigger as PRIMARY_ANGLE.
If no trigger ≥ 7/10 exists, flag it and use the best available.
Apply personalization rubric — only output touches scoring ≥ 7.`

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

    console.log(`\nResearching ${prospect.firstName} ${prospect.lastName} @ ${prospect.company}…`)

    const call1 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []

    for (const block of call1.content) {
      if (block.type !== 'tool_use') continue
      const input = block.input as Record<string, string | number>
      console.log(`  → ${block.name}(${JSON.stringify(input)})`)

      let result: unknown
      try {
        switch (block.name) {
          case 'find_trigger_events':
            result = await toolFindTriggerEvents(input.company_name as string, input.days_back as number | undefined)
            break
          case 'enrich_company':
            result = await toolEnrichCompany(input.company_name as string, input.website as string | undefined)
            break
          case 'profile_decision_maker':
            result = await toolProfileDecisionMaker(
              input.name as string,
              input.company as string,
              input.title as string | undefined,
              input.linkedin_url as string | undefined,
            )
            break
          case 'check_intent_signals':
            result = await toolCheckIntentSignals(input.company_name as string, input.product_category as string)
            break
          case 'find_mutual_connections':
            result = await toolFindMutualConnections(input.prospect_linkedin as string | undefined)
            break
          default:
            result = { error: `Unknown tool: ${block.name}` }
        }
      } catch (err) {
        result = { error: String(err) }
      }

      toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
    }

    console.log('  Writing sequence…\n')

    const call2 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'none' },
      messages: [
        ...messages,
        { role: 'assistant', content: call1.content },
        { role: 'user', content: toolResultBlocks },
      ],
    })

    const sequence = call2.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

    console.log(`===== OUTREACH: ${prospect.firstName} ${prospect.lastName} @ ${prospect.company} =====\n`)
    console.log(sequence)

    const angleMatch = sequence.match(/PRIMARY_ANGLE:\s*(.+)/)
    journal.add({
      prospect: `${prospect.firstName} ${prospect.lastName}`,
      company: prospect.company,
      touchpoints: [],
      primaryAngle: angleMatch?.[1]?.trim() ?? 'unknown',
      followUpTiming: [0, 3, 7, 14],
    })
  }

  await journal.save()
  console.log('\nSequences saved to outreach_journal.json')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const prospects: Prospect[] = [
    {
      firstName: 'Marcus',
      lastName: 'Reynolds',
      title: 'VP of Revenue Operations',
      company: 'Meridian Health AI',
      sector: 'Health Tech SaaS',
      employeeCount: 180,
      revenueM: 22,
      companyWebsite: 'https://www.meridianhealthai.com',
      linkedinUrl: 'https://www.linkedin.com/in/marcus-reynolds',
    },
  ]

  await runSalesOrchestrator(
    prospects,
    'Revenue intelligence platform for B2B SaaS',
    'Series B+ SaaS companies, 100–500 employees, VP RevOps or VP Sales buyer',
    'We predict pipeline risk 6 weeks out with 87% accuracy, eliminating quarter-end surprises',
  )
}

main().catch(console.error)
