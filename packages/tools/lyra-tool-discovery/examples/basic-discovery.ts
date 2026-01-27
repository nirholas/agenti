/**
 * Basic Discovery Example
 *
 * This example shows how to discover MCP tools from GitHub and npm.
 *
 * Run with: npx tsx examples/01-basic-discovery.ts
 *
 * Prerequisites:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable
 */

import { ToolDiscovery } from '../src/index.js'

async function main() {
  console.log('🔮 Lyra Tool Discovery - Basic Example\n')

  // Create discovery instance with default AI config
  // Automatically detects API key from environment
  const discovery = new ToolDiscovery()

  console.log('Searching GitHub for MCP servers...\n')

  // Discover tools from GitHub
  const results = await discovery.discover({
    sources: ['github'],
    limit: 5,
  })

  console.log(`\nFound ${results.length} analyzed tools:\n`)

  for (const result of results) {
    console.log(`📦 ${result.tool.name}`)
    console.log(`   Template: ${result.decision.template}`)
    console.log(`   Reasoning: ${result.decision.reasoning}`)
    console.log(`   URL: ${result.tool.sourceUrl}`)
    console.log()
  }

  // Summary
  console.log('━'.repeat(50))
  console.log(`\n✅ Discovery complete! Found ${results.length} MCP-compatible tools.`)
}

main().catch(console.error)
