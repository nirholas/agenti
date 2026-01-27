import { NextRequest, NextResponse } from 'next/server'
import { KNOWN_SITES, VerificationResult, LlmsTxtInfo } from '@/data/sites'
import { getRateLimiter } from '@/lib/rate-limiter'

const TIMEOUT_MS = parseInt(process.env.VERIFY_TIMEOUT_MS || '10000', 10)
const CACHE_TTL_MS = parseInt(process.env.VERIFY_CACHE_TTL_MS || '300000', 10) // 5 minutes default

// In-memory cache for verification results
const verificationCache = new Map<string, { result: VerificationResult; timestamp: number }>()

// Get rate limiter with more lenient limits for verification
const rateLimiter = getRateLimiter({ windowMs: 60 * 1000, maxRequests: 60 })

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/**
 * Check if a URL returns a valid llms.txt file
 */
async function checkLlmsTxtUrl(url: string): Promise<LlmsTxtInfo | null> {
  try {
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'llms-txt-verifier/1.0',
        'Accept': 'text/plain, text/markdown, */*',
      },
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    const contentLength = response.headers.get('content-length')
    const lastModified = response.headers.get('last-modified')

    // Read the content to validate it's actually llms.txt format
    const text = await response.text()
    
    // Basic validation: should start with # and contain markdown-like content
    // or contain typical llms.txt patterns
    const isValidContent = 
      text.trim().startsWith('#') || 
      text.includes('# ') ||
      text.includes('##') ||
      text.toLowerCase().includes('documentation') ||
      text.toLowerCase().includes('api') ||
      (text.length > 100 && !text.includes('<!DOCTYPE') && !text.includes('<html'))

    if (!isValidContent) {
      return null
    }

    // Determine if it's full or standard based on content patterns
    const isFullLlms = 
      text.includes('## ') || 
      text.includes('### ') ||
      text.split('\n').length > 50 ||
      text.length > 5000

    return {
      exists: true,
      url: response.url, // Final URL after redirects
      size: contentLength ? parseInt(contentLength, 10) : text.length,
      lastModified: lastModified || undefined,
      type: isFullLlms ? 'full' : 'standard',
    }
  } catch (error) {
    return null
  }
}

/**
 * Check for install.md at common locations
 */
async function checkInstallMd(baseUrl: string): Promise<{ exists: boolean; url?: string }> {
  const locations = [
    `${baseUrl}/install.md`,
    `${baseUrl}/docs/install.md`,
    `${baseUrl}/INSTALL.md`,
  ]

  for (const url of locations) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return { exists: true, url: response.url }
      }
    } catch {
      // Continue to next location
    }
  }

  return { exists: false }
}

/**
 * Verify a single site's llms.txt availability
 */
async function verifySite(baseUrl: string): Promise<VerificationResult> {
  const startTime = Date.now()
  
  try {
    // Normalize the base URL
    const url = new URL(baseUrl)
    const origin = url.origin

    // Check multiple possible locations in parallel
    const llmsTxtLocations = [
      `${origin}/llms.txt`,
      `${origin}/llms-full.txt`,
      `${origin}/docs/llms.txt`,
      `${origin}/docs/llms-full.txt`,
    ]

    const [llmsTxtResults, installMdResult] = await Promise.all([
      Promise.all(llmsTxtLocations.map(checkLlmsTxtUrl)),
      checkInstallMd(origin),
    ])

    // Find the first valid llms.txt and llms-full.txt
    let llmsTxt: LlmsTxtInfo | undefined
    let llmsFullTxt: LlmsTxtInfo | undefined

    for (let i = 0; i < llmsTxtResults.length; i++) {
      const result = llmsTxtResults[i]
      if (result) {
        const location = llmsTxtLocations[i]
        if (location.includes('llms-full.txt')) {
          if (!llmsFullTxt) llmsFullTxt = result
        } else {
          if (!llmsTxt) llmsTxt = result
        }
      }
    }

    const responseTime = Date.now() - startTime
    const hasAnyLlmsTxt = !!llmsTxt || !!llmsFullTxt

    return {
      status: hasAnyLlmsTxt ? 'online' : 'offline',
      llmsTxt,
      llmsFullTxt,
      installMd: installMdResult,
      responseTime,
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      checkedAt: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * GET /api/sites/verify?url=...
 * Verify a single site's llms.txt availability
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)
  
  if (!rateLimitResult.allowed) {
    const headers = rateLimiter.getHeaders(rateLimitResult)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': headers['X-RateLimit-Limit'],
          'X-RateLimit-Remaining': headers['X-RateLimit-Remaining'],
          'X-RateLimit-Reset': headers['X-RateLimit-Reset'],
        },
      }
    )
  }

  const url = request.nextUrl.searchParams.get('url')
  const siteId = request.nextUrl.searchParams.get('id')
  const noCache = request.nextUrl.searchParams.get('nocache') === 'true'

  let targetUrl: string | undefined

  if (siteId) {
    const site = KNOWN_SITES.find(s => s.id === siteId)
    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }
    targetUrl = site.llmsTxtUrl || site.url
  } else if (url) {
    targetUrl = url
  } else {
    return NextResponse.json(
      { error: 'Either url or id parameter is required' },
      { status: 400 }
    )
  }

  // Check cache first
  const cacheKey = targetUrl
  if (!noCache) {
    const cached = verificationCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.result,
        cached: true,
      })
    }
  }

  // Perform verification
  const result = await verifySite(targetUrl)

  // Cache the result
  verificationCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
  })

  return NextResponse.json(result)
}

/**
 * POST /api/sites/verify
 * Verify multiple sites at once (batch verification)
 */
export async function POST(request: NextRequest) {
  // Rate limiting - batch requests cost more
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)
  
  if (!rateLimitResult.allowed) {
    const headers = rateLimiter.getHeaders(rateLimitResult)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': headers['X-RateLimit-Limit'],
          'X-RateLimit-Remaining': headers['X-RateLimit-Remaining'],
          'X-RateLimit-Reset': headers['X-RateLimit-Reset'],
        },
      }
    )
  }

  try {
    const body = await request.json()
    const { siteIds, urls, noCache } = body as {
      siteIds?: string[]
      urls?: string[]
      noCache?: boolean
    }

    const targets: { id?: string; url: string }[] = []

    // Collect targets from site IDs
    if (siteIds && Array.isArray(siteIds)) {
      for (const id of siteIds) {
        const site = KNOWN_SITES.find(s => s.id === id)
        if (site) {
          targets.push({ id, url: site.llmsTxtUrl || site.url })
        }
      }
    }

    // Collect targets from URLs
    if (urls && Array.isArray(urls)) {
      for (const url of urls) {
        targets.push({ url })
      }
    }

    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'No valid targets provided' },
        { status: 400 }
      )
    }

    // Limit batch size
    const maxBatchSize = 20
    const limitedTargets = targets.slice(0, maxBatchSize)

    // Verify all targets in parallel (with some concurrency control)
    const results: Record<string, VerificationResult & { cached?: boolean }> = {}

    await Promise.all(
      limitedTargets.map(async (target) => {
        const key = target.id || target.url
        const cacheKey = target.url

        // Check cache
        if (!noCache) {
          const cached = verificationCache.get(cacheKey)
          if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            results[key] = { ...cached.result, cached: true }
            return
          }
        }

        // Perform verification
        const result = await verifySite(target.url)
        results[key] = result

        // Cache the result
        verificationCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        })
      })
    )

    return NextResponse.json({
      results,
      total: limitedTargets.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Batch verification error:', error)
    return NextResponse.json(
      { error: 'Failed to perform batch verification' },
      { status: 500 }
    )
  }
}
