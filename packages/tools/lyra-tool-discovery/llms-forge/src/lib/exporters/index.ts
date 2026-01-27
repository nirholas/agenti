/**
 * Exporters Module
 * Export extraction results to various formats (Markdown, JSON, YAML)
 */

import type { ExtractionResult, ExportFormat, ExportData } from '@/types'
import {
  exportToMarkdown,
  exportExtractionToMarkdown,
  getMarkdownFilename,
  getMarkdownMimeType,
  extractionToExportData,
} from './markdown'
import {
  exportToJson,
  exportExtractionToJson,
  getJsonFilename,
  getJsonMimeType,
} from './json'
import {
  exportToYaml,
  exportExtractionToYaml,
  getYamlFilename,
  getYamlMimeType,
} from './yaml'

// Re-export individual exporters
export {
  exportToMarkdown,
  exportExtractionToMarkdown,
  getMarkdownFilename,
  getMarkdownMimeType,
  extractionToExportData,
} from './markdown'
export {
  exportToJson,
  exportExtractionToJson,
  getJsonFilename,
  getJsonMimeType,
  parseJsonExport,
} from './json'
export {
  exportToYaml,
  exportExtractionToYaml,
  getYamlFilename,
  getYamlMimeType,
  parseYamlExport,
} from './yaml'

/**
 * Export extraction result to specified format
 */
export function exportToFormat(result: ExtractionResult, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return exportExtractionToJson(result)
    case 'yaml':
      return exportExtractionToYaml(result)
    case 'markdown':
    default:
      return exportExtractionToMarkdown(result)
  }
}

/**
 * Export data to specified format
 */
export function exportDataToFormat(data: ExportData, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return exportToJson(data)
    case 'yaml':
      return exportToYaml(data)
    case 'markdown':
    default:
      return exportToMarkdown(data)
  }
}

/**
 * Get filename for specified format
 */
export function getFilenameForFormat(siteName: string, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return getJsonFilename(siteName)
    case 'yaml':
      return getYamlFilename(siteName)
    case 'markdown':
    default:
      return getMarkdownFilename(siteName)
  }
}

/**
 * Get MIME type for specified format
 */
export function getMimeTypeForFormat(format: ExportFormat): string {
  switch (format) {
    case 'json':
      return getJsonMimeType()
    case 'yaml':
      return getYamlMimeType()
    case 'markdown':
    default:
      return getMarkdownMimeType()
  }
}

/**
 * Get file extension for specified format
 */
export function getExtensionForFormat(format: ExportFormat): string {
  switch (format) {
    case 'json':
      return '.json'
    case 'yaml':
      return '.yaml'
    case 'markdown':
    default:
      return '.md'
  }
}

/**
 * Available export formats
 */
export const EXPORT_FORMATS: { value: ExportFormat; label: string; extension: string }[] = [
  { value: 'markdown', label: 'Markdown', extension: '.md' },
  { value: 'json', label: 'JSON', extension: '.json' },
  { value: 'yaml', label: 'YAML', extension: '.yaml' },
]
