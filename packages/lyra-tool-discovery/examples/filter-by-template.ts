/**
 * Filter by Template Example
 *
 * This example shows how to discover tools and filter
 * results by template type, with grouping and statistics.
 *
 * Run with: npx tsx examples/06-filter-by-template.ts
 */

import { ToolDiscovery, type DiscoveryResult, type PluginTemplate } from '../src/index.js'

// Template categories for grouping
const MCP_TEMPLATES: PluginTemplate[] = ['mcp-http', 'mcp-stdio']
const STANDARD_TEMPLATES: PluginTemplate[] = ['basic', 'default', 'markdown', 'openapi', 'settings', 'standalone']

function filterByTemplates(
  results: DiscoveryResult[],
  templates: PluginTemplate[]
): DiscoveryResult[] {
  return results.filter(r => templates.includes(r.decision.template))
}

function groupByTemplate(results: DiscoveryResult[]): Map<PluginTemplate, DiscoveryResult[]> {
  const groups = new Map<PluginTemplate, DiscoveryResult[]>()
  
  for (const result of results) {
    const template = result.decision.template
    if (!groups.has(template)) {
      groups.set(template, [])
    }
    groups.get(template)!.push(result)
  }
  
  return groups
}

function printStatistics(results: DiscoveryResult[]): void {
  const groups = groupByTemplate(results)
  const total = results.length

  console.log('\n📊 Template Distribution:')
  console.log('─'.repeat(40))
  
  // Sort by count descending
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  
  for (const [template, items] of sorted) {
    const percentage = ((items.length / total) * 100).toFixed(1)
    const bar = '█'.repeat(Math.ceil(items.length / total * 20))
    console.log(`   ${template.padEnd(12)} ${items.length.toString().padStart(3)} (${percentage.padStart(5)}%) ${bar}`)
  }
  
  console.log('─'.repeat(40))
  console.log(`   Total:       ${total}`)
}

async function main() {
  console.log('🔮 Lyra Tool Discovery - Filter by Template\n')

  const discovery = new ToolDiscovery()

  // Discover more tools to get a good sample
  console.log('🔍 Discovering tools from GitHub and npm...\n')
  
  const results = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 15,
  })

  if (results.length === 0) {
    console.log('❌ No tools discovered')
    process.exit(1)
  }

  console.log(`\n✅ Discovered ${results.length} tools\n`)

  // ===========================================
  // Filter: MCP Templates Only
  // ===========================================
  console.log('═'.repeat(60))
  console.log('🔌 MCP Templates (mcp-http, mcp-stdio)')
  console.log('═'.repeat(60))

  const mcpTools = filterByTemplates(results, MCP_TEMPLATES)
  
  if (mcpTools.length === 0) {
    console.log('   No MCP tools found')
  } else {
    for (const result of mcpTools) {
      console.log(`   📦 ${result.tool.name}`)
      console.log(`      Template: ${result.decision.template}`)
      console.log(`      URL: ${result.tool.sourceUrl}`)
    }
  }

  // ===========================================
  // Filter: Standard Templates Only
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('📋 Standard Templates (non-MCP)')
  console.log('═'.repeat(60))

  const standardTools = filterByTemplates(results, STANDARD_TEMPLATES)
  
  if (standardTools.length === 0) {
    console.log('   No standard template tools found')
  } else {
    for (const result of standardTools) {
      console.log(`   📦 ${result.tool.name}`)
      console.log(`      Template: ${result.decision.template}`)
      console.log(`      Reason: ${result.decision.reasoning.substring(0, 80)}...`)
    }
  }

  // ===========================================
  // Group by Template
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('📁 Grouped by Template')
  console.log('═'.repeat(60))

  const grouped = groupByTemplate(results)
  
  for (const [template, items] of grouped) {
    console.log(`\n   🏷️  ${template} (${items.length} tools):`)
    for (const item of items) {
      console.log(`      - ${item.tool.name}`)
    }
  }

  // ===========================================
  // Output Statistics
  // ===========================================
  printStatistics(results)

  // ===========================================
  // Filter by Specific Template
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('🎯 Custom Filter Example')
  console.log('═'.repeat(60))

  // Example: Find only stdio-based MCP servers
  const stdioOnly = filterByTemplates(results, ['mcp-stdio'])
  console.log(`\n   mcp-stdio tools: ${stdioOnly.length}`)
  for (const tool of stdioOnly) {
    console.log(`   - ${tool.tool.name}`)
  }

  // Example: Find tools needing UI
  const uiTools = filterByTemplates(results, ['standalone', 'default', 'settings'])
  console.log(`\n   Tools with UI: ${uiTools.length}`)
  for (const tool of uiTools) {
    console.log(`   - ${tool.tool.name} (${tool.decision.template})`)
  }

  console.log('\n✅ Filter example complete!')
}

main().catch(console.error)
