import { NextRequest, NextResponse } from 'next/server'
import { KNOWN_SITES, VerificationResult } from '@/data/sites'
import { getRateLimiter } from '@/lib/rate-limiter'

const TIMEOUT_MS = parseInt(process.env.HEALTH_TIMEOUT_MS || '8000', 10)

interface HealthCheckResult {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'error' | 'slow'
  responseTime: number
  llmsTxtFound: boolean
  llmsFullTxtFound: boolean
  foundAt?: string
  error?: string
}

interface HealthReport {
  timestamp: string
  totalSites: number
  online: number
  offline: number
  errors: number
  slow: number
  averageResponseTime: number
  results: HealthCheckResult[]
}

// Rate limiter for health endpoint (more restrictive since it's resource-intensive)
const rateLimiter = getRateLimiter({ windowMs: 60 * 1000, maxRequests: 30 })

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

// In-memory storage for last health report
let lastHealthReport: HealthReport | null = null
let lastHealthCheckTime = 0
const HEALTH_CHECK_COOLDOWN = 60 * 1000 // 1 minute between full checks

/**
 * Quick check if a URL returns a valid response
 */
async function quickCheck(url: string): Promise<{ ok: boolean; responseTime: number; finalUrl?: string }> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'llms-txt-health-check/1.0',
      },
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    return {
      ok: response.ok,
      responseTime,
      finalUrl: response.url,
    }
  } catch {
    return {
      ok: false,
      responseTime: Date.now() - startTime,
    }
  }
}

/**
 * Check a single site's health
 */
async function checkSiteHealth(site: typeof KNOWN_SITES[number]): Promise<HealthCheckResult> {
  const baseUrl = site.llmsTxtUrl || site.url
  const startTime = Date.now()

  try {
    const url = new URL(baseUrl)
    const origin = url.origin

    // Check llms.txt and llms-full.txt in parallel
    const [llmsTxt, llmsFullTxt, docsLlmsTxt] = await Promise.all([
      quickCheck(`${origin}/llms.txt`),
      quickCheck(`${origin}/llms-full.txt`),
      quickCheck(`${origin}/docs/llms.txt`),
    ])

    const responseTime = Date.now() - startTime
    const llmsTxtFound = llmsTxt.ok || docsLlmsTxt.ok
    const llmsFullTxtFound = llmsFullTxt.ok
    const anyFound = llmsTxtFound || llmsFullTxtFound

    let status: HealthCheckResult['status']
    if (!anyFound) {
      status = 'offline'
    } else if (responseTime > 5000) {
      status = 'slow'
    } else {
      status = 'online'
    }

    const foundAt = llmsFullTxt.ok 
      ? llmsFullTxt.finalUrl 
      : llmsTxt.ok 
        ? llmsTxt.finalUrl 
        : docsLlmsTxt.ok 
          ? docsLlmsTxt.finalUrl 
          : undefined

    return {
      id: site.id,
      name: site.name,
      url: baseUrl,
      status,
      responseTime,
      llmsTxtFound,
      llmsFullTxtFound,
      foundAt,
    }
  } catch (error) {
    return {
      id: site.id,
      name: site.name,
      url: baseUrl,
      status: 'error',
      responseTime: Date.now() - startTime,
      llmsTxtFound: false,
      llmsFullTxtFound: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * GET /api/sites/health
 * Get health status of all known sites
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

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'
  const siteId = request.nextUrl.searchParams.get('id')

  // If checking a single site
  if (siteId) {
    const site = KNOWN_SITES.find(s => s.id === siteId)
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    const result = await checkSiteHealth(site)
    return NextResponse.json(result)
  }

  // Check if we can return cached results
  const now = Date.now()
  if (!forceRefresh && lastHealthReport && now - lastHealthCheckTime < HEALTH_CHECK_COOLDOWN) {
    return NextResponse.json({
      ...lastHealthReport,
      cached: true,
      cacheAge: Math.round((now - lastHealthCheckTime) / 1000),
    })
  }

  // Perform full health check
  const results = await Promise.all(
    KNOWN_SITES.map(site => checkSiteHealth(site))
  )

  // Calculate summary statistics
  const online = results.filter(r => r.status === 'online').length
  const offline = results.filter(r => r.status === 'offline').length
  const errors = results.filter(r => r.status === 'error').length
  const slow = results.filter(r => r.status === 'slow').length
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    totalSites: KNOWN_SITES.length,
    online,
    offline,
    errors,
    slow,
    averageResponseTime: Math.round(avgResponseTime),
    results,
  }

  // Cache the report
  lastHealthReport = report
  lastHealthCheckTime = now

  return NextResponse.json(report)
}

/**
 * POST /api/sites/health
 * Trigger a health check for specific sites
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { siteIds } = body as { siteIds?: string[] }

    if (!siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
      return NextResponse.json(
        { error: 'siteIds array is required' },
        { status: 400 }
      )
    }

    // Limit to 50 sites at a time
    const limitedIds = siteIds.slice(0, 50)
    const sites = KNOWN_SITES.filter(s => limitedIds.includes(s.id))

    if (sites.length === 0) {
      return NextResponse.json(
        { error: 'No matching sites found' },
        { status: 404 }
      )
    }

    const results = await Promise.all(
      sites.map(site => checkSiteHealth(site))
    )

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total: results.length,
      results,
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: 'Failed to perform health check' },
      { status: 500 }
    )
  }
}
