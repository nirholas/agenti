import { NextRequest, NextResponse } from 'next/server'
import { getExtensionForFormat, getMimeTypeForFormat } from '@/lib/exporters'
import type { ExportFormat } from '@/types'

/**
 * Helper to format content based on export format
 */
function formatContent(
  content: string,
  format: ExportFormat,
  siteName: string,
  sourceUrl: string,
  includeHeader: boolean
): string {
  const meta = {
    source: sourceUrl,
    site: siteName,
    extractedAt: new Date().toISOString(),
    version: '1.0',
  }

  if (format === 'json') {
    return JSON.stringify({
      meta,
      content,
    }, null, 2)
  }

  if (format === 'yaml') {
    // Simple YAML serialization
    const lines = [
      'meta:',
      `  source: "${meta.source}"`,
      `  site: "${meta.site}"`,
      `  extractedAt: "${meta.extractedAt}"`,
      '  version: "1.0"',
      'content: |',
    ]
    const contentLines = content.split('\n')
    for (const line of contentLines) {
      lines.push(`  ${line}`)
    }
    return lines.join('\n')
  }

  // Markdown format
  if (includeHeader) {
    const header = `<!-- 
  Source: ${sourceUrl}
  Extracted: ${meta.extractedAt}
  Site: ${siteName}
-->\n\n`
    return header + content
  }

  return content
}

/**
 * GET endpoint - Download llms-full.txt as docs.md
 * Usage: /api/download?url=docs.axiom.trade&filename=axiom-docs.md&format=markdown
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const filename = request.nextUrl.searchParams.get('filename')
  const format = (request.nextUrl.searchParams.get('format') || 'markdown') as ExportFormat
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL is required as query parameter. Usage: /api/download?url=example.com' },
      { status: 400 }
    )
  }

  try {
    // Normalize URL
    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`
    }

    let urlObj: URL
    try {
      urlObj = new URL(targetUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }
    
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`
    
    // Try to fetch llms-full.txt first, then llms.txt
    let content: string | null = null
    let sourceUrl: string = ''
    
    const urlsToTry = [
      `${baseUrl}/llms-full.txt`,
      `${baseUrl}/llms.txt`
    ]
    
    for (const tryUrl of urlsToTry) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
          },
        })
        
        if (response.ok) {
          content = await response.text()
          sourceUrl = tryUrl
          break
        }
      } catch {
        continue
      }
    }
    
    if (!content) {
      return NextResponse.json(
        { error: `No llms.txt or llms-full.txt found at ${urlObj.host}` },
        { status: 404 }
      )
    }
    
    // Get format-specific extension and mime type
    const siteName = urlObj.host.replace('www.', '')
    const ext = getExtensionForFormat(format)
    const mimeType = getMimeTypeForFormat(format)
    const finalFilename = filename || `docs${ext}`
    
    // Format content based on export format
    const finalContent = formatContent(content, format, siteName, sourceUrl, true)

    // Return as downloadable file
    return new NextResponse(finalContent, {
      status: 200,
      headers: {
        'Content-Type': `${mimeType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'X-Source-URL': sourceUrl,
        'X-Export-Format': format,
      },
    })
    
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint - Download with custom options
 * Body: { url: string, filename?: string, includeHeader?: boolean, format?: ExportFormat }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, filename, includeHeader = true, format = 'markdown' } = body as {
      url: string
      filename?: string
      includeHeader?: boolean
      format?: ExportFormat
    }
    
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

    let urlObj: URL
    try {
      urlObj = new URL(targetUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }
    
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`
    
    // Try to fetch llms-full.txt first, then llms.txt
    let content: string | null = null
    let sourceUrl: string = ''
    
    const urlsToTry = [
      `${baseUrl}/llms-full.txt`,
      `${baseUrl}/llms.txt`
    ]
    
    for (const tryUrl of urlsToTry) {
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
          },
        })
        
        if (response.ok) {
          content = await response.text()
          sourceUrl = tryUrl
          break
        }
      } catch {
        continue
      }
    }
    
    if (!content) {
      return NextResponse.json(
        { error: `No llms.txt or llms-full.txt found at ${urlObj.host}` },
        { status: 404 }
      )
    }
    
    // Get format-specific extension and mime type
    const siteName = urlObj.host.replace('www.', '')
    const ext = getExtensionForFormat(format)
    const mimeType = getMimeTypeForFormat(format)
    const finalFilename = filename || `docs${ext}`
    
    // Format content based on export format
    const finalContent = formatContent(content, format, siteName, sourceUrl, includeHeader)

    // Return as downloadable file
    return new NextResponse(finalContent, {
      status: 200,
      headers: {
        'Content-Type': `${mimeType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'X-Source-URL': sourceUrl,
        'X-Export-Format': format,
      },
    })
    
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    )
  }
}

