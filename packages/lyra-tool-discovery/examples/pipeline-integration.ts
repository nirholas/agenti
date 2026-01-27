/**
 * Pipeline Integration Example
 *
 * This example shows a complete discovery pipeline
 * ready for integration with github-to-mcp or similar tools.
 *
 * Pipeline: Discovery → Transform → Output
 *
 * Run with: npx tsx examples/10-pipeline-integration.ts
 */

import { ToolDiscovery, type DiscoveryResult, type CustomPlugin, type PluginIndexEntry } from '../src/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ===========================================
// Pipeline Configuration
// ===========================================

interface PipelineConfig {
  sources: ('github' | 'npm')[]
  limit: number
  outputDir: string
  formats: ('json' | 'mcp-config' | 'plugin-index')[]
}

const DEFAULT_CONFIG: PipelineConfig = {
  sources: ['github', 'npm'],
  limit: 10,
  outputDir: './data/pipeline-output',
  formats: ['json', 'mcp-config', 'plugin-index'],
}

// ===========================================
// Transform Functions
// ===========================================

/**
 * Transform results to MCP Quick Import format
 */
function toMCPConfig(results: DiscoveryResult[]): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {}

  for (const result of results) {
    const config = result.generated.pluginConfig as CustomPlugin
    
    if (config.customParams?.mcp) {
      const mcp = config.customParams.mcp
      
      if (mcp.type === 'http') {
        mcpServers[config.identifier] = {
          url: mcp.url,
          ...(mcp.auth && mcp.auth.type !== 'none' ? { auth: mcp.auth } : {}),
        }
      } else if (mcp.type === 'stdio') {
        mcpServers[config.identifier] = {
          command: mcp.command,
          args: mcp.args || [],
          ...(mcp.env ? { env: mcp.env } : {}),
        }
      }
    }
  }

  return { mcpServers }
}

/**
 * Transform results to plugin.delivery index format
 */
function toPluginIndex(results: DiscoveryResult[]): PluginIndexEntry[] {
  return results.map(result => {
    const config = result.generated.pluginConfig
    
    // Check if it's already a PluginIndexEntry
    if ('manifest' in config && 'meta' in config) {
      return config as PluginIndexEntry
    }
    
    // Convert CustomPlugin to PluginIndexEntry format
    const customPlugin = config as CustomPlugin
    return {
      identifier: customPlugin.identifier,
      manifest: `https://plugin.delivery/plugins/${customPlugin.identifier}/manifest.json`,
      author: result.tool.author || 'unknown',
      homepage: result.tool.homepage,
      createdAt: new Date().toISOString(),
      meta: {
        title: result.tool.name,
        description: result.tool.description,
        avatar: customPlugin.customParams?.avatar || '🔧',
        tags: ['mcp', 'discovered'],
      },
    }
  })
}

/**
 * Transform results to full JSON report
 */
function toFullReport(results: DiscoveryResult[]): object {
  return {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    summary: {
      total: results.length,
      byTemplate: results.reduce((acc, r) => {
        acc[r.decision.template] = (acc[r.decision.template] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      bySource: results.reduce((acc, r) => {
        acc[r.tool.source] = (acc[r.tool.source] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    },
    tools: results.map(r => ({
      name: r.tool.name,
      description: r.tool.description,
      source: r.tool.source,
      url: r.tool.sourceUrl,
      template: r.decision.template,
      reasoning: r.decision.reasoning,
      config: r.generated.pluginConfig,
    })),
  }
}

// ===========================================
// Output Functions
// ===========================================

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

function saveOutput(data: unknown, filePath: string): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`   💾 Saved: ${filePath}`)
}

// ===========================================
// Pipeline Execution
// ===========================================

async function runPipeline(config: PipelineConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('🔮 Lyra Tool Discovery - Pipeline Integration\n')
  console.log('═'.repeat(60))
  console.log('📋 Pipeline Configuration')
  console.log('═'.repeat(60))
  console.log(`   Sources: ${config.sources.join(', ')}`)
  console.log(`   Limit: ${config.limit}`)
  console.log(`   Output: ${config.outputDir}`)
  console.log(`   Formats: ${config.formats.join(', ')}`)

  // ===========================================
  // Step 1: Discovery
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('🔍 Step 1: Discovery')
  console.log('═'.repeat(60))

  const discovery = new ToolDiscovery()
  
  const results = await discovery.discover({
    sources: config.sources,
    limit: config.limit,
  })

  console.log(`\n   ✅ Discovered ${results.length} tools`)

  if (results.length === 0) {
    console.log('   ⚠️  No tools found, pipeline complete')
    return
  }

  // ===========================================
  // Step 2: Transform
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('🔄 Step 2: Transform')
  console.log('═'.repeat(60))

  const transforms: Record<string, unknown> = {}

  if (config.formats.includes('json')) {
    transforms.fullReport = toFullReport(results)
    console.log('   ✅ Generated full JSON report')
  }

  if (config.formats.includes('mcp-config')) {
    transforms.mcpConfig = toMCPConfig(results)
    const serverCount = Object.keys((transforms.mcpConfig as { mcpServers: object }).mcpServers).length
    console.log(`   ✅ Generated MCP config (${serverCount} servers)`)
  }

  if (config.formats.includes('plugin-index')) {
    transforms.pluginIndex = toPluginIndex(results)
    console.log(`   ✅ Generated plugin index (${(transforms.pluginIndex as unknown[]).length} entries)`)
  }

  // ===========================================
  // Step 3: Output
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('💾 Step 3: Output')
  console.log('═'.repeat(60))

  ensureDir(config.outputDir)

  if (transforms.fullReport) {
    saveOutput(transforms.fullReport, join(config.outputDir, 'discovery-report.json'))
  }

  if (transforms.mcpConfig) {
    saveOutput(transforms.mcpConfig, join(config.outputDir, 'mcp-config.json'))
  }

  if (transforms.pluginIndex) {
    saveOutput(transforms.pluginIndex, join(config.outputDir, 'plugin-index.json'))
  }

  // ===========================================
  // Pipeline Summary
  // ===========================================
  console.log('\n' + '═'.repeat(60))
  console.log('📊 Pipeline Summary')
  console.log('═'.repeat(60))
  console.log(`   Tools discovered: ${results.length}`)
  console.log(`   Transforms applied: ${Object.keys(transforms).length}`)
  console.log(`   Files generated: ${config.formats.length}`)
  console.log(`   Output directory: ${config.outputDir}`)

  // Show template breakdown
  console.log('\n   Templates:')
  const templateCounts = results.reduce((acc, r) => {
    acc[r.decision.template] = (acc[r.decision.template] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  for (const [template, count] of Object.entries(templateCounts)) {
    console.log(`     - ${template}: ${count}`)
  }

  console.log('\n✅ Pipeline complete!')
}

// ===========================================
// Main Entry Point
// ===========================================

async function main() {
  // Parse command line for custom config
  const args = process.argv.slice(2)
  
  const config: PipelineConfig = {
    ...DEFAULT_CONFIG,
  }

  // Override from CLI
  const limitArg = args.find(a => a.startsWith('--limit='))
  if (limitArg) {
    config.limit = parseInt(limitArg.split('=')[1], 10)
  }

  const outputArg = args.find(a => a.startsWith('--output='))
  if (outputArg) {
    config.outputDir = outputArg.split('=')[1]
  }

  await runPipeline(config)
}

main().catch(console.error)
