/**
 * Analyze npm Package Example
 *
 * This example shows how to analyze an npm package
 * and extract information for plugin generation.
 *
 * Run with: npx tsx examples/03-analyze-npm-package.ts
 *
 * You can also pass a package name:
 * npx tsx examples/03-analyze-npm-package.ts @modelcontextprotocol/server-filesystem
 */

import { ToolDiscovery } from '../src/index.js'

async function main() {
  console.log('🔮 Lyra Tool Discovery - Analyze npm Package\n')

  // Get package from command line or use default
  const packageName = process.argv[2] || '@modelcontextprotocol/server-filesystem'

  console.log(`📦 Package: ${packageName}\n`)

  // Create discovery instance
  const discovery = new ToolDiscovery()

  try {
    // Analyze the npm package
    const result = await discovery.analyzeNpmPackage(packageName)

    if (!result) {
      console.log('❌ Package not found or not analyzable')
      process.exit(1)
    }

    // Display analysis
    console.log('\n' + '═'.repeat(60))
    console.log('📊 PACKAGE ANALYSIS RESULTS')
    console.log('═'.repeat(60))

    console.log('\n📦 Package Information:')
    console.log(`   Name: ${result.tool.name}`)
    console.log(`   Description: ${result.tool.description}`)
    console.log(`   Author: ${result.tool.author || 'Unknown'}`)
    console.log(`   License: ${result.tool.license || 'Unknown'}`)
    console.log(`   Homepage: ${result.tool.homepage || 'N/A'}`)
    console.log(`   Repository: ${result.tool.repository || 'N/A'}`)

    // Extract package.json info if available
    if (result.tool.packageJson) {
      const pkg = result.tool.packageJson
      console.log('\n📋 package.json Highlights:')
      
      if (pkg.version) {
        console.log(`   Version: ${pkg.version}`)
      }
      if (pkg.keywords && Array.isArray(pkg.keywords)) {
        console.log(`   Keywords: ${(pkg.keywords as string[]).join(', ')}`)
      }
      if (pkg.bin) {
        console.log(`   Binaries: ${JSON.stringify(pkg.bin)}`)
      }
      if (pkg.main) {
        console.log(`   Main: ${pkg.main}`)
      }
      if (pkg.type) {
        console.log(`   Type: ${pkg.type}`)
      }
    }

    // Show template decision
    console.log('\n🎯 Template Decision:')
    console.log(`   Template: ${result.decision.template}`)
    console.log(`   Reasoning: ${result.decision.reasoning}`)

    // Show the generated configuration
    console.log('\n⚙️  Generated Plugin Configuration:')
    console.log(JSON.stringify(result.generated.pluginConfig, null, 2))

    // Detection flags
    console.log('\n🔍 Detection Flags:')
    console.log(`   Has MCP Support: ${result.tool.hasMCPSupport ? '✅ Yes' : '❌ No'}`)
    console.log(`   Has npm Package: ${result.tool.hasNpmPackage ? '✅ Yes' : '❌ No'}`)
    console.log(`   Has OpenAPI: ${result.tool.hasOpenAPI ? '✅ Yes' : '❌ No'}`)

    console.log('\n' + '═'.repeat(60))
    console.log('✅ Analysis complete!')

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.error(`❌ Package "${packageName}" not found on npm.`)
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
