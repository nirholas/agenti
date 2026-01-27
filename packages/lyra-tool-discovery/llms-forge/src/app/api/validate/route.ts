import { NextRequest, NextResponse } from 'next/server'
import { getRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rate-limiter'
import { getValidationCache, normalizeUrlKey } from '@/lib/cache'

interface ValidationResult {
  exists: boolean
  type: 'full' | 'standard' | null
  size?: number
  url?: string
}

/**
 * GET endpoint - Validate if llms.txt exists for a domain
 * Uses HEAD request to check without downloading full content
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'URL is required as query parameter' },
      { status: 400 }
    )
  }

  // Apply rate limiting
  const rateLimiter = getRateLimiter()
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, rateLimiter)
  }

  // Normalize and validate URL
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
  const cache = getValidationCache<ValidationResult>()
  const cachedResult = cache.get(cacheKey)

  if (cachedResult) {
    const headers = rateLimiter.getHeaders(rateLimitResult)
    return NextResponse.json(cachedResult, {
      headers: {
        ...headers,
        'X-Cache': 'HIT',
        'X-Cache-TTL': String(cache.getTtlRemaining(cacheKey)),
        'Cache-Control': 'public, max-age=120', // 2 minutes
      },
    })
  }

  // Check for llms-full.txt and llms.txt
  const urlsToCheck: Array<{ url: string; type: 'full' | 'standard' }> = [
    { url: `${baseUrl}/llms-full.txt`, type: 'full' },
    { url: `${baseUrl}/llms.txt`, type: 'standard' },
  ]

  let result: ValidationResult = {
    exists: false,
    type: null,
  }

  for (const { url: checkUrl, type } of urlsToCheck) {
    try {
      // Use HEAD request to check existence without downloading content
      const response = await fetch(checkUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'llms-forge/1.0 (Documentation Validator)',
        },
      })

      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        result = {
          exists: true,
          type,
          size: contentLength ? parseInt(contentLength, 10) : undefined,
          url: checkUrl,
        }
        break
      }
    } catch {
      // Continue to next URL on error
      continue
    }
  }

  // Cache the result
  cache.set(cacheKey, result)

  const headers = rateLimiter.getHeaders(rateLimitResult)
  return NextResponse.json(result, {
    headers: {
      ...headers,
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=120',
    },
  })
}

/**
 * HEAD endpoint - Quick existence check
 * Returns status 200 if llms.txt exists, 404 otherwise
 */
export async function HEAD(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return new NextResponse(null, { status: 400 })
  }

  // Apply rate limiting
  const rateLimiter = getRateLimiter()
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)

  if (!rateLimitResult.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        ...rateLimiter.getHeaders(rateLimitResult),
        'Retry-After': String(rateLimitResult.resetAt - Math.floor(Date.now() / 1000)),
      },
    })
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
    return new NextResponse(null, { status: 400 })
  }

  const baseUrl = `${urlObj.protocol}//${urlObj.host}`
  const cacheKey = normalizeUrlKey(baseUrl)

  // Check cache first
  const cache = getValidationCache<ValidationResult>()
  const cachedResult = cache.get(cacheKey)

  const headers = rateLimiter.getHeaders(rateLimitResult)

  if (cachedResult) {
    return new NextResponse(null, {
      status: cachedResult.exists ? 200 : 404,
      headers: {
        ...headers,
        'X-Cache': 'HIT',
        'X-LLMs-Type': cachedResult.type || 'none',
        'X-Content-Size': cachedResult.size?.toString() || '0',
      },
    })
  }

  // Check for llms-full.txt and llms.txt
  const urlsToCheck: Array<{ url: string; type: 'full' | 'standard' }> = [
    { url: `${baseUrl}/llms-full.txt`, type: 'full' },
    { url: `${baseUrl}/llms.txt`, type: 'standard' },
  ]

  for (const { url: checkUrl, type } of urlsToCheck) {
    try {
      const response = await fetch(checkUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'llms-forge/1.0 (Documentation Validator)',
        },
      })

      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        const result: ValidationResult = {
          exists: true,
          type,
          size: contentLength ? parseInt(contentLength, 10) : undefined,
          url: checkUrl,
        }
        cache.set(cacheKey, result)

        return new NextResponse(null, {
          status: 200,
          headers: {
            ...headers,
            'X-Cache': 'MISS',
            'X-LLMs-Type': type,
            'X-Content-Size': contentLength || '0',
          },
        })
      }
    } catch {
      continue
    }
  }

  // Not found - cache this result too
  const notFoundResult: ValidationResult = {
    exists: false,
    type: null,
  }
  cache.set(cacheKey, notFoundResult)

  return new NextResponse(null, {
    status: 404,
    headers: {
      ...headers,
      'X-Cache': 'MISS',
      'X-LLMs-Type': 'none',
    },
  })
}
