/**
 * Documentation URL Analyzer
 * 
 * Scrapes any documentation website URL to extract installation
 * and setup information for generating install.md files.
 * 
 * Strategies:
 * 1. Detect known doc platforms (Mintlify, Docusaurus, GitBook, etc.)
 * 2. Extract code blocks from the page
 * 3. Find installation-related sections
 * 4. Parse prerequisites and dependencies
 */

export interface CodeBlock {
  language: string
  code: string
  context?: string // Text before the code block
}

export interface ExtractedSection {
  title: string
  content: string
  codeBlocks: CodeBlock[]
}

export interface DocsAnalysis {
  // Source info
  url: string
  title: string
  description: string
  
  // Detected platform
  platform: string | null
  
  // Extracted content
  sections: ExtractedSection[]
  allCodeBlocks: CodeBlock[]
  
  // Parsed installation info
  installCommands: Array<{
    command: string
    packageManager?: string
    label?: string
  }>
  
  prerequisites: string[]
  
  // Raw content for AI
  pageContent: string
  
  // Related URLs found
  relatedUrls: Array<{
    url: string
    text: string
    type: 'installation' | 'quickstart' | 'getting-started' | 'api' | 'other'
  }>
}

const DOC_PLATFORMS = {
  mintlify: ['mintlify', 'x-mintlify'],
  docusaurus: ['docusaurus', '__docusaurus'],
  gitbook: ['gitbook', 'x-gitbook'],
  readme: ['readme.io', 'x-readme'],
  vitepress: ['vitepress'],
  mkdocs: ['mkdocs', 'material'],
  sphinx: ['sphinx'],
  nextra: ['nextra'],
} as const

/**
 * Detect documentation platform from HTML
 */
function detectPlatform(html: string): string | null {
  const htmlLower = html.toLowerCase()
  
  for (const [platform, indicators] of Object.entries(DOC_PLATFORMS)) {
    if (indicators.some(ind => htmlLower.includes(ind))) {
      return platform
    }
  }
  
  return null
}

/**
 * Extract page title
 */
function extractTitle(html: string): string {
  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    return titleMatch[1].trim().split('|')[0].split('-')[0].trim()
  }
  
  // Try og:title
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) {
    return ogMatch[1].trim()
  }
  
  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) {
    return h1Match[1].trim()
  }
  
  return 'Documentation'
}

/**
 * Extract meta description
 */
function extractDescription(html: string): string {
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  if (metaMatch) {
    return metaMatch[1].trim()
  }
  
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) {
    return ogMatch[1].trim()
  }
  
  return ''
}

/**
 * Extract code blocks from HTML
 */
function extractCodeBlocks(html: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  
  // Match <pre><code> patterns
  const preCodePattern = /<pre[^>]*>[\s\S]*?<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi
  let match
  
  while ((match = preCodePattern.exec(html)) !== null) {
    const language = match[1] || 'bash'
    const code = decodeHtmlEntities(match[2])
      .replace(/<[^>]+>/g, '') // Remove any inner HTML tags
      .trim()
    
    if (code.length > 0) {
      blocks.push({ language, code })
    }
  }
  
  // Match standalone <code> blocks that look like commands
  const codePattern = /<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>([\s\S]*?)<\/code>/gi
  
  while ((match = codePattern.exec(html)) !== null) {
    const code = decodeHtmlEntities(match[2])
      .replace(/<[^>]+>/g, '')
      .trim()
    
    // Only include if it looks like a command and not already captured
    if (
      code.length > 5 &&
      code.length < 500 &&
      !blocks.some(b => b.code === code) &&
      /^(npm|pnpm|yarn|pip|cargo|brew|apt|curl|wget|go\s|npx|bunx)/.test(code)
    ) {
      blocks.push({ language: 'bash', code })
    }
  }
  
  return blocks
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
  }
  
  let decoded = text
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.split(entity).join(char)
  }
  
  return decoded
}

/**
 * Remove HTML tags and get plain text
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract sections from page content
 */
function extractSections(html: string): ExtractedSection[] {
  const sections: ExtractedSection[] = []
  
  // Find all header + content pairs
  const headerPattern = /<h([2-4])[^>]*(?:id=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/h\1>/gi
  const matches = Array.from(html.matchAll(headerPattern))
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const title = decodeHtmlEntities(match[3]).replace(/<[^>]+>/g, '').trim()
    
    // Get content until next header
    const startIndex = match.index! + match[0].length
    const endIndex = matches[i + 1]?.index || html.length
    const sectionHtml = html.slice(startIndex, endIndex)
    
    // Check if section is installation-related
    const isRelevant = /install|setup|getting\s*started|prerequisites|requirements|quick\s*start|usage/i.test(title)
    
    if (isRelevant) {
      const content = htmlToText(sectionHtml)
      const codeBlocks = extractCodeBlocks(sectionHtml)
      
      sections.push({
        title,
        content: content.slice(0, 2000),
        codeBlocks,
      })
    }
  }
  
  return sections
}

/**
 * Extract install commands from code blocks
 */
function extractInstallCommands(codeBlocks: CodeBlock[]): DocsAnalysis['installCommands'] {
  const commands: DocsAnalysis['installCommands'] = []
  
  const patterns = [
    { regex: /npm\s+(?:i|install)\s+(?:-g\s+)?([^\s&|;\n]+)/g, pm: 'npm' },
    { regex: /pnpm\s+(?:add|install)\s+(?:-g\s+)?([^\s&|;\n]+)/g, pm: 'pnpm' },
    { regex: /yarn\s+(?:add|global\s+add)\s+([^\s&|;\n]+)/g, pm: 'yarn' },
    { regex: /pip\s+install\s+([^\s&|;\n]+)/g, pm: 'pip' },
    { regex: /pipx\s+install\s+([^\s&|;\n]+)/g, pm: 'pipx' },
    { regex: /cargo\s+install\s+([^\s&|;\n]+)/g, pm: 'cargo' },
    { regex: /brew\s+install\s+([^\s&|;\n]+)/g, pm: 'homebrew' },
    { regex: /apt(?:-get)?\s+install\s+([^\s&|;\n]+)/g, pm: 'apt' },
    { regex: /go\s+install\s+([^\s&|;\n]+)/g, pm: 'go' },
    { regex: /npx\s+([^\s&|;\n]+)/g, pm: 'npx' },
    { regex: /bunx?\s+(?:add\s+)?([^\s&|;\n]+)/g, pm: 'bun' },
  ]
  
  for (const block of codeBlocks) {
    if (block.language !== 'bash' && block.language !== 'shell' && block.language !== 'sh') {
      // Check if it looks like a shell command anyway
      if (!/^(npm|pnpm|yarn|pip|cargo|brew|apt|curl|wget|go|npx)/.test(block.code)) {
        continue
      }
    }
    
    for (const { regex, pm } of patterns) {
      const matches = Array.from(block.code.matchAll(regex))
      for (const match of matches) {
        const fullCommand = match[0]
        if (!commands.some(c => c.command === fullCommand)) {
          commands.push({
            command: fullCommand,
            packageManager: pm,
          })
        }
      }
    }
    
    // Also check for curl | bash patterns
    const curlMatch = block.code.match(/curl\s+[^\n]+\|\s*(?:bash|sh)/i)
    if (curlMatch) {
      commands.push({
        command: curlMatch[0],
        label: 'Install script',
      })
    }
  }
  
  return commands
}

/**
 * Extract prerequisites from content
 */
function extractPrerequisites(text: string, codeBlocks: CodeBlock[]): string[] {
  const prerequisites: string[] = []
  
  // Common version check commands
  const versionChecks = [
    { pattern: /node\s+--?v(?:ersion)?/i, prereq: 'Node.js' },
    { pattern: /npm\s+--?v(?:ersion)?/i, prereq: 'npm' },
    { pattern: /python3?\s+--?v(?:ersion)?/i, prereq: 'Python' },
    { pattern: /pip3?\s+--?v(?:ersion)?/i, prereq: 'pip' },
    { pattern: /cargo\s+--?v(?:ersion)?/i, prereq: 'Rust/Cargo' },
    { pattern: /go\s+version/i, prereq: 'Go' },
    { pattern: /git\s+--?v(?:ersion)?/i, prereq: 'Git' },
    { pattern: /docker\s+--?v(?:ersion)?/i, prereq: 'Docker' },
  ]
  
  for (const block of codeBlocks) {
    for (const { pattern, prereq } of versionChecks) {
      if (pattern.test(block.code) && !prerequisites.includes(prereq)) {
        prerequisites.push(prereq)
      }
    }
  }
  
  // Check text for version requirements
  const nodeMatch = text.match(/Node(?:\.js)?\s+(?:v?(\d+(?:\.\d+)*)\s+or\s+(?:higher|later|above)|>=?\s*v?(\d+))/i)
  if (nodeMatch) {
    const version = nodeMatch[1] || nodeMatch[2]
    prerequisites.push(`Node.js v${version}+`)
  }
  
  const pythonMatch = text.match(/Python\s+(?:(\d+(?:\.\d+)*)\s+or\s+(?:higher|later|above)|>=?\s*(\d+))/i)
  if (pythonMatch) {
    const version = pythonMatch[1] || pythonMatch[2]
    prerequisites.push(`Python ${version}+`)
  }
  
  return Array.from(new Set(prerequisites))
}

/**
 * Find related documentation URLs
 */
function findRelatedUrls(html: string, baseUrl: string): DocsAnalysis['relatedUrls'] {
  const urls: DocsAnalysis['relatedUrls'] = []
  const baseUrlObj = new URL(baseUrl)
  
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
  const matches = Array.from(html.matchAll(linkPattern))
  
  const typePatterns = {
    installation: /install/i,
    quickstart: /quick\s*start/i,
    'getting-started': /getting\s*started|get\s*started/i,
    api: /api\s*reference|api\s*docs/i,
  }
  
  for (const match of matches) {
    let href = match[1]
    const text = decodeHtmlEntities(match[2]).trim()
    
    if (!text || text.length < 3) continue
    
    // Resolve relative URLs
    if (href.startsWith('/')) {
      href = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`
    } else if (!href.startsWith('http')) {
      continue
    }
    
    // Determine type
    let type: DocsAnalysis['relatedUrls'][0]['type'] = 'other'
    for (const [typeName, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(text) || pattern.test(href)) {
        type = typeName as typeof type
        break
      }
    }
    
    // Only include relevant types
    if (type !== 'other' && !urls.some(u => u.url === href)) {
      urls.push({ url: href, text, type })
    }
  }
  
  return urls.slice(0, 10)
}

/**
 * Analyze a documentation URL
 */
export async function analyzeDocsUrl(url: string): Promise<DocsAnalysis> {
  // Fetch the page
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'llm-energy-install-md-generator/1.0',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  const html = await response.text()
  
  // Extract information
  const platform = detectPlatform(html)
  const title = extractTitle(html)
  const description = extractDescription(html)
  const allCodeBlocks = extractCodeBlocks(html)
  const sections = extractSections(html)
  const installCommands = extractInstallCommands(allCodeBlocks)
  const pageContent = htmlToText(html)
  const prerequisites = extractPrerequisites(pageContent, allCodeBlocks)
  const relatedUrls = findRelatedUrls(html, url)
  
  return {
    url,
    title,
    description,
    platform,
    sections,
    allCodeBlocks,
    installCommands,
    prerequisites,
    pageContent: pageContent.slice(0, 10000), // Limit for AI context
    relatedUrls,
  }
}

/**
 * Generate a prompt for AI to create install.md from docs analysis
 */
export function generateInstallMdPromptFromDocs(analysis: DocsAnalysis): string {
  const parts: string[] = []
  
  parts.push(`Generate an install.md file based on this documentation page.`)
  parts.push('')
  parts.push('## Source Information')
  parts.push(`- URL: ${analysis.url}`)
  parts.push(`- Title: ${analysis.title}`)
  if (analysis.description) {
    parts.push(`- Description: ${analysis.description}`)
  }
  if (analysis.platform) {
    parts.push(`- Platform: ${analysis.platform}`)
  }
  parts.push('')
  
  if (analysis.installCommands.length > 0) {
    parts.push('## Detected Install Commands')
    for (const cmd of analysis.installCommands) {
      parts.push(`- \`${cmd.command}\`${cmd.packageManager ? ` (${cmd.packageManager})` : ''}`)
    }
    parts.push('')
  }
  
  if (analysis.prerequisites.length > 0) {
    parts.push('## Prerequisites')
    for (const prereq of analysis.prerequisites) {
      parts.push(`- ${prereq}`)
    }
    parts.push('')
  }
  
  if (analysis.sections.length > 0) {
    parts.push('## Relevant Sections')
    for (const section of analysis.sections) {
      parts.push(`### ${section.title}`)
      parts.push(section.content.slice(0, 1000))
      if (section.codeBlocks.length > 0) {
        parts.push('')
        parts.push('Code blocks:')
        for (const block of section.codeBlocks) {
          parts.push(`\`\`\`${block.language}`)
          parts.push(block.code)
          parts.push('```')
        }
      }
      parts.push('')
    }
  } else if (analysis.allCodeBlocks.length > 0) {
    parts.push('## Code Blocks Found')
    for (const block of analysis.allCodeBlocks.slice(0, 10)) {
      parts.push(`\`\`\`${block.language}`)
      parts.push(block.code)
      parts.push('```')
    }
    parts.push('')
  }
  
  if (analysis.relatedUrls.length > 0) {
    parts.push('## Related Documentation')
    for (const link of analysis.relatedUrls) {
      parts.push(`- [${link.text}](${link.url}) (${link.type})`)
    }
    parts.push('')
  }
  
  // Include raw page content for context
  parts.push('## Page Content (for context)')
  parts.push(analysis.pageContent.slice(0, 5000))
  
  return parts.join('\n')
}
