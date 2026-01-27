# Agent 1: Backend API & Document Processing

You are a backend engineer working on llms-forge, a Next.js 14 app that extracts documentation from websites by fetching their `/llms.txt` or `/llms-full.txt` files.

## Project Location
`/workspaces/lyra-tool-discovery/llms-forge`

## Your Mission
Build the complete document extraction, parsing, and generation pipeline. The current API is just a mock - you need to make it actually useful.

## Current State
The existing API at `src/app/api/extract/route.ts` fetches raw content but doesn't process it into useful documents. It also has fake delays and metrics.

## Tasks

### 1. Install Required Dependencies
```bash
cd /workspaces/lyra-tool-discovery/llms-forge
pnpm add jszip
```

### 2. Create Shared Types (`src/types/index.ts`)
```typescript
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

### 3. Create Markdown Parser (`src/lib/parser.ts`)
Build a parser that:
- Splits llms.txt content by `##` headers into sections
- Creates clean filenames from titles (slugify)
- Handles edge cases: no headers, malformed content, empty sections
- Returns array of document objects

### 4. Create Document Generator (`src/lib/generator.ts`)
Build generators for:
- Individual markdown files from parsed sections
- `llms-full.md` - consolidated document with table of contents
- `AGENT-GUIDE.md` - instructions for AI agents

The AGENT-GUIDE.md should contain:
```markdown
# Agent Guide for [Site Name] Documentation

This package contains documentation extracted from [URL].

## Included Files
- llms-full.md - Complete documentation in one file
- [list each individual file with description]

## How to Use This Documentation

As an AI assistant, you can use these files to:
1. Answer questions about [topic]
2. Provide code examples from the documentation
3. Explain concepts and features

## Recommended Reading Order
1. Start with llms-full.md for complete context
2. Reference individual files for specific topics

## Source
Original documentation: [sourceUrl]
Extracted on: [date]
```

### 5. Rewrite Extract API (`src/app/api/extract/route.ts`)
- Remove fake delays (process as fast as possible)
- Try `/llms-full.txt` first, fallback to `/llms.txt`
- Use the parser to split content into documents
- Use the generator to create full document and agent guide
- Calculate real token counts (rough estimate: chars / 4)
- Return the full ExtractionResult structure

### 6. Create Download API (`src/app/api/download/route.ts`)
```typescript
// POST /api/download
// Body: { documents: Document[], fullDocument: Document, agentGuide: Document, siteName: string }
// Response: ZIP file blob

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function POST(request: NextRequest) {
  const { documents, fullDocument, agentGuide, siteName } = await request.json()
  
  const zip = new JSZip()
  const folder = zip.folder(siteName || 'llms-docs')
  
  // Add all documents to zip
  documents.forEach((doc: Document) => {
    folder?.file(doc.filename, doc.content)
  })
  folder?.file(fullDocument.filename, fullDocument.content)
  folder?.file(agentGuide.filename, agentGuide.content)
  
  const blob = await zip.generateAsync({ type: 'nodebuffer' })
  
  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${siteName || 'llms-docs'}.zip"`
    }
  })
}
```

## Files to Create/Modify
- `src/types/index.ts` (create)
- `src/lib/parser.ts` (create)
- `src/lib/generator.ts` (create)
- `src/app/api/extract/route.ts` (rewrite)
- `src/app/api/download/route.ts` (create)

## Quality Requirements
- TypeScript strict mode compatible
- Proper error handling with descriptive messages
- No fake delays or metrics
- Handle edge cases gracefully
- Clean, readable code

## Testing
Test with these URLs (if they have llms.txt):
- https://docs.anthropic.com
- https://docs.stripe.com
- https://modelcontextprotocol.io

## Do Not
- Add fake processing delays
- Use emoji in any output
- Create mock/placeholder data
- Leave any `// TODO` comments

Start by reading the current implementation, then systematically implement each piece.
