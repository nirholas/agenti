import { NextRequest, NextResponse } from 'next/server'
import { analyzeGitHubRepo, generateInstallMdPrompt, parseGitHubUrl } from '@/lib/github-analyzer'
import { analyzeDocsUrl, generateInstallMdPromptFromDocs } from '@/lib/docs-analyzer'
import { getRateLimiter } from '@/lib/rate-limiter'
import Anthropic from '@anthropic-ai/sdk'

const rateLimiter = getRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 })

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

const INSTALL_MD_SYSTEM_PROMPT = `You are an expert at creating install.md files following the Mintlify standard for LLM-executable installation instructions.

Your task is to generate a valid install.md file that an AI agent can use to autonomously install software.

The install.md format MUST include:
1. H1 header with product name (lowercase-hyphenated, e.g., # my-cli-tool)
2. Blockquote description (> Brief description of the software)
3. Action prompt: "I want you to install [Product] for me. Execute all the steps below autonomously."
4. OBJECTIVE: What the installation should achieve
5. DONE WHEN: Specific verification criteria (usually a command that confirms success)
6. ## TODO section with markdown checkbox list (- [ ] step)
7. Step sections (## Prerequisites, ## Install, ## Verify, etc.) with code blocks
8. EXECUTE NOW: Call-to-action referencing the TODO list and objective

Guidelines:
- Be explicit and specific - write for an agent with no prior context
- Include version checks for prerequisites (e.g., node --version)
- Provide multiple installation methods when available (npm, pnpm, yarn, etc.)
- Include verification steps to confirm successful installation
- Handle common edge cases (permissions, PATH issues, etc.)
- Keep code blocks in bash/shell format
- Make the TODO list comprehensive but not overwhelming (5-8 items typically)

Output ONLY the install.md content, no explanations or markdown code fences around it.`

/**
 * POST /api/generate-install
 * 
 * Generate install.md from a GitHub repo or documentation URL
 */
export async function POST(request: NextRequest) {
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
  
  try {
    const body = await request.json()
    const { url, type, githubToken } = body as {
      url: string
      type: 'github' | 'docs'
      githubToken?: string
    }
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }
    
    if (!type || (type !== 'github' && type !== 'docs')) {
      return NextResponse.json({ error: 'Type must be "github" or "docs"' }, { status: 400 })
    }
    
    // Check for API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json(
        { error: 'AI generation not configured. Please set ANTHROPIC_API_KEY.' },
        { status: 503 }
      )
    }
    
    let prompt: string
    let productName: string
    let description: string
    
    if (type === 'github') {
      // Validate GitHub URL
      const parsed = parseGitHubUrl(url)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
      }
      
      // Analyze GitHub repo
      const analysis = await analyzeGitHubRepo(url, githubToken)
      prompt = generateInstallMdPrompt(analysis)
      productName = analysis.repo
      description = analysis.description
      
      // Return analysis for preview if no AI key
      if (!anthropicKey) {
        return NextResponse.json({
          success: true,
          analysis: {
            productName,
            description,
            projectType: analysis.projectType,
            hasCli: analysis.hasCli,
            installMethods: analysis.installMethods,
            latestVersion: analysis.latestRelease?.tagName,
          },
          prompt,
        })
      }
    } else {
      // Analyze docs URL
      const analysis = await analyzeDocsUrl(url)
      prompt = generateInstallMdPromptFromDocs(analysis)
      productName = analysis.title
      description = analysis.description
      
      // Return analysis for preview if no AI key
      if (!anthropicKey) {
        return NextResponse.json({
          success: true,
          analysis: {
            productName,
            description,
            platform: analysis.platform,
            installCommands: analysis.installCommands,
            prerequisites: analysis.prerequisites,
          },
          prompt,
        })
      }
    }
    
    // Generate install.md using Claude
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: INSTALL_MD_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })
    
    // Extract text content
    const textContent = message.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }
    
    let installMd = textContent.text.trim()
    
    // Clean up any markdown code fences if present
    if (installMd.startsWith('```')) {
      installMd = installMd.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```$/, '')
    }
    
    return NextResponse.json({
      success: true,
      installMd,
      productName,
      description,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
    })
    
  } catch (error) {
    console.error('Generate install.md error:', error)
    
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: 'GitHub API rate limit exceeded. Please try again later or provide a GitHub token.' },
          { status: 429 }
        )
      }
      if (error.message.includes('not found') || error.message.includes('404')) {
        return NextResponse.json(
          { error: 'Repository or page not found. Please check the URL.' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/generate-install?url=...&type=github|docs
 * 
 * Analyze a URL without generating (preview mode)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const type = request.nextUrl.searchParams.get('type') as 'github' | 'docs' | null
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }
  
  if (!type || (type !== 'github' && type !== 'docs')) {
    return NextResponse.json({ error: 'Type must be "github" or "docs"' }, { status: 400 })
  }
  
  try {
    if (type === 'github') {
      const parsed = parseGitHubUrl(url)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
      }
      
      const analysis = await analyzeGitHubRepo(url)
      
      return NextResponse.json({
        success: true,
        type: 'github',
        analysis: {
          owner: analysis.owner,
          repo: analysis.repo,
          description: analysis.description,
          language: analysis.language,
          projectType: analysis.projectType,
          hasCli: analysis.hasCli,
          installMethods: analysis.installMethods,
          latestVersion: analysis.latestRelease?.tagName,
          stars: analysis.stars,
          topics: analysis.topics,
          homepage: analysis.homepage,
        },
      })
    } else {
      const analysis = await analyzeDocsUrl(url)
      
      return NextResponse.json({
        success: true,
        type: 'docs',
        analysis: {
          title: analysis.title,
          description: analysis.description,
          platform: analysis.platform,
          installCommands: analysis.installCommands,
          prerequisites: analysis.prerequisites,
          codeBlockCount: analysis.allCodeBlocks.length,
          sectionCount: analysis.sections.length,
          relatedUrls: analysis.relatedUrls,
        },
      })
    }
  } catch (error) {
    console.error('Analyze URL error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
