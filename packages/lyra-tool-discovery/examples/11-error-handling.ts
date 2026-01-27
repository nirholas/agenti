/**
 * Error Handling Example
 * 
 * This example demonstrates robust error handling for:
 * - API rate limits
 * - Invalid repositories
 * - Network errors
 * - Retry logic with exponential backoff
 * 
 * Run with: npx tsx examples/11-error-handling.ts
 * 
 * Prerequisites:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable
 */

import { ToolDiscovery } from '../src/index.js'
import type { DiscoveryResult, DiscoveredTool } from '../src/types.js'

// Custom error types
class RateLimitError extends Error {
  retryAfter: number
  constructor(message: string, retryAfter = 60) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

class InvalidRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRepositoryError'
  }
}

// Retry configuration
interface RetryConfig {
  maxRetries: number
  baseDelay: number      // Initial delay in ms
  maxDelay: number       // Maximum delay in ms
  backoffFactor: number  // Multiplier for exponential backoff
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt)
  return Math.min(delay, config.maxDelay)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      const isRetryable = isRetryableError(error)
      
      if (!isRetryable) {
        console.error(`❌ Non-retryable error in ${operationName}:`, lastError.message)
        throw lastError
      }

      if (attempt < config.maxRetries) {
        const delay = calculateDelay(attempt, config)
        console.warn(`⚠️  ${operationName} failed (attempt ${attempt + 1}/${config.maxRetries + 1})`)
        console.warn(`   Error: ${lastError.message}`)
        console.warn(`   Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true
  if (error instanceof NetworkError) return true
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Rate limit errors
    if (message.includes('rate limit')) return true
    if (message.includes('too many requests')) return true
    if (message.includes('429')) return true
    
    // Network errors
    if (message.includes('network')) return true
    if (message.includes('timeout')) return true
    if (message.includes('econnreset')) return true
    if (message.includes('econnrefused')) return true
    if (message.includes('etimedout')) return true
    
    // Temporary server errors
    if (message.includes('500')) return true
    if (message.includes('502')) return true
    if (message.includes('503')) return true
    if (message.includes('504')) return true
  }
  
  return false
}

/**
 * Validate repository format
 */
function validateRepoFormat(owner: string, repo: string): void {
  if (!owner || typeof owner !== 'string') {
    throw new InvalidRepositoryError('Owner must be a non-empty string')
  }
  
  if (!repo || typeof repo !== 'string') {
    throw new InvalidRepositoryError('Repo must be a non-empty string')
  }
  
  // Check for valid GitHub username/org pattern
  const validNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/
  
  if (!validNamePattern.test(owner)) {
    throw new InvalidRepositoryError(`Invalid owner format: ${owner}`)
  }
  
  if (!validNamePattern.test(repo)) {
    throw new InvalidRepositoryError(`Invalid repo format: ${repo}`)
  }
}

/**
 * Safe repository analysis with full error handling
 */
async function safeAnalyzeRepo(
  discovery: ToolDiscovery,
  owner: string,
  repo: string
): Promise<DiscoveryResult | null> {
  const repoName = `${owner}/${repo}`
  
  try {
    // Validate input
    validateRepoFormat(owner, repo)
    
    // Attempt analysis with retry
    const result = await withRetry(
      () => discovery.analyzeGitHubRepo(owner, repo),
      `Analyze ${repoName}`
    )
    
    console.log(`✅ Successfully analyzed ${repoName}`)
    return result
    
  } catch (error) {
    if (error instanceof InvalidRepositoryError) {
      console.error(`❌ Invalid repository: ${error.message}`)
    } else if (error instanceof RateLimitError) {
      console.error(`❌ Rate limited. Try again in ${error.retryAfter}s`)
    } else if (error instanceof NetworkError) {
      console.error(`❌ Network error: ${error.message}`)
    } else {
      console.error(`❌ Failed to analyze ${repoName}:`, (error as Error).message)
    }
    
    return null
  }
}

/**
 * Process multiple repositories with error isolation
 */
async function processRepositoriesWithErrorIsolation(
  repos: Array<{ owner: string; repo: string }>
): Promise<{
  successful: DiscoveryResult[]
  failed: Array<{ repo: string; error: string }>
}> {
  const discovery = new ToolDiscovery()
  
  const successful: DiscoveryResult[] = []
  const failed: Array<{ repo: string; error: string }> = []
  
  console.log(`\n📦 Processing ${repos.length} repositories...\n`)
  
  for (let i = 0; i < repos.length; i++) {
    const { owner, repo } = repos[i]
    const repoName = `${owner}/${repo}`
    
    console.log(`[${i + 1}/${repos.length}] Analyzing ${repoName}...`)
    
    const result = await safeAnalyzeRepo(discovery, owner, repo)
    
    if (result) {
      successful.push(result)
    } else {
      failed.push({ repo: repoName, error: 'Analysis failed' })
    }
    
    // Rate limiting between requests
    if (i < repos.length - 1) {
      await sleep(1000)
    }
  }
  
  return { successful, failed }
}

/**
 * Example: Handle API key errors
 */
function checkApiKeyConfiguration(): void {
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
  
  if (!hasOpenAI && !hasAnthropic) {
    console.error('❌ No API key configured!')
    console.error('')
    console.error('Set one of these environment variables:')
    console.error('  export OPENAI_API_KEY="sk-..."')
    console.error('  export ANTHROPIC_API_KEY="sk-ant-..."')
    console.error('')
    process.exit(1)
  }
  
  console.log('✅ API key configured:')
  if (hasOpenAI) console.log('   - OpenAI')
  if (hasAnthropic) console.log('   - Anthropic')
  console.log('')
}

/**
 * Main example
 */
async function main() {
  console.log('🛡️  Error Handling Example\n')
  console.log('=' .repeat(50))
  
  // Check API configuration first
  checkApiKeyConfiguration()
  
  // Example 1: Single repo with error handling
  console.log('\n📌 Example 1: Safe Single Repo Analysis')
  console.log('-'.repeat(40))
  
  const discovery = new ToolDiscovery()
  
  // Valid repo
  await safeAnalyzeRepo(discovery, 'modelcontextprotocol', 'servers')
  
  // Invalid repo format
  await safeAnalyzeRepo(discovery, '', 'invalid')
  
  // Non-existent repo (will fail gracefully)
  await safeAnalyzeRepo(discovery, 'nonexistent-user-xyz', 'nonexistent-repo-abc')
  
  // Example 2: Batch processing with error isolation
  console.log('\n📌 Example 2: Batch Processing with Error Isolation')
  console.log('-'.repeat(40))
  
  const repos = [
    { owner: 'modelcontextprotocol', repo: 'servers' },
    { owner: 'invalid', repo: '' },  // Will fail validation
    { owner: 'anthropics', repo: 'anthropic-sdk-python' },
  ]
  
  const { successful, failed } = await processRepositoriesWithErrorIsolation(repos)
  
  // Summary
  console.log('\n📊 Results Summary')
  console.log('-'.repeat(40))
  console.log(`✅ Successful: ${successful.length}`)
  console.log(`❌ Failed: ${failed.length}`)
  
  if (failed.length > 0) {
    console.log('\nFailed repositories:')
    for (const f of failed) {
      console.log(`   - ${f.repo}: ${f.error}`)
    }
  }
  
  // Example 3: Discovery with built-in error handling
  console.log('\n📌 Example 3: Discovery with Error Recovery')
  console.log('-'.repeat(40))
  
  try {
    const results = await discovery.discover({
      sources: ['github'],
      limit: 3,
      dryRun: true  // Dry run to avoid AI costs
    })
    
    console.log(`\nDiscovered ${results.length} tools (dry run)`)
  } catch (error) {
    console.error('Discovery failed:', (error as Error).message)
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('✅ Error handling examples complete!')
}

main().catch(error => {
  console.error('\n💥 Unhandled error:', error)
  process.exit(1)
})
