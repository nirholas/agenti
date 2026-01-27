/**
 * GitHub Action Script
 * 
 * This script is designed to run in GitHub Actions environments.
 * It handles:
 * - Environment variable configuration
 * - Proper exit codes
 * - JSON output for subsequent workflow steps
 * - Summary generation for GitHub Actions
 * 
 * Run with: npx tsx examples/12-github-action-script.ts
 * 
 * Environment Variables:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY (required)
 * - GITHUB_TOKEN (optional, for higher rate limits)
 * - GITHUB_OUTPUT (set by GitHub Actions)
 * - GITHUB_STEP_SUMMARY (set by GitHub Actions)
 * 
 * Arguments:
 * - --sources: Comma-separated sources (default: github,npm)
 * - --limit: Maximum tools to discover (default: 20)
 * - --output: Output file path (default: discovered-tools.json)
 * - --dry-run: Skip AI analysis
 */

import { ToolDiscovery } from '../src/index.js'
import type { DiscoveryResult, PluginTemplate } from '../src/types.js'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// Configuration
// ============================================

interface ActionConfig {
  sources: string[]
  limit: number
  outputFile: string
  dryRun: boolean
}

function parseArgs(): ActionConfig {
  const args = process.argv.slice(2)
  
  const config: ActionConfig = {
    sources: ['github', 'npm'],
    limit: 20,
    outputFile: 'discovered-tools.json',
    dryRun: false
  }
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sources':
        config.sources = args[++i]?.split(',') || config.sources
        break
      case '--limit':
        config.limit = parseInt(args[++i] || '20', 10)
        break
      case '--output':
        config.outputFile = args[++i] || config.outputFile
        break
      case '--dry-run':
        config.dryRun = true
        break
    }
  }
  
  return config
}

// ============================================
// GitHub Actions Helpers
// ============================================

/**
 * Check if running in GitHub Actions
 */
function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true'
}

/**
 * Set output variable for GitHub Actions
 */
function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT
  
  if (outputFile) {
    // Multi-line values need special handling
    if (value.includes('\n')) {
      const delimiter = `EOF_${Date.now()}`
      fs.appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
    } else {
      fs.appendFileSync(outputFile, `${name}=${value}\n`)
    }
  } else {
    // Fallback for local testing
    console.log(`::set-output name=${name}::${value}`)
  }
}

/**
 * Write job summary for GitHub Actions
 */
function writeSummary(markdown: string): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  
  if (summaryFile) {
    fs.appendFileSync(summaryFile, markdown + '\n')
  } else {
    // Print to console for local testing
    console.log('\n--- JOB SUMMARY ---')
    console.log(markdown)
    console.log('--- END SUMMARY ---\n')
  }
}

/**
 * Log error in GitHub Actions format
 */
function logError(message: string, file?: string, line?: number): void {
  if (isGitHubActions()) {
    let annotation = `::error`
    if (file) annotation += ` file=${file}`
    if (line) annotation += `,line=${line}`
    console.log(`${annotation}::${message}`)
  } else {
    console.error(`❌ Error: ${message}`)
  }
}

/**
 * Log warning in GitHub Actions format
 */
function logWarning(message: string): void {
  if (isGitHubActions()) {
    console.log(`::warning::${message}`)
  } else {
    console.warn(`⚠️  Warning: ${message}`)
  }
}

/**
 * Start a log group
 */
function startGroup(name: string): void {
  if (isGitHubActions()) {
    console.log(`::group::${name}`)
  } else {
    console.log(`\n📌 ${name}`)
    console.log('-'.repeat(40))
  }
}

/**
 * End a log group
 */
function endGroup(): void {
  if (isGitHubActions()) {
    console.log('::endgroup::')
  }
}

// ============================================
// Validation
// ============================================

function validateEnvironment(): boolean {
  let valid = true
  
  // Check for AI API key
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    logError('No AI API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY')
    valid = false
  }
  
  // Check for GitHub token (optional but recommended)
  if (!process.env.GITHUB_TOKEN) {
    logWarning('GITHUB_TOKEN not set. API rate limits may apply.')
  }
  
  return valid
}

// ============================================
// Output Generation
// ============================================

interface OutputData {
  timestamp: string
  sources: string[]
  totalDiscovered: number
  tools: Array<{
    name: string
    template: PluginTemplate
    source: string
    url: string
    reasoning: string
  }>
  templateSummary: Record<string, number>
}

function generateOutput(results: DiscoveryResult[], sources: string[]): OutputData {
  const templateSummary: Record<string, number> = {}
  
  const tools = results.map(r => {
    const template = r.decision.template
    templateSummary[template] = (templateSummary[template] || 0) + 1
    
    return {
      name: r.tool.name,
      template: r.decision.template,
      source: r.tool.source,
      url: r.tool.sourceUrl,
      reasoning: r.decision.reasoning
    }
  })
  
  return {
    timestamp: new Date().toISOString(),
    sources,
    totalDiscovered: results.length,
    tools,
    templateSummary
  }
}

function generateSummaryMarkdown(output: OutputData): string {
  let md = '# 🔮 Tool Discovery Results\n\n'
  
  md += `**Timestamp:** ${output.timestamp}\n`
  md += `**Sources:** ${output.sources.join(', ')}\n`
  md += `**Total Discovered:** ${output.totalDiscovered}\n\n`
  
  // Template summary table
  md += '## Template Distribution\n\n'
  md += '| Template | Count |\n'
  md += '|----------|-------|\n'
  
  for (const [template, count] of Object.entries(output.templateSummary)) {
    md += `| \`${template}\` | ${count} |\n`
  }
  
  // Tools table
  md += '\n## Discovered Tools\n\n'
  md += '| Name | Template | Source |\n'
  md += '|------|----------|--------|\n'
  
  for (const tool of output.tools.slice(0, 20)) {  // Limit to 20 for summary
    md += `| [${tool.name}](${tool.url}) | \`${tool.template}\` | ${tool.source} |\n`
  }
  
  if (output.tools.length > 20) {
    md += `\n*...and ${output.tools.length - 20} more tools*\n`
  }
  
  return md
}

// ============================================
// Main Script
// ============================================

async function main(): Promise<void> {
  const startTime = Date.now()
  const config = parseArgs()
  
  console.log('🔮 Lyra Tool Discovery - GitHub Action Script')
  console.log('='.repeat(50))
  
  // Log configuration
  startGroup('Configuration')
  console.log(`Sources: ${config.sources.join(', ')}`)
  console.log(`Limit: ${config.limit}`)
  console.log(`Output: ${config.outputFile}`)
  console.log(`Dry Run: ${config.dryRun}`)
  console.log(`GitHub Actions: ${isGitHubActions()}`)
  endGroup()
  
  // Validate environment
  startGroup('Environment Validation')
  if (!validateEnvironment()) {
    process.exit(1)
  }
  console.log('✅ Environment validated')
  endGroup()
  
  // Run discovery
  startGroup('Discovery')
  const discovery = new ToolDiscovery()
  
  let results: DiscoveryResult[] = []
  
  try {
    results = await discovery.discover({
      sources: config.sources as any[],
      limit: config.limit,
      dryRun: config.dryRun
    })
    
    console.log(`✅ Discovered ${results.length} tools`)
  } catch (error) {
    logError(`Discovery failed: ${(error as Error).message}`)
    process.exit(1)
  }
  endGroup()
  
  // Generate output
  startGroup('Output Generation')
  const output = generateOutput(results, config.sources)
  
  // Ensure output directory exists
  const outputDir = path.dirname(config.outputFile)
  if (outputDir && outputDir !== '.') {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Write JSON output
  fs.writeFileSync(
    config.outputFile,
    JSON.stringify(output, null, 2)
  )
  console.log(`✅ Wrote output to ${config.outputFile}`)
  
  // Write summary
  const summaryMd = generateSummaryMarkdown(output)
  writeSummary(summaryMd)
  
  endGroup()
  
  // Set outputs for subsequent steps
  startGroup('Set Outputs')
  setOutput('total_tools', String(output.totalDiscovered))
  setOutput('output_file', config.outputFile)
  setOutput('has_results', output.totalDiscovered > 0 ? 'true' : 'false')
  
  // Template counts as outputs
  for (const [template, count] of Object.entries(output.templateSummary)) {
    setOutput(`count_${template.replace('-', '_')}`, String(count))
  }
  
  console.log('✅ Outputs set')
  endGroup()
  
  // Final summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(50))
  console.log(`✅ Discovery complete in ${duration}s`)
  console.log(`   Total tools: ${output.totalDiscovered}`)
  console.log(`   Output file: ${config.outputFile}`)
  
  // Exit with appropriate code
  if (output.totalDiscovered === 0 && !config.dryRun) {
    logWarning('No tools discovered')
    process.exit(0)  // Not an error, just no results
  }
  
  process.exit(0)
}

// Run with proper error handling
main().catch(error => {
  logError(`Unhandled error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
