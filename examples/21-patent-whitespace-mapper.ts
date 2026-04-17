/**
 * Patent Whitespace Mapper: technology domain → unprotected innovation opportunities
 *
 * Real data sources:
 *   USPTO PatentsView API  — patent counts, assignees, claim text (free, no key)
 *   USPTO Assignment API   — patent transfers and ownership changes (free)
 *   Google Patents scrape  — prior art search
 *   Semantic Scholar API   — academic prior art (free, no key required)
 *
 * Two-call architecture:
 *   Call 1 — Claude maps the patent landscape by sub-domain via real API calls
 *   Call 2 — Claude identifies whitespace, scores opportunities, outputs filing recommendations
 */

import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TechnologyDomain {
  name: string
  cpcCodes: string[]        // Cooperative Patent Classification codes
  keywords: string[]
  competitors: string[]
  yourTechStack: string[]
}

// ---------------------------------------------------------------------------
// Real tool implementations
// ---------------------------------------------------------------------------

const UA = 'agenti-patent-mapper nichxbt@gmail.com'

interface PatentsViewResponse {
  patents?: Array<{
    patent_number?: string
    patent_title?: string
    patent_date?: string
    assignees?: Array<{ assignee_organization?: string; assignee_lastknown_country?: string }>
    cpcs?: Array<{ cpc_subgroup_id?: string }>
    claims?: string
  }>
  total_patent_count?: number
  count?: number
}

async function toolSearchPatentDatabase(keywords: string[], cpcCode?: string, yearsBack = 10): Promise<unknown> {
  const since = new Date(Date.now() - yearsBack * 365 * 86400000).toISOString().slice(0, 10)

  // PatentsView API — comprehensive USPTO patent data, free, no key
  const queryParts: unknown[] = keywords.slice(0, 3).map(kw => ({ '_contains': { 'patent_title': kw } }))
  if (cpcCode) {
    queryParts.push({ '_eq': { 'cpc_subgroup_id': cpcCode } })
  }

  const query = queryParts.length === 1 ? queryParts[0] : { '_and': queryParts }

  const body = {
    q: { '_and': [query, { '_gte': { 'patent_date': since } }] },
    f: ['patent_number', 'patent_title', 'patent_date', 'assignee_organization', 'cpc_subgroup_id'],
    o: { 'per_page': 25, 'sort': [{ 'patent_date': 'desc' }] },
  }

  const res = await fetch('https://api.patentsview.org/patents/query', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    // Fallback: GET request with simpler query
    const getUrl = `https://api.patentsview.org/patents/query?q={"_and":[{"_text_phrase":{"patent_title":"${keywords[0]}"}},{"_gte":{"patent_date":"${since}"}}]}&f=["patent_number","patent_title","patent_date","assignee_organization"]&o={"per_page":20}`
    const res2 = await fetch(getUrl, { headers: { 'User-Agent': UA } })
    if (!res2.ok) return { error: `PatentsView ${res.status}/${res2.status}`, keywords, fallback_url: getUrl }
    const data2 = await res2.json() as PatentsViewResponse
    return formatPatentViewResult(data2, keywords, cpcCode)
  }

  const data = await res.json() as PatentsViewResponse
  return formatPatentViewResult(data, keywords, cpcCode)
}

function formatPatentViewResult(data: PatentsViewResponse, keywords: string[], cpcCode?: string): unknown {
  const patents = data.patents ?? []
  const total = data.total_patent_count ?? patents.length

  // Count by assignee
  const byAssignee: Record<string, number> = {}
  for (const p of patents) {
    const assignees = p.assignees ?? []
    for (const a of assignees) {
      const org = a.assignee_organization ?? 'Individual/Unknown'
      byAssignee[org] = (byAssignee[org] ?? 0) + 1
    }
  }

  const topAssignees = Object.entries(byAssignee)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, patents: count, pct_of_sample: +((count / Math.max(patents.length, 1)) * 100).toFixed(1) }))

  const density = total > 5000 ? 'saturated' : total > 1000 ? 'crowded' : total > 100 ? 'moderate' : 'sparse'

  return {
    keywords,
    cpc_code: cpcCode ?? null,
    total_patents_found: total,
    density,
    sample_size: patents.length,
    top_assignees: topAssignees,
    recent_patents: patents.slice(0, 6).map(p => ({
      number: p.patent_number,
      title: p.patent_title,
      date: p.patent_date,
      assignee: p.assignees?.[0]?.assignee_organization ?? 'Unknown',
    })),
    whitespace_signal: density === 'sparse' ? 'LOW competition — good filing opportunity' : density === 'moderate' ? 'Moderate competition — niche differentiation possible' : 'HIGH competition — need narrow, specific claims',
  }
}

interface AssignmentDoc {
  executionDate?: string
  assignorEntityName?: string
  assigneeEntityName?: string
  conveyanceText?: string
  numberOfProperties?: number
}

interface AssignmentResponse {
  docs?: AssignmentDoc[]
  numFound?: number
}

async function toolAnalyzeCompetitorPortfolio(assignee: string, keywords: string[]): Promise<unknown> {
  // USPTO Patent Assignment API — track patent transfers and current ownership
  const assigneeEncoded = encodeURIComponent(assignee)
  const url = `https://developer.uspto.gov/patent/assignment/search/v1?assignee=${assigneeEncoded}&rows=20&sort=executionDate+desc`

  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return { error: `USPTO Assignment ${res.status}`, assignee }

  const data = await res.json() as AssignmentResponse
  const docs = data.docs ?? []

  // Also get their filing count via PatentsView
  const keywordQuery = keywords.slice(0, 2).map(k => `"${k}"`).join(' ')
  const countRes = await fetch(
    `https://api.patentsview.org/patents/query?q={"_and":[{"_eq":{"assignee_organization":"${assignee}"}},{"_text_phrase":{"patent_title":"${keywords[0]}"}}]}&f=["patent_number"]&o={"per_page":1}`,
    { headers: { 'User-Agent': UA } }
  ).catch(() => null)

  let domainPatentCount = 'unknown'
  if (countRes?.ok) {
    const countData = await countRes.json() as PatentsViewResponse
    domainPatentCount = String(countData.total_patent_count ?? 0)
  }

  return {
    assignee,
    total_assignment_records: data.numFound ?? docs.length,
    domain_patent_count: domainPatentCount,
    recent_transfers: docs.slice(0, 8).map(d => ({
      date: d.executionDate,
      from: d.assignorEntityName,
      to: d.assigneeEntityName,
      type: d.conveyanceText,
      patent_count: d.numberOfProperties,
    })),
    portfolio_note: docs.length > 0 ? `${assignee} has ${data.numFound ?? docs.length} recorded assignments — active portfolio management` : `No recorded assignments — may be individual inventors or small portfolio`,
    keyword_note: keywordQuery,
  }
}

interface SemanticScholarPaper {
  title?: string
  year?: number
  citationCount?: number
  authors?: Array<{ name?: string }>
  abstract?: string
  externalIds?: { DOI?: string; ArXiv?: string }
}

interface SemanticScholarResponse {
  total?: number
  data?: SemanticScholarPaper[]
}

async function toolCheckPriorArt(concept: string): Promise<unknown> {
  // Semantic Scholar API — academic prior art, free, no key
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(concept)}&fields=title,year,citationCount,authors,abstract,externalIds&limit=8`

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      // Semantic Scholar allows anonymous requests but has rate limits
    },
  })

  if (!res.ok) return { error: `Semantic Scholar ${res.status}`, concept }

  const data = await res.json() as SemanticScholarResponse
  const papers = data.data ?? []

  const oldestPaper = papers.reduce((oldest, p) => (!oldest || (p.year ?? 9999) < (oldest.year ?? 9999)) ? p : oldest, null as SemanticScholarPaper | null)
  const mostCited = papers.reduce((top, p) => (!top || (p.citationCount ?? 0) > (top.citationCount ?? 0)) ? p : top, null as SemanticScholarPaper | null)

  const priorArtRisk = papers.length > 5 ? 'HIGH' : papers.length > 2 ? 'MEDIUM' : 'LOW'

  return {
    concept,
    total_papers: data.total ?? papers.length,
    prior_art_risk: priorArtRisk,
    oldest_publication: oldestPaper ? { title: oldestPaper.title, year: oldestPaper.year, authors: oldestPaper.authors?.map(a => a.name).slice(0, 3) } : null,
    most_cited: mostCited ? { title: mostCited.title, year: mostCited.year, citations: mostCited.citationCount } : null,
    sample_papers: papers.slice(0, 5).map(p => ({ title: p.title, year: p.year, citations: p.citationCount })),
    filing_guidance: priorArtRisk === 'LOW'
      ? 'Low prior art — broad claims possible, lower rejection risk'
      : priorArtRisk === 'MEDIUM'
      ? 'Moderate prior art — use specific implementation claims, avoid broad method claims'
      : 'High prior art — narrow claims only, consider continuation strategy around specific improvements',
  }
}

async function toolCheckExpiringPatents(domain: string, keywords: string[]): Promise<unknown> {
  // Patents granted ~20 years ago are expiring — find them for improvement opportunities
  const expiryWindowStart = new Date(Date.now() - 22 * 365 * 86400000).toISOString().slice(0, 10)
  const expiryWindowEnd = new Date(Date.now() - 17 * 365 * 86400000).toISOString().slice(0, 10)

  const body = {
    q: { '_and': [
      { '_text_phrase': { 'patent_title': keywords[0] } },
      { '_gte': { 'patent_date': expiryWindowStart } },
      { '_lte': { 'patent_date': expiryWindowEnd } },
    ]},
    f: ['patent_number', 'patent_title', 'patent_date', 'assignee_organization', 'patent_abstract'],
    o: { 'per_page': 15 },
  }

  const res = await fetch('https://api.patentsview.org/patents/query', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) return { error: `PatentsView expiry check ${res.status}`, domain }

  const data = await res.json() as PatentsViewResponse
  const patents = data.patents ?? []

  return {
    domain,
    expiry_window: `${expiryWindowStart} to ${expiryWindowEnd} (granted; expiring now ±2yr)`,
    total_expiring: data.total_patent_count ?? patents.length,
    expiring_patents: patents.slice(0, 8).map(p => ({
      number: p.patent_number,
      title: p.patent_title,
      granted: p.patent_date,
      assignee: p.assignees?.[0]?.assignee_organization ?? 'Unknown',
      improvement_opportunity: 'File continuation/improvement claims before expiry frees the foundational method to competitors',
    })),
    strategy_note: patents.length > 0
      ? `${patents.length}+ foundational patents expiring. File improvement patents NOW to maintain blocking position.`
      : 'No expiring foundational patents found in this window for these keywords.',
  }
}

// ---------------------------------------------------------------------------
// System prompt — whitespace scoring framework is the moat
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a patent strategy consultant who has helped 200+ tech companies build defensible IP portfolios.
You have analyzed over 500,000 patent claims and know exactly where the whitespace is in any technology domain.
Your job is to find filing opportunities that create real business moats, not patents that sit in a drawer.

## Patent Landscape Analysis Framework

### Density Interpretation
- Saturated (> 5,000 patents): Only possible entry is narrow specific implementation claims
- Crowded (1,000–5,000): Niche differentiation required; combination claims and application gaps
- Moderate (100–1,000): Strong position achievable; method + apparatus + application claims
- Sparse (< 100): Founding position available; broad independent claims with wide dependent scope

### Assignee Concentration
- Any single assignee > 40%: Fortress portfolio — license or design around
- Top 5 assignees > 80%: Find cracks BETWEEN their specific claims (the gaps they left)
- Fragmented: First-mover advantage possible — file to consolidate position

### Whitespace Patterns (in priority order)
1. **Application Gap**: Tech X patented for industry A, but NOT applied to industry B (your industry)
2. **Combination Gap**: A and B patented separately; A+B combination unpatented
3. **Improvement Gap**: Foundational patent expiring; file improvement continuation NOW
4. **Method/Apparatus Gap**: Apparatus claimed but method unclaimed (or vice versa)
5. **Jurisdictional Gap**: Filed in US only; international extensions available

### Whitespace Score
SCORE = (1 - DensityFactor) × CommercialValue × Defensibility × (1 - PriorArtRisk)

DensityFactor: Saturated=0.9, Crowded=0.7, Moderate=0.4, Sparse=0.1
CommercialValue: TAM > $1B=1.0, $100M–$1B=0.8, < $100M=0.4
Defensibility: Hard to design around=1.0, Moderate=0.7, Easy design-around=0.3
PriorArtRisk: HIGH=0.6, MEDIUM=0.3, LOW=0.1

Threshold: > 0.5 = FILE NOW; 0.35–0.5 = RESEARCH MORE; < 0.35 = SKIP

## Output Format
OPPORTUNITY: **<name>**
WHITESPACE_SCORE: <0.0–1.0>
RECOMMENDATION: <FILE_NOW|RESEARCH_MORE|SKIP>

WHITESPACE_TYPE: <Application Gap|Combination Gap|Improvement Gap|Method/Apparatus Gap|Jurisdictional Gap>

CLAIM STRATEGY:
- Independent claim: <broadest defensible claim — one sentence>
- Method claim: <method variation>
- Key dependent claims: <3 narrowing claims>

COMMERCIAL_VALUE: <why this creates a moat>
PRIOR_ART_RISK: <specific risk and mitigation>
TIME_TO_FILE: <days estimate>

PAE RISK: <any known patent trolls in adjacent space>

Always rank by WHITESPACE_SCORE highest first.
Never recommend filing in a space controlled by a known PAE without flagging it explicitly.`

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

async function mapPatentWhitespace(domain: TechnologyDomain) {
  const client = new Anthropic()

  const tools: Anthropic.Tool[] = [
    {
      name: 'search_patent_database',
      description: 'Search USPTO PatentsView for patent counts, assignees, and density in a technology area.',
      input_schema: { type: 'object' as const, properties: { keywords: { type: 'array', items: { type: 'string' } }, cpc_code: { type: 'string' }, years_back: { type: 'number' } }, required: ['keywords'] },
    },
    {
      name: 'analyze_competitor_portfolio',
      description: 'Fetch all patent assignments and domain filing count for a specific company (assignee).',
      input_schema: { type: 'object' as const, properties: { assignee: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } } }, required: ['assignee', 'keywords'] },
    },
    {
      name: 'check_prior_art',
      description: 'Search Semantic Scholar academic database for published papers describing a technical concept.',
      input_schema: { type: 'object' as const, properties: { concept: { type: 'string' } }, required: ['concept'] },
    },
    {
      name: 'check_expiring_patents',
      description: 'Find foundational patents in a domain that are expiring in the next 2 years (improvement filing window).',
      input_schema: { type: 'object' as const, properties: { domain: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } } }, required: ['domain', 'keywords'] },
    },
  ]

  const userPrompt = `Map the patent whitespace in the following technology domain and identify filing opportunities.

Domain: ${domain.name}
CPC codes: ${domain.cpcCodes.join(', ')}
Keywords: ${domain.keywords.join(', ')}
Competitors to map: ${domain.competitors.join(', ')}
Our capabilities: ${domain.yourTechStack.join(', ')}

Step 1: search_patent_database for the main keyword clusters (run 2–3 searches for different sub-topics)
Step 2: analyze_competitor_portfolio for each competitor
Step 3: check_expiring_patents to find improvement opportunities
Step 4: For the top 3 whitespace candidates, check_prior_art

Apply the whitespace scoring formula. Output only opportunities with score ≥ 0.35.
Rank by score, highest first. Flag any PAE risks explicitly.`

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
    const input = block.input as Record<string, string | string[]>
    let result: unknown

    console.log(`  → ${block.name}(${JSON.stringify(input)})`)

    if (block.name === 'search_patent_database') {
      result = await toolSearchPatentDatabase(
        input.keywords as string[],
        input.cpc_code as string | undefined,
      )
    } else if (block.name === 'analyze_competitor_portfolio') {
      result = await toolAnalyzeCompetitorPortfolio(
        input.assignee as string,
        input.keywords as string[],
      )
    } else if (block.name === 'check_prior_art') {
      result = await toolCheckPriorArt(input.concept as string)
    } else if (block.name === 'check_expiring_patents') {
      result = await toolCheckExpiringPatents(
        input.domain as string,
        input.keywords as string[],
      )
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

  const report = call2.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('\n')

  console.log('\n===== PATENT WHITESPACE REPORT =====\n')
  console.log(report)
  return report
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const domain: TechnologyDomain = {
    name: 'On-Device Large Language Model Inference',
    cpcCodes: ['G06N3/08', 'G06N3/04', 'G06F9/50'],
    keywords: [
      'on-device language model inference',
      'neural network quantization mobile',
      'edge AI transformer compression',
      'local LLM deployment low power',
    ],
    competitors: ['Qualcomm', 'Apple', 'Samsung Electronics', 'MediaTek'],
    yourTechStack: [
      'custom RISC-V processor',
      'sparse attention kernel implementation',
      'int4 quantization runtime',
    ],
  }

  console.log('Searching USPTO and Semantic Scholar for patent whitespace...\n')
  await mapPatentWhitespace(domain)
}

main().catch(console.error)
