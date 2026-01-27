import { NextRequest, NextResponse } from 'next/server'
import type { ExtractionResult, Document, BatchRequest, BatchResponse, BatchResult, ExportFormat } from '@/types'
import { getRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rate-limiter'

/**
 * Maximum concurrent extractions
 */
const MAX_CONCURRENT = 5

/**
 * Maximum URLs per batch request
 */
const MAX_URLS_PER_BATCH = 50

/**
 * Timeout per URL extraction (ms)
 */
const EXTRACTION_TIMEOUT = 30000

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
 * Extract content from a single URL
 */
async function extractFromUrl(url: string): Promise<ExtractionResult> {
  const startTime = Date.now()
  
  // Normalize URL
  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`
  }

  const urlObj = new URL(targetUrl)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`
  
  let content: string | null = null
  let sourceUrl: string = ''
  
  const urlsToTry = [
    `${baseUrl}/llms-full.txt`,
    `${baseUrl}/llms.txt`
  ]
  
  for (const tryUrl of urlsToTry) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT)
      
      const response = await fetch(tryUrl, {
        headers: {
          'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
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
    throw new Error(`No llms.txt or llms-full.txt found at ${urlObj.host}`)
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
  
  return {
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
}

/**
 * Process URLs with concurrency limit
 */
async function processUrlsWithConcurrency(
  urls: string[],
  maxConcurrent: number
): Promise<BatchResult[]> {
  const results: BatchResult[] = []
  const pending: Promise<void>[] = []
  
  for (const url of urls) {
    const promise = (async () => {
      try {
        const data = await extractFromUrl(url)
        results.push({
          url,
          success: true,
          data,
        })
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })()
    
    pending.push(promise)
    
    // If we've reached max concurrent, wait for one to complete
    if (pending.length >= maxConcurrent) {
      await Promise.race(pending)
      // Remove completed promises
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i]
        // Check if promise is settled by racing with an already-resolved promise
        const settled = await Promise.race([
          p.then(() => true).catch(() => true),
          Promise.resolve(false)
        ])
        if (settled) {
          pending.splice(i, 1)
        }
      }
    }
  }
  
  // Wait for remaining promises
  await Promise.all(pending)
  
  return results
}

/**
 * POST endpoint - Batch extraction
 * Accepts array of URLs and processes them in parallel
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimiter = getRateLimiter()
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, rateLimiter)
  }
  
  try {
    const body = await request.json() as BatchRequest
    const { urls, options } = body
    
    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      )
    }
    
    if (urls.length === 0) {
      return NextResponse.json(
        { error: 'At least one URL is required' },
        { status: 400 }
      )
    }
    
    if (urls.length > MAX_URLS_PER_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_URLS_PER_BATCH} URLs per batch request` },
        { status: 400 }
      )
    }
    
    // Validate URLs
    const validUrls: string[] = []
    const invalidUrls: string[] = []
    
    for (const url of urls) {
      if (typeof url !== 'string' || !url.trim()) {
        continue
      }
      
      try {
        let normalizedUrl = url.trim()
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = `https://${normalizedUrl}`
        }
        new URL(normalizedUrl)
        validUrls.push(url.trim())
      } catch {
        invalidUrls.push(url)
      }
    }
    
    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid URLs provided', invalidUrls },
        { status: 400 }
      )
    }
    
    // Process URLs with concurrency limit
    const results = await processUrlsWithConcurrency(validUrls, MAX_CONCURRENT)
    
    // Add invalid URLs as failed results
    for (const invalidUrl of invalidUrls) {
      results.push({
        url: invalidUrl,
        success: false,
        error: 'Invalid URL format',
      })
    }
    
    // Calculate stats
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const totalTokens = results
      .filter(r => r.success && r.data)
      .reduce((sum, r) => sum + (r.data?.stats.totalTokens || 0), 0)
    
    const response: BatchResponse = {
      results,
      stats: {
        total: urls.length,
        successful,
        failed,
        totalTokens,
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetAt),
      }
    })
    
  } catch (error) {
    console.error('Batch extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch extraction failed' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint - Returns batch processing info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/batch',
    method: 'POST',
    description: 'Batch process multiple URLs for llms.txt extraction',
    limits: {
      maxUrls: MAX_URLS_PER_BATCH,
      maxConcurrent: MAX_CONCURRENT,
      timeoutPerUrl: EXTRACTION_TIMEOUT,
    },
    requestBody: {
      urls: 'string[] - Array of URLs to process',
      options: {
        format: "'markdown' | 'json' | 'yaml' - Export format (optional)",
        includeAgentGuide: 'boolean - Include agent guide in results (optional)',
      }
    },
    response: {
      results: 'Array of { url, success, error?, data? }',
      stats: '{ total, successful, failed, totalTokens }',
    }
  })
}
