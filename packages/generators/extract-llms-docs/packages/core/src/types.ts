/**
 * @llm-energy/core - Shared types for llm.energy
 * 
 * These types are used by both the web app and MCP server
 */

/**
 * Represents a parsed document section from llms.txt content
 */
export interface Document {
  /** Generated filename (e.g., "getting-started.md") */
  filename: string
  /** Section title extracted from header */
  title: string
  /** Full content of the section including header */
  content: string
  /** Estimated token count (~4 chars per token) */
  tokens: number
}

/**
 * Intermediate representation of a parsed markdown section
 */
export interface ParsedSection {
  /** Section title from markdown header */
  title: string
  /** Header level (1-6 for # through ######) */
  level: number
  /** Content following the header */
  content: string
}

/**
 * Result of extracting and parsing llms.txt content
 */
export interface ExtractionResult {
  /** Original URL provided by user */
  url: string
  /** Actual URL that was fetched (llms.txt or llms-full.txt) */
  sourceUrl: string
  /** Raw content from the llms.txt file */
  rawContent: string
  /** Array of parsed document sections */
  documents: Document[]
  /** Consolidated full documentation file */
  fullDocument: Document
  /** Generated agent guide with usage instructions */
  agentGuide: Document
  /** Extraction statistics */
  stats: {
    /** Total tokens across all documents */
    totalTokens: number
    /** Number of individual documents generated */
    documentCount: number
    /** Time taken to process in milliseconds */
    processingTime: number
  }
}

/**
 * Request body for downloading documents as ZIP
 */
export interface DownloadRequest {
  documents: Document[]
  fullDocument: Document
  agentGuide: Document
  siteName: string
}

/**
 * Site entry for the directory feature
 */
export interface SiteEntry {
  id: string
  name: string
  url: string
  category: 'ai' | 'developer-tools' | 'documentation' | 'cloud' | 'other'
  description: string
  llmsTxtType: 'full' | 'standard'
  verified: boolean
  lastChecked?: string
  favicon?: string
}

/**
 * Analytics event for tracking extractions
 */
export interface ExtractionEvent {
  url: string
  host: string
  timestamp: number
  success: boolean
  documentCount?: number
  totalTokens?: number
  processingTime?: number
  cached?: boolean
}

/**
 * Batch processing request
 */
export interface BatchRequest {
  urls: string[]
  format?: ExportFormat
}

/**
 * Individual result in a batch operation
 */
export interface BatchResult {
  url: string
  success: boolean
  error?: string
  data?: ExtractionResult
}

/**
 * Supported export formats
 */
export type ExportFormat = 'markdown' | 'json' | 'yaml' | 'html'

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Rate limiting result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}
