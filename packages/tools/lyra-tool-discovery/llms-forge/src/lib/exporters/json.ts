import type { ExtractionResult, ExportData } from '@/types'
import { extractionToExportData } from './markdown'

/**
 * JSON export structure
 */
export interface JsonExport {
  meta: {
    source: string
    extractedAt: string
    version: string
    siteName: string
  }
  sections: Array<{
    title: string
    content: string
    tokens: number
    filename?: string
  }>
  stats: {
    totalSections: number
    totalTokens: number
  }
}

/**
 * Export data to JSON format
 */
export function exportToJson(data: ExportData): string {
  const totalTokens = data.sections.reduce((sum, s) => sum + s.tokens, 0)
  
  const jsonExport: JsonExport = {
    meta: {
      source: data.meta.source,
      extractedAt: data.meta.extractedAt,
      version: data.meta.version,
      siteName: data.meta.siteName,
    },
    sections: data.sections.map((s) => ({
      title: s.title,
      content: s.content,
      tokens: s.tokens,
      filename: s.filename,
    })),
    stats: {
      totalSections: data.sections.length,
      totalTokens,
    },
  }
  
  return JSON.stringify(jsonExport, null, 2)
}

/**
 * Export extraction result directly to JSON
 */
export function exportExtractionToJson(result: ExtractionResult): string {
  const data = extractionToExportData(result)
  return exportToJson(data)
}

/**
 * Parse JSON export back to ExportData
 */
export function parseJsonExport(jsonString: string): ExportData {
  const parsed = JSON.parse(jsonString) as JsonExport
  
  return {
    meta: {
      source: parsed.meta.source,
      extractedAt: parsed.meta.extractedAt,
      version: parsed.meta.version,
      siteName: parsed.meta.siteName,
    },
    sections: parsed.sections.map((s) => ({
      title: s.title,
      content: s.content,
      tokens: s.tokens,
      filename: s.filename,
    })),
  }
}

/**
 * Get filename for JSON export
 */
export function getJsonFilename(siteName: string): string {
  const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-docs.json`
}

/**
 * Get MIME type for JSON
 */
export function getJsonMimeType(): string {
  return 'application/json'
}
