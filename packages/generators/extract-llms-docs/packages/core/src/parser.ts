/**
 * @llm-energy/core - Parser utilities
 * 
 * Functions for parsing llms.txt content into structured documents
 */

import type { Document, ParsedSection } from './types'

/**
 * Converts a title string to a URL-friendly filename
 * 
 * @example
 * slugify('Getting Started') // 'getting-started'
 * slugify('API Reference (v2)') // 'api-reference-v2'
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
 * This provides a reasonable estimate for most LLM tokenizers
 * 
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Extracts the site name from a URL
 * 
 * @example
 * extractSiteName('https://docs.anthropic.com/api') // 'anthropic'
 * extractSiteName('https://stripe.com/docs') // 'stripe'
 */
export function extractSiteName(url: string): string {
  try {
    const urlObj = new URL(url)
    // Get hostname without www prefix
    const hostname = urlObj.hostname.replace(/^www\./, '')
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

/**
 * Parses llms.txt content into sections based on markdown headers
 * Supports header levels 1-6 (# through ######)
 * 
 * @param content - Raw markdown content from llms.txt
 * @returns Array of parsed sections with title, level, and content
 */
export function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split('\n')
  const sections: ParsedSection[] = []
  
  let currentSection: ParsedSection | null = null
  let contentLines: string[] = []
  
  for (const line of lines) {
    // Check for headers (# through ######)
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
 * Ensures unique filenames by appending numbers if needed
 * 
 * @param sections - Array of parsed sections
 * @returns Array of Document objects with filenames and token counts
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
 * 
 * @param content - Raw llms.txt content
 * @returns Array of Document objects
 * 
 * @example
 * const docs = parseLlmsContent('# Title\n\nContent here\n\n## Section\n\nMore content')
 * // Returns: [{ filename: 'title.md', ... }, { filename: 'section.md', ... }]
 */
export function parseLlmsContent(content: string): Document[] {
  if (!content || !content.trim()) {
    return []
  }
  
  const sections = parseMarkdownSections(content)
  return sectionsToDocuments(sections)
}
