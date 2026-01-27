/**
 * Sitemap Parser - Parses sitemap.xml files to extract documentation URLs
 */

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  priority?: number;
  changefreq?: string;
}

export interface SitemapParseResult {
  entries: SitemapEntry[];
  urls: string[];
  isSitemapIndex: boolean;
  nestedSitemaps: string[];
}

/**
 * Patterns for identifying documentation pages
 */
const DOC_PATTERNS = [
  '/docs', '/doc/', '/guide', '/api', '/reference', 
  '/tutorial', '/learn', '/manual', '/handbook',
  '/getting-started', '/quickstart', '/introduction',
  '/concepts', '/examples', '/sdk', '/help'
];

const EXCLUDE_PATTERNS = [
  '/blog', '/changelog', '/news', '/pricing', '/careers', 
  '/about', '/contact', '/privacy', '/terms', '/legal',
  '/login', '/signup', '/register', '/dashboard', '/account',
  '/search', '/404', '/500', '/feed', '/rss',
  '.pdf', '.zip', '.png', '.jpg', '.gif', '.svg', '.ico',
  '/tag/', '/category/', '/author/'
];

/**
 * Check if a URL is likely a documentation page
 */
export function isDocumentationUrl(url: string): boolean {
  const lower = url.toLowerCase();
  
  // Always exclude certain patterns
  if (EXCLUDE_PATTERNS.some(p => lower.includes(p))) {
    return false;
  }
  
  // Include if matches doc patterns
  if (DOC_PATTERNS.some(p => lower.includes(p))) {
    return true;
  }
  
  return false;
}

/**
 * Parse a sitemap XML string and extract entries
 */
export function parseSitemapXml(xml: string): SitemapParseResult {
  const result: SitemapParseResult = {
    entries: [],
    urls: [],
    isSitemapIndex: false,
    nestedSitemaps: [],
  };
  
  // Check if this is a sitemap index
  if (xml.includes('<sitemapindex') || xml.includes('<sitemap>')) {
    result.isSitemapIndex = true;
    
    // Extract nested sitemap URLs
    const sitemapRegex = /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi;
    let sitemapMatch;
    
    while ((sitemapMatch = sitemapRegex.exec(xml)) !== null) {
      result.nestedSitemaps.push(decodeXmlEntities(sitemapMatch[1].trim()));
    }
    
    return result;
  }
  
  // Parse regular sitemap URLs
  const urlRegex = /<url>[\s\S]*?<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/gi;
  let urlMatch;
  
  while ((urlMatch = urlRegex.exec(xml)) !== null) {
    const url = decodeXmlEntities(urlMatch[1].trim());
    const extraContent = urlMatch[2] || '';
    
    const entry: SitemapEntry = { url };
    
    // Extract optional fields
    const lastmodMatch = extraContent.match(/<lastmod>([^<]+)<\/lastmod>/i);
    if (lastmodMatch) {
      entry.lastmod = lastmodMatch[1].trim();
    }
    
    const priorityMatch = extraContent.match(/<priority>([^<]+)<\/priority>/i);
    if (priorityMatch) {
      entry.priority = parseFloat(priorityMatch[1].trim());
    }
    
    const changefreqMatch = extraContent.match(/<changefreq>([^<]+)<\/changefreq>/i);
    if (changefreqMatch) {
      entry.changefreq = changefreqMatch[1].trim();
    }
    
    result.entries.push(entry);
    result.urls.push(url);
  }
  
  return result;
}

/**
 * Decode common XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Fetch and parse a sitemap, handling sitemap indexes recursively
 */
export async function parseSitemap(
  sitemapUrl: string, 
  options: { maxUrls?: number; filterDocs?: boolean } = {}
): Promise<string[]> {
  const { maxUrls = 100, filterDocs = true } = options;
  const allUrls: string[] = [];
  const visited = new Set<string>();
  
  async function processSitemap(url: string, depth: number = 0): Promise<void> {
    // Prevent infinite loops and limit depth
    if (visited.has(url) || depth > 3 || allUrls.length >= maxUrls) {
      return;
    }
    visited.add(url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
          'Accept': 'application/xml, text/xml, */*',
        },
      });
      
      if (!response.ok) return;
      
      const xml = await response.text();
      const parsed = parseSitemapXml(xml);
      
      if (parsed.isSitemapIndex) {
        // Process nested sitemaps (limit to first 5)
        for (const nestedUrl of parsed.nestedSitemaps.slice(0, 5)) {
          if (allUrls.length >= maxUrls) break;
          await processSitemap(nestedUrl, depth + 1);
        }
      } else {
        // Add URLs from this sitemap
        for (const pageUrl of parsed.urls) {
          if (allUrls.length >= maxUrls) break;
          
          if (!filterDocs || isDocumentationUrl(pageUrl)) {
            allUrls.push(pageUrl);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to parse sitemap: ${url}`, error);
    }
  }
  
  await processSitemap(sitemapUrl);
  return allUrls;
}

/**
 * Sort URLs to prioritize important pages
 */
export function sortDocumentationUrls(urls: string[]): string[] {
  const priorityPatterns = [
    '/getting-started',
    '/quickstart',
    '/introduction',
    '/installation',
    '/overview',
    '/guide',
    '/tutorial',
    '/api',
    '/reference',
  ];
  
  return [...urls].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    // Find the index of the first matching pattern for each URL
    let aIndex = priorityPatterns.length;
    let bIndex = priorityPatterns.length;
    
    for (let i = 0; i < priorityPatterns.length; i++) {
      if (aLower.includes(priorityPatterns[i])) {
        aIndex = Math.min(aIndex, i);
      }
      if (bLower.includes(priorityPatterns[i])) {
        bIndex = Math.min(bIndex, i);
      }
    }
    
    // Sort by priority index, then alphabetically
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return a.localeCompare(b);
  });
}
