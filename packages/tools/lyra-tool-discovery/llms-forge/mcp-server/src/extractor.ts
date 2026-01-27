import type { Document, ExtractionResult } from './types.js'
import { parseLlmsContent, extractSiteName } from './parser.js'
import { generateAllDocuments } from './generator.js'

/**
 * Fetches and extracts documentation from a URL's llms.txt or llms-full.txt
 */
export async function extractDocumentation(url: string): Promise<ExtractionResult> {
  const startTime = Date.now()
  
  // Parse and normalize the URL
  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`
  }

  let urlObj: URL
  try {
    urlObj = new URL(targetUrl)
  } catch {
    throw new Error('Invalid URL format')
  }
  
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`
  
  // Try llms-full.txt first, then fallback to llms.txt
  let content: string | null = null
  let sourceUrl: string = ''
  
  const urlsToTry = [
    `${baseUrl}/llms-full.txt`,
    `${baseUrl}/llms.txt`
  ]
  
  for (const tryUrl of urlsToTry) {
    try {
      const response = await fetch(tryUrl, {
        headers: {
          'User-Agent': 'llm-energy-MCP/1.0 (Documentation Extractor)',
        },
      })
      
      if (response.ok) {
        content = await response.text()
        sourceUrl = tryUrl
        break
      }
    } catch {
      continue
    }
  }
  
  if (!content) {
    throw new Error(`No llms.txt or llms-full.txt found at ${urlObj.host}`)
  }
  
  // Parse the content into documents
  const parsedDocuments = parseLlmsContent(content)
  
  if (parsedDocuments.length === 0) {
    throw new Error('No content could be parsed from the documentation')
  }
  
  // Generate all output documents
  const { documents, fullDocument, agentGuide } = generateAllDocuments(
    parsedDocuments,
    content,
    sourceUrl
  )
  
  // Calculate statistics
  const totalTokens = documents.reduce((sum, doc) => sum + doc.tokens, 0) 
    + fullDocument.tokens 
    + agentGuide.tokens
  
  const processingTime = Date.now() - startTime
  
  return {
    url: targetUrl,
    sourceUrl,
    rawContent: content,
    documents,
    fullDocument,
    agentGuide,
    stats: {
      totalTokens,
      documentCount: documents.length,
      processingTime
    }
  }
}

/**
 * Fetches raw llms.txt content without parsing
 */
export async function fetchLlmsTxt(url: string): Promise<{ content: string; sourceUrl: string }> {
  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`
  }

  let urlObj: URL
  try {
    urlObj = new URL(targetUrl)
  } catch {
    throw new Error('Invalid URL format')
  }
  
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`
  
  const urlsToTry = [
    `${baseUrl}/llms-full.txt`,
    `${baseUrl}/llms.txt`
  ]
  
  for (const tryUrl of urlsToTry) {
    try {
      const response = await fetch(tryUrl, {
        headers: {
          'User-Agent': 'LLMs-Forge-MCP/1.0 (Documentation Extractor)',
        },
      })
      
      if (response.ok) {
        const content = await response.text()
        return { content, sourceUrl: tryUrl }
      }
    } catch {
      continue
    }
  }
  
  throw new Error(`No llms.txt or llms-full.txt found at ${urlObj.host}`)
}

/**
 * Lists all document sections from extracted content
 */
export function listDocumentSections(documents: Document[]): Array<{
  filename: string
  title: string
  tokens: number
}> {
  return documents.map(doc => ({
    filename: doc.filename,
    title: doc.title,
    tokens: doc.tokens
  }))
}

/**
 * Gets a specific document by filename
 */
export function getDocumentByFilename(
  documents: Document[],
  filename: string
): Document | undefined {
  return documents.find(doc => doc.filename === filename)
}
