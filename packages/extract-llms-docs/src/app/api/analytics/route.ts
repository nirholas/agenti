import { NextRequest, NextResponse } from 'next/server'
import {
  recordExtraction,
  getStats,
  getRecentEvents,
  ExtractionEvent,
} from '@/lib/analytics'

/**
 * POST /api/analytics
 * Record an extraction event
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.url || typeof body.success !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: url and success' },
        { status: 400 }
      )
    }

    // Extract host from URL
    let host: string
    try {
      host = new URL(body.url).hostname
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const event: ExtractionEvent = {
      url: body.url,
      host,
      timestamp: Date.now(),
      success: body.success,
      documentCount: body.documentCount,
      totalTokens: body.totalTokens,
      processingTime: body.processingTime,
      cached: body.cached,
    }

    recordExtraction(event)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics POST error:', error)
    return NextResponse.json(
      { error: 'Failed to record analytics' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/analytics
 * Retrieve aggregated statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeRecent = searchParams.get('includeRecent') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const stats = getStats()

    const response: Record<string, unknown> = { stats }

    if (includeRecent) {
      response.recentEvents = getRecentEvents(limit)
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve analytics' },
      { status: 500 }
    )
  }
}
