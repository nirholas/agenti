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

/**
 * Verification result interface
 */
export interface VerifyResult {
  available: boolean
  status: 'online' | 'offline' | 'error'
  llmsTxt?: {
    url: string
    size: number
    type: 'full' | 'standard'
  }
  llmsFullTxt?: {
    url: string
    size: number
  }
  responseTime: number
  checkedAt: string
  error?: string
}

/**
 * Discovery result interface
 */
export interface DiscoverResult {
  domain: string
  checkedUrls: Array<{
    url: string
    status: number | 'error'
    available: boolean
  }>
  found: string[]
  recommended?: string
}

/**
 * Verify if a website has llms.txt available
 */
export async function verifyLlmsTxt(url: string): Promise<VerifyResult> {
  const startTime = Date.now()
  
  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`
  }

  let urlObj: URL
  try {
    urlObj = new URL(targetUrl)
  } catch {
    return {
      available: false,
      status: 'error',
      responseTime: Date.now() - startTime,
      checkedAt: new Date().toISOString(),
      error: 'Invalid URL format',
    }
  }

  const baseUrl = `${urlObj.protocol}//${urlObj.host}`
  const urlsToCheck = [
    { url: `${baseUrl}/llms.txt`, type: 'standard' as const },
    { url: `${baseUrl}/llms-full.txt`, type: 'full' as const },
  ]

  let llmsTxt: VerifyResult['llmsTxt'] | undefined
  let llmsFullTxt: VerifyResult['llmsFullTxt'] | undefined

  for (const { url: checkUrl, type } of urlsToCheck) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(checkUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'llm-energy-MCP/1.0 (Verification)',
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const content = await response.text()
        const size = content.length
        
        // Validate it's actual llms.txt content
        const isValid = content.trim().startsWith('#') || 
                       content.includes('## ') || 
                       !content.includes('<!DOCTYPE')

        if (isValid) {
          if (type === 'full' || checkUrl.includes('llms-full.txt')) {
            llmsFullTxt = { url: checkUrl, size }
          } else {
            const isFullContent = content.includes('## ') || content.split('\n').length > 50
            llmsTxt = { url: checkUrl, size, type: isFullContent ? 'full' : 'standard' }
          }
        }
      }
    } catch {
      // Continue to next URL
    }
  }

  const available = !!llmsTxt || !!llmsFullTxt

  return {
    available,
    status: available ? 'online' : 'offline',
    llmsTxt,
    llmsFullTxt,
    responseTime: Date.now() - startTime,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Discover possible llms.txt locations for a domain
 */
export async function discoverDocumentationUrls(url: string): Promise<DiscoverResult> {
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

  const domain = urlObj.hostname
  const protocol = urlObj.protocol

  // Generate URLs to check
  const urlsToCheck = [
    `${protocol}//${domain}/llms.txt`,
    `${protocol}//${domain}/llms-full.txt`,
    `${protocol}//docs.${domain}/llms.txt`,
    `${protocol}//${domain}/docs/llms.txt`,
  ]

  // If it's a subdomain, also check parent
  const parts = domain.split('.')
  if (parts.length > 2) {
    const parentDomain = parts.slice(1).join('.')
    urlsToCheck.push(`${protocol}//${parentDomain}/llms.txt`)
  }

  const checkedUrls: DiscoverResult['checkedUrls'] = []
  const found: string[] = []

  for (const checkUrl of urlsToCheck) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(checkUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'llm-energy-MCP/1.0 (Discovery)',
        },
      })

      clearTimeout(timeoutId)

      const available = response.ok
      checkedUrls.push({ url: checkUrl, status: response.status, available })
      
      if (available) {
        found.push(checkUrl)
      }
    } catch {
      checkedUrls.push({ url: checkUrl, status: 'error', available: false })
    }
  }

  // Recommend the best URL (prefer llms-full.txt)
  const recommended = found.find(u => u.includes('llms-full.txt')) || found[0]

  return {
    domain,
    checkedUrls,
    found,
    recommended,
  }
}
