# LLMs Forge - Agent Task Distribution

**Project:** llms-forge  
**Created by:** nich ([x.com/nichxbt](https://x.com/nichxbt) | [github.com/nirholas](https://github.com/nirholas))  
**Goal:** Ship a complete, professional documentation extraction tool that finds llms.txt/llms-full.txt files and compiles them into downloadable markdown documents.

---

## Quick Reference - Individual Prompt Files

Each agent has a detailed prompt file in the `prompts/` directory:

| Agent | File | Focus |
|-------|------|-------|
| Agent 1 | [prompts/agent-1-backend.md](prompts/agent-1-backend.md) | Backend API, document parsing, ZIP generation |
| Agent 2 | [prompts/agent-2-frontend.md](prompts/agent-2-frontend.md) | Download UI, file downloads, pro tip reveal |
| Agent 3 | [prompts/agent-3-ui-polish.md](prompts/agent-3-ui-polish.md) | Icons, landing page, remove fake claims |
| Agent 4 | [prompts/agent-4-docs.md](prompts/agent-4-docs.md) | Material for MkDocs documentation site |
| Agent 5 | [prompts/agent-5-deploy.md](prompts/agent-5-deploy.md) | Testing, fixes, Vercel deployment |

## Execution Plan

```
[Parallel]
  Agent 1 (Backend) ----\
  Agent 3 (UI Polish) ---+---> Agent 2 (Frontend) ---> Agent 5 (Deploy)
  Agent 4 (Docs) -------/
```

- **Agents 1, 3, 4** can run in parallel (no dependencies)
- **Agent 2** should wait for Agent 1 (needs API response structure)
- **Agent 5** runs last (integration testing and deployment)

---

## AGENT 1: Backend API & Document Processing

**Role:** Backend Engineer  
**Focus:** Build the complete document extraction, parsing, and generation pipeline

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. This is a Next.js 14 app that extracts documentation from websites by fetching their `/llms.txt` or `/llms-full.txt` files. Currently the API at `src/app/api/extract/route.ts` only fetches the raw content. You need to make it actually useful.

### Tasks

1. **Update the extraction API** (`src/app/api/extract/route.ts`):
   - Fetch both `/llms.txt` and `/llms-full.txt` (try full first, fallback to regular)
   - Parse the content into logical sections based on markdown headers (##, ###)
   - Return structured data with individual documents

2. **Create document generation logic**:
   - Parse the raw llms content into individual markdown documents by section
   - Each major section (## header) becomes its own `.md` file
   - Generate clean filenames from section titles (e.g., "## Getting Started" -> "getting-started.md")
   - Generate `llms-full.md` - the complete consolidated document with proper formatting
   - Generate `AGENT-GUIDE.md` - a prompt file that tells AI agents what the documents contain and how to use them

3. **Create zip download endpoint** (`src/app/api/download/route.ts`):
   - Accept POST with documents array
   - Use JSZip or similar to create a zip bundle
   - Include: all individual .md files, llms-full.md, AGENT-GUIDE.md
   - Return as downloadable blob

4. **Update the response structure** to include:
   ```typescript
   interface ExtractionResult {
     url: string
     sourceUrl: string // the actual llms.txt URL that was fetched
     rawContent: string
     documents: Array<{
       filename: string
       title: string
       content: string
       tokens: number
     }>
     fullDocument: {
       filename: string
       content: string
       tokens: number
     }
     agentGuide: {
       filename: string
       content: string
     }
     stats: {
       totalTokens: number
       documentCount: number
       processingTime: number
     }
   }
   ```

5. **AGENT-GUIDE.md template** should include:
   - What these documents are and where they came from
   - List of all included files with descriptions
   - Instructions for AI agents on how to use the documentation
   - Recommended reading order
   - The source URL for reference

### Technical Requirements
- Install `jszip` for zip creation: `pnpm add jszip`
- Handle edge cases: empty content, malformed markdown, missing headers
- Keep processing time reasonable (no fake delays in production)
- Proper error handling with descriptive messages

### Files to Create/Modify
- `src/app/api/extract/route.ts` - complete rewrite
- `src/app/api/download/route.ts` - new file
- `src/lib/parser.ts` - new file for markdown parsing logic
- `src/lib/generator.ts` - new file for document generation

---

## AGENT 2: Frontend Output & Download UI

**Role:** Frontend Engineer  
**Focus:** Build the complete download experience with individual files and zip download

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. The OutputSection component at `src/components/OutputSection.tsx` currently shows fake download buttons. You need to make them work with the new API response structure.

### Tasks

1. **Update types** (`src/app/page.tsx` or create `src/types/index.ts`):
   - Update ExtractionResult interface to match new API response
   - Add proper types for documents array

2. **Rewrite OutputSection.tsx**:
   - Remove fake MCP server and API endpoint tabs (or make them optional/secondary)
   - Primary focus on the Download tab with:
     - List of all individual markdown files with download buttons
     - Each file shows: filename, title, token count, download button
     - "Download All as ZIP" prominent button
     - "Download llms-full.md" quick action
     - "Download AGENT-GUIDE.md" quick action

3. **Implement download functionality**:
   - Individual file download: create blob from content, trigger download
   - ZIP download: call `/api/download` endpoint, receive blob, trigger download
   - Show download progress for zip (loading state)

4. **Add the reveal message** after successful extraction:
   - After showing results, include a subtle info box that says:
   - "Pro tip: You can usually access this content directly by adding /llms-full.txt to the end of most documentation URLs."
   - Style it as a friendly tip, not mocking - we're educating users
   - Use an info icon (Lucide `Info` or `Lightbulb`)

5. **Preview tab improvements**:
   - Show full content with syntax highlighting
   - Allow switching between viewing individual documents
   - Proper scrolling and code formatting

6. **Polish the stats display**:
   - Show real stats: document count, total tokens, source URL
   - Remove fake "compression ratio" and fake metrics
   - Add "Source" link that opens the actual llms.txt URL

### Technical Requirements
- Use Lucide icons only (no emojis)
- Maintain the professional dark theme
- Smooth animations with Framer Motion
- Mobile responsive design
- Accessible download buttons

### Files to Create/Modify
- `src/components/OutputSection.tsx` - major rewrite
- `src/app/page.tsx` - update types
- `src/types/index.ts` - new file for shared types
- `src/lib/download.ts` - new file for download utilities

---

## AGENT 3: UI Polish, Icons & Landing Page

**Role:** UI/UX Engineer  
**Focus:** Professional polish, replace emojis with icons, improve landing page

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. The site has good bones but needs polish. Replace all emojis with professional Lucide icons. Ensure the landing page effectively communicates the value proposition.

### Tasks

1. **Icon audit and replacement**:
   - Search all components for emoji usage
   - Replace with appropriate Lucide icons
   - Ensure consistent icon sizing (w-5 h-5 for inline, w-6 h-6 for features)

2. **Update Hero.tsx**:
   - Professional headline that explains the tool
   - Subtitle explaining: "Extract documentation from any site with llms.txt support"
   - Remove any over-the-top AI claims, keep it honest but professional
   - Add subtle badge: "Open Source" or "Free to Use"

3. **Update Features.tsx**:
   - Feature 1: Document Extraction - Automatically finds and fetches llms.txt/llms-full.txt
   - Feature 2: Smart Parsing - Splits documentation into organized markdown files
   - Feature 3: Agent-Ready - Includes AGENT-GUIDE.md for AI assistants
   - Feature 4: Bulk Download - Download individual files or everything as ZIP
   - Use appropriate icons for each (FileText, Scissors, Bot, Archive)

4. **Update HowItWorks.tsx**:
   - Step 1: Enter URL - Paste any documentation site URL
   - Step 2: Extract - We find and fetch the llms.txt file
   - Step 3: Download - Get organized markdown files ready for AI agents
   - Keep it simple and honest

5. **Update Stats.tsx**:
   - Remove fake stats like "1,600+ models"
   - Replace with real/honest stats or remove entirely
   - Could show: "Works with any llms.txt compatible site"

6. **Update ExtractionProcess.tsx**:
   - Simplify the extraction animation
   - Show real steps: "Finding llms.txt...", "Parsing content...", "Generating documents..."
   - Remove fake "quantum" and "ensemble" terminology
   - Keep it professional but can still be visually interesting

7. **Header and Footer**:
   - Header: Logo, GitHub link, maybe docs link
   - Footer: Created by nich, links to x.com/nichxbt and github.com/nirholas
   - Keep it minimal and professional

8. **Color scheme check**:
   - Ensure the cyber-green/blue theme is consistent
   - Professional dark mode throughout
   - Good contrast for accessibility

### Technical Requirements
- Only Lucide icons (import from 'lucide-react')
- Consistent spacing and typography
- Framer Motion for subtle animations
- No emojis anywhere in the UI

### Files to Modify
- `src/components/Hero.tsx`
- `src/components/Features.tsx`
- `src/components/HowItWorks.tsx`
- `src/components/Stats.tsx`
- `src/components/ExtractionProcess.tsx`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- Any other component with emojis

---

## AGENT 4: Documentation Site (Material for MkDocs)

**Role:** Technical Writer  
**Focus:** Create comprehensive documentation using Material for MkDocs

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. Create a documentation site in a `docs-site/` subdirectory using Material for MkDocs. This will be deployed separately or as a subdirectory.

### Tasks

1. **Setup MkDocs structure** in `llms-forge/docs-site/`:
   ```
   docs-site/
     mkdocs.yml
     docs/
       index.md
       getting-started.md
       how-it-works.md
       api-reference.md
       faq.md
       about.md
   ```

2. **mkdocs.yml configuration**:
   - Site name: "LLMs Forge Documentation"
   - Theme: material with dark mode
   - Color scheme matching the main site (dark with green accents)
   - Navigation structure
   - Social links to nich's profiles
   - Repository link to github.com/nirholas/lyra-tool-discovery

3. **Documentation pages**:

   **index.md (Home)**:
   - What is LLMs Forge
   - Quick overview of features
   - Link to getting started

   **getting-started.md**:
   - How to use the web app
   - Enter URL, wait for extraction, download files
   - What you get: individual docs, llms-full.md, AGENT-GUIDE.md
   - How to use the downloaded files with AI assistants

   **how-it-works.md**:
   - Explanation of llms.txt standard
   - What the tool does behind the scenes
   - Document parsing logic
   - The "secret" - it's just fetching llms.txt (be honest and fun about it)

   **api-reference.md** (if we expose an API):
   - POST /api/extract endpoint
   - Request/response format
   - Example usage with curl

   **faq.md**:
   - What sites work with this? (Any site with llms.txt)
   - Is this free? (Yes)
   - Can I self-host? (Yes, it's open source)
   - Why does this exist? (To make llms.txt more accessible)

   **about.md**:
   - Created by nich
   - Links: x.com/nichxbt, github.com/nirholas
   - Part of the lyra-tool-discovery project
   - Open source, contributions welcome

4. **Create requirements.txt** for docs:
   ```
   mkdocs-material
   ```

5. **Add docs scripts to package.json**:
   ```json
   "docs:install": "pip install -r docs-site/requirements.txt",
   "docs:dev": "cd docs-site && mkdocs serve",
   "docs:build": "cd docs-site && mkdocs build"
   ```

### Technical Requirements
- Material for MkDocs theme
- Dark mode by default
- Professional tone but can be playful about the "secret"
- No emojis in documentation
- Good code examples where relevant

### Files to Create
- `docs-site/mkdocs.yml`
- `docs-site/requirements.txt`
- `docs-site/docs/index.md`
- `docs-site/docs/getting-started.md`
- `docs-site/docs/how-it-works.md`
- `docs-site/docs/api-reference.md`
- `docs-site/docs/faq.md`
- `docs-site/docs/about.md`

---

## AGENT 5: Testing, Build & Deployment

**Role:** DevOps / QA Engineer  
**Focus:** Ensure everything works, fix errors, prepare for deployment

### Context
You are working on `/workspaces/lyra-tool-discovery/llms-forge`. After the other agents complete their work, you need to ensure everything works together and deploy to Vercel.

### Tasks

1. **Dependency check**:
   - Run `pnpm install` to ensure all deps are installed
   - Check for any missing dependencies (jszip, etc.)
   - Verify all imports resolve correctly

2. **TypeScript validation**:
   - Run `pnpm build` and fix any type errors
   - Ensure all interfaces match between API and frontend
   - Fix any `any` types that should be properly typed

3. **Linting**:
   - Run `pnpm lint` and fix any issues
   - Ensure consistent code style

4. **Functional testing**:
   - Test extraction with real URLs that have llms.txt:
     - https://docs.anthropic.com (if they have llms.txt)
     - https://docs.stripe.com
     - Other known sites with llms.txt
   - Test individual file downloads
   - Test ZIP download
   - Test error handling (URL without llms.txt)

5. **Build verification**:
   - `pnpm build` should complete without errors
   - Check build output size
   - Verify no console errors in production build

6. **Vercel deployment prep**:
   - Ensure `vercel.json` is configured correctly (or create if needed)
   - Environment variables (if any needed)
   - Check that API routes work in serverless environment
   - Verify JSZip works in Edge/Serverless runtime

7. **Create/update vercel.json** if needed:
   ```json
   {
     "framework": "nextjs",
     "buildCommand": "pnpm build",
     "installCommand": "pnpm install"
   }
   ```

8. **README update**:
   - Update README.md to reflect the actual functionality (not the joke)
   - Installation instructions
   - Development setup
   - Deployment instructions
   - Credits to nich

9. **Final checklist**:
   - [ ] All pages load without errors
   - [ ] Extraction works with test URLs
   - [ ] Downloads work (individual + ZIP)
   - [ ] Mobile responsive
   - [ ] No console errors
   - [ ] Build succeeds
   - [ ] Ready for Vercel deployment

10. **Deploy commands**:
    ```bash
    # Install Vercel CLI if needed
    pnpm add -g vercel
    
    # Deploy to Vercel
    cd llms-forge
    vercel --prod
    ```

### Technical Requirements
- Zero TypeScript errors
- Zero ESLint errors (or documented exceptions)
- All features functional
- Production-ready build
- Vercel deployment successful

### Files to Modify
- `README.md` - update to reflect real functionality
- `vercel.json` - create/update as needed
- `package.json` - ensure scripts are correct
- Any files with errors from other agents' work

---

## Coordination Notes

**Execution Order:**
1. Agent 1 (Backend) and Agent 4 (Docs) can start immediately in parallel
2. Agent 3 (UI Polish) can start immediately
3. Agent 2 (Frontend Output) should wait for Agent 1 to define the API response structure
4. Agent 5 (Testing/Deploy) runs last after all other work is complete

**Shared Interfaces:**
All agents should use this ExtractionResult interface (Agent 1 defines it, Agent 2 consumes it):

```typescript
interface Document {
  filename: string
  title: string
  content: string
  tokens: number
}

interface ExtractionResult {
  url: string
  sourceUrl: string
  rawContent: string
  documents: Document[]
  fullDocument: Document
  agentGuide: Document
  stats: {
    totalTokens: number
    documentCount: number
    processingTime: number
  }
}
```

**Brand Guidelines:**
- Created by: nich
- Twitter/X: x.com/nichxbt  
- GitHub: github.com/nirholas
- Tone: Professional but with subtle humor
- No emojis - Lucide icons only
- Color scheme: Dark with cyber-green (#00ff88) and cyber-blue accents

---

*Ship it!*
