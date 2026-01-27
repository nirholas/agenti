# Agent 2: Frontend Output & Download UI

You are a frontend engineer working on llms-forge, a Next.js 14 app that extracts documentation from websites.

## Project Location
`/workspaces/lyra-tool-discovery/llms-forge`

## Your Mission
Build the complete download experience with working individual file downloads and ZIP download functionality.

## Current State
The `OutputSection.tsx` component has tabs for Preview, MCP Server, API Endpoint, and Download. The download buttons are non-functional placeholders. The MCP and API tabs show fake/generated data.

## Shared Types (Agent 1 creates these, you consume them)
```typescript
// src/types/index.ts
export interface Document {
  filename: string
  title: string
  content: string
  tokens: number
}

export interface ExtractionResult {
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

## Tasks

### 1. Update Page Types (`src/app/page.tsx`)
Update the ExtractionResult type to match the shared interface. Remove the old fake fields (mcpConfig, apiEndpoint, compressionRatio).

### 2. Create Download Utilities (`src/lib/download.ts`)
```typescript
export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadZip(
  documents: Document[],
  fullDocument: Document,
  agentGuide: Document,
  siteName: string
): Promise<void> {
  const response = await fetch('/api/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents, fullDocument, agentGuide, siteName })
  })
  
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${siteName}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

### 3. Rewrite OutputSection.tsx
Completely rewrite the output section with these tabs:

**Tab 1: Documents (Primary)**
- List all extracted documents in a clean table/list
- Each row shows: icon, filename, title (truncated), token count, download button
- Highlight `llms-full.md` and `AGENT-GUIDE.md` at the top
- Individual download buttons that work

**Tab 2: Preview**
- Dropdown to select which document to preview
- Syntax-highlighted markdown preview
- Copy button for the content
- Show full content with scroll

**Tab 3: Download** (or make this a prominent section, not a tab)
- Big "Download All as ZIP" button with Archive icon
- Shows total file count and estimated size
- Loading state while generating ZIP

### 4. Add the "Pro Tip" Reveal
After successful extraction, show an info box:
```tsx
<div className="mt-6 p-4 bg-cyber-blue/10 border border-cyber-blue/30 rounded-xl">
  <div className="flex items-start gap-3">
    <Lightbulb className="w-5 h-5 text-cyber-blue mt-0.5 flex-shrink-0" />
    <div>
      <h4 className="font-medium text-cyber-blue">Pro tip</h4>
      <p className="text-sm text-gray-400 mt-1">
        You can usually access this content directly by adding{' '}
        <code className="px-1.5 py-0.5 bg-dark-700 rounded text-cyber-green font-mono text-xs">
          /llms-full.txt
        </code>{' '}
        to the end of most documentation URLs. This tool just makes it easier to organize and download.
      </p>
    </div>
  </div>
</div>
```

### 5. Update Stats Display
Show real, useful stats:
- Total Documents: `{result.documents.length + 2}` (includes full + guide)
- Total Tokens: `{result.stats.totalTokens.toLocaleString()}`
- Source: clickable link to `result.sourceUrl`
- Processing Time: `{result.stats.processingTime}ms`

Remove fake stats like "compression ratio".

### 6. Success Header
Update to be more straightforward:
- "Extraction Complete" with Check icon
- "Found {n} documentation sections from {hostname}"
- "Extract Another" button

## UI Components to Use
Icons from lucide-react:
- `FileText` - for markdown files
- `Archive` - for ZIP download
- `Download` - for individual downloads
- `Copy` / `Check` - for copy functionality
- `Lightbulb` or `Info` - for the pro tip
- `ExternalLink` - for source URL link
- `Eye` - for preview tab
- `Files` - for documents tab

## Quality Requirements
- All downloads must actually work
- Proper loading states
- Mobile responsive
- No emojis - only Lucide icons
- Smooth Framer Motion animations
- Accessible buttons with proper labels

## Files to Create/Modify
- `src/app/page.tsx` - update types
- `src/lib/download.ts` (create)
- `src/components/OutputSection.tsx` (major rewrite)

## Do Not
- Keep the fake MCP server configuration
- Keep the fake API endpoint generation
- Use emojis anywhere
- Leave non-functional buttons

Read the current OutputSection.tsx first, then systematically rebuild it with working functionality.
