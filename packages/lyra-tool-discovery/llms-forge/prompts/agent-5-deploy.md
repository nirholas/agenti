# Agent 5: Testing, Build & Deployment

You are a DevOps/QA engineer responsible for ensuring llms-forge works correctly and deploys successfully.

## Project Location
`/workspaces/lyra-tool-discovery/llms-forge`

## Your Mission
After other agents complete their work, verify everything functions correctly, fix any errors, and deploy to Vercel.

## Execution Order
Run this agent LAST, after Agents 1-4 have completed their tasks.

## Tasks

### 1. Install All Dependencies
```bash
cd /workspaces/lyra-tool-discovery/llms-forge
pnpm install
```

Check for any missing dependencies and install them:
```bash
# Verify jszip is installed (Agent 1 should have added it)
pnpm add jszip
pnpm add -D @types/jszip  # if types are needed
```

### 2. TypeScript Validation
```bash
pnpm build
```

Fix any TypeScript errors. Common issues to look for:
- Mismatched interfaces between API and frontend
- Missing type imports
- `any` types that should be properly typed
- Unused imports

### 3. Linting
```bash
pnpm lint
```

Fix any ESLint issues:
- Unused variables
- Missing dependencies in useEffect
- Accessibility issues

### 4. Functional Testing

Test the application manually:

```bash
pnpm dev
```

Open http://localhost:3001 and test:

**Test 1: Successful Extraction**
- Enter a known working URL (try these):
  - https://modelcontextprotocol.io
  - https://docs.anthropic.com
  - https://docs.stripe.com
- Verify extraction completes
- Verify documents are shown
- Verify stats are displayed

**Test 2: Individual Downloads**
- Click download on individual files
- Verify file downloads with correct content

**Test 3: ZIP Download**
- Click "Download All as ZIP"
- Verify ZIP downloads
- Open ZIP and verify contents

**Test 4: Error Handling**
- Enter a URL without llms.txt (e.g., https://google.com)
- Verify error message is shown
- Verify "Try Again" button works

**Test 5: UI/UX**
- Check mobile responsiveness (resize browser)
- Verify no console errors
- Check all icons render (no missing icons)
- Verify pro tip message appears after extraction

### 5. Build Verification
```bash
pnpm build
```

Verify:
- Build completes without errors
- No warnings about large bundles
- Output shows reasonable sizes

### 6. Check for Console Errors
In the browser dev tools:
- No JavaScript errors
- No failed network requests (except expected 404s for testing)
- No React warnings

### 7. Create/Update vercel.json

Create or update `vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "regions": ["iad1"]
}
```

### 8. Update README.md

Rewrite the README to reflect actual functionality:

```markdown
# LLMs Forge

Extract documentation for AI agents from any site with llms.txt support.

## What It Does

1. Enter any documentation URL
2. LLMs Forge finds and fetches the llms.txt file
3. Download organized markdown files ready for AI assistants

## Output

- **Individual markdown files** - Each documentation section
- **llms-full.md** - Complete consolidated documentation
- **AGENT-GUIDE.md** - Instructions for AI assistants

## Development

```bash
cd llms-forge
pnpm install
pnpm dev
```

Open http://localhost:3001

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Or use the Vercel dashboard to import from GitHub.

## Documentation

See the [docs](./docs-site) for detailed documentation.

## About

Created by [nich](https://x.com/nichxbt) | [GitHub](https://github.com/nirholas)

Part of the [lyra-tool-discovery](https://github.com/nirholas/lyra-tool-discovery) project.
```

### 9. Final Pre-Deploy Checklist

Run through this checklist:

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm lint` passes (or has documented exceptions)
- [ ] Dev server starts without errors
- [ ] Landing page loads correctly
- [ ] All icons render (no emojis, no broken icons)
- [ ] URL input works
- [ ] Extraction works with a real URL
- [ ] Stats display correctly
- [ ] Individual file downloads work
- [ ] ZIP download works
- [ ] Pro tip message displays
- [ ] Error handling works
- [ ] Mobile responsive
- [ ] No console errors
- [ ] README is updated

### 10. Deploy to Vercel

Option A: Vercel CLI
```bash
# Install Vercel CLI if needed
npm install -g vercel

# Login
vercel login

# Deploy (from llms-forge directory)
cd /workspaces/lyra-tool-discovery/llms-forge
vercel --prod
```

Option B: Vercel Dashboard
1. Go to vercel.com
2. Import from GitHub: nirholas/lyra-tool-discovery
3. Set root directory to: llms-forge
4. Deploy

### 11. Post-Deploy Verification

After deployment:
1. Visit the deployed URL
2. Run through the same tests as local
3. Verify all functionality works in production
4. Check Vercel logs for any errors

### 12. If Vercel Fails, Try Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd /workspaces/lyra-tool-discovery/llms-forge
railway init

# Deploy
railway up

# Get deployed URL
railway domain
```

## Common Issues and Fixes

### JSZip in Edge Runtime
If JSZip doesn't work in Vercel's edge runtime, update the API route:
```typescript
// Add to top of api/download/route.ts
export const runtime = 'nodejs'
```

### Missing Environment Variables
LLMs Forge shouldn't need any environment variables. If something expects one, it's likely a bug from the old fake implementation.

### Type Mismatches
If types don't match between API and frontend:
1. Check `src/types/index.ts` is the source of truth
2. Both API routes and components should import from there
3. Fix any deviations

### Build Failures
Common causes:
- Unused imports (remove them)
- Missing dependencies (add them)
- Type errors (fix the types)

## Files to Modify
- `vercel.json` (create/update)
- `README.md` (rewrite)
- Any files with errors from build/lint
- Any files with bugs found during testing

## Quality Requirements
- Zero build errors
- Zero critical lint errors
- All features functional
- Production deployment successful

## Do Not
- Skip testing
- Deploy with known bugs
- Leave console.log statements
- Deploy without verifying locally first

Start by running `pnpm install && pnpm build` to see the current state, then work through fixing any issues.
