import { Document } from '@/types'

/**
 * Converts a title string to a URL-friendly filename
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Estimates token count from text (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Extracts the site name from a URL
 */
export function extractSiteName(url: string): string {
  try {
    const urlObj = new URL(url)
    // Get hostname without www prefix
    let hostname = urlObj.hostname.replace(/^www\./, '')
    // Get the main domain name (e.g., "anthropic" from "docs.anthropic.com")
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      // Return second-to-last part (the main domain name)
      return parts[parts.length - 2]
    }
    return hostname
  } catch {
    return 'documentation'
  }
}

interface ParsedSection {
  title: string
  level: number
  content: string
}

/**
 * Parses llms.txt content into sections based on markdown headers
 */
export function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split('\n')
  const sections: ParsedSection[] = []
  
  let currentSection: ParsedSection | null = null
  let contentLines: string[] = []
  
  for (const line of lines) {
    // Check for headers (## or ###)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    
    if (headerMatch) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim()
        if (currentSection.content || currentSection.title) {
          sections.push(currentSection)
        }
      }
      
      const level = headerMatch[1].length
      const title = headerMatch[2].trim()
      
      currentSection = {
        title,
        level,
        content: ''
      }
      contentLines = []
    } else {
      contentLines.push(line)
    }
  }
  
  // Don't forget the last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim()
    if (currentSection.content || currentSection.title) {
      sections.push(currentSection)
    }
  }
  
  // If no headers were found, treat the entire content as one section
  if (sections.length === 0 && content.trim()) {
    sections.push({
      title: 'Documentation',
      level: 1,
      content: content.trim()
    })
  }
  
  return sections
}

/**
 * Converts parsed sections into Document objects
 */
export function sectionsToDocuments(sections: ParsedSection[]): Document[] {
  const documents: Document[] = []
  const usedFilenames = new Set<string>()
  
  for (const section of sections) {
    let baseFilename = slugify(section.title) || 'section'
    
    // Ensure unique filenames
    let filename = `${baseFilename}.md`
    let counter = 1
    while (usedFilenames.has(filename)) {
      filename = `${baseFilename}-${counter}.md`
      counter++
    }
    usedFilenames.add(filename)
    
    // Build document content with header
    const headerPrefix = '#'.repeat(Math.min(section.level, 6))
    const documentContent = `${headerPrefix} ${section.title}\n\n${section.content}`.trim()
    
    documents.push({
      filename,
      title: section.title,
      content: documentContent,
      tokens: estimateTokens(documentContent)
    })
  }
  
  return documents
}

/**
 * Main parsing function: takes raw llms.txt content and returns structured documents
 */
export function parseLlmsContent(content: string): Document[] {
  if (!content || !content.trim()) {
    return []
  }
  
  const sections = parseMarkdownSections(content)
  return sectionsToDocuments(sections)
}
