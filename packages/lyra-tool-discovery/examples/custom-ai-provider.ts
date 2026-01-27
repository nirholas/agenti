/**
 * Custom AI Provider Example
 *
 * This example shows how to explicitly configure AI providers
 * including OpenAI and Anthropic with specific models.
 *
 * Run with: npx tsx examples/04-custom-ai-provider.ts
 *
 * Prerequisites:
 * - For OpenAI: OPENAI_API_KEY environment variable
 * - For Anthropic: ANTHROPIC_API_KEY environment variable
 */

import { ToolDiscovery, AIAnalyzer } from '../src/index.js'
import { getAvailableProviders } from '../src/ai.js'

async function main() {
  console.log('🔮 Lyra Tool Discovery - Custom AI Provider\n')

  // Check available providers
  const available = getAvailableProviders()
  console.log('Available providers:', available.length > 0 ? available.join(', ') : 'None')
  console.log()

  if (available.length === 0) {
    console.error('❌ No AI providers available!')
    console.error('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY')
    process.exit(1)
  }

  // ===========================================
  // Example 1: Explicitly configure OpenAI
  // ===========================================
  if (available.includes('openai')) {
    console.log('━'.repeat(50))
    console.log('📌 Example 1: Using OpenAI with GPT-4o')
    console.log('━'.repeat(50))

    const openaiDiscovery = new ToolDiscovery({
      provider: 'openai',
      model: 'gpt-4o',
      // apiKey is optional if OPENAI_API_KEY is set
    })

    // Get provider info
    const aiAnalyzer = new AIAnalyzer({
      provider: 'openai',
      model: 'gpt-4o'
    })
    const info = aiAnalyzer.getProviderInfo()
    console.log(`   Provider: ${info.provider}`)
    console.log(`   Model: ${info.model}\n`)

    // Run a quick discovery
    const results = await openaiDiscovery.discover({
      sources: ['github'],
      limit: 1,
    })

    if (results.length > 0) {
      console.log(`   ✅ Analyzed: ${results[0].tool.name}`)
      console.log(`   Template: ${results[0].decision.template}`)
    }
    console.log()
  }

  // ===========================================
  // Example 2: Explicitly configure Anthropic
  // ===========================================
  if (available.includes('anthropic')) {
    console.log('━'.repeat(50))
    console.log('📌 Example 2: Using Anthropic with Claude Sonnet')
    console.log('━'.repeat(50))

    const anthropicDiscovery = new ToolDiscovery({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      // apiKey is optional if ANTHROPIC_API_KEY is set
    })

    const aiAnalyzer = new AIAnalyzer({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514'
    })
    const info = aiAnalyzer.getProviderInfo()
    console.log(`   Provider: ${info.provider}`)
    console.log(`   Model: ${info.model}\n`)

    // Run a quick discovery
    const results = await anthropicDiscovery.discover({
      sources: ['github'],
      limit: 1,
    })

    if (results.length > 0) {
      console.log(`   ✅ Analyzed: ${results[0].tool.name}`)
      console.log(`   Template: ${results[0].decision.template}`)
    }
    console.log()
  }

  // ===========================================
  // Example 3: Using different OpenAI models
  // ===========================================
  if (available.includes('openai')) {
    console.log('━'.repeat(50))
    console.log('📌 Example 3: Different OpenAI Models')
    console.log('━'.repeat(50))

    const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
    console.log('   Available OpenAI models for this use case:')
    for (const model of models) {
      console.log(`   - ${model}`)
    }
    console.log()

    // Example with gpt-4o-mini (cheaper, faster)
    const cheapDiscovery = new ToolDiscovery({
      provider: 'openai',
      model: 'gpt-4o-mini',
    })
    console.log('   Using gpt-4o-mini for cost-effective analysis...')
    
    const results = await cheapDiscovery.discover({
      sources: ['github'],
      limit: 1,
    })

    if (results.length > 0) {
      console.log(`   ✅ Result: ${results[0].decision.template}`)
    }
    console.log()
  }

  // ===========================================
  // Example 4: Environment variable override
  // ===========================================
  console.log('━'.repeat(50))
  console.log('📌 Example 4: Environment Variable Configuration')
  console.log('━'.repeat(50))
  console.log(`
   You can also configure via environment variables:
   
   # Provider selection
   export AI_PROVIDER=openai    # or 'anthropic'
   
   # Model selection
   export AI_MODEL=gpt-4o       # or 'claude-sonnet-4-20250514'
   
   # API keys
   export OPENAI_API_KEY=sk-...
   export ANTHROPIC_API_KEY=sk-ant-...
   
   Priority: Constructor args > Environment vars > Auto-detect
  `)

  // ===========================================
  // Token Usage Notes
  // ===========================================
  console.log('━'.repeat(50))
  console.log('📌 Token Usage & Cost Optimization')
  console.log('━'.repeat(50))
  console.log(`
   Tips for managing AI costs:
   
   1. Use gpt-4o-mini or claude-3-haiku for bulk analysis
   2. Use gpt-4o or claude-sonnet-4-20250514 for complex decisions
   3. Enable dry-run mode to preview without AI calls
   4. Limit discovery results to reduce API calls
   5. Cache results to avoid re-analyzing
   
   Approximate costs per analysis:
   - gpt-4o-mini: ~$0.001-0.002 per tool
   - gpt-4o: ~$0.01-0.02 per tool
   - claude-3-haiku: ~$0.001 per tool
   - claude-sonnet-4-20250514: ~$0.01 per tool
  `)

  console.log('\n✅ Custom AI provider examples complete!')
}

main().catch(console.error)
