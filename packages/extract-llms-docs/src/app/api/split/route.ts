import { NextRequest, NextResponse } from 'next/server'
import { discoverLlmsTxt } from '@/lib/url-discovery'
import { fetchInstallMd, parseInstallMd, isValidInstallMd } from '@/lib/install-md-parser'
import type { ParsedInstallMd } from '@/types'

interface SplitDocument {
  filename: string
  title: string
  content: string
  order: number
}

/**
 * Slugify a title into a filename-safe string
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/**
 * Split llms-full.txt into individual page files
 * Each # Header becomes its own .md file
 */
function splitIntoPages(content: string): SplitDocument[] {
  const documents: SplitDocument[] = []
  
  // Split by # at the start of a line (h1 headers = pages)
  const pages = content.split(/^# /m)
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i].trim()
    if (!page || page.length < 10) continue
    
    const lines = page.split('\n')
    const title = lines[0]?.trim() || `Page ${i}`
    const pageContent = i === 0 
      ? page  // First chunk might not have a header
      : `# ${lines[0]}\n\n${lines.slice(1).join('\n').trim()}`
    
    const order = documents.length + 1
    const filename = `${String(order).padStart(2, '0')}-${slugify(title)}.md`
    
    documents.push({
      filename,
      title,
      content: pageContent,
      order
    })
  }
  
  return documents
}

/**
 * GET - Split and return as JSON with all files
 * Usage: /api/split?url=docs.axiom.trade
 * 
 * Query params:
 * - url: The domain to extract from (required)
 * - discover: If "true", scan for llms.txt across common doc URL patterns (default: true)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const shouldDiscover = request.nextUrl.searchParams.get('discover') !== 'false'
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL is required. Usage: /api/split?url=example.com' },
      { status: 400 }
    )
  }

  try {
    // Normalize URL
    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }

    const urlObj = new URL(targetUrl)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.replace(/\/$/, '')}`
    
    // Fetch llms-full.txt or llms.txt
    let content: string | null = null
    let sourceUrl: string = ''
    let discoveredUrl: string | null = null
    
    // First try the exact URL provided
    for (const tryUrl of [`${baseUrl}/llms-full.txt`, `${baseUrl}/llms.txt`]) {
      try {
        const response = await fetch(tryUrl, {
          headers: { 'User-Agent': 'llms-forge/1.0' },
        })
        if (response.ok) {
          const text = await response.text()
          // Verify it's not an HTML error page
          if (text && !text.trim().toLowerCase().startsWith('<!doctype') && !text.trim().toLowerCase().startsWith('<html')) {
            content = text
            sourceUrl = tryUrl
            break
          }
        }
      } catch { continue }
    }
    
    // If not found and discovery is enabled, scan for llms.txt
    if (!content && shouldDiscover) {
      const discovery = await discoverLlmsTxt(targetUrl, { timeoutMs: 20000 })
      
      if (discovery.found && discovery.llmsTxtUrl) {
        try {
          const response = await fetch(discovery.llmsTxtUrl, {
            headers: { 'User-Agent': 'llms-forge/1.0' },
          })
          if (response.ok) {
            content = await response.text()
            sourceUrl = discovery.llmsTxtUrl
            discoveredUrl = discovery.url
          }
        } catch { /* continue to error */ }
      }
    }
    
    if (!content) {
      return NextResponse.json(
        { 
          error: `No llms.txt found for ${urlObj.host}`,
          suggestion: 'Try a different URL or check if this site supports llms.txt',
          triedDiscovery: shouldDiscover,
        },
        { status: 404 }
      )
    }
    
    // Split into pages
    const documents = splitIntoPages(content)
    const siteName = urlObj.host.replace('www.', '').replace('docs.', '').split('.')[0]
    
    // Try to fetch install.md
    let installMd: ParsedInstallMd | null = null
    let installMdUrl: string | null = null
    
    // Check common install.md locations
    const installMdPaths = [
      '/install.md',
      '/docs/install.md',
    ]
    
    for (const path of installMdPaths) {
      const tryUrl = `${urlObj.protocol}//${urlObj.host}${path}`
      try {
        const response = await fetch(tryUrl, {
          headers: { 'User-Agent': 'llms-forge/1.0' },
        })
        if (response.ok) {
          const text = await response.text()
          // Check if it's valid install.md format
          if (text && isValidInstallMd(text)) {
            installMd = parseInstallMd(text)
            installMdUrl = tryUrl
            break
          }
        }
      } catch { continue }
    }
    
    // Also try docs subdomain
    if (!installMd) {
      try {
        const docsUrl = `https://docs.${urlObj.host.replace(/^docs\./, '')}/install.md`
        const response = await fetch(docsUrl, {
          headers: { 'User-Agent': 'llms-forge/1.0' },
        })
        if (response.ok) {
          const text = await response.text()
          if (text && isValidInstallMd(text)) {
            installMd = parseInstallMd(text)
            installMdUrl = docsUrl
          }
        }
      } catch { /* continue */ }
    }
    
    return NextResponse.json({
      siteName,
      sourceUrl,
      discoveredFrom: discoveredUrl,
      totalPages: documents.length,
      documents,
      // Also include a manifest/index
      manifest: documents.map(d => ({
        filename: d.filename,
        title: d.title,
        order: d.order
      })),
      // Include install.md if found
      installMd,
      installMdUrl,
    })
    
  } catch (error) {
    console.error('Split error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Split failed' },
      { status: 500 }
    )
  }
}

/**
 * POST - Split and return as downloadable ZIP
 * Body: { url: string, discover?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, discover = true } = body
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Normalize URL
    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }

    const urlObj = new URL(targetUrl)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.replace(/\/$/, '')}`
    
    // Fetch llms-full.txt or llms.txt
    let content: string | null = null
    let sourceUrl: string = ''
    
    // First try the exact URL provided
    for (const tryUrl of [`${baseUrl}/llms-full.txt`, `${baseUrl}/llms.txt`]) {
      try {
        const response = await fetch(tryUrl, {
          headers: { 'User-Agent': 'llms-forge/1.0' },
        })
        if (response.ok) {
          const text = await response.text()
          if (text && !text.trim().toLowerCase().startsWith('<!doctype') && !text.trim().toLowerCase().startsWith('<html')) {
            content = text
            sourceUrl = tryUrl
            break
          }
        }
      } catch { continue }
    }
    
    // If not found and discovery is enabled, scan for llms.txt
    if (!content && discover) {
      const discovery = await discoverLlmsTxt(targetUrl, { timeoutMs: 20000 })
      
      if (discovery.found && discovery.llmsTxtUrl) {
        try {
          const response = await fetch(discovery.llmsTxtUrl, {
            headers: { 'User-Agent': 'llms-forge/1.0' },
          })
          if (response.ok) {
            content = await response.text()
            sourceUrl = discovery.llmsTxtUrl
          }
        } catch { /* continue to error */ }
      }
    }
    
    if (!content) {
      return NextResponse.json(
        { 
          error: `No llms.txt found for ${urlObj.host}`,
          suggestion: 'Try a different URL or check if this site supports llms.txt',
        },
        { status: 404 }
      )
    }
    
    // Split into pages
    const documents = splitIntoPages(content)
    const siteName = urlObj.host.replace('www.', '').replace('docs.', '').split('.')[0]
    
    // Create a simple TAR-like format (concatenated files with headers)
    // Or return as a multi-part response that can be easily parsed
    
    // For simplicity, return as JSON with base64 encoded files
    // Client can then create individual files
    const filesForDownload = documents.map(doc => ({
      path: `${siteName}-docs/${doc.filename}`,
      content: doc.content
    }))
    
    // Add an index file
    const indexContent = `# ${siteName} Documentation

Extracted from: ${sourceUrl}
Date: ${new Date().toISOString()}
Total Pages: ${documents.length}

## Pages

${documents.map(d => `- [${d.title}](./${d.filename})`).join('\n')}
`
    
    filesForDownload.unshift({
      path: `${siteName}-docs/README.md`,
      content: indexContent
    })
    
    return NextResponse.json({
      siteName,
      sourceUrl,
      folderName: `${siteName}-docs`,
      totalFiles: filesForDownload.length,
      files: filesForDownload
    })
    
  } catch (error) {
    console.error('Split error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Split failed' },
      { status: 500 }
    )
  }
}
