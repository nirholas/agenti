export interface Document {
  filename: string
  title: string
  content: string
  tokens: number
  sourceUrl?: string  // For documents extracted from linked llms.txt files
}

export interface MarkdownDocument {
  title: string
  url: string
  content: string
  wordCount: number
}

export type ExtractionState = 'idle' | 'extracting' | 'complete' | 'error'

export interface ExtractionProgress {
  status: 'idle' | 'analyzing' | 'fetching' | 'processing' | 'complete' | 'error'
  message: string
  progress: number
  currentStep?: string
  totalSteps?: number
  completedSteps?: number
  logs: string[]
}

export interface LinkedSource {
  url: string
  name: string
  description?: string
  documentCount?: number
  tokens?: number
}

export interface ExtractionResult {
  url: string
  sourceUrl: string
  rawContent: string
  documents: Document[]
  fullDocument: Document
  agentGuide: Document
  linkedSources?: LinkedSource[]  // Info about linked llms.txt files that were fetched
  stats: {
    totalTokens: number
    documentCount: number
    processingTime: number
    linkedSourceCount?: number
  }
}

export interface UrlAnalysis {
  originalUrl: string
  baseUrl: string
  strategy: 'llms-txt' | 'sitemap' | 'docs-discovery' | 'html-scrape'
  llmsTxtUrl: string | null
  installMdUrl: string | null
  sitemapUrl: string | null
  docsUrl: string | null
  pages: string[]
}

export interface DownloadRequest {
  documents: Document[]
  fullDocument: Document
  agentGuide: Document
  siteName: string
}

// Site Directory types
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

// Analytics types
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

export interface AggregatedStats {
  totalExtractions: number
  successfulExtractions: number
  failedExtractions: number
  successRate: number
  avgProcessingTime: number
  totalTokensProcessed: number
  popularSites: { host: string; count: number }[]
  extractionsToday: number
  extractionsThisHour: number
}

// Site suggestion types
export interface SiteSuggestion {
  url: string
  name: string
  description?: string
  submittedAt: number
  llmsTxtExists: boolean | null
}
// Caching types
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  evictions: number
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs?: number
  maxRequests?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

// Validation types
export interface ValidationResult {
  exists: boolean
  type: 'full' | 'standard' | null
  size?: number
  url?: string
}

// Export format types
export type ExportFormat = 'markdown' | 'json' | 'yaml'

export interface ExportMeta {
  source: string
  extractedAt: string
  version: string
  siteName: string
}

export interface ExportSection {
  title: string
  content: string
  tokens: number
  filename?: string
}

export interface ExportData {
  meta: ExportMeta
  sections: ExportSection[]
  fullContent?: string
}

// Batch processing types
export interface BatchRequest {
  urls: string[]
  options?: {
    format?: ExportFormat
    includeAgentGuide?: boolean
  }
}

export interface BatchResult {
  url: string
  success: boolean
  error?: string
  data?: ExtractionResult
}

export interface BatchResponse {
  results: BatchResult[]
  stats: {
    total: number
    successful: number
    failed: number
    totalTokens: number
  }
}

// Generator types
export interface GeneratorSection {
  id: string
  title: string
  content: string
}

export interface GeneratorData {
  siteName: string
  description: string
  url: string
  sections: GeneratorSection[]
}

// install.md types
export interface InstallMdTodoItem {
  id: string
  text: string
  completed: boolean
}

export interface InstallMdStep {
  id: string
  title: string
  description: string
  codeBlocks: Array<{
    language: string
    code: string
    label?: string
  }>
}

export interface InstallMdData {
  productName: string
  description: string
  actionPrompt: string
  objective: string
  doneWhen: string
  todoItems: InstallMdTodoItem[]
  prerequisites?: InstallMdStep
  steps: InstallMdStep[]
  additionalSections?: InstallMdStep[]
  llmsTxtUrl?: string
}

export interface InstallMdGeneratorData {
  productName: string
  description: string
  objective: string
  doneWhen: string
  todoItems: InstallMdTodoItem[]
  steps: InstallMdStep[]
}

export interface ParsedInstallMd {
  raw: string
  productName: string
  description: string
  actionPrompt: string
  objective: string
  doneWhen: string
  todoItems: InstallMdTodoItem[]
  steps: InstallMdStep[]
  isValid: boolean
  validationErrors: string[]
}