/**
 * Custom Search Queries Example
 *
 * This example shows how to use custom search queries
 * for GitHub and npm to find specific types of tools.
 *
 * Run with: npx tsx examples/09-custom-search-queries.ts
 */

import { GitHubSource, NpmSource, ToolDiscovery } from '../src/index.js'

async function main() {
  console.log('🔮 Lyra Tool Discovery - Custom Search Queries\n')

  // ===========================================
  // Custom GitHub Search Queries
  // ===========================================
  console.log('═'.repeat(60))
  console.log('🔍 Custom GitHub Searches')
  console.log('═'.repeat(60))

  const github = new GitHubSource()

  // Example 1: Search for MCP servers with specific language
  console.log('\n📌 Example 1: MCP servers in TypeScript')
  console.log('   Query: "mcp server" language:typescript')
  
  const tsServers = await github.searchMCPServers(5)
  console.log(`   Found: ${tsServers.length} results`)
  for (const server of tsServers.slice(0, 3)) {
    console.log(`   - ${server.name}`)
  }

  // Example 2: Search for specific MCP implementations
  console.log('\n📌 Example 2: Model Context Protocol implementations')
  console.log('   Query: "modelcontextprotocol" in:readme')
  
  // Note: The GitHubSource has built-in queries, but you can extend it
  // For custom queries, you'd typically extend the class or use the API directly

  // ===========================================
  // Custom npm Keyword Searches
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('📦 Custom npm Searches')
  console.log('═'.repeat(60))

  const npm = new NpmSource()

  // Example 1: Search for MCP packages
  console.log('\n📌 Example 1: MCP-related packages')
  console.log('   Keywords: mcp, model-context-protocol')
  
  const mcpPackages = await npm.searchMCPServers(5)
  console.log(`   Found: ${mcpPackages.length} results`)
  for (const pkg of mcpPackages.slice(0, 3)) {
    console.log(`   - ${pkg.name}: ${pkg.description?.substring(0, 50)}...`)
  }

  // ===========================================
  // Combining Multiple Queries
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('🔗 Combining Multiple Queries')
  console.log('═'.repeat(60))

  console.log('\n📌 Discovery from all sources:')
  
  const discovery = new ToolDiscovery()
  
  // Run discovery with both sources
  const allResults = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 5,
    dryRun: true,  // Just show what would be analyzed
  })

  // ===========================================
  // Search Query Best Practices
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('💡 Search Query Best Practices')
  console.log('═'.repeat(60))

  console.log(`
   GitHub Search Tips:
   ─────────────────────
   • Use "mcp" OR "model context protocol" for broader results
   • Add language:typescript for TypeScript projects
   • Use stars:>10 to filter popular repos
   • Search in:readme,description for better matches
   • Use topic:mcp-server if repos use GitHub topics
   
   npm Search Tips:
   ─────────────────────
   • Keywords: mcp, mcp-server, model-context-protocol
   • Look for @modelcontextprotocol scope
   • Check for "mcp" in package name
   • Filter by recent updates for active packages
   
   Combining Strategies:
   ─────────────────────
   • Start with broad queries, then filter results
   • Use multiple sources to maximize coverage
   • Deduplicate by repository URL
   • Cache results to avoid rate limits
  `)

  // ===========================================
  // Example: Custom Query Workflow
  // ===========================================
  console.log('═'.repeat(60))
  console.log('📋 Example Custom Query Workflow')
  console.log('═'.repeat(60))

  console.log(`
   // Extend GitHubSource for custom queries
   class CustomGitHubSource extends GitHubSource {
     async searchByTopic(topic: string, limit: number) {
       // Custom implementation with specific topic
       return this.searchMCPServers(limit)
     }
     
     async searchByLanguage(language: string, limit: number) {
       // Custom implementation with language filter
       return this.searchMCPServers(limit)
     }
   }
   
   // Use custom source
   const customGithub = new CustomGitHubSource()
   const pythonMCP = await customGithub.searchByLanguage('python', 10)
  `)

  console.log('\n✅ Custom search queries example complete!')
}

main().catch(console.error)
