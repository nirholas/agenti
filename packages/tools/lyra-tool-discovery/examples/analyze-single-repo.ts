/**
 * Analyze Single Repository Example
 *
 * This example shows how to analyze a specific GitHub repository
 * to determine the best plugin template.
 *
 * Run with: npx tsx examples/02-analyze-single-repo.ts
 *
 * You can also pass a repo as argument:
 * npx tsx examples/02-analyze-single-repo.ts owner/repo
 */

import { ToolDiscovery } from '../src/index.js'

async function main() {
  console.log('🔮 Lyra Tool Discovery - Analyze Single Repo\n')

  // Get repo from command line or use default
  const repoArg = process.argv[2] || 'modelcontextprotocol/servers'
  const [owner, repo] = repoArg.split('/')

  if (!owner || !repo) {
    console.error('❌ Invalid repository format. Use: owner/repo')
    process.exit(1)
  }

  console.log(`📂 Repository: ${owner}/${repo}\n`)

  // Create discovery instance
  const discovery = new ToolDiscovery()

  try {
    // Analyze the specific repository
    const result = await discovery.analyzeGitHubRepo(owner, repo)

    if (!result) {
      console.log('❌ Repository not found or not analyzable')
      process.exit(1)
    }

    // Display full analysis output
    console.log('\n' + '═'.repeat(60))
    console.log('📊 FULL ANALYSIS RESULTS')
    console.log('═'.repeat(60))

    console.log('\n📦 Tool Information:')
    console.log(`   Name: ${result.tool.name}`)
    console.log(`   Description: ${result.tool.description}`)
    console.log(`   Source: ${result.tool.source}`)
    console.log(`   URL: ${result.tool.sourceUrl}`)
    console.log(`   License: ${result.tool.license || 'Unknown'}`)
    console.log(`   Author: ${result.tool.author || 'Unknown'}`)

    console.log('\n🎯 Template Decision:')
    console.log(`   Template: ${result.decision.template}`)
    console.log(`   Reasoning: ${result.decision.reasoning}`)

    console.log('\n⚙️  Plugin Configuration:')
    console.log(JSON.stringify(result.generated.pluginConfig, null, 2))

    console.log('\n🔍 Detection Flags:')
    console.log(`   Has MCP Support: ${result.tool.hasMCPSupport ? '✅' : '❌'}`)
    console.log(`   Has OpenAPI: ${result.tool.hasOpenAPI ? '✅' : '❌'}`)
    console.log(`   Has NPM Package: ${result.tool.hasNpmPackage ? '✅' : '❌'}`)

    if (result.tool.readme) {
      console.log('\n📖 README Preview (first 300 chars):')
      console.log(`   ${result.tool.readme.substring(0, 300).replace(/\n/g, '\n   ')}...`)
    }

    console.log('\n' + '═'.repeat(60))
    console.log('✅ Analysis complete!')

  } catch (error) {
    // Handle errors gracefully
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        console.error('❌ GitHub API rate limit exceeded. Try again later.')
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.error(`❌ Repository ${owner}/${repo} not found.`)
      } else if (error.message.includes('API key')) {
        console.error('❌ Missing AI provider API key.')
        console.error('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY')
      } else {
        console.error(`❌ Error: ${error.message}`)
      }
    } else {
      console.error('❌ Unknown error:', error)
    }
    process.exit(1)
  }
}

main().catch(console.error)
