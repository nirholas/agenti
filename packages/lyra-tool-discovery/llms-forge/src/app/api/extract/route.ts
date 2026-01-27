import { NextRequest, NextResponse } from 'next/server'
import { ExtractionResult, Document, ExportFormat } from '@/types'
import { getExtractionCache, normalizeUrlKey } from '@/lib/cache'
import { getRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rate-limiter'
import { exportToFormat, getMimeTypeForFormat, getFilenameForFormat } from '@/lib/exporters'

/**
 * Simple helper to estimate tokens (roughly 4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Simple helper to create a slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/**
 * Add rate limit and cache headers to response
 */
function addResponseHeaders(
  headers: Record<string, string>,
  rateLimitResult: { limit: number; remaining: number; resetAt: number },
  cacheStatus: 'HIT' | 'MISS',
  cacheTtl?: number
): Record<string, string> {
  return {
    ...headers,
    'X-Cache': cacheStatus,
    'X-Cache-TTL': cacheTtl !== undefined ? String(cacheTtl) : '0',
    'X-RateLimit-Limit': String(rateLimitResult.limit),
    'X-RateLimit-Remaining': String(rateLimitResult.remaining),
    'X-RateLimit-Reset': String(rateLimitResult.resetAt),
    'Cache-Control': 'public, max-age=300', // 5 minutes
  }
}

/**
 * POST endpoint - Simple extraction
 * Fetches llms-full.txt or llms.txt from a domain and returns the content
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Apply rate limiting
  const rateLimiter = getRateLimiter()
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, rateLimiter)
  }
  
  try {
    const body = await request.json()
    const { url } = body
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Simple extraction - just fetch llms-full.txt or llms.txt
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
    const cacheKey = normalizeUrlKey(baseUrl)

    // Check cache first
    const cache = getExtractionCache<ExtractionResult>()
    const cachedResult = cache.get(cacheKey)

    if (cachedResult) {
      // Return cached result with updated processing time
      const cachedWithTime: ExtractionResult = {
        ...cachedResult,
        stats: {
          ...cachedResult.stats,
          processingTime: Date.now() - startTime,
        },
      }
      const responseHeaders = addResponseHeaders(
        {},
        rateLimitResult,
        'HIT',
        cache.getTtlRemaining(cacheKey)
      )
      return NextResponse.json(cachedWithTime, { headers: responseHeaders })
    }
    
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
    
    // Simple parsing - split by ## headers
    const sections = content.split(/^## /m)
    const documents: Document[] = []
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim()
      if (!section || section.length < 20) continue
      
      const lines = section.split('\n')
      const title = i === 0 ? 'Introduction' : (lines[0] || `Section ${i}`)
      const sectionContent = i === 0 ? section : `## ${lines[0]}\n\n${lines.slice(1).join('\n').trim()}`
      
      documents.push({
        filename: `${String(documents.length + 1).padStart(2, '0')}-${slugify(title)}.md`,
        title,
        content: sectionContent,
        tokens: estimateTokens(sectionContent),
      })
    }
    
    // If no sections, treat whole content as one doc
    if (documents.length === 0 && content.length > 20) {
      documents.push({
        filename: '01-documentation.md',
        title: 'Documentation',
        content: content,
        tokens: estimateTokens(content),
      })
    }
    
    const siteName = urlObj.host.replace('www.', '').split('.')[0]
    
    const fullDocument: Document = {
      filename: 'docs.md',
      title: `${siteName} Documentation`,
      content: content,
      tokens: estimateTokens(content),
    }
    
    const agentGuide: Document = {
      filename: 'AGENT-GUIDE.md',
      title: 'Agent Guide',
      content: `# ${siteName} Documentation\n\nExtracted from ${sourceUrl}\n\nUse this documentation to answer questions about ${siteName}.`,
      tokens: estimateTokens(`# ${siteName} Documentation`),
    }
    
    const totalTokens = documents.reduce((sum, doc) => sum + doc.tokens, 0) 
      + fullDocument.tokens 
      + agentGuide.tokens
    
    const processingTime = Date.now() - startTime
    
    const result: ExtractionResult = {
      url: targetUrl,
      sourceUrl,
      rawContent: content,
      documents,
      fullDocument,
      agentGuide,
      stats: {
        totalTokens,
        documentCount: documents.length,
        processingTime
      }
    }

    // Cache the successful result
    cache.set(cacheKey, result)
    
    // Check for format parameter
    const formatParam = request.nextUrl.searchParams.get('format') as ExportFormat | null
    const acceptHeader = request.headers.get('accept')
    
    // Determine output format based on query param, Accept header, or default to JSON
    let outputFormat: ExportFormat | null = null
    
    if (formatParam && ['markdown', 'json', 'yaml'].includes(formatParam)) {
      outputFormat = formatParam
    } else if (acceptHeader) {
      if (acceptHeader.includes('text/markdown')) {
        outputFormat = 'markdown'
      } else if (acceptHeader.includes('text/yaml') || acceptHeader.includes('application/yaml')) {
        outputFormat = 'yaml'
      }
    }
    
    // If format is specified, return formatted content instead of JSON
    if (outputFormat) {
      const formattedContent = exportToFormat(result, outputFormat)
      const mimeType = getMimeTypeForFormat(outputFormat)
      const siteName = urlObj.host.replace('www.', '').split('.')[0]
      const filename = getFilenameForFormat(siteName, outputFormat)
      
      return new NextResponse(formattedContent, {
        status: 200,
        headers: {
          'Content-Type': `${mimeType}; charset=utf-8`,
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...addResponseHeaders({}, rateLimitResult, 'MISS', cache.getTtlRemaining(cacheKey)),
        },
      })
    }
    
    const responseHeaders = addResponseHeaders(
      {},
      rateLimitResult,
      'MISS',
      cache.getTtlRemaining(cacheKey)
    )
    
    return NextResponse.json(result, { headers: responseHeaders })
    
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint - Simple extraction (same as POST but with query param)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL is required as query parameter' },
      { status: 400 }
    )
  }

  // Create a mock request body for POST handler
  const originalJson = request.json.bind(request)
  const mockRequest = Object.create(request, {
    json: {
      value: async () => ({ url }),
    },
    headers: {
      value: request.headers,
    },
  }) as NextRequest
  
  return POST(mockRequest)
}