/**
 * HTML to Markdown Converter - Scrapes web pages and converts to clean markdown
 */

export interface MarkdownDocument {
  title: string;
  url: string;
  content: string;
  wordCount: number;
  description?: string;
}

/**
 * Selectors to find main content
 */
const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.docs-content',
  '.documentation',
  '.content',
  '.markdown-body',
  '.prose',
  '#content',
  '#main-content',
  '.post-content',
  '.article-content',
];

/**
 * Elements to remove before conversion
 */
const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'footer',
  'header',
  'aside',
  '.sidebar',
  '.navigation',
  '.nav',
  '.menu',
  '.toc',
  '.table-of-contents',
  '.ads',
  '.advertisement',
  '.cookie-banner',
  '.cookie-consent',
  '.newsletter',
  '.social-share',
  '.comments',
  '.related-posts',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
];

/**
 * Count words in a string
 */
export function countWords(text: string): number {
  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string, url: string): string {
  // Try og:title first
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogTitleMatch) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }
  
  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    // Clean up common suffixes like " - Company Name" or " | Docs"
    let title = decodeHtmlEntities(titleMatch[1].trim());
    title = title.replace(/\s*[-|–]\s*[^-|–]+$/, '').trim();
    if (title) return title;
  }
  
  // Try first <h1>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return decodeHtmlEntities(h1Match[1].trim());
  }
  
  // Fallback to URL
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1]
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|md|mdx)$/i, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return urlObj.hostname;
  } catch {
    return 'Documentation';
  }
}

/**
 * Extract description from HTML
 */
function extractDescription(html: string): string | undefined {
  // Try og:description
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogDescMatch) {
    return decodeHtmlEntities(ogDescMatch[1].trim());
  }
  
  // Try meta description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (descMatch) {
    return decodeHtmlEntities(descMatch[1].trim());
  }
  
  return undefined;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Remove unwanted elements from HTML
 */
function removeUnwantedElements(html: string): string {
  let cleaned = html;
  
  // Remove script, style, and comment blocks
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // Remove common non-content elements by tag
  const tagsToRemove = ['nav', 'footer', 'header', 'aside'];
  for (const tag of tagsToRemove) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  
  return cleaned;
}

/**
 * Extract main content from HTML
 */
function extractMainContent(html: string): string {
  // Try to find main content area using patterns
  for (const selector of CONTENT_SELECTORS) {
    let pattern: RegExp;
    
    if (selector.startsWith('.')) {
      // Class selector
      const className = selector.slice(1);
      pattern = new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)(?=<(?:article|main|section|div)[^>]+class=|$)`, 'i');
    } else if (selector.startsWith('#')) {
      // ID selector
      const id = selector.slice(1);
      pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)(?=<(?:article|main|section|div)[^>]+id=|$)`, 'i');
    } else if (selector.startsWith('[')) {
      // Attribute selector
      const attrMatch = selector.match(/\[([^=]+)=["']?([^"'\]]+)["']?\]/);
      if (attrMatch) {
        pattern = new RegExp(`<[^>]+${attrMatch[1]}=["']${attrMatch[2]}["'][^>]*>([\\s\\S]*?)`, 'i');
      } else {
        continue;
      }
    } else {
      // Tag selector
      pattern = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i');
    }
    
    const match = html.match(pattern);
    if (match && match[1] && match[1].trim().length > 100) {
      return match[1];
    }
  }
  
  // Fallback: find the largest block of text content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }
  
  return html;
}

/**
 * Convert HTML to Markdown
 */
function htmlToMarkdown(html: string, baseUrl: string): string {
  let md = html;
  
  // Remove unwanted elements first
  md = removeUnwantedElements(md);
  
  // Convert headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n\n');
  
  // Convert code blocks (before inline code)
  md = md.replace(/<pre[^>]*><code[^>]*class=["'][^"']*language-(\w+)[^"']*["'][^>]*>([\s\S]*?)<\/code><\/pre>/gi, 
    (_, lang, code) => `\n\`\`\`${lang}\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`);
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, 
    (_, code) => `\n\`\`\`\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`);
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, 
    (_, code) => `\n\`\`\`\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`);
  
  // Convert inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  
  // Convert links (make relative URLs absolute)
  md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    let url = href;
    try {
      if (href.startsWith('/')) {
        url = new URL(href, baseUrl).href;
      } else if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
        url = new URL(href, baseUrl).href;
      }
    } catch {
      // Keep original URL
    }
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    return cleanText ? `[${cleanText}](${url})` : '';
  });
  
  // Convert images
  md = md.replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)');
  
  // Convert emphasis
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  
  // Convert unordered lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return '\n' + items.map((item: string) => {
      const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return `- ${text}`;
    }).join('\n') + '\n\n';
  });
  
  // Convert ordered lists
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    return '\n' + items.map((item: string, index: number) => {
      const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return `${index + 1}. ${text}`;
    }).join('\n') + '\n\n';
  });
  
  // Convert blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const lines = content.trim().split('\n');
    return '\n' + lines.map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n';
  });
  
  // Convert paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n\n');
  
  // Convert line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert horizontal rules
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');
  
  // Convert tables (basic support)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rows.length === 0) return '';
    
    const tableRows: string[] = [];
    let headerRow = true;
    
    for (const row of rows) {
      const cells = (row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [])
        .map((cell: string) => cell.replace(/<\/?t[hd][^>]*>/gi, '').trim());
      
      if (cells.length > 0) {
        tableRows.push('| ' + cells.join(' | ') + ' |');
        
        // Add header separator after first row
        if (headerRow) {
          tableRows.push('| ' + cells.map(() => '---').join(' | ') + ' |');
          headerRow = false;
        }
      }
    }
    
    return '\n' + tableRows.join('\n') + '\n\n';
  });
  
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  md = decodeHtmlEntities(md);
  
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.replace(/^\s+|\s+$/g, '');
  md = md.replace(/[ \t]+$/gm, '');
  
  return md;
}

/**
 * Scrape a page and convert to markdown
 */
export async function scrapePageToMarkdown(url: string): Promise<MarkdownDocument> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'llms-forge/1.0 (Documentation Extractor)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const baseUrl = new URL(url).origin;
  
  // Extract metadata
  const title = extractTitle(html, url);
  const description = extractDescription(html);
  
  // Extract and convert main content
  const mainContent = extractMainContent(html);
  const content = htmlToMarkdown(mainContent, baseUrl);
  
  return {
    title,
    url,
    content,
    wordCount: countWords(content),
    description,
  };
}

/**
 * Scrape multiple pages with progress tracking
 */
export async function scrapePages(
  urls: string[],
  onProgress?: (completed: number, total: number, currentUrl: string) => void
): Promise<MarkdownDocument[]> {
  const documents: MarkdownDocument[] = [];
  const total = urls.length;
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress?.(i, total, url);
    
    try {
      const doc = await scrapePageToMarkdown(url);
      if (doc.content.length > 50) { // Only include pages with meaningful content
        documents.push(doc);
      }
    } catch (error) {
      console.warn(`Failed to scrape ${url}:`, error);
      // Continue with other pages
    }
    
    // Small delay between requests to be respectful
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  onProgress?.(total, total, '');
  return documents;
}
