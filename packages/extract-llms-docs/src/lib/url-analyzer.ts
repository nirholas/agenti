/**
 * URL Analyzer - Determines the best extraction strategy for any URL
 */

export type ExtractionStrategy = 
  | 'llms-txt' 
  | 'sitemap' 
  | 'docs-discovery' 
  | 'html-scrape' 
  | 'unknown';

export interface UrlAnalysis {
  originalUrl: string;
  baseUrl: string;
  strategy: ExtractionStrategy;
  llmsTxtUrl: string | null;
  installMdUrl: string | null;
  sitemapUrl: string | null;
  docsUrl: string | null;
  pages: string[];
  detectedTitle?: string;
}

/**
 * Check if a URL exists and returns a successful response
 */
async function urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
      },
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    // Try GET as fallback since some servers don't support HEAD
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
        },
        redirect: 'follow',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Parse sitemap XML to extract documentation URLs
 */
async function parseSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
      },
    });
    
    if (!response.ok) return [];
    
    const xml = await response.text();
    const urls: string[] = [];
    
    // Check if this is a sitemap index (contains other sitemaps)
    const sitemapRegex = /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi;
    const nestedSitemaps: string[] = [];
    let sitemapMatch;
    
    while ((sitemapMatch = sitemapRegex.exec(xml)) !== null) {
      nestedSitemaps.push(sitemapMatch[1].trim());
    }
    
    // If this is a sitemap index, recursively parse child sitemaps
    if (nestedSitemaps.length > 0) {
      // Limit to first 5 sitemaps to prevent abuse
      for (const nestedUrl of nestedSitemaps.slice(0, 5)) {
        const nestedUrls = await parseSitemapUrls(nestedUrl);
        urls.push(...nestedUrls);
        if (urls.length >= 100) break;
      }
    } else {
      // Parse regular sitemap URLs
      const locRegex = /<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi;
      let locMatch;
      
      while ((locMatch = locRegex.exec(xml)) !== null) {
        const url = locMatch[1].trim();
        if (isDocumentationUrl(url)) {
          urls.push(url);
        }
      }
    }
    
    return urls.slice(0, 100); // Limit to prevent abuse
  } catch {
    return [];
  }
}

/**
 * Determine if a URL is likely a documentation page
 */
function isDocumentationUrl(url: string): boolean {
  const docPatterns = [
    '/docs', '/doc/', '/guide', '/api', '/reference', 
    '/tutorial', '/learn', '/manual', '/handbook',
    '/getting-started', '/quickstart', '/introduction',
    '/concepts', '/examples', '/sdk'
  ];
  
  const excludePatterns = [
    '/blog', '/changelog', '/news', '/pricing', '/careers', 
    '/about', '/contact', '/privacy', '/terms', '/legal',
    '/login', '/signup', '/register', '/dashboard', '/account',
    '/search', '/404', '/500', '.pdf', '.zip', '.png', '.jpg',
    '/feed', '/rss', '/sitemap'
  ];
  
  const lower = url.toLowerCase();
  
  // If it matches an exclude pattern, skip it
  if (excludePatterns.some(p => lower.includes(p))) {
    return false;
  }
  
  // If it matches a doc pattern, include it
  if (docPatterns.some(p => lower.includes(p))) {
    return true;
  }
  
  // If the URL looks like a content page (not just root), cautiously include
  const path = new URL(url).pathname;
  if (path.length > 1 && !path.endsWith('/')) {
    return true;
  }
  
  return false;
}

/**
 * Analyze a URL and determine the best extraction strategy
 */
export async function analyzeUrl(inputUrl: string): Promise<UrlAnalysis> {
  // Normalize the URL
  let normalizedUrl = inputUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  const urlObj = new URL(normalizedUrl);
  const baseUrl = urlObj.origin;
  const hostname = urlObj.hostname.replace(/^www\./, '');
  
  // Extract root domain for subdomain checks (e.g., defillama.com from api.defillama.com)
  const domainParts = hostname.split('.');
  const rootDomain = domainParts.length > 2 
    ? domainParts.slice(-2).join('.') 
    : hostname;
  
  const analysis: UrlAnalysis = {
    originalUrl: inputUrl,
    baseUrl,
    strategy: 'unknown',
    llmsTxtUrl: null,
    installMdUrl: null,
    sitemapUrl: null,
    docsUrl: null,
    pages: [],
  };

  // 1. Check for llms-full.txt first (complete docs), then llms.txt as fallback
  // Check all subdomains for llms-full.txt first
  const subdomains = [
    baseUrl,
    `https://docs.${rootDomain}`,
    `https://api-docs.${rootDomain}`,
    `https://developer.${rootDomain}`,
    `https://api.${rootDomain}`,
  ];
  
  // Also check for install.md in parallel with llms.txt detection
  const installMdLocations = [
    `${baseUrl}/install.md`,
    `${baseUrl}/docs/install.md`,
    `https://docs.${rootDomain}/install.md`,
  ];
  
  // Check install.md locations in parallel (async, will set on analysis object)
  const checkInstallMd = async () => {
    for (const url of installMdLocations) {
      if (await urlExists(url)) {
        return url;
      }
    }
    return null;
  };
  
  // Start install.md check in background
  const installMdPromise = checkInstallMd();
  
  // Priority 1: llms-full.txt (complete documentation)
  for (const subdomain of subdomains) {
    const fullUrl = `${subdomain}/llms-full.txt`;
    if (await urlExists(fullUrl)) {
      analysis.llmsTxtUrl = fullUrl;
      analysis.strategy = 'llms-txt';
      // Wait for install.md check before returning
      analysis.installMdUrl = await installMdPromise;
      return analysis;
    }
  }
  
  // Priority 2: llms.txt (summary documentation)
  for (const subdomain of subdomains) {
    const url = `${subdomain}/llms.txt`;
    if (await urlExists(url)) {
      analysis.llmsTxtUrl = url;
      analysis.strategy = 'llms-txt';
      // Wait for install.md check before returning
      analysis.installMdUrl = await installMdPromise;
      return analysis;
    }
  }
  
  // Priority 3: .well-known location
  if (await urlExists(`${baseUrl}/.well-known/llms.txt`)) {
    analysis.llmsTxtUrl = `${baseUrl}/.well-known/llms.txt`;
    analysis.strategy = 'llms-txt';
    // Wait for install.md check before returning
    analysis.installMdUrl = await installMdPromise;
    return analysis;
  }

  // 2. Check for sitemap.xml
  const sitemapLocations = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap-index.xml`,
    `${baseUrl}/docs/sitemap.xml`,
  ];
  
  for (const url of sitemapLocations) {
    if (await urlExists(url)) {
      analysis.sitemapUrl = url;
      analysis.pages = await parseSitemapUrls(url);
      
      if (analysis.pages.length > 0) {
        analysis.strategy = 'sitemap';
        // Wait for install.md check before returning
        analysis.installMdUrl = await installMdPromise;
        return analysis;
      }
    }
  }

  // 3. Check for /docs subdomain or path
  const docsVariants = [
    `https://docs.${rootDomain}`,
    `https://api-docs.${rootDomain}`,
    `https://developer.${rootDomain}`,
    `${baseUrl}/docs`,
    `${baseUrl}/documentation`,
    `${baseUrl}/doc`,
    `${baseUrl}/guide`,
    `${baseUrl}/api`,
  ];
  
  for (const url of docsVariants) {
    // Skip if it's the same as input URL
    if (url === normalizedUrl || url === baseUrl) continue;
    
    if (await urlExists(url)) {
      analysis.docsUrl = url;
      analysis.strategy = 'docs-discovery';
      // Wait for install.md check before returning
      analysis.installMdUrl = await installMdPromise;
      return analysis;
    }
  }

  // 4. Fallback: Direct HTML scraping of the input URL
  analysis.strategy = 'html-scrape';
  analysis.pages = [normalizedUrl];
  // Wait for install.md check before returning
  analysis.installMdUrl = await installMdPromise;
  return analysis;
}

export { urlExists, isDocumentationUrl };
