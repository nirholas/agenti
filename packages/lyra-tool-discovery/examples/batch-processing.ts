/**
 * Batch Processing Example
 *
 * This example shows how to process multiple repositories
 * with rate limiting, progress tracking, and error handling.
 *
 * Run with: npx tsx examples/05-batch-processing.ts
 */

import { ToolDiscovery, type DiscoveryResult } from '../src/index.js'

// Helper to add delay between API calls
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Repositories to analyze
const REPOS_TO_ANALYZE = [
  'modelcontextprotocol/servers',
  'anthropics/anthropic-cookbook',
  'openai/openai-node',
  'langchain-ai/langchain',
  'microsoft/autogen',
]

interface BatchResult {
  success: DiscoveryResult[]
  failed: Array<{ repo: string; error: string }>
  stats: {
    total: number
    succeeded: number
    failed: number
    duration: number
  }
}

async function processBatch(
  repos: string[],
  delayMs: number = 1000
): Promise<BatchResult> {
  const discovery = new ToolDiscovery()
  const startTime = Date.now()

  const success: DiscoveryResult[] = []
  const failed: Array<{ repo: string; error: string }> = []

  console.log(`📋 Processing ${repos.length} repositories...\n`)

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i]
    const [owner, name] = repo.split('/')
    
    // Progress tracking
    const progress = `[${i + 1}/${repos.length}]`
    console.log(`${progress} 🔍 Analyzing ${repo}...`)

    try {
      const result = await discovery.analyzeGitHubRepo(owner, name)
      
      if (result) {
        success.push(result)
        console.log(`${progress} ✅ Success: ${result.decision.template}`)
      } else {
        failed.push({ repo, error: 'Repository not analyzable' })
        console.log(`${progress} ⚠️  Skipped: Not analyzable`)
      }
    } catch (error) {
      // Handle partial failures gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      failed.push({ repo, error: errorMessage })
      console.log(`${progress} ❌ Failed: ${errorMessage.substring(0, 50)}...`)
    }

    // Rate limiting - wait between requests
    if (i < repos.length - 1) {
      console.log(`${progress} ⏳ Waiting ${delayMs}ms...`)
      await delay(delayMs)
    }
  }

  const duration = Date.now() - startTime

  return {
    success,
    failed,
    stats: {
      total: repos.length,
      succeeded: success.length,
      failed: failed.length,
      duration,
    },
  }
}

// Aggregate results by template type
function aggregateByTemplate(results: DiscoveryResult[]): Record<string, number> {
  const counts: Record<string, number> = {}
  
  for (const result of results) {
    const template = result.decision.template
    counts[template] = (counts[template] || 0) + 1
  }
  
  return counts
}

async function main() {
  console.log('🔮 Lyra Tool Discovery - Batch Processing\n')
  console.log('═'.repeat(60))
  
  // Process the batch with 1.5 second delay between calls
  const batchResult = await processBatch(REPOS_TO_ANALYZE, 1500)

  console.log('\n' + '═'.repeat(60))
  console.log('📊 BATCH PROCESSING RESULTS')
  console.log('═'.repeat(60))

  // Display statistics
  console.log('\n📈 Statistics:')
  console.log(`   Total processed: ${batchResult.stats.total}`)
  console.log(`   Succeeded: ${batchResult.stats.succeeded}`)
  console.log(`   Failed: ${batchResult.stats.failed}`)
  console.log(`   Duration: ${(batchResult.stats.duration / 1000).toFixed(2)}s`)
  console.log(`   Avg time/repo: ${(batchResult.stats.duration / batchResult.stats.total / 1000).toFixed(2)}s`)

  // Aggregate results by template
  if (batchResult.success.length > 0) {
    console.log('\n📦 Results by Template:')
    const templateCounts = aggregateByTemplate(batchResult.success)
    for (const [template, count] of Object.entries(templateCounts)) {
      console.log(`   ${template}: ${count}`)
    }

    console.log('\n✅ Successfully Analyzed:')
    for (const result of batchResult.success) {
      console.log(`   - ${result.tool.name} → ${result.decision.template}`)
    }
  }

  // Show failures
  if (batchResult.failed.length > 0) {
    console.log('\n❌ Failed:')
    for (const failure of batchResult.failed) {
      console.log(`   - ${failure.repo}: ${failure.error.substring(0, 60)}`)
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('✅ Batch processing complete!')

  // Exit with error code if any failures
  if (batchResult.failed.length > 0) {
    process.exit(1)
  }
}

main().catch(console.error)
