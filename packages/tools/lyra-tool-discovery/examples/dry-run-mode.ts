/**
 * Dry Run Mode Example
 *
 * This example shows how to simulate discovery without
 * making AI calls - useful for testing and previewing.
 *
 * Run with: npx tsx examples/08-dry-run-mode.ts
 */

import { ToolDiscovery } from '../src/index.js'

async function main() {
  console.log('🔮 Lyra Tool Discovery - Dry Run Mode\n')
  console.log('═'.repeat(60))
  console.log('ℹ️  Dry run mode shows what WOULD be analyzed without AI calls')
  console.log('   This is useful for:')
  console.log('   - Testing discovery sources')
  console.log('   - Previewing before spending API credits')
  console.log('   - Debugging search queries')
  console.log('   - CI/CD pipeline validation')
  console.log('═'.repeat(60))

  // Note: In dry run mode, no AI provider is actually needed
  const discovery = new ToolDiscovery()

  // ===========================================
  // Dry Run: GitHub Source
  // ===========================================
  console.log('\n📌 Dry Run: GitHub Source')
  console.log('─'.repeat(40))

  await discovery.discover({
    sources: ['github'],
    limit: 5,
    dryRun: true,  // <-- Key option!
  })

  // Note: dryRun logs to console but returns empty array
  // since no actual analysis is performed

  // ===========================================
  // Dry Run: npm Source
  // ===========================================
  console.log('\n📌 Dry Run: npm Source')
  console.log('─'.repeat(40))

  await discovery.discover({
    sources: ['npm'],
    limit: 5,
    dryRun: true,
  })

  // ===========================================
  // Dry Run: Both Sources
  // ===========================================
  console.log('\n📌 Dry Run: All Sources')
  console.log('─'.repeat(40))

  const results = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 10,
    dryRun: true,
  })

  console.log(`\n📊 Dry Run Summary:`)
  console.log(`   Results returned: ${results.length} (always 0 in dry run)`)
  console.log(`   AI calls made: 0`)
  console.log(`   Cost incurred: $0.00`)

  // ===========================================
  // When to Use Dry Run
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('💡 Use Cases for Dry Run Mode')
  console.log('═'.repeat(60))
  
  console.log(`
   1. Testing Discovery Sources
      Check that GitHub/npm search returns expected results
      
   2. Preview Before Analysis
      See what tools would be analyzed before spending credits
      
   3. CI/CD Validation
      Validate discovery pipeline without API costs
      
   4. Rate Limit Avoidance
      Check source availability without hitting AI limits
      
   5. Debugging
      Isolate issues to source vs AI layer
  `)

  // ===========================================
  // CLI Equivalent
  // ===========================================
  console.log('═'.repeat(60))
  console.log('🖥️  CLI Equivalent')
  console.log('═'.repeat(60))
  console.log(`
   Run from command line:
   
   # Dry run discovery
   pnpm lyra-discover discover --dry-run
   
   # Dry run with specific source
   pnpm lyra-discover discover --sources github --dry-run
   
   # Dry run with higher limit
   pnpm lyra-discover discover --limit 20 --dry-run
  `)

  console.log('✅ Dry run example complete!')
}

main().catch(console.error)
