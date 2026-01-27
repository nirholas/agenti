/**
 * Pipeline Integration Example
 * 
 * This example demonstrates a full discovery pipeline:
 * - Discovery → Transform → Validate → Output
 * - Ready for github-to-mcp and plugin.delivery integration
 * - Generates multiple output formats
 * 
 * Run with: npx tsx examples/10-pipeline-integration.ts
 * 
 * Prerequisites:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable
 */

import { ToolDiscovery } from '../src/index.js'
import type { 
  DiscoveryResult, 
  PluginTemplate, 
  CustomPlugin,
  PluginIndexEntry 
} from '../src/types.js'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// Pipeline Configuration
// ============================================

interface PipelineConfig {
  sources: ('github' | 'npm')[]
  limit: number
  outputDir: string
  formats: ('json' | 'mcp-config' | 'plugin-index')[]
  filters: {
    templates?: PluginTemplate[]
    minConfidence?: number
    requireMCP?: boolean
  }
}

const DEFAULT_CONFIG: PipelineConfig = {
  sources: ['github', 'npm'],
  limit: 10,
  outputDir: './pipeline-output',
  formats: ['json', 'mcp-config', 'plugin-index'],
  filters: {
    requireMCP: true
  }
}

// ============================================
// Pipeline Stages
// ============================================

/**
 * Stage 1: Discovery
 * Discover tools from configured sources
 */
async function stageDiscover(
  config: PipelineConfig
): Promise<DiscoveryResult[]> {
  console.log('\n📍 Stage 1: Discovery')
  console.log('-'.repeat(40))
  
  const discovery = new ToolDiscovery()
  
  const results = await discovery.discover({
    sources: config.sources,
    limit: config.limit
  })
  
  console.log(`   Discovered: ${results.length} tools`)
  
  return results
}

/**
 * Stage 2: Transform
 * Transform results into normalized format
 */
interface TransformedTool {
  id: string
  name: string
  template: PluginTemplate
  source: 'github' | 'npm'
  url: string
  description: string
  config: CustomPlugin | PluginIndexEntry
  reasoning: string
  metadata: {
    author?: string
    license?: string
    homepage?: string
    hasMCP: boolean
    hasOpenAPI: boolean
  }
}

function stageTransform(results: DiscoveryResult[]): TransformedTool[] {
  console.log('\n📍 Stage 2: Transform')
  console.log('-'.repeat(40))
  
  const transformed = results.map(r => ({
    id: r.tool.id,
    name: r.tool.name,
    template: r.decision.template,
    source: r.tool.source as 'github' | 'npm',
    url: r.tool.sourceUrl,
    description: r.tool.description,
    config: r.decision.config,
    reasoning: r.decision.reasoning,
    metadata: {
      author: r.tool.author,
      license: r.tool.license,
      homepage: r.tool.homepage,
      hasMCP: r.tool.hasMCPSupport || false,
      hasOpenAPI: r.tool.hasOpenAPI || false
    }
  }))
  
  console.log(`   Transformed: ${transformed.length} tools`)
  
  return transformed
}

/**
 * Stage 3: Filter
 * Apply filters to results
 */
function stageFilter(
  tools: TransformedTool[],
  filters: PipelineConfig['filters']
): TransformedTool[] {
  console.log('\n📍 Stage 3: Filter')
  console.log('-'.repeat(40))
  
  let filtered = tools
  
  // Filter by template
  if (filters.templates && filters.templates.length > 0) {
    filtered = filtered.filter(t => filters.templates!.includes(t.template))
    console.log(`   After template filter: ${filtered.length}`)
  }
  
  // Filter by MCP requirement
  if (filters.requireMCP) {
    filtered = filtered.filter(t => t.metadata.hasMCP)
    console.log(`   After MCP filter: ${filtered.length}`)
  }
  
  console.log(`   Final count: ${filtered.length}`)
  
  return filtered
}

/**
 * Stage 4: Validate
 * Validate configurations
 */
interface ValidationResult {
  tool: TransformedTool
  valid: boolean
  errors: string[]
  warnings: string[]
}

function stageValidate(tools: TransformedTool[]): ValidationResult[] {
  console.log('\n📍 Stage 4: Validate')
  console.log('-'.repeat(40))
  
  const results: ValidationResult[] = []
  
  for (const tool of tools) {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Validate required fields
    if (!tool.name) errors.push('Missing name')
    if (!tool.template) errors.push('Missing template')
    if (!tool.url) errors.push('Missing URL')
    
    // Validate MCP config
    if (tool.template === 'mcp-http' || tool.template === 'mcp-stdio') {
      const config = tool.config as CustomPlugin
      if (!config.customParams?.mcp) {
        errors.push('MCP template missing mcp config')
      }
    }
    
    // Warnings
    if (!tool.description) warnings.push('Missing description')
    if (!tool.metadata.author) warnings.push('Missing author')
    
    results.push({
      tool,
      valid: errors.length === 0,
      errors,
      warnings
    })
  }
  
  const validCount = results.filter(r => r.valid).length
  console.log(`   Valid: ${validCount}/${results.length}`)
  
  return results
}

/**
 * Stage 5: Output
 * Generate output files in multiple formats
 */
function stageOutput(
  validatedTools: ValidationResult[],
  config: PipelineConfig
): void {
  console.log('\n📍 Stage 5: Output')
  console.log('-'.repeat(40))
  
  // Create output directory
  fs.mkdirSync(config.outputDir, { recursive: true })
  
  // Only use valid tools
  const validTools = validatedTools
    .filter(v => v.valid)
    .map(v => v.tool)
  
  for (const format of config.formats) {
    switch (format) {
      case 'json':
        outputJSON(validTools, config.outputDir)
        break
      case 'mcp-config':
        outputMCPConfig(validTools, config.outputDir)
        break
      case 'plugin-index':
        outputPluginIndex(validTools, config.outputDir)
        break
    }
  }
}

/**
 * Output: Full JSON
 */
function outputJSON(tools: TransformedTool[], outputDir: string): void {
  const filepath = path.join(outputDir, 'discovered-tools.json')
  
  const output = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    count: tools.length,
    tools
  }
  
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2))
  console.log(`   ✅ JSON: ${filepath}`)
}

/**
 * Output: MCP Config (for quick import)
 */
function outputMCPConfig(tools: TransformedTool[], outputDir: string): void {
  const filepath = path.join(outputDir, 'mcp-servers.json')
  
  const mcpTools = tools.filter(
    t => t.template === 'mcp-http' || t.template === 'mcp-stdio'
  )
  
  const mcpServers: Record<string, unknown> = {}
  
  for (const tool of mcpTools) {
    const config = tool.config as CustomPlugin
    const mcp = config.customParams?.mcp
    
    if (mcp) {
      if (mcp.type === 'http') {
        mcpServers[tool.name] = {
          url: mcp.url,
          ...(mcp.headers && { headers: mcp.headers })
        }
      } else if (mcp.type === 'stdio') {
        mcpServers[tool.name] = {
          command: mcp.command,
          args: mcp.args || [],
          ...(mcp.env && { env: mcp.env })
        }
      }
    }
  }
  
  const output = { mcpServers }
  
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2))
  console.log(`   ✅ MCP Config: ${filepath} (${mcpTools.length} servers)`)
}

/**
 * Output: Plugin Index (for plugin.delivery)
 */
function outputPluginIndex(tools: TransformedTool[], outputDir: string): void {
  const filepath = path.join(outputDir, 'plugin-index.json')
  
  const nonMcpTools = tools.filter(
    t => t.template !== 'mcp-http' && t.template !== 'mcp-stdio'
  )
  
  const plugins = nonMcpTools.map(tool => {
    const config = tool.config as PluginIndexEntry
    return {
      identifier: tool.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      manifest: config.manifest || `https://plugin.delivery/plugins/${tool.name}/manifest.json`,
      author: tool.metadata.author || 'unknown',
      createdAt: new Date().toISOString(),
      meta: {
        title: tool.name,
        description: tool.description,
        tags: [tool.template, tool.source]
      }
    }
  })
  
  const output = {
    schemaVersion: 1,
    plugins
  }
  
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2))
  console.log(`   ✅ Plugin Index: ${filepath} (${plugins.length} plugins)`)
}

// ============================================
// Pipeline Summary
// ============================================

interface PipelineSummary {
  startTime: Date
  endTime: Date
  duration: number
  stages: {
    discovered: number
    transformed: number
    filtered: number
    valid: number
    invalid: number
  }
  templates: Record<string, number>
  sources: Record<string, number>
}

function generateSummary(
  discovered: DiscoveryResult[],
  transformed: TransformedTool[],
  filtered: TransformedTool[],
  validated: ValidationResult[],
  startTime: Date
): PipelineSummary {
  const endTime = new Date()
  
  const templates: Record<string, number> = {}
  const sources: Record<string, number> = {}
  
  for (const tool of filtered) {
    templates[tool.template] = (templates[tool.template] || 0) + 1
    sources[tool.source] = (sources[tool.source] || 0) + 1
  }
  
  return {
    startTime,
    endTime,
    duration: endTime.getTime() - startTime.getTime(),
    stages: {
      discovered: discovered.length,
      transformed: transformed.length,
      filtered: filtered.length,
      valid: validated.filter(v => v.valid).length,
      invalid: validated.filter(v => !v.valid).length
    },
    templates,
    sources
  }
}

function printSummary(summary: PipelineSummary): void {
  console.log('\n' + '='.repeat(50))
  console.log('📊 Pipeline Summary')
  console.log('='.repeat(50))
  
  console.log(`\n⏱️  Duration: ${(summary.duration / 1000).toFixed(1)}s`)
  
  console.log('\n📈 Stage Counts:')
  console.log(`   Discovered: ${summary.stages.discovered}`)
  console.log(`   Transformed: ${summary.stages.transformed}`)
  console.log(`   Filtered: ${summary.stages.filtered}`)
  console.log(`   Valid: ${summary.stages.valid}`)
  console.log(`   Invalid: ${summary.stages.invalid}`)
  
  console.log('\n🏷️  By Template:')
  for (const [template, count] of Object.entries(summary.templates)) {
    console.log(`   ${template}: ${count}`)
  }
  
  console.log('\n📦 By Source:')
  for (const [source, count] of Object.entries(summary.sources)) {
    console.log(`   ${source}: ${count}`)
  }
}

// ============================================
// Main Pipeline
// ============================================

async function runPipeline(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('🔮 Lyra Tool Discovery - Pipeline Integration')
  console.log('='.repeat(50))
  
  const startTime = new Date()
  
  console.log('\n📋 Configuration:')
  console.log(`   Sources: ${config.sources.join(', ')}`)
  console.log(`   Limit: ${config.limit}`)
  console.log(`   Output: ${config.outputDir}`)
  console.log(`   Formats: ${config.formats.join(', ')}`)
  
  // Run pipeline stages
  const discovered = await stageDiscover(config)
  const transformed = stageTransform(discovered)
  const filtered = stageFilter(transformed, config.filters)
  const validated = stageValidate(filtered)
  
  stageOutput(validated, config)
  
  // Generate and print summary
  const summary = generateSummary(
    discovered,
    transformed,
    filtered,
    validated,
    startTime
  )
  
  printSummary(summary)
  
  // Save summary
  const summaryPath = path.join(config.outputDir, 'pipeline-summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  console.log(`\n📄 Summary saved to: ${summaryPath}`)
  
  console.log('\n✅ Pipeline complete!')
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2)
  
  const config: PipelineConfig = { ...DEFAULT_CONFIG }
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sources':
        config.sources = args[++i].split(',') as ('github' | 'npm')[]
        break
      case '--limit':
        config.limit = parseInt(args[++i], 10)
        break
      case '--output':
        config.outputDir = args[++i]
        break
      case '--mcp-only':
        config.filters.requireMCP = true
        config.filters.templates = ['mcp-http', 'mcp-stdio']
        break
    }
  }
  
  await runPipeline(config)
}

main().catch(error => {
  console.error('\n❌ Pipeline failed:', error)
  process.exit(1)
})
