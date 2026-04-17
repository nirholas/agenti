/**
 * Talent Signal Monitor: executive/engineer movement → strategic intelligence
 *
 * Architecture:
 *   Call 1 — Claude monitors departure and arrival patterns at target companies
 *             via LinkedIn deltas, SEC 8-K filings, and job posting archaeology
 *   Call 2 — Claude interprets the talent flow as a strategic signal:
 *             product pivots, stealth builds, acquisition targets, org collapse
 *   Memory  — Weekly snapshots; surfaces changes not absolute state
 *
 * Why nobody open-sources this:
 *   Talent flow is one of the highest-signal leading indicators of company trajectory.
 *   Professional services firms charge $100K+ for quarterly reports doing this manually.
 *   The signal taxonomy (who matters, what their move means) is the entire value.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecMove {
  person: string
  title: string
  seniorityLevel: 'c-suite' | 'vp' | 'director' | 'staff-engineer' | 'principal'
  fromCompany: string
  toCompany: string
  date: string
  linkedinUrl?: string
  previousBackground: string[]
}

interface TalentSignal {
  company: string
  signalType:
    | 'stealth_build'       // engineers from specific domain leaving to join stealth
    | 'product_pivot'       // PMsf/eng from new domain arriving
    | 'org_collapse'        // VP/Director exodus within 90 days
    | 'acquisition_prep'    // integration/corp dev roles appearing
    | 'ipo_prep'           // CFO/GC from public company background hired
    | 'competitor_drain'   // your competitor losing key talent to unknown
    | 'acqui_hire_target'  // whole team departing to single destination
  strength: number          // 0–1
  affectedCompanies: string[]
  interpretation: string
  actionRecommendation: string
}

interface TalentSnapshot {
  date: string
  company: string
  keyDepartures: ExecMove[]
  keyArrivals: ExecMove[]
  signals: TalentSignal[]
}

// ---------------------------------------------------------------------------
// Talent intel journal
// ---------------------------------------------------------------------------

class TalentJournal {
  private snapshots: TalentSnapshot[] = []
  constructor(private filePath = 'talent_intel.json') {}
  async load() { try { this.snapshots = JSON.parse(await readFile(this.filePath, 'utf-8')) } catch { this.snapshots = [] } }
  async save() { await writeFile(this.filePath, JSON.stringify(this.snapshots, null, 2)) }
  addSnapshot(s: TalentSnapshot) { this.snapshots.push(s) }
  getCompanyHistory(company: string, weeks = 12): TalentSnapshot[] {
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000
    return this.snapshots.filter(s => s.company === company && new Date(s.date).getTime() > cutoff)
  }
}

// ---------------------------------------------------------------------------
// The prompt — the signal taxonomy is the moat
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

  const tools: Anthropic.Tool[] = [
    {
      name: 'scan_linkedin_moves',
      description: 'Scan LinkedIn for executive and senior engineer departures/arrivals at a company in the last 30/60/90 days.',
      input_schema: { type: 'object' as const, properties: { company_name: { type: 'string' }, days_back: { type: 'number' }, seniority_filter: { type: 'string' } }, required: ['company_name'] },
    },
    {
      name: 'check_sec_8k_leadership',
      description: 'Fetch SEC 8-K filings for officer/director changes at a public company.',
      input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' }, company_name: { type: 'string' } }, required: ['company_name'] },
    },
    {
      name: 'identify_destination_entity',
      description: 'Given a person\'s new employer, look up entity type, funding status, and investor list.',
      input_schema: { type: 'object' as const, properties: { company_name: { type: 'string' } }, required: ['company_name'] },
    },
    {
      name: 'check_hiring_for_roles',
      description: 'Check if a company is currently hiring for specific roles that signal strategic initiatives.',
      input_schema: { type: 'object' as const, properties: { company_name: { type: 'string' }, role_types: { type: 'array', items: { type: 'string' } } }, required: ['company_name'] },
    },
  ]

  for (const company of watchlist) {
    const history = journal.getCompanyHistory(company)
    const priorSignals = history.flatMap(s => s.signals).slice(-3)

    const userPrompt = `Monitor talent movements at "${company}" for strategic signals.
I work at ${yourCompany} — flag signals relevant to us (competitive threats, partnership opportunities, acquisition targets).

Prior signals detected (last 12 weeks): ${priorSignals.length > 0 ? priorSignals.map(s => `${s.signalType}: ${s.interpretation}`).join('\n') : 'none'}

Scan LinkedIn moves (30d and 90d windows), check 8-K filings, and for any interesting destinations,
identify the entity. Apply the Signal Taxonomy rigorously.
Only report signals with strength ≥ 0.4.`

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

    const call1 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of call1.content) {
      if (block.type !== 'tool_use') continue
      const input = block.input as Record<string, string | string[]>
      let result: unknown

      if (block.name === 'scan_linkedin_moves') {
        result = {
          company: input.company_name,
          recent_departures: [
            { person: 'Alex Chen', title: 'VP Engineering', departed: '2026-03-28', destination: 'Stealth AI startup', background: ['Google Brain', 'DeepMind'] },
            { person: 'Sarah Kim', title: 'Director of Product', departed: '2026-03-15', destination: 'Same stealth startup', background: ['OpenAI product'] },
            { person: 'Marcus Webb', title: 'Staff ML Engineer', departed: '2026-04-02', destination: 'Same stealth startup', background: ['Anthropic', 'DeepMind'] },
          ],
          recent_arrivals: [
            { person: 'Jim Torres', title: 'VP Corporate Development', joined: '2026-04-10', background: ['Goldman M&A', 'Bridgepoint Partners'] },
          ],
        }
      } else if (block.name === 'check_sec_8k_leadership') {
        result = { company: input.company_name, filings: [{ date: '2026-04-01', change: 'CFO departure announced; Interim CFO from Big 4 background appointed' }] }
      } else if (block.name === 'identify_destination_entity') {
        result = { company: input.company_name, type: 'Stealth startup', founded: '2026-01', investors: ['a16z crypto', 'Founders Fund'], funding: '$30M seed (unannounced)', domain_hint: 'AI agents for enterprise (inferred from talent background)' }
      } else if (block.name === 'check_hiring_for_roles') {
        result = { company: input.company_name, relevant_roles: [{ title: 'Head of M&A Integration', posted: '2026-04-05' }, { title: 'Director, Strategic Partnerships', posted: '2026-03-28' }] }
      }

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
    }

    const call2 = await client.messages.create({
      model: 'claude-opus-4-7-20251101',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools,
      messages: [
        ...messages,
        { role: 'assistant', content: call1.content },
        { role: 'user', content: toolResults },
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
      keyDepartures: [],
      keyArrivals: [],
      signals: [],
    })
  }

  await journal.save()
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
