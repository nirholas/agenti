import { NextRequest, NextResponse } from 'next/server'
import { ExtractionResult, Document, ExportFormat, LinkedSource } from '@/types'
import { getExtractionCache, normalizeUrlKey } from '@/lib/cache'
import { getRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rate-limiter'
import { exportToFormat, getMimeTypeForFormat, getFilenameForFormat } from '@/lib/exporters'

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
 * Interface for a linked llms.txt file
 */
interface LinkedLlmsTxt {
  url: string;
  name: string;
  description?: string;
  content?: string;
  isFull?: boolean;  // Whether this is a -full.txt version
}

/**
 * Detect and extract links to other llms.txt files from content
 * Supports patterns like:
 * - https://example.com/llms-sdk.txt
 * - https://example.com/llms-full.txt
 * - https://example.com/llms-sdk-full.txt
 */
function detectLinkedLlmsTxtFiles(content: string, baseUrl: string): LinkedLlmsTxt[] {
  const linkedFiles: LinkedLlmsTxt[] = [];
  const seenUrls = new Set<string>();
  
  // Pattern to match llms*.txt URLs
  const urlPattern = /https?:\/\/[^\s<>"']+\/llms[^\/\s<>"']*\.txt/gi;
  
  const matches = content.matchAll(urlPattern);
  const filesByBase = new Map<string, LinkedLlmsTxt[]>();
  
  for (const match of matches) {
    const url = match[0];
    
    // Skip if we've already seen this URL
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    
    // Skip the main llms.txt file itself
    if (url.endsWith('/llms.txt') || url === `${baseUrl}/llms.txt`) continue;
    
    // Extract a name from the URL
    const filename = url.split('/').pop() || 'llms.txt';
    const isFull = filename.includes('-full');
    const baseName = filename
      .replace(/^llms-?/, '')
      .replace(/-full\.txt$/, '')
      .replace(/\.txt$/, '')
      .replace(/-/g, ' ')
      .trim() || 'Documentation';
    
    // Try to find a description from the surrounding context
    const lineContainingUrl = content.split('\n').find(line => line.includes(url)) || '';
    const description = lineContainingUrl
      .replace(url, '')
      .replace(/[-–—:]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    
    const linkedFile: LinkedLlmsTxt = {
      url,
      name: baseName.charAt(0).toUpperCase() + baseName.slice(1),
      description: description || undefined,
      isFull,
    };
    
    // Group by base name to prefer -full versions
    const baseKey = baseName.toLowerCase();
    if (!filesByBase.has(baseKey)) {
      filesByBase.set(baseKey, []);
    }
    filesByBase.get(baseKey)!.push(linkedFile);
  }
  
  // For each base name, prefer the -full version
  for (const [, files] of filesByBase) {
    // Sort so -full versions come first
    files.sort((a, b) => (b.isFull ? 1 : 0) - (a.isFull ? 1 : 0));
    // Only add the first (prefer full) version
    linkedFiles.push(files[0]);
  }
  
  return linkedFiles;
}

/**
 * Fetch content from a linked llms.txt file
 */
async function fetchLinkedLlmsTxt(file: LinkedLlmsTxt): Promise<LinkedLlmsTxt> {
  try {
    const response = await fetch(file.url, {
      headers: {
        'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
      },
    });
    
    if (response.ok) {
      const content = await response.text();
      return { ...file, content };
    }
  } catch (error) {
    console.error(`Failed to fetch linked llms.txt: ${file.url}`, error);
  }
  
  return file;
}

/**
 * Fetch all linked llms.txt files in parallel
 */
async function fetchAllLinkedLlmsTxt(files: LinkedLlmsTxt[]): Promise<LinkedLlmsTxt[]> {
  // Limit concurrent fetches to avoid overwhelming servers
  const MAX_CONCURRENT = 5;
  const results: LinkedLlmsTxt[] = [];
  
  for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
    const batch = files.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map(fetchLinkedLlmsTxt));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Add rate limit and cache headers to response
 */
function addResponseHeaders(
  headers: Record<string, string>,
  rateLimitResult: { limit: number; remaining: number; resetAt: number },
  cacheStatus: 'HIT' | 'MISS',
  cacheTtl?: number
): Record<string, string> {
  return {
    ...headers,
    'X-Cache': cacheStatus,
    'X-Cache-TTL': cacheTtl !== undefined ? String(cacheTtl) : '0',
    'X-RateLimit-Limit': String(rateLimitResult.limit),
    'X-RateLimit-Remaining': String(rateLimitResult.remaining),
    'X-RateLimit-Reset': String(rateLimitResult.resetAt),
    'Cache-Control': 'public, max-age=300', // 5 minutes
  }
}

/**
 * POST endpoint - Simple extraction
 * Fetches llms-full.txt or llms.txt from a domain and returns the content
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Apply rate limiting
  const rateLimiter = getRateLimiter()
  const clientIp = getClientIp(request)
  const rateLimitResult = rateLimiter.checkAndRecord(clientIp)

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, rateLimiter)
  }
  
  try {
    const body = await request.json()
    const { url } = body
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Simple extraction - just fetch llms-full.txt or llms.txt
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
    const hostname = urlObj.hostname.replace(/^www\./, '')
    
    // Extract root domain for subdomain checks (e.g., defillama.com from api.defillama.com)
    const domainParts = hostname.split('.')
    const rootDomain = domainParts.length > 2 
      ? domainParts.slice(-2).join('.') 
      : hostname
    
    const cacheKey = normalizeUrlKey(baseUrl)

    // Check cache first
    const cache = getExtractionCache<ExtractionResult>()
    const cachedResult = cache.get(cacheKey)

    if (cachedResult) {
      // Return cached result with updated processing time
      const cachedWithTime: ExtractionResult = {
        ...cachedResult,
        stats: {
          ...cachedResult.stats,
          processingTime: Date.now() - startTime,
        },
      }
      const responseHeaders = addResponseHeaders(
        {},
        rateLimitResult,
        'HIT',
        cache.getTtlRemaining(cacheKey)
      )
      return NextResponse.json(cachedWithTime, { headers: responseHeaders })
    }
    
    let content: string | null = null
    let sourceUrl: string = ''
    
    // Build list of subdomains to check
    const subdomains = [
      baseUrl,
      `https://docs.${rootDomain}`,
      `https://api-docs.${rootDomain}`,
      `https://developer.${rootDomain}`,
      `https://api.${rootDomain}`,
    ]
    
    // Priority 1: llms-full.txt on all subdomains
    for (const subdomain of subdomains) {
      const tryUrl = `${subdomain}/llms-full.txt`
      try {
        const response = await fetch(tryUrl, {
          headers: {
            'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
          },
        })
        
        if (response.ok) {
          content = await response.text()
          sourceUrl = tryUrl
          break
        }
      } catch {
        continue
      }
    }
    
    // Priority 2: llms.txt on all subdomains
    if (!content) {
      for (const subdomain of subdomains) {
        const tryUrl = `${subdomain}/llms.txt`
        try {
          const response = await fetch(tryUrl, {
            headers: {
              'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
            },
          })
          
          if (response.ok) {
            content = await response.text()
            sourceUrl = tryUrl
            break
          }
        } catch {
          continue
        }
      }
    }
    
    if (!content) {
      return NextResponse.json(
        { error: `No llms.txt or llms-full.txt found at ${urlObj.host}` },
        { status: 404 }
      )
    }
    
    // Check if the content contains links to other llms.txt files
    // This is common for documentation hubs like MetaMask that split docs by product
    const linkedFiles = detectLinkedLlmsTxtFiles(content, baseUrl);
    let linkedLlmsTxtData: LinkedLlmsTxt[] = [];
    
    if (linkedFiles.length > 0) {
      // Fetch all linked llms.txt files
      linkedLlmsTxtData = await fetchAllLinkedLlmsTxt(linkedFiles);
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
    
    // Add documents from linked llms.txt files
    for (const linked of linkedLlmsTxtData) {
      if (!linked.content) continue;
      
      // Create a document for each linked file
      const linkedFilename = linked.url.split('/').pop() || 'linked.txt';
      const linkedSlug = slugify(linked.name || linkedFilename.replace('.txt', ''));
      
      // Parse the linked content into sections too
      const linkedSections = linked.content.split(/^## /m);
      
      for (let i = 0; i < linkedSections.length; i++) {
        const section = linkedSections[i].trim();
        if (!section || section.length < 20) continue;
        
        const lines = section.split('\n');
        const sectionTitle = i === 0 
          ? linked.name || 'Documentation'
          : (lines[0] || `${linked.name} Section ${i}`);
        const sectionContent = i === 0 
          ? section 
          : `## ${lines[0]}\n\n${lines.slice(1).join('\n').trim()}`;
        
        documents.push({
          filename: `${String(documents.length + 1).padStart(2, '0')}-${linkedSlug}-${slugify(sectionTitle)}.md`,
          title: `${linked.name}: ${sectionTitle}`,
          content: sectionContent,
          tokens: estimateTokens(sectionContent),
          sourceUrl: linked.url,
        });
      }
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
    
    // Combine main content with all linked content for full document
    let combinedContent = content;
    if (linkedLlmsTxtData.length > 0) {
      combinedContent += '\n\n---\n\n# Additional Documentation Sources\n\n';
      for (const linked of linkedLlmsTxtData) {
        if (linked.content) {
          combinedContent += `\n\n---\n\n## ${linked.name}\n\n> Source: ${linked.url}\n\n${linked.content}`;
        }
      }
    }
    
    const fullDocument: Document = {
      filename: 'docs.md',
      title: `${siteName} Documentation`,
      content: combinedContent,
      tokens: estimateTokens(combinedContent),
    }
    
    // Build agent guide with info about linked docs
    let agentGuideContent = `# ${siteName} Documentation\n\nExtracted from ${sourceUrl}\n\nUse this documentation to answer questions about ${siteName}.`;
    
    if (linkedLlmsTxtData.length > 0) {
      agentGuideContent += '\n\n## Documentation Sources\n\nThis extraction includes content from multiple documentation sources:\n';
      agentGuideContent += `\n- Main: ${sourceUrl}`;
      for (const linked of linkedLlmsTxtData) {
        if (linked.content) {
          agentGuideContent += `\n- ${linked.name}: ${linked.url}`;
        }
      }
    }
    
    const agentGuide: Document = {
      filename: 'AGENT-GUIDE.md',
      title: 'Agent Guide',
      content: agentGuideContent,
      tokens: estimateTokens(agentGuideContent),
    }
    
    const totalTokens = documents.reduce((sum, doc) => sum + doc.tokens, 0) 
      + fullDocument.tokens 
      + agentGuide.tokens
    
    const processingTime = Date.now() - startTime
    
    // Build linkedSources info for the result
    const linkedSources = linkedLlmsTxtData
      .filter(l => l.content)
      .map(l => ({
        url: l.url,
        name: l.name,
        description: l.description,
        tokens: l.content ? estimateTokens(l.content) : 0,
      }));
    
    const result: ExtractionResult = {
      url: targetUrl,
      sourceUrl,
      rawContent: content,
      documents,
      fullDocument,
      agentGuide,
      linkedSources: linkedSources.length > 0 ? linkedSources : undefined,
      stats: {
        totalTokens,
        documentCount: documents.length,
        processingTime,
        linkedSourceCount: linkedSources.length > 0 ? linkedSources.length : undefined,
      }
    }

    // Cache the successful result
    cache.set(cacheKey, result)
    
    // Check for format parameter
    const formatParam = request.nextUrl.searchParams.get('format') as ExportFormat | null
    const acceptHeader = request.headers.get('accept')
    
    // Determine output format based on query param, Accept header, or default to JSON
    let outputFormat: ExportFormat | null = null
    
    if (formatParam && ['markdown', 'json', 'yaml'].includes(formatParam)) {
      outputFormat = formatParam
    } else if (acceptHeader) {
      if (acceptHeader.includes('text/markdown')) {
        outputFormat = 'markdown'
      } else if (acceptHeader.includes('text/yaml') || acceptHeader.includes('application/yaml')) {
        outputFormat = 'yaml'
      }
    }
    
    // If format is specified, return formatted content instead of JSON
    if (outputFormat) {
      const formattedContent = exportToFormat(result, outputFormat)
      const mimeType = getMimeTypeForFormat(outputFormat)
      const siteName = urlObj.host.replace('www.', '').split('.')[0]
      const filename = getFilenameForFormat(siteName, outputFormat)
      
      return new NextResponse(formattedContent, {
        status: 200,
        headers: {
          'Content-Type': `${mimeType}; charset=utf-8`,
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...addResponseHeaders({}, rateLimitResult, 'MISS', cache.getTtlRemaining(cacheKey)),
        },
      })
    }
    
    const responseHeaders = addResponseHeaders(
      {},
      rateLimitResult,
      'MISS',
      cache.getTtlRemaining(cacheKey)
    )
    
    return NextResponse.json(result, { headers: responseHeaders })
    
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint - Simple extraction (same as POST but with query param)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL is required as query parameter' },
      { status: 400 }
    )
  }

  // Create a mock request body for POST handler
  const originalJson = request.json.bind(request)
  const mockRequest = Object.create(request, {
    json: {
      value: async () => ({ url }),
    },
    headers: {
      value: request.headers,
    },
  }) as NextRequest
  
  return POST(mockRequest)
}