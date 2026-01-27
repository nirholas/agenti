/**
 * Ultra-Intelligent URL Discovery System
 * 
 * A comprehensive, multi-strategy approach to finding llms.txt files for ANY website.
 * Combines 15+ discovery strategies to maximize success rate:
 * 
 * PHASE 1 - Quick Checks:
 * 1. Well-known paths (.well-known/llms.txt, /llms.txt)
 * 2. User-provided URL direct check
 * 
 * PHASE 2 - Pattern Generation:
 * 3. Subdomain patterns (50+ common doc subdomains)
 * 4. Path patterns (30+ common doc paths)
 * 5. External doc platform subdomains (gitbook, readme, notion)
 * 
 * PHASE 3 - Deep Analysis:
 * 6. Homepage HTML analysis (links, nav menus, footers)
 * 7. Link text analysis (finds "Docs", "API", "Documentation" links)
 * 8. Meta tag extraction (og:site_name, canonical URLs)
 * 9. JSON-LD structured data parsing
 * 10. robots.txt parsing (sitemaps, allowed paths)
 * 11. Sitemap.xml deep analysis
 * 
 * PHASE 4 - Platform Detection:
 * 12. Documentation platform fingerprinting (15+ platforms)
 * 13. API documentation framework detection (Swagger, Redoc, Stoplight)
 * 14. GitHub/GitLab repository discovery
 * 15. External hosted docs detection (GitBook, ReadMe, Notion sites)
 * 
 * PHASE 5 - Advanced:
 * 16. Deep link crawling on promising paths
 * 17. Common naming convention matching
 * 18. Redirect following and final URL analysis
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DiscoveryResult {
  found: boolean
  url: string | null
  llmsTxtUrl: string | null
  type: 'llms-full' | 'llms-standard' | null
  scannedUrls: string[]
  timeElapsed: number
  discoveryMethod?: string
  confidence?: 'high' | 'medium' | 'low'
  additionalInfo?: {
    platform?: string
    sitemapFound?: boolean
    robotsTxtFound?: boolean
    githubRepo?: string
    externalDocsUrl?: string
    detectedFramework?: string
  }
}

export interface DiscoveryProgress {
  currentUrl: string
  scannedCount: number
  totalToScan: number
  status: 'scanning' | 'found' | 'not-found' | 'error'
  currentStrategy?: string
  phase?: string
}

interface LlmsTxtCheckResult {
  found: boolean
  url: string | null
  type: 'llms-full' | 'llms-standard' | null
  content?: string
}

interface DiscoveredUrl {
  url: string
  priority: number  // Lower = higher priority
  source: string
  metadata?: Record<string, string>
}

// ============================================================================
// Configuration - Comprehensive patterns for ANY website
// ============================================================================

const CONFIG = {
  // Timeout settings
  defaultTimeoutMs: 45000,  // Increased for thorough scanning
  perRequestTimeoutMs: 6000,
  
  // Batch processing
  batchSize: 10,
  maxUrlsToScan: 150,
  
  // Common documentation subdomains (50+ patterns, ordered by likelihood)
  subdomains: [
    // Most common
    'docs', 'doc', 'documentation',
    'api', 'api-docs', 'apidocs', 'api-reference',
    'developers', 'developer', 'dev',
    // Secondary common
    'reference', 'ref',
    'help', 'support', 'faq',
    'learn', 'learning', 'education',
    'guide', 'guides', 'tutorial', 'tutorials',
    'wiki', 'kb', 'knowledge', 'knowledgebase',
    // Technical
    'devdocs', 'dev-docs', 'devportal', 'dev-portal', 'portal',
    'platform', 'console', 'dashboard',
    'openapi', 'swagger', 'spec', 'specs', 'schema',
    // Enterprise/Product
    'manual', 'handbook', 'resources',
    'community', 'forum', 'discuss',
    'status', 'changelog', 'releases',
    // Versioned
    'v1', 'v2', 'v3', 'latest', 'stable', 'beta',
    // Internationalized
    'en', 'www',
  ],
  
  // Common documentation paths (30+ patterns)
  docPaths: [
    // Root doc paths
    '/docs', '/doc', '/documentation',
    '/api', '/api-docs', '/api-reference', '/reference',
    '/developers', '/developer', '/dev',
    // Help & Support
    '/help', '/support', '/faq', '/faqs',
    '/guide', '/guides', '/tutorial', '/tutorials',
    '/learn', '/learning', '/getting-started', '/quickstart',
    // Technical
    '/manual', '/handbook', '/resources', '/wiki', '/kb',
    '/openapi', '/swagger', '/redoc', '/api-explorer',
    // Versioned paths
    '/v1/docs', '/v2/docs', '/v3/docs',
    '/latest', '/stable', '/current',
    // Nested common patterns
    '/en/docs', '/en-us/docs',
    '/api/v1', '/api/v2', '/api/v3',
  ],
  
  // Well-known paths to check first
  wellKnownPaths: [
    '/.well-known/llms.txt',
    '/.well-known/llms-full.txt',
    '/llms.txt',
    '/llms-full.txt',
    '/docs/llms.txt',
    '/api/llms.txt',
  ],
  
  // External documentation hosting platforms
  externalDocPlatforms: {
    gitbook: {
      // GitBook hosted docs: {name}.gitbook.io or custom domain
      subdomainPatterns: ['.gitbook.io', '.gitbook.com'],
      indicators: ['x-gitbook', 'gitbook', 'powered by gitbook'],
      llmsPaths: ['/llms.txt', '/llms-full.txt'],
    },
    readme: {
      // ReadMe hosted docs: {name}.readme.io
      subdomainPatterns: ['.readme.io', '.readme.com'],
      indicators: ['x-readme', 'readme.io', 'powered by readme'],
      llmsPaths: ['/llms.txt', '/llms-full.txt', '/reference/llms.txt'],
    },
    notion: {
      // Notion sites: {name}.notion.site
      subdomainPatterns: ['.notion.site', '.notion.so'],
      indicators: ['notion.site', 'notion-static'],
      llmsPaths: ['/llms.txt'],
    },
    mintlify: {
      // Mintlify hosted docs
      subdomainPatterns: ['.mintlify.app', '.mintlify.dev'],
      indicators: ['mintlify', 'x-mintlify'],
      llmsPaths: ['/llms.txt', '/llms-full.txt'],
    },
    docusaurus: {
      indicators: ['docusaurus', '__docusaurus', 'docsearch'],
      llmsPaths: ['/llms.txt', '/docs/llms.txt'],
    },
    vitepress: {
      indicators: ['vitepress', '.vitepress', 'vp-doc'],
      llmsPaths: ['/llms.txt', '/guide/llms.txt'],
    },
    docsify: {
      indicators: ['docsify', 'window.$docsify'],
      llmsPaths: ['/llms.txt'],
    },
    mkdocs: {
      indicators: ['mkdocs', 'material for mkdocs', 'mike/'],
      llmsPaths: ['/llms.txt', '/llms-full.txt'],
    },
    sphinx: {
      indicators: ['sphinx', 'alabaster', '_sphinx_javascript_frameworks_compat'],
      llmsPaths: ['/llms.txt', '/_static/llms.txt'],
    },
    readthedocs: {
      subdomainPatterns: ['.readthedocs.io', '.readthedocs.org', '.rtfd.io'],
      indicators: ['readthedocs', 'rtd-'],
      llmsPaths: ['/llms.txt', '/en/latest/llms.txt', '/en/stable/llms.txt'],
    },
    confluence: {
      subdomainPatterns: ['.atlassian.net'],
      indicators: ['confluence', 'atlassian'],
      llmsPaths: ['/llms.txt'],
    },
    zendesk: {
      subdomainPatterns: ['.zendesk.com'],
      indicators: ['zendesk', 'zd-'],
      llmsPaths: ['/llms.txt', '/hc/llms.txt'],
    },
    intercom: {
      subdomainPatterns: ['.intercom.help'],
      indicators: ['intercom'],
      llmsPaths: ['/llms.txt'],
    },
    helpscout: {
      subdomainPatterns: ['.helpscoutdocs.com'],
      indicators: ['help scout', 'helpscout'],
      llmsPaths: ['/llms.txt'],
    },
    gitiles: {
      indicators: ['gitiles'],
      llmsPaths: ['/+/HEAD/llms.txt', '/llms.txt'],
    },
  },
  
  // API documentation frameworks
  apiDocFrameworks: {
    swagger: {
      indicators: ['swagger-ui', 'swagger.json', 'swagger.yaml'],
      paths: ['/swagger', '/swagger-ui', '/api-docs', '/swagger.json'],
    },
    redoc: {
      indicators: ['redoc', 'redocly'],
      paths: ['/redoc', '/api-docs', '/docs/api'],
    },
    stoplight: {
      indicators: ['stoplight', 'elements-api'],
      paths: ['/docs', '/api-reference'],
    },
    rapidoc: {
      indicators: ['rapi-doc', 'rapidoc'],
      paths: ['/docs', '/api'],
    },
    scalar: {
      indicators: ['scalar', '@scalar/api-reference'],
      paths: ['/reference', '/docs'],
    },
    slate: {
      indicators: ['slate', 'tocify'],
      paths: ['/docs', '/api'],
    },
  },
  
  // Link text patterns that indicate documentation
  docLinkTextPatterns: [
    /docs?/i,
    /documentation/i,
    /api\s*(?:reference|docs?)?/i,
    /developers?/i,
    /reference/i,
    /guide/i,
    /tutorial/i,
    /learn/i,
    /getting\s*started/i,
    /quickstart/i,
    /manual/i,
    /handbook/i,
    /wiki/i,
    /help(?:\s*center)?/i,
    /support/i,
    /knowledge\s*base/i,
    /faq/i,
    /resources/i,
  ],
  
  // User agent for requests
  userAgent: 'llms-forge/1.0 (Intelligent Documentation Discovery; +https://llm.energy)',
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a URL and extract domain components
 */
function parseUrl(inputUrl: string): {
  protocol: string
  hostname: string
  baseDomain: string
  tld: string
  fullDomain: string
  hasSubdomain: boolean
  subdomain: string | null
} | null {
  try {
    let normalizedUrl = inputUrl.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }
    
    const urlObj = new URL(normalizedUrl)
    const hostname = urlObj.hostname
    const protocol = urlObj.protocol
    const parts = hostname.split('.')
    
    let baseDomain: string
    let tld: string
    let subdomain: string | null = null
    
    // Handle common compound TLDs
    const compoundTlds = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'org.uk', 'net.au']
    const lastTwo = parts.slice(-2).join('.')
    
    if (compoundTlds.includes(lastTwo) && parts.length >= 3) {
      tld = lastTwo
      baseDomain = parts[parts.length - 3]
      if (parts.length > 3) {
        subdomain = parts.slice(0, -3).join('.')
      }
    } else if (parts.length >= 2) {
      tld = parts[parts.length - 1]
      baseDomain = parts[parts.length - 2]
      if (parts.length > 2) {
        subdomain = parts.slice(0, -2).join('.')
      }
    } else {
      baseDomain = parts[0]
      tld = 'com'
    }
    
    const fullDomain = `${baseDomain}.${tld}`
    const hasSubdomain = subdomain !== null && subdomain !== 'www'
    
    return {
      protocol,
      hostname,
      baseDomain,
      tld,
      fullDomain,
      hasSubdomain,
      subdomain: subdomain === 'www' ? null : subdomain,
    }
  } catch {
    return null
  }
}

/**
 * Create a fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = CONFIG.perRequestTimeoutMs
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': (options.headers as Record<string, string>)?.['Accept'] || '*/*',
        ...(options.headers as Record<string, string>),
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Check if content looks like valid llms.txt
 */
function isValidLlmsTxtContent(content: string): boolean {
  if (!content || content.length < 10) return false
  
  const trimmed = content.trim().toLowerCase()
  
  // Reject HTML
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
    return false
  }
  
  // Should contain markdown-like content
  const hasMarkdownIndicators = 
    content.includes('#') ||  // Headers
    content.includes('>') ||  // Blockquotes
    content.includes('- ') || // Lists
    content.includes('* ') || // Lists
    content.includes('[') ||  // Links
    content.includes('```')   // Code blocks
  
  return hasMarkdownIndicators
}

// ============================================================================
// Core Discovery Functions
// ============================================================================

/**
 * Check if a specific URL has an llms.txt file
 */
async function checkForLlmsTxt(
  baseUrl: string,
  signal?: AbortSignal
): Promise<LlmsTxtCheckResult> {
  const filesToTry = ['llms-full.txt', 'llms.txt']
  const normalizedBase = baseUrl.replace(/\/$/, '')
  
  for (const file of filesToTry) {
    const testUrl = `${normalizedBase}/${file}`
    
    try {
      const response = await fetchWithTimeout(testUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/plain, text/markdown, */*' },
        redirect: 'follow',
      })
      
      if (response.ok) {
        const text = await response.text()
        
        if (isValidLlmsTxtContent(text)) {
          return {
            found: true,
            url: testUrl,
            type: file === 'llms-full.txt' ? 'llms-full' : 'llms-standard',
            content: text.slice(0, 500), // Preview
          }
        }
      }
    } catch {
      // Continue to next file
    }
  }
  
  return { found: false, url: null, type: null }
}

/**
 * Check well-known paths for llms.txt
 */
async function checkWellKnownPaths(
  baseUrl: string,
  signal?: AbortSignal
): Promise<LlmsTxtCheckResult> {
  const parsed = parseUrl(baseUrl)
  if (!parsed) return { found: false, url: null, type: null }
  
  const baseUrls = [
    `${parsed.protocol}//${parsed.hostname}`,
    `${parsed.protocol}//${parsed.fullDomain}`,
    `${parsed.protocol}//www.${parsed.fullDomain}`,
  ]
  
  for (const base of Array.from(new Set(baseUrls))) {
    for (const path of CONFIG.wellKnownPaths) {
      const testUrl = `${base}${path}`
      
      try {
        const response = await fetchWithTimeout(testUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/plain, text/markdown, */*' },
          redirect: 'follow',
        })
        
        if (response.ok) {
          const text = await response.text()
          if (isValidLlmsTxtContent(text)) {
            return {
              found: true,
              url: testUrl,
              type: path.includes('llms-full') ? 'llms-full' : 'llms-standard',
            }
          }
        }
      } catch {
        // Continue
      }
    }
  }
  
  return { found: false, url: null, type: null }
}

// ============================================================================
// Strategy 1: Generate URL Patterns
// ============================================================================

function generateUrlPatterns(inputUrl: string): DiscoveredUrl[] {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) {
    return [{ url: inputUrl, priority: 0, source: 'input' }]
  }
  
  const { protocol, hostname, baseDomain, tld, fullDomain, hasSubdomain, subdomain } = parsed
  
  // If user provided a specific subdomain, prioritize it
  if (hasSubdomain && subdomain) {
    urls.push({ url: `${protocol}//${hostname}`, priority: 0, source: 'user-provided-subdomain' })
  }
  
  // Add subdomain variations
  CONFIG.subdomains.forEach((sub, index) => {
    urls.push({
      url: `${protocol}//${sub}.${fullDomain}`,
      priority: 10 + index,
      source: 'subdomain-pattern',
    })
  })
  
  // Add main domain
  urls.push({ url: `${protocol}//${fullDomain}`, priority: 5, source: 'main-domain' })
  urls.push({ url: `${protocol}//www.${fullDomain}`, priority: 6, source: 'www-domain' })
  
  // Add path-based documentation locations
  CONFIG.docPaths.forEach((path, index) => {
    urls.push({
      url: `${protocol}//${fullDomain}${path}`,
      priority: 50 + index,
      source: 'path-pattern',
    })
    urls.push({
      url: `${protocol}//www.${fullDomain}${path}`,
      priority: 51 + index,
      source: 'path-pattern',
    })
  })
  
  // Deduplicate and sort by priority
  const seen = new Set<string>()
  return urls
    .filter(u => {
      if (seen.has(u.url)) return false
      seen.add(u.url)
      return true
    })
    .sort((a, b) => a.priority - b.priority)
}

// ============================================================================
// Strategy 2: Parse robots.txt
// ============================================================================

async function parseRobotsTxt(inputUrl: string): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return urls
  
  const robotsUrls = [
    `${parsed.protocol}//${parsed.hostname}/robots.txt`,
    `${parsed.protocol}//${parsed.fullDomain}/robots.txt`,
  ]
  
  for (const robotsUrl of Array.from(new Set(robotsUrls))) {
    try {
      const response = await fetchWithTimeout(robotsUrl, {
        headers: { 'Accept': 'text/plain' },
      })
      
      if (!response.ok) continue
      
      const text = await response.text()
      
      // Look for Sitemap directives
      const sitemapMatches = Array.from(text.matchAll(/Sitemap:\s*(\S+)/gi))
      for (const match of sitemapMatches) {
        urls.push({
          url: match[1].trim(),
          priority: 15,
          source: 'robots-sitemap',
        })
      }
      
      // Look for Allow/Disallow patterns that might indicate docs
      const lines = text.split('\n')
      for (const line of lines) {
        const allowMatch = line.match(/Allow:\s*(\S+)/i)
        if (allowMatch) {
          const path = allowMatch[1]
          if (/docs?|api|developer|reference|guide|help/i.test(path)) {
            const baseUrl = robotsUrl.replace('/robots.txt', '')
            urls.push({
              url: `${baseUrl}${path.replace(/\*/g, '')}`,
              priority: 30,
              source: 'robots-allow',
            })
          }
        }
      }
    } catch {
      // Continue to next URL
    }
  }
  
  return urls
}

// ============================================================================
// Strategy 3: Parse Sitemap
// ============================================================================

async function parseSitemap(sitemapUrl: string, depth: number = 0): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  
  // Prevent infinite recursion
  if (depth > 2) return urls
  
  try {
    const response = await fetchWithTimeout(sitemapUrl, {
      headers: { 'Accept': 'application/xml, text/xml, */*' },
    })
    
    if (!response.ok) return urls
    
    const text = await response.text()
    
    // Check if it's a sitemap index
    if (text.includes('<sitemapindex')) {
      const sitemapLocMatches = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi))
      for (const match of sitemapLocMatches) {
        const nestedUrl = match[1].trim()
        if (nestedUrl.includes('sitemap') && nestedUrl.endsWith('.xml')) {
          // Recursively parse nested sitemaps (limit depth)
          const nestedUrls = await parseSitemap(nestedUrl, depth + 1)
          urls.push(...nestedUrls)
        }
      }
    }
    
    // Extract URLs from sitemap
    const locMatches = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi))
    for (const match of locMatches) {
      const url = match[1].trim()
      
      // Look for documentation-related URLs
      if (/docs?|api|developer|reference|guide|help|getting-started|quickstart/i.test(url)) {
        // Extract base doc URL
        try {
          const urlObj = new URL(url)
          const pathParts = urlObj.pathname.split('/').filter(Boolean)
          
          // Get the docs root
          for (let i = 0; i < pathParts.length; i++) {
            if (/docs?|api|developer|reference|guide|help/i.test(pathParts[i])) {
              const docsRoot = `${urlObj.protocol}//${urlObj.host}/${pathParts.slice(0, i + 1).join('/')}`
              urls.push({
                url: docsRoot,
                priority: 20,
                source: 'sitemap-docs',
              })
              break
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
  } catch {
    // Silently fail
  }
  
  return urls
}

// ============================================================================
// Strategy 4: Scrape Homepage for Links
// ============================================================================

async function scrapeHomepageLinks(inputUrl: string): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return urls
  
  const pagesToScrape = [
    `${parsed.protocol}//${parsed.hostname}`,
    `${parsed.protocol}//${parsed.fullDomain}`,
  ]
  
  for (const pageUrl of Array.from(new Set(pagesToScrape))) {
    try {
      const response = await fetchWithTimeout(pageUrl, {
        headers: { 'Accept': 'text/html' },
      })
      
      if (!response.ok) continue
      
      const html = await response.text()
      const baseHost = new URL(pageUrl).hostname.replace('www.', '')
      
      // Extract all href attributes
      const hrefMatches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
      
      for (const match of hrefMatches) {
        let url = match[1]
        
        // Skip non-http links
        if (url.startsWith('#') || url.startsWith('javascript:') || 
            url.startsWith('mailto:') || url.startsWith('tel:')) {
          continue
        }
        
        // Convert relative URLs
        if (url.startsWith('/')) {
          url = `${parsed.protocol}//${new URL(pageUrl).host}${url}`
        } else if (!url.startsWith('http')) {
          continue
        }
        
        // Check if URL looks like documentation
        try {
          const urlObj = new URL(url)
          const urlHost = urlObj.hostname.replace('www.', '')
          
          // Must be same domain or known doc platform
          const isRelated = 
            urlHost.includes(baseHost) ||
            urlHost.includes(parsed.baseDomain) ||
            /gitbook|readme|notion|mintlify|docusaurus|readthedocs/.test(urlHost)
          
          if (!isRelated) continue
          
          // Check if path or subdomain indicates docs
          const isDocUrl = 
            /docs?|api-docs?|documentation|developer|reference|guide|help|learn/.test(urlObj.hostname) ||
            /docs?|api|developer|reference|guide|help|getting-started/.test(urlObj.pathname)
          
          if (isDocUrl) {
            urls.push({
              url: url.replace(/\/$/, ''),
              priority: 25,
              source: 'homepage-link',
            })
          }
        } catch {
          continue
        }
      }
      
      // Also look for meta tags
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      if (canonicalMatch) {
        urls.push({
          url: canonicalMatch[1],
          priority: 5,
          source: 'canonical',
        })
      }
      
      // Look for documentation link in nav/header
      const docLinkPatterns = [
        /href=["']([^"']+)["'][^>]*>(?:[^<]*(?:docs?|documentation|api|developers?|reference|guide))/gi,
        /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*(?:docs?|nav|menu)[^"']*["']/gi,
      ]
      
      for (const pattern of docLinkPatterns) {
        const matches = Array.from(html.matchAll(pattern))
        for (const m of matches) {
          let docUrl = m[1]
          if (docUrl.startsWith('/')) {
            docUrl = `${parsed.protocol}//${new URL(pageUrl).host}${docUrl}`
          }
          if (docUrl.startsWith('http')) {
            urls.push({
              url: docUrl.replace(/\/$/, ''),
              priority: 15,
              source: 'nav-link',
            })
          }
        }
      }
    } catch {
      continue
    }
  }
  
  return urls
}

// ============================================================================
// Strategy 5: Detect Documentation Platform
// ============================================================================

async function detectDocPlatform(inputUrl: string): Promise<{
  platform: string | null
  urls: DiscoveredUrl[]
}> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return { platform: null, urls }
  
  const pagesToCheck = [
    `${parsed.protocol}//${parsed.hostname}`,
    `${parsed.protocol}//${parsed.fullDomain}`,
  ]
  
  for (const pageUrl of Array.from(new Set(pagesToCheck))) {
    try {
      const response = await fetchWithTimeout(pageUrl, {
        headers: { 'Accept': 'text/html' },
      })
      
      if (!response.ok) continue
      
      const html = await response.text().then(t => t.toLowerCase())
      const headers = Object.fromEntries(response.headers.entries())
      const headersStr = JSON.stringify(headers).toLowerCase()
      
      // Check each platform
      for (const [platform, config] of Object.entries(CONFIG.externalDocPlatforms)) {
        const indicators = config.indicators || []
        const isMatch = indicators.some(indicator => 
          html.includes(indicator.toLowerCase()) || 
          headersStr.includes(indicator.toLowerCase())
        )
        
        if (isMatch) {
          // Add platform-specific paths
          const llmsPaths = config.llmsPaths || ['/llms.txt', '/llms-full.txt']
          for (const path of llmsPaths) {
            urls.push({
              url: `${pageUrl}${path}`,
              priority: 5,
              source: `platform-${platform}`,
            })
          }
          
          return { platform, urls }
        }
      }
    } catch {
      continue
    }
  }
  
  return { platform: null, urls }
}

// ============================================================================
// Strategy 6: Check GitHub/GitLab Repository
// ============================================================================

async function checkGitRepository(inputUrl: string): Promise<{
  repoUrl: string | null
  urls: DiscoveredUrl[]
}> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return { repoUrl: null, urls }
  
  // Try to find GitHub/GitLab link on homepage
  try {
    const response = await fetchWithTimeout(`${parsed.protocol}//${parsed.hostname}`, {
      headers: { 'Accept': 'text/html' },
    })
    
    if (response.ok) {
      const html = await response.text()
      
      // Look for GitHub links
      const githubMatch = html.match(/href=["'](https:\/\/github\.com\/[^"'\/]+\/[^"'\/]+)/i)
      if (githubMatch) {
        const repoUrl = githubMatch[1]
        const rawBase = repoUrl.replace('github.com', 'raw.githubusercontent.com')
        
        // Check common doc locations in repo
        urls.push(
          { url: `${rawBase}/main/llms.txt`, priority: 10, source: 'github-main' },
          { url: `${rawBase}/master/llms.txt`, priority: 11, source: 'github-master' },
          { url: `${rawBase}/main/docs/llms.txt`, priority: 12, source: 'github-docs' },
          { url: `${rawBase}/master/docs/llms.txt`, priority: 13, source: 'github-docs' },
          { url: `${rawBase}/main/llms-full.txt`, priority: 14, source: 'github-main' },
          { url: `${rawBase}/master/llms-full.txt`, priority: 15, source: 'github-master' },
        )
        
        // Also check GitHub Pages
        const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
        if (repoMatch) {
          const [, owner, repo] = repoMatch
          if (owner && repo) {
            urls.push(
              { url: `https://${owner}.github.io/${repo}/llms.txt`, priority: 8, source: 'github-pages' },
              { url: `https://${owner}.github.io/${repo}/llms-full.txt`, priority: 9, source: 'github-pages' },
            )
          }
        }
        
        return { repoUrl, urls }
      }
      
      // Look for GitLab links
      const gitlabMatch = html.match(/href=["'](https:\/\/gitlab\.com\/[^"']+)/i)
      if (gitlabMatch) {
        const repoUrl = gitlabMatch[1]
        urls.push(
          { url: `${repoUrl}/-/raw/main/llms.txt`, priority: 10, source: 'gitlab-main' },
          { url: `${repoUrl}/-/raw/master/llms.txt`, priority: 11, source: 'gitlab-master' },
        )
        return { repoUrl, urls }
      }
    }
  } catch {
    // Continue
  }
  
  return { repoUrl: null, urls }
}

// ============================================================================
// Strategy 7: Check OpenAPI/Swagger
// ============================================================================

async function checkOpenApiEndpoints(inputUrl: string): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return urls
  
  const openApiPaths = [
    '/openapi.json',
    '/openapi.yaml',
    '/swagger.json',
    '/swagger.yaml',
    '/api/openapi.json',
    '/api/swagger.json',
    '/v1/openapi.json',
    '/v2/openapi.json',
    '/v3/openapi.json',
    '/api-docs',
    '/api-docs/swagger.json',
  ]
  
  const bases = [
    `${parsed.protocol}//${parsed.hostname}`,
    `${parsed.protocol}//${parsed.fullDomain}`,
    `${parsed.protocol}//api.${parsed.fullDomain}`,
  ]
  
  for (const base of Array.from(new Set(bases))) {
    for (const path of openApiPaths) {
      try {
        const response = await fetchWithTimeout(`${base}${path}`, {
          method: 'HEAD',
        })
        
        if (response.ok) {
          // OpenAPI found - docs are likely nearby
          urls.push(
            { url: base, priority: 8, source: 'openapi-base' },
            { url: `${base}/docs`, priority: 9, source: 'openapi-docs' },
          )
          break
        }
      } catch {
        continue
      }
    }
  }
  
  return urls
}

// ============================================================================
// Strategy 8: External Documentation Platform Discovery
// ============================================================================

async function discoverExternalDocPlatforms(inputUrl: string): Promise<{
  externalUrl: string | null
  urls: DiscoveredUrl[]
}> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return { externalUrl: null, urls }
  
  const { baseDomain, fullDomain } = parsed
  
  // Check common external doc hosting patterns
  const externalPatterns = [
    // GitBook
    { host: `${baseDomain}.gitbook.io`, platform: 'gitbook' },
    { host: `docs-${baseDomain}.gitbook.io`, platform: 'gitbook' },
    // ReadMe
    { host: `${baseDomain}.readme.io`, platform: 'readme' },
    // Notion
    { host: `${baseDomain}.notion.site`, platform: 'notion' },
    // ReadTheDocs
    { host: `${baseDomain}.readthedocs.io`, platform: 'readthedocs' },
    { host: `${baseDomain}.rtfd.io`, platform: 'readthedocs' },
    // Mintlify
    { host: `docs.${fullDomain}`, platform: 'mintlify' },  // Often Mintlify
    // Zendesk
    { host: `${baseDomain}.zendesk.com`, platform: 'zendesk' },
    { host: `support.${fullDomain}`, platform: 'zendesk' },
    // Intercom
    { host: `${baseDomain}.intercom.help`, platform: 'intercom' },
    // Help Scout
    { host: `${baseDomain}.helpscoutdocs.com`, platform: 'helpscout' },
  ]
  
  for (const { host, platform } of externalPatterns) {
    const testUrl = `https://${host}`
    try {
      const response = await fetchWithTimeout(testUrl, { method: 'HEAD' }, 3000)
      if (response.ok) {
        const config = CONFIG.externalDocPlatforms[platform as keyof typeof CONFIG.externalDocPlatforms]
        if (config && config.llmsPaths) {
          for (const path of config.llmsPaths) {
            urls.push({
              url: `${testUrl}${path}`,
              priority: 3,  // High priority - external doc platforms often have llms.txt
              source: `external-${platform}`,
            })
          }
        }
        return { externalUrl: testUrl, urls }
      }
    } catch {
      // Continue
    }
  }
  
  return { externalUrl: null, urls }
}

// ============================================================================
// Strategy 9: Deep Link Text Analysis
// ============================================================================

async function analyzeLinksWithText(inputUrl: string): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return urls
  
  try {
    const response = await fetchWithTimeout(`${parsed.protocol}//${parsed.hostname}`, {
      headers: { 'Accept': 'text/html' },
    })
    
    if (!response.ok) return urls
    
    const html = await response.text()
    
    // Find links with documentation-related text
    // Pattern: <a href="URL">TEXT</a> where TEXT matches doc patterns
    const linkWithTextPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
    const matches = Array.from(html.matchAll(linkWithTextPattern))
    
    for (const match of matches) {
      const [, href, linkText] = match
      if (!href || !linkText) continue
      
      // Check if link text matches documentation patterns
      const isDocLink = CONFIG.docLinkTextPatterns.some(pattern => pattern.test(linkText.trim()))
      
      if (isDocLink) {
        let fullUrl = href
        
        // Convert relative URLs
        if (href.startsWith('/')) {
          fullUrl = `${parsed.protocol}//${parsed.hostname}${href}`
        } else if (!href.startsWith('http')) {
          continue
        }
        
        try {
          const urlObj = new URL(fullUrl)
          // Accept same domain, subdomains, or known doc platforms
          const host = urlObj.hostname
          if (
            host.includes(parsed.baseDomain) ||
            /gitbook|readme|notion|mintlify|readthedocs|zendesk|intercom|helpscout/.test(host)
          ) {
            urls.push({
              url: fullUrl.replace(/\/$/, ''),
              priority: 8,  // High priority - explicit doc links
              source: 'link-text-analysis',
              metadata: { linkText: linkText.trim().slice(0, 50) },
            })
          }
        } catch {
          continue
        }
      }
    }
    
    // Also check for header/nav elements specifically
    const navPatterns = [
      /<nav[^>]*>([\s\S]*?)<\/nav>/gi,
      /<header[^>]*>([\s\S]*?)<\/header>/gi,
      /class=["'][^"']*(?:nav|menu|header)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|ul|nav)>/gi,
    ]
    
    for (const navPattern of navPatterns) {
      const navMatches = Array.from(html.matchAll(navPattern))
      for (const navMatch of navMatches) {
        const navContent = navMatch[1] || navMatch[0]
        const navLinks = Array.from(navContent.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi))
        
        for (const [, href, text] of navLinks) {
          if (!href || !text) continue
          
          const isDocLink = CONFIG.docLinkTextPatterns.some(pattern => pattern.test(text.trim()))
          if (isDocLink) {
            let fullUrl = href
            if (href.startsWith('/')) {
              fullUrl = `${parsed.protocol}//${parsed.hostname}${href}`
            } else if (!href.startsWith('http')) {
              continue
            }
            
            try {
              new URL(fullUrl)
              urls.push({
                url: fullUrl.replace(/\/$/, ''),
                priority: 5,  // Very high priority - nav links are primary
                source: 'nav-text-analysis',
              })
            } catch {
              continue
            }
          }
        }
      }
    }
    
  } catch {
    // Silently fail
  }
  
  return urls
}

// ============================================================================
// Strategy 10: JSON-LD Structured Data Analysis
// ============================================================================

async function analyzeStructuredData(inputUrl: string): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return urls
  
  try {
    const response = await fetchWithTimeout(`${parsed.protocol}//${parsed.hostname}`, {
      headers: { 'Accept': 'text/html' },
    })
    
    if (!response.ok) return urls
    
    const html = await response.text()
    
    // Find JSON-LD scripts
    const jsonLdMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1])
        
        // Look for documentation-related URLs in structured data
        const findUrls = (obj: unknown, path: string = ''): void => {
          if (!obj || typeof obj !== 'object') return
          
          if (Array.isArray(obj)) {
            obj.forEach((item, i) => findUrls(item, `${path}[${i}]`))
            return
          }
          
          for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            if (typeof value === 'string' && value.startsWith('http')) {
              // Check if this looks like a doc URL
              if (/docs?|documentation|api|developer|reference|guide|help/i.test(key) ||
                  /docs?|documentation|api|developer|reference|guide|help/i.test(value)) {
                urls.push({
                  url: value,
                  priority: 12,
                  source: 'json-ld',
                  metadata: { key },
                })
              }
            } else if (typeof value === 'object') {
              findUrls(value, `${path}.${key}`)
            }
          }
        }
        
        findUrls(jsonData)
      } catch {
        // Invalid JSON, skip
      }
    }
  } catch {
    // Silently fail
  }
  
  return urls
}

// ============================================================================
// Strategy 11: API Documentation Framework Detection
// ============================================================================

async function detectApiDocFramework(inputUrl: string): Promise<{
  framework: string | null
  urls: DiscoveredUrl[]
}> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return { framework: null, urls }
  
  // Check common API doc paths for framework indicators
  const pathsToCheck = [
    '',
    '/docs',
    '/api-docs',
    '/api',
    '/reference',
    '/swagger',
    '/redoc',
  ]
  
  const bases = [
    `${parsed.protocol}//${parsed.hostname}`,
    `${parsed.protocol}//${parsed.fullDomain}`,
    `${parsed.protocol}//api.${parsed.fullDomain}`,
  ]
  
  for (const base of Array.from(new Set(bases))) {
    for (const path of pathsToCheck) {
      try {
        const testUrl = `${base}${path}`
        const response = await fetchWithTimeout(testUrl, {
          headers: { 'Accept': 'text/html' },
        }, 3000)
        
        if (!response.ok) continue
        
        const html = (await response.text()).toLowerCase()
        
        // Check each API doc framework
        for (const [framework, config] of Object.entries(CONFIG.apiDocFrameworks)) {
          const isMatch = config.indicators.some(ind => html.includes(ind.toLowerCase()))
          
          if (isMatch) {
            // Framework detected - check its specific paths for llms.txt
            for (const fwPath of config.paths) {
              urls.push({
                url: `${base}${fwPath}`,
                priority: 6,
                source: `api-framework-${framework}`,
              })
            }
            
            // Also check main URL
            urls.push({
              url: testUrl,
              priority: 4,
              source: `api-framework-${framework}`,
            })
            
            return { framework, urls }
          }
        }
      } catch {
        continue
      }
    }
  }
  
  return { framework: null, urls }
}

// ============================================================================
// Strategy 12: Footer Link Analysis
// ============================================================================

async function analyzeFooterLinks(inputUrl: string): Promise<DiscoveredUrl[]> {
  const urls: DiscoveredUrl[] = []
  const parsed = parseUrl(inputUrl)
  
  if (!parsed) return urls
  
  try {
    const response = await fetchWithTimeout(`${parsed.protocol}//${parsed.hostname}`, {
      headers: { 'Accept': 'text/html' },
    })
    
    if (!response.ok) return urls
    
    const html = await response.text()
    
    // Find footer sections
    const footerPatterns = [
      /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
      /class=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      /id=["']footer["'][^>]*>([\s\S]*?)<\/div>/gi,
    ]
    
    for (const pattern of footerPatterns) {
      const footerMatches = Array.from(html.matchAll(pattern))
      
      for (const footerMatch of footerMatches) {
        const footerContent = footerMatch[1] || footerMatch[0]
        const linkMatches = Array.from(footerContent.matchAll(/href=["']([^"']+)["']/gi))
        
        for (const [, href] of linkMatches) {
          if (!href) continue
          
          // Check if URL looks like documentation
          if (/docs?|api|developer|documentation|reference|guide|help|support/i.test(href)) {
            let fullUrl = href
            if (href.startsWith('/')) {
              fullUrl = `${parsed.protocol}//${parsed.hostname}${href}`
            } else if (!href.startsWith('http')) {
              continue
            }
            
            try {
              new URL(fullUrl)
              urls.push({
                url: fullUrl.replace(/\/$/, ''),
                priority: 18,
                source: 'footer-link',
              })
            } catch {
              continue
            }
          }
        }
      }
    }
  } catch {
    // Silently fail
  }
  
  return urls
}

// ============================================================================
// Main Discovery Function - Ultra-Comprehensive
// ============================================================================

type DiscoveryStrategy = 
  | 'wellknown' 
  | 'patterns' 
  | 'platform' 
  | 'homepage' 
  | 'robots' 
  | 'sitemap' 
  | 'github' 
  | 'openapi'
  | 'external'      // External doc platforms (GitBook, ReadMe, etc.)
  | 'linktext'      // Link text analysis
  | 'jsonld'        // JSON-LD structured data
  | 'apiframework'  // API doc framework detection
  | 'footer'        // Footer link analysis

export async function discoverLlmsTxt(
  inputUrl: string,
  options: {
    timeoutMs?: number
    onProgress?: (progress: DiscoveryProgress) => void
    strategies?: DiscoveryStrategy[]
  } = {}
): Promise<DiscoveryResult> {
  const {
    timeoutMs = CONFIG.defaultTimeoutMs,
    onProgress,
    // Use ALL strategies by default for maximum intelligence
    strategies = [
      'wellknown',
      'external',
      'linktext',
      'patterns',
      'platform',
      'apiframework',
      'homepage',
      'footer',
      'jsonld',
      'robots',
      'sitemap',
      'github',
      'openapi',
    ],
  } = options
  
  const startTime = Date.now()
  const scannedUrls: string[] = []
  const allDiscoveredUrls: DiscoveredUrl[] = []
  const additionalInfo: DiscoveryResult['additionalInfo'] = {}
  
  // Helper to check timeout
  const isTimedOut = () => Date.now() - startTime > timeoutMs
  
  // Helper to report progress with phase
  const reportProgress = (
    currentUrl: string, 
    strategy: string, 
    status: DiscoveryProgress['status'] = 'scanning',
    phase?: string
  ) => {
    if (onProgress) {
      onProgress({
        currentUrl,
        scannedCount: scannedUrls.length,
        totalToScan: Math.max(scannedUrls.length + 10, allDiscoveredUrls.length),
        status,
        currentStrategy: strategy,
        phase,
      })
    }
  }
  
  try {
    // ========================================================================
    // PHASE 1: Quick Checks (highest chance of immediate success)
    // ========================================================================
    
    // Strategy: Well-known paths
    if (strategies.includes('wellknown') && !isTimedOut()) {
      reportProgress('Checking well-known paths...', 'wellknown', 'scanning', 'Phase 1: Quick Checks')
      const result = await checkWellKnownPaths(inputUrl)
      if (result.found && result.url) {
        scannedUrls.push(result.url)
        reportProgress(result.url, 'wellknown', 'found')
        return {
          found: true,
          url: result.url.replace(/\/llms(-full)?\.txt$/, ''),
          llmsTxtUrl: result.url,
          type: result.type,
          scannedUrls,
          timeElapsed: Date.now() - startTime,
          discoveryMethod: 'well-known-path',
          confidence: 'high',
        }
      }
    }
    
    // ========================================================================
    // PHASE 2: Parallel Discovery (gather ALL potential URLs)
    // ========================================================================
    reportProgress('Gathering potential documentation URLs...', 'discovery', 'scanning', 'Phase 2: Discovery')
    
    const discoveryPromises: Promise<DiscoveredUrl[]>[] = []
    
    // Strategy: External doc platforms (high priority - GitBook, ReadMe, etc.)
    if (strategies.includes('external')) {
      discoveryPromises.push(
        discoverExternalDocPlatforms(inputUrl).then(result => {
          if (result.externalUrl) additionalInfo.externalDocsUrl = result.externalUrl
          return result.urls
        })
      )
    }
    
    // Strategy: Link text analysis (finds explicit "Docs" links)
    if (strategies.includes('linktext')) {
      discoveryPromises.push(analyzeLinksWithText(inputUrl))
    }
    
    // Strategy: URL pattern generation
    if (strategies.includes('patterns')) {
      discoveryPromises.push(Promise.resolve(generateUrlPatterns(inputUrl)))
    }
    
    // Strategy: Documentation platform detection
    if (strategies.includes('platform')) {
      discoveryPromises.push(
        detectDocPlatform(inputUrl).then(result => {
          if (result.platform) additionalInfo.platform = result.platform
          return result.urls
        })
      )
    }
    
    // Strategy: API documentation framework detection
    if (strategies.includes('apiframework')) {
      discoveryPromises.push(
        detectApiDocFramework(inputUrl).then(result => {
          if (result.framework) additionalInfo.detectedFramework = result.framework
          return result.urls
        })
      )
    }
    
    // Strategy: Homepage link scraping
    if (strategies.includes('homepage')) {
      discoveryPromises.push(scrapeHomepageLinks(inputUrl))
    }
    
    // Strategy: Footer link analysis
    if (strategies.includes('footer')) {
      discoveryPromises.push(analyzeFooterLinks(inputUrl))
    }
    
    // Strategy: JSON-LD structured data
    if (strategies.includes('jsonld')) {
      discoveryPromises.push(analyzeStructuredData(inputUrl))
    }
    
    // Strategy: robots.txt parsing
    if (strategies.includes('robots')) {
      discoveryPromises.push(
        parseRobotsTxt(inputUrl).then(urls => {
          if (urls.length > 0) additionalInfo.robotsTxtFound = true
          return urls
        })
      )
    }
    
    // Strategy: GitHub/GitLab repository
    if (strategies.includes('github')) {
      discoveryPromises.push(
        checkGitRepository(inputUrl).then(result => {
          if (result.repoUrl) additionalInfo.githubRepo = result.repoUrl
          return result.urls
        })
      )
    }
    
    // Strategy: OpenAPI/Swagger endpoints
    if (strategies.includes('openapi')) {
      discoveryPromises.push(checkOpenApiEndpoints(inputUrl))
    }
    
    // Wait for all discovery strategies to complete
    const discoveryResults = await Promise.allSettled(discoveryPromises)
    
    for (const result of discoveryResults) {
      if (result.status === 'fulfilled') {
        allDiscoveredUrls.push(...result.value)
      }
    }
    
    // ========================================================================
    // PHASE 3: Sitemap Deep Analysis
    // ========================================================================
    if (strategies.includes('sitemap') && !isTimedOut()) {
      reportProgress('Analyzing sitemaps...', 'sitemap', 'scanning', 'Phase 3: Sitemap Analysis')
      
      const sitemapUrls = allDiscoveredUrls
        .filter(u => u.source === 'robots-sitemap')
        .map(u => u.url)
      
      // Also try standard sitemap locations
      const parsed = parseUrl(inputUrl)
      if (parsed) {
        sitemapUrls.push(
          `${parsed.protocol}//${parsed.hostname}/sitemap.xml`,
          `${parsed.protocol}//${parsed.fullDomain}/sitemap.xml`,
          `${parsed.protocol}//${parsed.hostname}/sitemap_index.xml`,
        )
      }
      
      for (const sitemapUrl of Array.from(new Set(sitemapUrls)).slice(0, 5)) {
        if (isTimedOut()) break
        const sitemapDiscovered = await parseSitemap(sitemapUrl)
        if (sitemapDiscovered.length > 0) {
          additionalInfo.sitemapFound = true
          allDiscoveredUrls.push(...sitemapDiscovered)
        }
      }
    }
    
    // ========================================================================
    // PHASE 4: Deduplicate, Prioritize, and Check
    // ========================================================================
    reportProgress('Prioritizing discovered URLs...', 'prioritize', 'scanning', 'Phase 4: Checking')
    
    // Deduplicate and sort by priority
    const seen = new Set<string>()
    const uniqueUrls = allDiscoveredUrls
      .filter(u => {
        const normalized = u.url.replace(/\/$/, '').toLowerCase()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .sort((a, b) => a.priority - b.priority)
      .slice(0, CONFIG.maxUrlsToScan)
    
    reportProgress(`Checking ${uniqueUrls.length} potential locations...`, 'checking', 'scanning', 'Phase 4: Checking')
    
    // Check all discovered URLs for llms.txt in priority order
    for (let i = 0; i < uniqueUrls.length; i += CONFIG.batchSize) {
      if (isTimedOut()) break
      
      const batch = uniqueUrls.slice(i, i + CONFIG.batchSize)
      
      reportProgress(batch[0].url, batch[0].source)
      
      const results = await Promise.allSettled(
        batch.map(async ({ url, source }) => {
          scannedUrls.push(url)
          const result = await checkForLlmsTxt(url)
          return { url, source, result }
        })
      )
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.result.found) {
          const { url, source, result: checkResult } = result.value
          
          reportProgress(checkResult.url!, source, 'found')
          
          // Determine confidence based on discovery method
          let confidence: 'high' | 'medium' | 'low' = 'medium'
          if (
            source.includes('user-provided') || 
            source.includes('well-known') ||
            source.includes('nav-text') ||
            source.includes('external-')
          ) {
            confidence = 'high'
          } else if (
            source.includes('platform') || 
            source.includes('github') ||
            source.includes('link-text') ||
            source.includes('api-framework')
          ) {
            confidence = 'high'
          } else if (source.includes('footer') || source.includes('sitemap')) {
            confidence = 'medium'
          }
          
          return {
            found: true,
            url,
            llmsTxtUrl: checkResult.url,
            type: checkResult.type,
            scannedUrls,
            timeElapsed: Date.now() - startTime,
            discoveryMethod: source,
            confidence,
            additionalInfo,
          }
        }
      }
    }
    
    // ========================================================================
    // Not Found
    // ========================================================================
    reportProgress('', 'complete', 'not-found')
    
    return {
      found: false,
      url: null,
      llmsTxtUrl: null,
      type: null,
      scannedUrls,
      timeElapsed: Date.now() - startTime,
      additionalInfo,
    }
    
  } catch (error) {
    reportProgress('', 'error', 'error')
    
    return {
      found: false,
      url: null,
      llmsTxtUrl: null,
      type: null,
      scannedUrls,
      timeElapsed: Date.now() - startTime,
    }
  }
}

// ============================================================================
// Quick Check Function
// ============================================================================

/**
 * Quick check if a specific URL has llms.txt (no discovery)
 */
export async function quickCheckLlmsTxt(url: string): Promise<DiscoveryResult> {
  const startTime = Date.now()
  const result = await checkForLlmsTxt(url)
  
  return {
    found: result.found,
    url: result.found ? url : null,
    llmsTxtUrl: result.url,
    type: result.type,
    scannedUrls: [url],
    timeElapsed: Date.now() - startTime,
    discoveryMethod: 'direct',
    confidence: 'high',
  }
}

// ============================================================================
// Batch Discovery Function
// ============================================================================

/**
 * Discover llms.txt for multiple URLs in parallel
 */
export async function batchDiscoverLlmsTxt(
  urls: string[],
  options: {
    concurrency?: number
    timeoutMs?: number
    onProgress?: (completed: number, total: number, current: string) => void
  } = {}
): Promise<Map<string, DiscoveryResult>> {
  const { concurrency = 3, timeoutMs = 30000, onProgress } = options
  const results = new Map<string, DiscoveryResult>()
  
  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    
    const batchResults = await Promise.allSettled(
      batch.map(url => discoverLlmsTxt(url, { timeoutMs }))
    )
    
    batch.forEach((url, index) => {
      const result = batchResults[index]
      if (result.status === 'fulfilled') {
        results.set(url, result.value)
      } else {
        results.set(url, {
          found: false,
          url: null,
          llmsTxtUrl: null,
          type: null,
          scannedUrls: [],
          timeElapsed: 0,
        })
      }
      
      if (onProgress) {
        onProgress(i + index + 1, urls.length, url)
      }
    })
  }
  
  return results
}
