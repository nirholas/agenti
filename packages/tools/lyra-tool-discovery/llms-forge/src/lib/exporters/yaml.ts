import yaml from 'js-yaml'
import type { ExtractionResult, ExportData } from '@/types'
import { extractionToExportData } from './markdown'

/**
 * YAML export structure (mirrors JSON structure)
 */
export interface YamlExport {
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
 * Export data to YAML format
 */
export function exportToYaml(data: ExportData): string {
  const totalTokens = data.sections.reduce((sum, s) => sum + s.tokens, 0)
  
  const yamlExport: YamlExport = {
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
  
  return yaml.dump(yamlExport, {
    lineWidth: -1, // Don't wrap lines
    noRefs: true,
    sortKeys: false,
  })
}

/**
 * Export extraction result directly to YAML
 */
export function exportExtractionToYaml(result: ExtractionResult): string {
  const data = extractionToExportData(result)
  return exportToYaml(data)
}

/**
 * Parse YAML export back to ExportData
 */
export function parseYamlExport(yamlString: string): ExportData {
  const parsed = yaml.load(yamlString) as YamlExport
  
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
 * Get filename for YAML export
 */
export function getYamlFilename(siteName: string): string {
  const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-docs.yaml`
}

/**
 * Get MIME type for YAML
 */
export function getYamlMimeType(): string {
  return 'text/yaml'
}
