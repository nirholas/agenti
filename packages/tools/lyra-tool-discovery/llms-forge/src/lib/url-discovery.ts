/**
 * Smart URL Discovery - Scans common documentation URL patterns to find llms.txt files
 * Handles cases like:
 * - docs.example.com/llms.txt
 * - example.com/docs/llms.txt
 * - example.com/llms-full.txt
 * - developers.example.com/llms.txt
 */

export interface DiscoveryResult {
  found: boolean
  url: string | null
  llmsTxtUrl: string | null
  type: 'llms-full' | 'llms-standard' | null
  scannedUrls: string[]
  timeElapsed: number
}

export interface DiscoveryProgress {
  currentUrl: string
  scannedCount: number
  totalToScan: number
  status: 'scanning' | 'found' | 'not-found' | 'error'
}

/**
 * Generate all possible documentation URLs for a given domain
 */
function generateDocUrls(inputUrl: string): string[] {
  const urls: string[] = []
  
  try {
    // Normalize the input
    let normalizedUrl = inputUrl.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }
    
    const urlObj = new URL(normalizedUrl)
    const hostname = urlObj.hostname
    const protocol = urlObj.protocol
    
    // Extract the base domain (e.g., "example" from "docs.example.com")
    const parts = hostname.split('.')
    let baseDomain: string
    let tld: string
    
    if (parts.length >= 2) {
      // Handle common TLDs like .co.uk, .com.au etc
      if (parts.length >= 3 && ['co', 'com', 'org', 'net'].includes(parts[parts.length - 2])) {
        tld = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
        baseDomain = parts[parts.length - 3]
      } else {
        tld = parts[parts.length - 1]
        baseDomain = parts[parts.length - 2]
      }
    } else {
      baseDomain = parts[0]
      tld = 'com'
    }
    
    // If user already provided a subdomain (like docs.example.com), check it first
    if (hostname !== `${baseDomain}.${tld}` && hostname !== `www.${baseDomain}.${tld}`) {
      // User provided a specific subdomain, prioritize it
      urls.push(`${protocol}//${hostname}`)
    }
    
    // Common documentation subdomain patterns
    const subdomains = [
      'docs',
      'documentation',
      'developers',
      'developer',
      'dev',
      'api',
      'reference',
      'help',
      'support',
      'learn',
      'guide',
      'wiki',
    ]
    
    // Add subdomain variations
    for (const sub of subdomains) {
      urls.push(`${protocol}//${sub}.${baseDomain}.${tld}`)
    }
    
    // Add main domain
    urls.push(`${protocol}//${baseDomain}.${tld}`)
    urls.push(`${protocol}//www.${baseDomain}.${tld}`)
    
    // Add path-based documentation locations on main domain
    const docsPaths = [
      '/docs',
      '/documentation',
      '/api',
      '/developer',
      '/developers',
      '/reference',
      '/help',
      '/guide',
      '/learn',
    ]
    
    for (const path of docsPaths) {
      urls.push(`${protocol}//${baseDomain}.${tld}${path}`)
      urls.push(`${protocol}//www.${baseDomain}.${tld}${path}`)
    }
    
    // Deduplicate while preserving order
    return Array.from(new Set(urls))
  } catch {
    return [inputUrl]
  }
}

/**
 * Check if a URL has an llms.txt file
 * Returns the full URL to the llms.txt if found
 */
async function checkForLlmsTxt(
  baseUrl: string,
  signal?: AbortSignal
): Promise<{ found: boolean; url: string | null; type: 'llms-full' | 'llms-standard' | null }> {
  // Try llms-full.txt first (more comprehensive), then llms.txt
  const filesToTry = ['llms-full.txt', 'llms.txt']
  
  // Normalize URL
  let normalizedBase = baseUrl.replace(/\/$/, '')
  
  for (const file of filesToTry) {
    const testUrl = `${normalizedBase}/${file}`
    
    try {
      const response = await fetch(testUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
        },
        redirect: 'follow',
        signal,
      })
      
      if (response.ok) {
        // Verify it's actually text content (not an HTML error page)
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/') || contentType.includes('application/octet-stream') || !contentType) {
          // Double-check with GET for small sample
          const getResponse = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
            },
            redirect: 'follow',
            signal,
          })
          
          if (getResponse.ok) {
            const text = await getResponse.text()
            // Basic validation - should start with # or > (markdown) and not be HTML
            if (text && !text.trim().toLowerCase().startsWith('<!doctype') && !text.trim().toLowerCase().startsWith('<html')) {
              return {
                found: true,
                url: testUrl,
                type: file === 'llms-full.txt' ? 'llms-full' : 'llms-standard',
              }
            }
          }
        }
      }
    } catch {
      // Continue to next option
    }
  }
  
  return { found: false, url: null, type: null }
}

/**
 * Discover llms.txt file for a given domain
 * Scans multiple common patterns with a timeout
 */
export async function discoverLlmsTxt(
  inputUrl: string,
  options: {
    timeoutMs?: number
    onProgress?: (progress: DiscoveryProgress) => void
  } = {}
): Promise<DiscoveryResult> {
  const { timeoutMs = 20000, onProgress } = options
  const startTime = Date.now()
  const scannedUrls: string[] = []
  
  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const urlsToScan = generateDocUrls(inputUrl)
    
    // Scan URLs in parallel batches for speed
    const batchSize = 5
    
    for (let i = 0; i < urlsToScan.length; i += batchSize) {
      // Check if we've exceeded timeout
      if (Date.now() - startTime > timeoutMs) {
        break
      }
      
      const batch = urlsToScan.slice(i, i + batchSize)
      
      // Update progress
      if (onProgress) {
        onProgress({
          currentUrl: batch[0],
          scannedCount: scannedUrls.length,
          totalToScan: urlsToScan.length,
          status: 'scanning',
        })
      }
      
      // Check batch in parallel
      const results = await Promise.all(
        batch.map(async (url) => {
          scannedUrls.push(url)
          return { url, result: await checkForLlmsTxt(url, controller.signal) }
        })
      )
      
      // Check if any found
      for (const { url, result } of results) {
        if (result.found) {
          clearTimeout(timeoutId)
          
          if (onProgress) {
            onProgress({
              currentUrl: result.url!,
              scannedCount: scannedUrls.length,
              totalToScan: urlsToScan.length,
              status: 'found',
            })
          }
          
          return {
            found: true,
            url,
            llmsTxtUrl: result.url,
            type: result.type,
            scannedUrls,
            timeElapsed: Date.now() - startTime,
          }
        }
      }
    }
    
    // Not found after scanning all URLs
    clearTimeout(timeoutId)
    
    if (onProgress) {
      onProgress({
        currentUrl: '',
        scannedCount: scannedUrls.length,
        totalToScan: urlsToScan.length,
        status: 'not-found',
      })
    }
    
    return {
      found: false,
      url: null,
      llmsTxtUrl: null,
      type: null,
      scannedUrls,
      timeElapsed: Date.now() - startTime,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (onProgress) {
      onProgress({
        currentUrl: '',
        scannedCount: scannedUrls.length,
        totalToScan: 0,
        status: 'error',
      })
    }
    
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
  }
}
