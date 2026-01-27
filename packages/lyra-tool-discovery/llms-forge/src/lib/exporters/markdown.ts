import type { ExtractionResult, ExportData, ExportMeta, ExportSection } from '@/types'

/**
 * Convert extraction result to export data structure
 */
export function extractionToExportData(result: ExtractionResult): ExportData {
  const siteName = new URL(result.url).hostname.replace('www.', '').split('.')[0]
  
  const meta: ExportMeta = {
    source: result.sourceUrl || result.url,
    extractedAt: new Date().toISOString(),
    version: '1.0',
    siteName,
  }

  const sections: ExportSection[] = result.documents.map((doc) => ({
    title: doc.title,
    content: doc.content,
    tokens: doc.tokens,
    filename: doc.filename,
  }))

  return {
    meta,
    sections,
    fullContent: result.fullDocument.content,
  }
}

/**
 * Export data to Markdown format
 */
export function exportToMarkdown(data: ExportData): string {
  const lines: string[] = []
  
  // Header with metadata as comment
  lines.push(`<!-- 
  Source: ${data.meta.source}
  Extracted: ${data.meta.extractedAt}
  Site: ${data.meta.siteName}
  Version: ${data.meta.version}
-->`)
  lines.push('')
  
  // Title
  lines.push(`# ${data.meta.siteName} Documentation`)
  lines.push('')
  
  // If we have full content, use it
  if (data.fullContent) {
    lines.push(data.fullContent)
  } else {
    // Otherwise, build from sections
    for (const section of data.sections) {
      lines.push(`## ${section.title}`)
      lines.push('')
      lines.push(section.content)
      lines.push('')
    }
  }
  
  return lines.join('\n')
}

/**
 * Export extraction result directly to Markdown
 */
export function exportExtractionToMarkdown(result: ExtractionResult): string {
  const data = extractionToExportData(result)
  return exportToMarkdown(data)
}

/**
 * Get filename for Markdown export
 */
export function getMarkdownFilename(siteName: string): string {
  const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-docs.md`
}

/**
 * Get MIME type for Markdown
 */
export function getMarkdownMimeType(): string {
  return 'text/markdown'
}
