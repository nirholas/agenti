import { NextRequest, NextResponse } from 'next/server'
import { parseInstallMd, isValidInstallMd } from '@/lib/install-md-parser'

/**
 * POST /api/validate-install
 * Validates an install.md file or URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, content } = body

    if (!url && !content) {
      return NextResponse.json(
        { error: 'Either url or content is required' },
        { status: 400 }
      )
    }

    let installMdContent = content

    // Fetch from URL if provided
    if (url) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
          },
        })

        if (!response.ok) {
          return NextResponse.json(
            { 
              exists: false,
              error: `Failed to fetch install.md: ${response.status}` 
            },
            { status: 200 }
          )
        }

        installMdContent = await response.text()
      } catch (error) {
        return NextResponse.json(
          { 
            exists: false,
            error: 'Failed to fetch install.md from URL' 
          },
          { status: 200 }
        )
      }
    }

    // Check if content looks like valid install.md
    const isValid = isValidInstallMd(installMdContent)

    if (!isValid) {
      return NextResponse.json({
        exists: true,
        isValid: false,
        error: 'Content does not appear to be a valid install.md file',
        hints: [
          'Missing product name (H1 header)',
          'Missing OBJECTIVE: declaration',
          'Missing DONE WHEN: criteria',
          'Missing ## TODO section with checkboxes',
        ],
      })
    }

    // Parse the content
    const parsed = parseInstallMd(installMdContent)

    return NextResponse.json({
      exists: true,
      isValid: parsed.isValid,
      validationErrors: parsed.validationErrors,
      summary: {
        productName: parsed.productName,
        description: parsed.description,
        objective: parsed.objective,
        doneWhen: parsed.doneWhen,
        todoCount: parsed.todoItems.length,
        stepCount: parsed.steps.length,
        totalCodeBlocks: parsed.steps.reduce(
          (sum, step) => sum + step.codeBlocks.length, 
          0
        ),
      },
      size: installMdContent.length,
      url: url || null,
    })

  } catch (error) {
    console.error('Error validating install.md:', error)
    return NextResponse.json(
      { error: 'Failed to validate install.md' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/validate-install?url=...
 * Quick check if a URL has an install.md file
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Try to construct install.md URL
    const urlObj = new URL(url)
    const baseUrl = urlObj.origin
    
    const installMdLocations = [
      `${baseUrl}/install.md`,
      `${baseUrl}/docs/install.md`,
    ]

    for (const installUrl of installMdLocations) {
      try {
        const response = await fetch(installUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
          },
        })

        if (response.ok) {
          // Fetch and validate content
          const contentResponse = await fetch(installUrl, {
            headers: {
              'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
            },
          })
          const content = await contentResponse.text()
          const isValid = isValidInstallMd(content)

          return NextResponse.json({
            exists: true,
            url: installUrl,
            isValid,
            size: content.length,
          })
        }
      } catch {
        // Continue to next location
      }
    }

    return NextResponse.json({
      exists: false,
      url: null,
      checkedLocations: installMdLocations,
    })

  } catch (error) {
    console.error('Error checking install.md:', error)
    return NextResponse.json(
      { error: 'Failed to check for install.md' },
      { status: 500 }
    )
  }
}
