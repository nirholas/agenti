#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js'

import { extractDocumentation, fetchLlmsTxt, verifyLlmsTxt, discoverDocumentationUrls } from './extractor.js'
import type { ExtractionResult, Document } from './types.js'

// Store extracted documentation in memory for resource access
const extractionCache = new Map<string, ExtractionResult>()

const server = new Server(
  {
    name: 'llm-energy-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'extract_documentation',
        description: 'Extract and parse documentation from a website that has llms.txt or llms-full.txt. Returns structured documents ready for AI consumption including individual sections, a full consolidated document, and an agent guide.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the documentation website (e.g., docs.anthropic.com, stripe.com/docs)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'fetch_llms_txt',
        description: 'Fetch the raw llms.txt or llms-full.txt content from a website without parsing. Useful for quick access to documentation.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the documentation website'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'get_document_section',
        description: 'Get a specific document section from previously extracted documentation by filename.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL that was previously extracted'
            },
            filename: {
              type: 'string',
              description: 'The filename of the section to retrieve (e.g., "getting-started.md")'
            }
          },
          required: ['url', 'filename']
        }
      },
      {
        name: 'list_extracted_documents',
        description: 'List all document sections from a previously extracted URL.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL that was previously extracted'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'get_full_documentation',
        description: 'Get the complete consolidated documentation (llms-full.md) from a previously extracted URL.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL that was previously extracted'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'get_agent_guide',
        description: 'Get the AI agent guide (AGENT-GUIDE.md) from a previously extracted URL. This contains instructions on how to use the documentation.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL that was previously extracted'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'verify_llms_txt',
        description: 'Check if a website has a valid llms.txt or llms-full.txt file. Returns availability status, file location, and basic metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the website to verify (e.g., docs.anthropic.com, stripe.com)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'discover_documentation_urls',
        description: 'Discover possible llms.txt locations for a given domain. Checks root domain, docs subdomain, and common paths.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The base URL or domain to check'
            }
          },
          required: ['url']
        }
      }
    ]
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'extract_documentation': {
        const url = args?.url as string
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const result = await extractDocumentation(url)
        
        // Cache the result for later access
        const cacheKey = normalizeUrl(url)
        extractionCache.set(cacheKey, result)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                url: result.url,
                sourceUrl: result.sourceUrl,
                stats: result.stats,
                documents: result.documents.map(d => ({
                  filename: d.filename,
                  title: d.title,
                  tokens: d.tokens
                })),
                fullDocument: {
                  filename: result.fullDocument.filename,
                  tokens: result.fullDocument.tokens
                },
                agentGuide: {
                  filename: result.agentGuide.filename,
                  tokens: result.agentGuide.tokens
                },
                message: `Successfully extracted ${result.stats.documentCount} documents (${result.stats.totalTokens} tokens) in ${result.stats.processingTime}ms. Use get_document_section, get_full_documentation, or get_agent_guide to access the content.`
              }, null, 2)
            }
          ]
        }
      }

      case 'fetch_llms_txt': {
        const url = args?.url as string
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const { content, sourceUrl } = await fetchLlmsTxt(url)

        return {
          content: [
            {
              type: 'text',
              text: `Source: ${sourceUrl}\n\n${content}`
            }
          ]
        }
      }

      case 'get_document_section': {
        const url = args?.url as string
        const filename = args?.filename as string
        
        if (!url || !filename) {
          throw new McpError(ErrorCode.InvalidParams, 'URL and filename are required')
        }

        const cacheKey = normalizeUrl(url)
        const cached = extractionCache.get(cacheKey)
        
        if (!cached) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `No extraction found for ${url}. Please run extract_documentation first.`
          )
        }

        const document = cached.documents.find(d => d.filename === filename)
        
        if (!document) {
          const available = cached.documents.map(d => d.filename).join(', ')
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Document "${filename}" not found. Available: ${available}`
          )
        }

        return {
          content: [
            {
              type: 'text',
              text: document.content
            }
          ]
        }
      }

      case 'list_extracted_documents': {
        const url = args?.url as string
        
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const cacheKey = normalizeUrl(url)
        const cached = extractionCache.get(cacheKey)
        
        if (!cached) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `No extraction found for ${url}. Please run extract_documentation first.`
          )
        }

        const documentList = cached.documents.map(d => ({
          filename: d.filename,
          title: d.title,
          tokens: d.tokens
        }))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                url: cached.url,
                sourceUrl: cached.sourceUrl,
                documentCount: cached.documents.length,
                documents: documentList,
                specialFiles: ['llms-full.md', 'AGENT-GUIDE.md']
              }, null, 2)
            }
          ]
        }
      }

      case 'get_full_documentation': {
        const url = args?.url as string
        
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const cacheKey = normalizeUrl(url)
        const cached = extractionCache.get(cacheKey)
        
        if (!cached) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `No extraction found for ${url}. Please run extract_documentation first.`
          )
        }

        return {
          content: [
            {
              type: 'text',
              text: cached.fullDocument.content
            }
          ]
        }
      }

      case 'get_agent_guide': {
        const url = args?.url as string
        
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const cacheKey = normalizeUrl(url)
        const cached = extractionCache.get(cacheKey)
        
        if (!cached) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `No extraction found for ${url}. Please run extract_documentation first.`
          )
        }

        return {
          content: [
            {
              type: 'text',
              text: cached.agentGuide.content
            }
          ]
        }
      }

      case 'verify_llms_txt': {
        const url = args?.url as string
        
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const verifyResult = await verifyLlmsTxt(url)
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(verifyResult, null, 2)
            }
          ]
        }
      }

      case 'discover_documentation_urls': {
        const url = args?.url as string
        
        if (!url) {
          throw new McpError(ErrorCode.InvalidParams, 'URL is required')
        }

        const discoverResult = await discoverDocumentationUrls(url)
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(discoverResult, null, 2)
            }
          ]
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error
    }
    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
})

// List available resources (cached extractions)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = []
  
  for (const [url, result] of extractionCache) {
    resources.push({
      uri: `llms-forge://${url}/full`,
      name: `${result.fullDocument.title}`,
      description: `Full documentation from ${result.sourceUrl}`,
      mimeType: 'text/markdown'
    })
    
    resources.push({
      uri: `llms-forge://${url}/guide`,
      name: `Agent Guide - ${url}`,
      description: `AI agent usage guide for ${url}`,
      mimeType: 'text/markdown'
    })
    
    for (const doc of result.documents) {
      resources.push({
        uri: `llms-forge://${url}/${doc.filename}`,
        name: doc.title,
        description: `${doc.tokens} tokens`,
        mimeType: 'text/markdown'
      })
    }
  }
  
  return { resources }
})

// Read a resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri
  
  // Parse the URI: llms-forge://domain.com/filename
  const match = uri.match(/^llms-forge:\/\/(.+?)\/(.+)$/)
  
  if (!match) {
    throw new McpError(ErrorCode.InvalidRequest, `Invalid resource URI: ${uri}`)
  }
  
  const [, url, filename] = match
  const cached = extractionCache.get(url)
  
  if (!cached) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `No extraction found for ${url}. Please run extract_documentation first.`
    )
  }
  
  let content: string
  
  if (filename === 'full') {
    content = cached.fullDocument.content
  } else if (filename === 'guide') {
    content = cached.agentGuide.content
  } else {
    const doc = cached.documents.find(d => d.filename === filename)
    if (!doc) {
      throw new McpError(ErrorCode.InvalidRequest, `Document not found: ${filename}`)
    }
    content = doc.content
  }
  
  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: content
      }
    ]
  }
})

// Helper function to normalize URLs for caching
function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase()
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`
  }
  try {
    const urlObj = new URL(normalized)
    return urlObj.host
  } catch {
    return normalized
  }
}

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'extract_and_summarize',
        description: 'Extract documentation from a URL and provide a summary of its contents',
        arguments: [
          {
            name: 'url',
            description: 'The documentation URL to extract',
            required: true
          }
        ]
      },
      {
        name: 'find_api_reference',
        description: 'Extract documentation and locate API reference sections',
        arguments: [
          {
            name: 'url',
            description: 'The documentation URL to extract',
            required: true
          },
          {
            name: 'topic',
            description: 'The API topic or endpoint to find',
            required: false
          }
        ]
      },
      {
        name: 'getting_started_guide',
        description: 'Extract documentation and create a getting started guide',
        arguments: [
          {
            name: 'url',
            description: 'The documentation URL to extract',
            required: true
          }
        ]
      }
    ]
  }
})

// Get a specific prompt
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const url = args?.url as string

  switch (name) {
    case 'extract_and_summarize':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please extract the documentation from ${url} using the extract_documentation tool, then provide a comprehensive summary of:
1. What the project/service does
2. Key features and capabilities
3. Main sections available in the documentation
4. Getting started steps if available`
            }
          }
        ]
      }

    case 'find_api_reference':
      const topic = args?.topic as string
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please extract the documentation from ${url} using the extract_documentation tool, then:
1. List all available API endpoints or methods
2. ${topic ? `Find specific documentation about: ${topic}` : 'Identify the main API categories'}
3. Provide code examples if available
4. Note any authentication requirements`
            }
          }
        ]
      }

    case 'getting_started_guide':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please extract the documentation from ${url} using the extract_documentation tool, then create a step-by-step getting started guide that includes:
1. Prerequisites and requirements
2. Installation steps
3. Basic configuration
4. First example or hello world
5. Next steps and resources`
            }
          }
        ]
      }

    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`)
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('LLMs Forge MCP Server started')
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
