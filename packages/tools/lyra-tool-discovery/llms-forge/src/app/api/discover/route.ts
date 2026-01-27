import { NextRequest, NextResponse } from 'next/server'
import { discoverLlmsTxt, quickCheckLlmsTxt } from '@/lib/url-discovery'

/**
 * GET /api/discover
 * Discover llms.txt file for a given domain
 * 
 * Query params:
 * - url: The domain to scan (required)
 * - quick: If "true", only check the exact URL provided (no discovery)
 * - timeout: Timeout in milliseconds (default: 20000)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const quick = searchParams.get('quick') === 'true'
  const timeout = parseInt(searchParams.get('timeout') || '20000', 10)

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  try {
    const result = quick 
      ? await quickCheckLlmsTxt(url)
      : await discoverLlmsTxt(url, { timeoutMs: Math.min(timeout, 30000) })

    if (result.found) {
      return NextResponse.json({
        success: true,
        found: true,
        url: result.url,
        llmsTxtUrl: result.llmsTxtUrl,
        type: result.type,
        scannedUrls: result.scannedUrls,
        timeElapsed: result.timeElapsed,
      })
    } else {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No llms.txt file found',
        scannedUrls: result.scannedUrls,
        timeElapsed: result.timeElapsed,
        suggestion: 'Try providing a more specific URL or check if the site supports llms.txt',
      })
    }
  } catch (error) {
    console.error('Discovery error:', error)
    return NextResponse.json(
      { 
        error: 'Discovery failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
