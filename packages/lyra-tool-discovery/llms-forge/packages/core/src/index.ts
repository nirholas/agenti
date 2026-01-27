/**
 * @llm-energy/core
 * 
 * Shared utilities for llm.energy - parser, types, and generators
 * Used by both the web app and MCP server
 */

// Types
export type {
  Document,
  ParsedSection,
  ExtractionResult,
  DownloadRequest,
  SiteEntry,
  ExtractionEvent,
  BatchRequest,
  BatchResult,
  ExportFormat,
  CacheEntry,
  RateLimitResult,
} from './types'

// Parser utilities
export {
  slugify,
  estimateTokens,
  extractSiteName,
  parseMarkdownSections,
  sectionsToDocuments,
  parseLlmsContent,
} from './parser'

// Generator utilities
export {
  generateFullDocument,
  generateAgentGuide,
  generateAllDocuments,
} from './generator'
