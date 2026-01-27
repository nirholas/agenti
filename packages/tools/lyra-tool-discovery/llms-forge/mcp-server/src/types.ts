export interface Document {
  filename: string
  title: string
  content: string
  tokens: number
}

export interface ExtractionResult {
  url: string
  sourceUrl: string
  rawContent: string
  documents: Document[]
  fullDocument: Document
  agentGuide: Document
  stats: {
    totalTokens: number
    documentCount: number
    processingTime: number
  }
}

export interface ParsedSection {
  title: string
  level: number
  content: string
}
