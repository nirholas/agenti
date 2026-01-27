import { NextRequest, NextResponse } from 'next/server'

/**
 * Site suggestion interface
 */
interface SiteSuggestion {
  url: string
  name: string
  description?: string
  submittedAt: number
  llmsTxtExists: boolean | null
}

// In-memory storage for suggestions
const suggestions: SiteSuggestion[] = []
const MAX_SUGGESTIONS = 1000

/**
 * Check if a URL has an llms.txt file
 */
async function checkLlmsTxt(baseUrl: string): Promise<boolean> {
  try {
    // Normalize URL
    const url = new URL(baseUrl)
    const llmsTxtUrl = `${url.origin}/llms.txt`

    const response = await fetch(llmsTxtUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })

    return response.ok
  } catch {
    return false
  }
}

/**
 * POST /api/sites/suggest
 * Submit a new site suggestion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Site name is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    let normalizedUrl: string
    try {
      const parsed = new URL(body.url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: 'URL must use HTTP or HTTPS protocol' },
          { status: 400 }
        )
      }
      normalizedUrl = parsed.origin
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Check for duplicate suggestions
    const existingSuggestion = suggestions.find(
      (s) => new URL(s.url).hostname === new URL(normalizedUrl).hostname
    )
    if (existingSuggestion) {
      return NextResponse.json(
        { error: 'This site has already been suggested' },
        { status: 409 }
      )
    }

    // Check if llms.txt exists
    const llmsTxtExists = await checkLlmsTxt(normalizedUrl)

    // Create suggestion
    const suggestion: SiteSuggestion = {
      url: normalizedUrl,
      name: body.name.trim().slice(0, 100),
      description: body.description?.trim().slice(0, 500),
      submittedAt: Date.now(),
      llmsTxtExists,
    }

    // Store suggestion
    suggestions.push(suggestion)

    // Cleanup old suggestions if over limit
    if (suggestions.length > MAX_SUGGESTIONS) {
      suggestions.shift()
    }

    return NextResponse.json({
      success: true,
      message: llmsTxtExists
        ? 'Site suggestion received! We verified it has an llms.txt file.'
        : 'Site suggestion received. Note: We could not verify an llms.txt file exists.',
      llmsTxtExists,
    })
  } catch (error) {
    console.error('Site suggest POST error:', error)
    return NextResponse.json(
      { error: 'Failed to submit suggestion' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sites/suggest
 * Get list of suggestions (for admin use)
 */
export async function GET() {
  try {
    // Return suggestions sorted by most recent
    const sortedSuggestions = [...suggestions]
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, 100)

    return NextResponse.json({
      count: suggestions.length,
      suggestions: sortedSuggestions,
    })
  } catch (error) {
    console.error('Site suggest GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve suggestions' },
      { status: 500 }
    )
  }
}
