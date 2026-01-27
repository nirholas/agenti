/**
 * Custom Search Queries Example
 * 
 * This example demonstrates how to customize search queries for:
 * - GitHub repository searches
 * - npm package searches
 * - Combining multiple queries
 * - Targeting specific ecosystems
 * 
 * Run with: npx tsx examples/09-custom-search-queries.ts
 * 
 * Prerequisites:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable
 * - GITHUB_TOKEN (optional, for higher rate limits)
 */

import { GitHubSource } from '../src/sources/github.js'
import { NpmSource } from '../src/sources/npm.js'
import { AIAnalyzer } from '../src/ai.js'
import type { DiscoveredTool } from '../src/types.js'

// ============================================
// Custom GitHub Search Queries
// ============================================

/**
 * Search GitHub with custom queries
 */
async function searchGitHubCustom(queries: string[], limit = 5): Promise<DiscoveredTool[]> {
  const github = new GitHubSource()
  const tools: DiscoveredTool[] = []
  const seen = new Set<string>()
  
  for (const query of queries) {
    console.log(`\n🔍 GitHub: "${query}"`)
    
    try {
      // Use the internal search method
      const results = await github.searchMCPServers(limit)
      
      for (const tool of results) {
        if (!seen.has(tool.id)) {
          seen.add(tool.id)
          tools.push(tool)
          console.log(`   Found: ${tool.name}`)
        }
      }
    } catch (error) {
      console.error(`   Error: ${(error as Error).message}`)
    }
    
    if (tools.length >= limit) break
  }
  
  return tools.slice(0, limit)
}

/**
 * Search npm with custom queries
 */
async function searchNpmCustom(queries: string[], limit = 5): Promise<DiscoveredTool[]> {
  const npm = new NpmSource()
  const tools: DiscoveredTool[] = []
  const seen = new Set<string>()
  
  for (const query of queries) {
    console.log(`\n🔍 npm: "${query}"`)
    
    try {
      const results = await npm.searchMCPServers(limit)
      
      for (const tool of results) {
        if (!seen.has(tool.id)) {
          seen.add(tool.id)
          tools.push(tool)
          console.log(`   Found: ${tool.name}`)
        }
      }
    } catch (error) {
      console.error(`   Error: ${(error as Error).message}`)
    }
    
    if (tools.length >= limit) break
  }
  
  return tools.slice(0, limit)
}

// ============================================
// Example Query Sets
// ============================================

// MCP-focused queries
const MCP_QUERIES = {
  github: [
    'mcp server in:name,description,readme',
    'modelcontextprotocol in:name,description',
    '@modelcontextprotocol in:readme',
    'mcp-server in:name',
    '"model context protocol" in:readme'
  ],
  npm: [
    'mcp server',
    '@modelcontextprotocol',
    'mcp-server',
    'model context protocol'
  ]
}

// AI/LLM tool queries
const AI_TOOL_QUERIES = {
  github: [
    'llm tools in:name,description',
    'ai agent tools in:description',
    'langchain tools in:name',
    'openai function in:name,description',
    'claude tools in:name,description'
  ],
  npm: [
    'llm tools',
    'langchain',
    'ai agent',
    'openai functions'
  ]
}

// API wrapper queries
const API_WRAPPER_QUERIES = {
  github: [
    'api wrapper in:name,description',
    'rest api client in:description',
    'openapi client in:name',
    'swagger client in:name'
  ],
  npm: [
    'api wrapper',
    'rest client',
    'openapi client'
  ]
}

// Database tool queries
const DATABASE_QUERIES = {
  github: [
    'database mcp in:name,description',
    'sql mcp server in:name,description',
    'mongodb mcp in:name',
    'postgres mcp in:name'
  ],
  npm: [
    'database mcp',
    'sql mcp',
    'mongodb tools'
  ]
}

// ============================================
// Combined Search Strategy
// ============================================

interface SearchStrategy {
  name: string
  github: string[]
  npm: string[]
}

async function executeSearchStrategy(
  strategy: SearchStrategy,
  limit = 10
): Promise<DiscoveredTool[]> {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`📌 Strategy: ${strategy.name}`)
  console.log('='.repeat(50))
  
  const allTools: DiscoveredTool[] = []
  const seen = new Set<string>()
  
  // Search GitHub
  console.log('\n🐙 GitHub Search')
  console.log('-'.repeat(30))
  const githubTools = await searchGitHubCustom(strategy.github, Math.ceil(limit / 2))
  
  for (const tool of githubTools) {
    if (!seen.has(tool.name)) {
      seen.add(tool.name)
      allTools.push(tool)
    }
  }
  
  // Search npm
  console.log('\n📦 npm Search')
  console.log('-'.repeat(30))
  const npmTools = await searchNpmCustom(strategy.npm, Math.ceil(limit / 2))
  
  for (const tool of npmTools) {
    if (!seen.has(tool.name)) {
      seen.add(tool.name)
      allTools.push(tool)
    }
  }
  
  return allTools.slice(0, limit)
}

// ============================================
// Main Example
// ============================================

async function main() {
  console.log('🔮 Custom Search Queries Example')
  console.log('='.repeat(50))
  
  // Example 1: MCP-focused search
  const mcpStrategy: SearchStrategy = {
    name: 'MCP Servers',
    ...MCP_QUERIES
  }
  
  const mcpTools = await executeSearchStrategy(mcpStrategy, 5)
  
  console.log(`\n✅ Found ${mcpTools.length} MCP tools`)
  for (const tool of mcpTools) {
    console.log(`   - ${tool.name} (${tool.source})`)
  }
  
  // Example 2: AI Tools search
  const aiStrategy: SearchStrategy = {
    name: 'AI/LLM Tools',
    ...AI_TOOL_QUERIES
  }
  
  const aiTools = await executeSearchStrategy(aiStrategy, 5)
  
  console.log(`\n✅ Found ${aiTools.length} AI tools`)
  for (const tool of aiTools) {
    console.log(`   - ${tool.name} (${tool.source})`)
  }
  
  // Example 3: Combined multi-strategy search
  console.log('\n' + '='.repeat(50))
  console.log('📌 Combined Multi-Strategy Search')
  console.log('='.repeat(50))
  
  const strategies = [
    { name: 'MCP', ...MCP_QUERIES },
    { name: 'Database', ...DATABASE_QUERIES }
  ]
  
  const allResults: DiscoveredTool[] = []
  
  for (const strategy of strategies) {
    const tools = await executeSearchStrategy(strategy, 3)
    allResults.push(...tools)
  }
  
  // Deduplicate by name
  const uniqueTools = Array.from(
    new Map(allResults.map(t => [t.name, t])).values()
  )
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 Combined Results Summary')
  console.log('='.repeat(50))
  console.log(`Total unique tools: ${uniqueTools.length}`)
  
  // Group by source
  const bySource = uniqueTools.reduce((acc, tool) => {
    acc[tool.source] = (acc[tool.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  console.log('\nBy source:')
  for (const [source, count] of Object.entries(bySource)) {
    console.log(`   ${source}: ${count}`)
  }
  
  // Example 4: Analyze top results with AI
  console.log('\n' + '='.repeat(50))
  console.log('🤖 AI Analysis of Top Results')
  console.log('='.repeat(50))
  
  const ai = new AIAnalyzer()
  const topTools = uniqueTools.slice(0, 2)
  
  for (const tool of topTools) {
    console.log(`\nAnalyzing: ${tool.name}...`)
    
    try {
      const decision = await ai.analyzeAndDecide(tool)
      console.log(`   Template: ${decision.template}`)
      console.log(`   Reasoning: ${decision.reasoning}`)
    } catch (error) {
      console.error(`   Error: ${(error as Error).message}`)
    }
  }
  
  console.log('\n✅ Custom search example complete!')
}

main().catch(console.error)
