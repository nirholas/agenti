# LLMs Forge - Phase 2: Agent Task Distribution

**Project:** llms-forge (llm.energy)  
**Created by:** nich ([x.com/nichxbt](https://x.com/nichxbt) | [github.com/nirholas](https://github.com/nirholas))  
**Goal:** Implement caching, rate limiting, site directory, batch processing, UI polish, and technical debt cleanup.

---

## Quick Reference - Agent Assignments

| Agent | File | Focus |
|-------|------|-------|
| Agent 1 | [agent-6-caching-ratelimit.md](agent-6-caching-ratelimit.md) | Caching, Rate Limiting, Validation |
| Agent 2 | [agent-7-directory-analytics.md](agent-7-directory-analytics.md) | Site Directory, Analytics, Search/Discovery |
| Agent 3 | [agent-8-ui-polish.md](agent-8-ui-polish.md) | UI Polish, Syntax Highlighting, Mobile UX |
| Agent 4 | [agent-9-batch-export.md](agent-9-batch-export.md) | Batch Processing, Export Formats, llms.txt Generator |
| Agent 5 | [agent-10-testing-cleanup.md](agent-10-testing-cleanup.md) | Technical Debt, Testing, Code Deduplication |

## Execution Plan

```
[Parallel Phase 1]
  Agent 1 (Caching/Rate Limit) ----\
  Agent 3 (UI Polish) -------------+---> [Phase 2] Agent 5 (Testing/Cleanup)
  Agent 4 (Batch/Export) ---------/

[Parallel Phase 1]
  Agent 2 (Directory/Analytics) --------> [Phase 2] Agent 5 (Testing/Cleanup)
```

- **Agents 1, 2, 3, 4** can run in parallel (mostly independent)
- **Agent 5** runs last to integrate, test, and clean up

---

## AGENT 1: Caching, Rate Limiting & Validation

**Role:** Backend Infrastructure Engineer  
**Focus:** Add caching layer, rate limiting, and pre-validation for llms.txt existence

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. The current extraction API at `src/app/api/extract/route.ts` fetches llms.txt files on every request with no caching. This wastes bandwidth and could lead to abuse. You need to add infrastructure for production readiness.

### Tasks

#### 1. Implement In-Memory Cache with TTL

Create `src/lib/cache.ts`:

```typescript
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds (default: 5 minutes)
  maxEntries?: number // Maximum cache entries (default: 100)
}

class LRUCache<T> {
  // Implement LRU cache with:
  // - get(key: string): T | null
  // - set(key: string, value: T, ttl?: number): void
  // - has(key: string): boolean
  // - delete(key: string): void
  // - clear(): void
  // - stats(): { hits: number, misses: number, size: number }
}
```

Features:
- LRU eviction when max entries exceeded
- Per-entry TTL support
- Cache statistics for monitoring
- Normalize URLs as cache keys (remove trailing slashes, lowercase host)

#### 2. Implement Rate Limiting

Create `src/lib/rate-limiter.ts`:

```typescript
interface RateLimitConfig {
  windowMs: number // Time window in ms (default: 60000 = 1 minute)
  maxRequests: number // Max requests per window (default: 30)
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Use IP-based rate limiting
// Return headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

Implementation:
- Token bucket or sliding window algorithm
- IP-based limiting (get IP from `x-forwarded-for` header for Vercel)
- Return 429 Too Many Requests when exceeded
- Include rate limit headers in all responses

#### 3. Add Pre-Validation Endpoint

Create `src/app/api/validate/route.ts`:

```typescript
// HEAD request to check if llms.txt exists without downloading
// Returns: { exists: boolean, type: 'full' | 'standard' | null, size?: number }
```

This allows the frontend to validate before starting extraction.

#### 4. Update Extract API

Modify `src/app/api/extract/route.ts`:
- Check cache first before fetching
- Apply rate limiting middleware
- Add cache control headers to response
- Store successful extractions in cache

#### 5. Add Cache Management Endpoint (Optional)

Create `src/app/api/cache/route.ts`:
- GET: Return cache statistics
- DELETE: Clear cache (protected, internal only)

### Response Headers to Add

```typescript
// On all extract responses:
{
  'X-Cache': 'HIT' | 'MISS',
  'X-Cache-TTL': number, // seconds remaining
  'X-RateLimit-Limit': number,
  'X-RateLimit-Remaining': number,
  'X-RateLimit-Reset': number, // Unix timestamp
  'Cache-Control': 'public, max-age=300', // 5 minutes
}
```

### Files to Create/Modify
- `src/lib/cache.ts` - new file
- `src/lib/rate-limiter.ts` - new file
- `src/app/api/validate/route.ts` - new file
- `src/app/api/extract/route.ts` - modify to use cache and rate limiter
- `src/app/api/cache/route.ts` - new file (optional)

### Technical Requirements
- No external dependencies (pure TypeScript implementation)
- Thread-safe for serverless environment
- Graceful degradation if cache fails
- Comprehensive error handling
- TypeScript strict mode compliant

---

## AGENT 2: Site Directory & Analytics

**Role:** Full-Stack Engineer  
**Focus:** Build a directory of llms.txt-compatible sites and track usage analytics

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. Users don't know which sites support llms.txt. Build a discovery feature that shows known compatible sites and tracks which sites are most popular.

### Tasks

#### 1. Create Site Directory Data

Create `src/data/sites.ts`:

```typescript
export interface SiteEntry {
  id: string
  name: string
  url: string
  category: 'ai' | 'developer-tools' | 'documentation' | 'cloud' | 'other'
  description: string
  llmsTxtType: 'full' | 'standard'
  verified: boolean
  lastChecked?: string
  favicon?: string
}

export const KNOWN_SITES: SiteEntry[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    url: 'https://docs.anthropic.com',
    category: 'ai',
    description: 'Claude AI documentation',
    llmsTxtType: 'full',
    verified: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://docs.stripe.com',
    category: 'developer-tools',
    description: 'Payment processing documentation',
    llmsTxtType: 'full',
    verified: true,
  },
  // Add 10-15 more known sites
]
```

#### 2. Create Directory Page

Create `src/app/directory/page.tsx`:

Features:
- Grid/list view of known llms.txt sites
- Filter by category
- Search by name
- Show verification status
- Click to extract or visit site
- "Suggest a site" button/form

Design:
- Consistent with existing dark theme
- Use Lucide icons for categories
- Responsive grid layout
- Hover states showing site details

#### 3. Create Directory Components

Create `src/components/directory/`:
- `SiteCard.tsx` - Individual site card with name, description, category badge
- `SiteGrid.tsx` - Grid container with filtering
- `CategoryFilter.tsx` - Category filter buttons
- `SearchBar.tsx` - Search input for filtering sites

#### 4. Implement Analytics Tracking

Create `src/lib/analytics.ts`:

```typescript
interface ExtractionEvent {
  url: string
  host: string
  timestamp: number
  success: boolean
  documentCount?: number
  totalTokens?: number
  processingTime?: number
  cached?: boolean
}

// Store analytics in-memory with periodic aggregation
// Track: total extractions, popular sites, success rate, avg processing time
```

Create `src/app/api/analytics/route.ts`:
- POST: Record extraction event (called from extract API)
- GET: Return aggregated stats (for display)

#### 5. Add Analytics Display

Update `src/components/Stats.tsx` to show real-time stats:
- Total extractions today
- Most popular sites (top 5)
- Success rate
- Average processing time

Or create a new `src/app/stats/page.tsx` for detailed analytics.

#### 6. Site Submission Endpoint

Create `src/app/api/sites/suggest/route.ts`:
- POST: Accept site suggestion { url, name, description }
- Validate URL format
- Check if llms.txt exists
- Store for review (in-memory for now, could be file-based)

### UI Components Needed

```
/directory
├── Header with search
├── Category filters (All, AI, Developer Tools, Documentation, Cloud)
├── Site grid
│   └── SiteCard (favicon, name, description, category, extract button)
└── "Know a site? Suggest it" CTA
```

### Files to Create/Modify
- `src/data/sites.ts` - new file
- `src/app/directory/page.tsx` - new file
- `src/components/directory/SiteCard.tsx` - new file
- `src/components/directory/SiteGrid.tsx` - new file
- `src/components/directory/CategoryFilter.tsx` - new file
- `src/lib/analytics.ts` - new file
- `src/app/api/analytics/route.ts` - new file
- `src/app/api/sites/suggest/route.ts` - new file
- `src/components/Stats.tsx` - modify for real stats
- `src/components/Header.tsx` - add Directory link

### Technical Requirements
- No database required (in-memory/file storage)
- Responsive design matching existing theme
- Lucide icons only
- Framer Motion animations
- TypeScript strict mode

---

## AGENT 3: UI Polish, Syntax Highlighting & Mobile UX

**Role:** Frontend/UI Engineer  
**Focus:** Polish remaining UI issues, add syntax highlighting, improve mobile experience

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. The UI needs final polish: syntax highlighting for previews, mobile responsiveness improvements, and any remaining emoji replacements.

### Tasks

#### 1. Add Syntax Highlighting for Preview

Install and configure syntax highlighting:

```bash
pnpm add react-syntax-highlighter @types/react-syntax-highlighter
# OR use shiki for better performance:
pnpm add shiki
```

Update `src/components/OutputSection.tsx`:
- Wrap markdown content in syntax highlighter
- Support for code blocks within markdown
- Dark theme matching site colors
- Line numbers (optional toggle)
- Copy code button for code blocks

Create `src/components/CodeBlock.tsx`:

```typescript
interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  filename?: string
}
```

#### 2. Improve Preview Tab

Update the Preview tab in `OutputSection.tsx`:
- Syntax-highlighted markdown rendering
- Document selector dropdown showing all files
- Side-by-side or tabbed view for comparing documents
- Smooth scrolling to sections
- Table of contents for long documents

#### 3. Mobile UX Improvements

Audit and fix mobile issues:

**Header.tsx:**
- Hamburger menu for mobile
- Collapsible navigation
- Touch-friendly tap targets (min 44px)

**OutputSection.tsx:**
- Stack tabs vertically on mobile
- Full-width download buttons
- Scrollable document list
- Swipe gestures for tab switching (optional)

**UrlInput.tsx:**
- Full-width input on mobile
- Larger submit button
- Better error message display

**General:**
- Test at 320px, 375px, 414px widths
- Ensure no horizontal scrolling
- Readable font sizes (min 14px)

#### 4. Emoji Audit and Cleanup

Search for any remaining emojis in components:
- Replace with appropriate Lucide icons
- Ensure consistent icon sizing

Files to check:
- All components in `src/components/`
- All pages in `src/app/`
- Any utility files with user-facing messages

#### 5. Loading States and Micro-interactions

Improve loading experience:
- Skeleton loaders for document list
- Progress indicator for large extractions
- Smooth transitions between states
- Hover/focus states on all interactive elements

Create `src/components/Skeleton.tsx`:

```typescript
// Reusable skeleton components for loading states
export function DocumentListSkeleton() { ... }
export function PreviewSkeleton() { ... }
```

#### 6. Accessibility Improvements

- Ensure all interactive elements have focus states
- Add aria-labels where needed
- Keyboard navigation for tabs and document selection
- Screen reader announcements for state changes

### Files to Create/Modify
- `src/components/CodeBlock.tsx` - new file
- `src/components/Skeleton.tsx` - new file
- `src/components/OutputSection.tsx` - major updates
- `src/components/Header.tsx` - mobile menu
- `src/components/UrlInput.tsx` - mobile improvements
- `src/app/globals.css` - any needed mobile styles

### Technical Requirements
- React Syntax Highlighter or Shiki for highlighting
- Tailwind CSS for responsive design
- Framer Motion for animations
- No emojis anywhere
- WCAG 2.1 AA compliance for accessibility
- Test on actual mobile devices or device emulator

---

## AGENT 4: Batch Processing, Export Formats & llms.txt Generator

**Role:** Full-Stack Engineer  
**Focus:** Enable batch URL processing, multiple export formats, and help users create their own llms.txt

### Tasks

#### 1. Batch Processing UI

Create `src/app/batch/page.tsx`:

Features:
- Textarea for multiple URLs (one per line)
- Or file upload (.txt file with URLs)
- Process all URLs with progress indicator
- Show results for each URL (success/fail)
- Download all as single mega-ZIP or individual ZIPs

Create `src/components/batch/`:
- `BatchInput.tsx` - URL list input with validation
- `BatchProgress.tsx` - Progress for multiple extractions
- `BatchResults.tsx` - Results grid showing status per URL

#### 2. Batch Processing API

Create `src/app/api/batch/route.ts`:

```typescript
// POST: Accept array of URLs
interface BatchRequest {
  urls: string[]
  options?: {
    format?: 'zip-per-site' | 'single-zip'
    includeAgentGuide?: boolean
  }
}

interface BatchResponse {
  results: Array<{
    url: string
    success: boolean
    error?: string
    data?: ExtractionResult
  }>
  stats: {
    total: number
    successful: number
    failed: number
    totalTokens: number
  }
}
```

Implementation:
- Process URLs in parallel (max 5 concurrent)
- Respect rate limits
- Return partial results on timeout
- Support cancellation

#### 3. Export Format Options

Update extraction to support multiple formats:

Create `src/lib/exporters/`:
- `markdown.ts` - Current markdown export (default)
- `json.ts` - Export as structured JSON
- `yaml.ts` - Export as YAML
- `html.ts` - Export as static HTML site

**JSON Export Format:**
```json
{
  "meta": {
    "source": "https://docs.example.com",
    "extractedAt": "2026-01-16T...",
    "version": "1.0"
  },
  "sections": [
    {
      "title": "Getting Started",
      "content": "...",
      "tokens": 1234
    }
  ]
}
```

**YAML Export Format:**
```yaml
meta:
  source: https://docs.example.com
  extractedAt: 2026-01-16T...
sections:
  - title: Getting Started
    content: |
      ...
```

#### 4. Update Download UI

Modify `src/components/OutputSection.tsx` and `src/components/DownloadPanel.tsx`:
- Add format selector dropdown (Markdown, JSON, YAML)
- Update download buttons to use selected format
- Show format-specific file extensions

#### 5. llms.txt Generator Tool

Create `src/app/generator/page.tsx`:

Help users create their own llms.txt file:

Features:
- Form wizard with steps:
  1. Basic info (site name, description, URL)
  2. Add sections (title, content for each)
  3. Preview generated llms.txt
  4. Download or copy

Components:
- `src/components/generator/GeneratorWizard.tsx`
- `src/components/generator/SectionEditor.tsx`
- `src/components/generator/Preview.tsx`

Output:
```markdown
# {Site Name}

> {Description}

## {Section 1 Title}

{Section 1 Content}

## {Section 2 Title}

{Section 2 Content}
```

Include:
- Live preview as user types
- Section reordering (drag and drop)
- Templates for common doc structures
- Validation and tips

#### 6. Update API for Format Support

Modify `src/app/api/extract/route.ts`:
- Accept `format` query parameter
- Return appropriate content type
- Support `Accept` header for format negotiation

Modify `src/app/api/download/route.ts`:
- Support different formats in ZIP
- Option to include multiple formats in one ZIP

### Files to Create/Modify
- `src/app/batch/page.tsx` - new file
- `src/components/batch/BatchInput.tsx` - new file
- `src/components/batch/BatchProgress.tsx` - new file
- `src/components/batch/BatchResults.tsx` - new file
- `src/app/api/batch/route.ts` - new file
- `src/lib/exporters/markdown.ts` - new file
- `src/lib/exporters/json.ts` - new file
- `src/lib/exporters/yaml.ts` - new file
- `src/app/generator/page.tsx` - new file
- `src/components/generator/GeneratorWizard.tsx` - new file
- `src/components/generator/SectionEditor.tsx` - new file
- `src/components/OutputSection.tsx` - add format selector
- `src/app/api/extract/route.ts` - add format support
- `src/components/Header.tsx` - add Batch and Generator links

### Technical Requirements
- Install `js-yaml` for YAML export: `pnpm add js-yaml @types/js-yaml`
- Parallel processing with concurrency limits
- Progress events using Server-Sent Events or polling
- Mobile-friendly batch interface
- Accessible drag-and-drop for generator

---

## AGENT 5: Technical Debt, Testing & Code Cleanup

**Role:** DevOps / QA Engineer  
**Focus:** Deduplicate code, add tests, clean up technical debt, ensure production readiness

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. After the other agents complete their work, clean up technical debt and add tests to ensure reliability.

### Tasks

#### 1. Deduplicate Parser Code

Currently duplicated:
- `src/lib/parser.ts` (web app)
- `mcp-server/src/parser.ts` (MCP server)

Solution:
- Create shared package or move to common location
- Update imports in both locations
- Ensure both use the same parsing logic

Option A - Shared folder:
```
llms-forge/
  shared/
    parser.ts
    types.ts
    generator.ts
  src/ (imports from ../shared)
  mcp-server/src/ (imports from ../../shared)
```

Option B - Workspace package:
```
llms-forge/
  packages/
    core/
      src/parser.ts
      src/types.ts
      package.json
  src/ (imports from @llm-energy/core)
  mcp-server/ (imports from @llm-energy/core)
```

#### 2. Add Unit Tests

Create `src/__tests__/` with Jest or Vitest:

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

Tests to write:

**Parser tests** (`parser.test.ts`):
- Parse empty content
- Parse content with no headers
- Parse content with ## headers
- Parse content with ### headers
- Handle malformed markdown
- Slugify function edge cases

**Cache tests** (`cache.test.ts`):
- Set and get values
- TTL expiration
- LRU eviction
- Cache statistics

**Rate limiter tests** (`rate-limiter.test.ts`):
- Allow requests within limit
- Block requests over limit
- Reset after window expires
- Multiple IPs tracked separately

**Exporter tests** (`exporters.test.ts`):
- JSON export format
- YAML export format
- Markdown export format

#### 3. Add Integration Tests

Create `src/__tests__/integration/`:

**API tests** (`extract.test.ts`):
- Successful extraction
- Invalid URL handling
- Rate limiting behavior
- Cache behavior

**E2E tests** (optional, using Playwright):
- Enter URL and extract
- Download individual file
- Download ZIP
- Batch processing flow

#### 4. Setup Test Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Update `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### 5. Code Quality Improvements

Run and fix:
```bash
pnpm lint
pnpm build
```

Cleanup tasks:
- Remove unused imports
- Fix TypeScript `any` types
- Add JSDoc comments to public functions
- Ensure consistent error handling
- Add input validation where missing

#### 6. Performance Audit

Check and optimize:
- Bundle size analysis (`pnpm build` output)
- Remove unused dependencies
- Lazy load heavy components (syntax highlighter)
- Image optimization if any
- API response times

#### 7. Documentation Updates

Update documentation:
- `README.md` - reflect all new features
- `docs-site/` - add pages for new features
- API documentation for new endpoints
- Add CHANGELOG.md entry for Phase 2

#### 8. Final Integration Testing

After all agents complete:
- Run full test suite
- Manual testing of all features
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile testing
- Performance testing with Lighthouse

#### 9. Pre-deployment Checklist

```markdown
## Pre-deployment Checklist

### Build
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes

### Features
- [ ] Single URL extraction works
- [ ] Batch processing works
- [ ] All export formats work
- [ ] llms.txt generator works
- [ ] Site directory loads
- [ ] Analytics tracking works
- [ ] Rate limiting works
- [ ] Caching works

### UI
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Dark theme consistent
- [ ] No emojis visible
- [ ] Loading states work
- [ ] Error states work

### Performance
- [ ] Lighthouse score > 90
- [ ] First contentful paint < 1.5s
- [ ] API response < 2s (cached)

### Security
- [ ] Rate limiting active
- [ ] No sensitive data exposed
- [ ] Input validation in place
```

### Files to Create/Modify
- `shared/` or `packages/core/` - new shared code location
- `src/__tests__/` - new test directory
- `vitest.config.ts` - new file
- `src/__tests__/setup.ts` - test setup file
- `src/__tests__/parser.test.ts` - new file
- `src/__tests__/cache.test.ts` - new file
- `src/__tests__/rate-limiter.test.ts` - new file
- `package.json` - add test scripts
- `README.md` - update documentation
- `CHANGELOG.md` - add Phase 2 entry

### Technical Requirements
- Vitest for testing
- 80%+ code coverage target
- All tests must pass before deployment
- No TypeScript errors
- No ESLint errors

---

## Coordination Notes

### Execution Order

**Phase 1 (Parallel):**
- Agent 1: Caching & Rate Limiting
- Agent 2: Directory & Analytics  
- Agent 3: UI Polish
- Agent 4: Batch & Export

**Phase 2 (Sequential):**
- Agent 5: Testing & Cleanup (after Phase 1 complete)

### Shared Types

All agents should use types from `src/types/index.ts`. Add new types there:

```typescript
// Add to src/types/index.ts

// Caching types
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// Rate limiting types
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Site directory types
export interface SiteEntry {
  id: string
  name: string
  url: string
  category: 'ai' | 'developer-tools' | 'documentation' | 'cloud' | 'other'
  description: string
  llmsTxtType: 'full' | 'standard'
  verified: boolean
}

// Analytics types
export interface ExtractionEvent {
  url: string
  host: string
  timestamp: number
  success: boolean
  documentCount?: number
  totalTokens?: number
  cached?: boolean
}

// Batch types
export interface BatchRequest {
  urls: string[]
  format?: 'markdown' | 'json' | 'yaml'
}

export interface BatchResult {
  url: string
  success: boolean
  error?: string
  data?: ExtractionResult
}

// Export format types
export type ExportFormat = 'markdown' | 'json' | 'yaml' | 'html'
```

### Navigation Updates

All agents adding new pages should coordinate on Header.tsx:

```typescript
const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/directory', label: 'Directory' },    // Agent 2
  { href: '/batch', label: 'Batch' },            // Agent 4
  { href: '/generator', label: 'Generator' },    // Agent 4
  { href: '/stats', label: 'Stats' },            // Agent 2 (optional)
]
```

### Brand Guidelines

- Created by: nich
- Twitter/X: x.com/nichxbt
- GitHub: github.com/nirholas
- Tone: Professional but approachable
- No emojis - Lucide icons only
- Color scheme: Dark with cyber-green (#00ff88) and cyber-blue accents
- Primary font: System font stack

---

*Ship it! 🚀* (okay, one emoji for the prompt file)
