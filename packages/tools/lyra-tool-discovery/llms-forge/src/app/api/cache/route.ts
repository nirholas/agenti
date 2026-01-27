import { NextRequest, NextResponse } from 'next/server'
import { getAllCacheStats, clearAllCaches, getExtractionCache, getValidationCache } from '@/lib/cache'
import { getRateLimiter } from '@/lib/rate-limiter'

/**
 * GET endpoint - Return cache statistics
 */
export async function GET() {
  const cacheStats = getAllCacheStats()
  const rateLimiterStats = getRateLimiter().getStats()

  return NextResponse.json({
    cache: cacheStats,
    rateLimiter: rateLimiterStats,
    timestamp: Date.now(),
  })
}

/**
 * DELETE endpoint - Clear all caches
 * Protected: Requires x-admin-key header
 */
export async function DELETE(request: NextRequest) {
  // Simple protection - require admin key header
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_KEY || 'llms-forge-admin'

  if (adminKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get stats before clearing
  const beforeStats = getAllCacheStats()

  // Clear caches
  clearAllCaches()

  // Optionally clear rate limiter data
  const clearRateLimiter = request.nextUrl.searchParams.get('clearRateLimiter') === 'true'
  if (clearRateLimiter) {
    getRateLimiter().clear()
  }

  return NextResponse.json({
    success: true,
    cleared: {
      extraction: beforeStats.extraction?.size ?? 0,
      validation: beforeStats.validation?.size ?? 0,
      rateLimiter: clearRateLimiter,
    },
    timestamp: Date.now(),
  })
}

/**
 * POST endpoint - Prune expired entries and return stats
 * Protected: Requires x-admin-key header
 */
export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_KEY || 'llms-forge-admin'

  if (adminKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Prune expired entries
  const extractionCache = getExtractionCache()
  const validationCache = getValidationCache()

  const prunedExtraction = extractionCache.prune()
  const prunedValidation = validationCache.prune()

  // Cleanup rate limiter
  const cleanedRateLimiter = getRateLimiter().cleanup()

  return NextResponse.json({
    success: true,
    pruned: {
      extraction: prunedExtraction,
      validation: prunedValidation,
      rateLimiter: cleanedRateLimiter,
    },
    currentStats: getAllCacheStats(),
    timestamp: Date.now(),
  })
}
