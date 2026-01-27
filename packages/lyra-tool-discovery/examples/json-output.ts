/**
 * JSON Output Example
 *
 * This example shows how to output discovery results
 * as JSON, with pretty printing and file saving.
 *
 * Run with: npx tsx examples/07-json-output.ts
 *
 * Options:
 *   --output <file>  Save to file
 *   --compact        Use compact JSON
 *   --stream         Stream output as NDJSON
 */

import { ToolDiscovery, type DiscoveryResult } from '../src/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Parse command line options
const args = process.argv.slice(2)
const outputFile = args.includes('--output') 
  ? args[args.indexOf('--output') + 1] 
  : null
const compact = args.includes('--compact')
const streaming = args.includes('--stream')

interface OutputFormat {
  meta: {
    version: string
    timestamp: string
    sources: string[]
    totalTools: number
  }
  tools: Array<{
    name: string
    description: string
    source: string
    url: string
    template: string
    reasoning: string
    config: unknown
    detectionFlags: {
      hasMCPSupport: boolean
      hasOpenAPI: boolean
      hasNpmPackage: boolean
    }
  }>
}

function formatForOutput(results: DiscoveryResult[]): OutputFormat {
  return {
    meta: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      sources: [...new Set(results.map(r => r.tool.source))],
      totalTools: results.length,
    },
    tools: results.map(r => ({
      name: r.tool.name,
      description: r.tool.description,
      source: r.tool.source,
      url: r.tool.sourceUrl,
      template: r.decision.template,
      reasoning: r.decision.reasoning,
      config: r.generated.pluginConfig,
      detectionFlags: {
        hasMCPSupport: r.tool.hasMCPSupport ?? false,
        hasOpenAPI: r.tool.hasOpenAPI ?? false,
        hasNpmPackage: r.tool.hasNpmPackage ?? false,
      },
    })),
  }
}

function saveToFile(content: string, filePath: string): void {
  // Ensure directory exists
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  
  writeFileSync(filePath, content, 'utf-8')
}

async function main() {
  // Only show progress to stderr so stdout is clean JSON
  const log = (msg: string) => {
    if (!streaming) {
      console.error(msg)
    }
  }

  log('🔮 Lyra Tool Discovery - JSON Output\n')

  const discovery = new ToolDiscovery()

  log('🔍 Discovering tools...\n')

  // ===========================================
  // Streaming Output (NDJSON)
  // ===========================================
  if (streaming) {
    console.error('📡 Streaming output as NDJSON...\n')
    
    const results = await discovery.discover({
      sources: ['github'],
      limit: 5,
    })

    // Output each result as a single JSON line
    for (const result of results) {
      const line = JSON.stringify({
        name: result.tool.name,
        template: result.decision.template,
        url: result.tool.sourceUrl,
        config: result.generated.pluginConfig,
      })
      console.log(line)
    }

    console.error('\n✅ Streamed ' + results.length + ' tools')
    return
  }

  // ===========================================
  // Standard JSON Output
  // ===========================================
  const results = await discovery.discover({
    sources: ['github', 'npm'],
    limit: 10,
  })

  if (results.length === 0) {
    log('❌ No tools discovered')
    console.log('{"meta":{"totalTools":0},"tools":[]}')
    return
  }

  log(`✅ Discovered ${results.length} tools\n`)

  // Format output
  const output = formatForOutput(results)

  // Pretty print or compact
  const jsonOutput = compact 
    ? JSON.stringify(output)
    : JSON.stringify(output, null, 2)

  // Save to file or print to stdout
  if (outputFile) {
    saveToFile(jsonOutput, outputFile)
    log(`💾 Saved to: ${outputFile}`)
    log(`   Size: ${(jsonOutput.length / 1024).toFixed(2)} KB`)
    
    // Also show a preview
    log('\n📄 Preview:')
    console.log(JSON.stringify(output.meta, null, 2))
    log(`\n   ... plus ${output.tools.length} tool entries`)
  } else {
    // Print full JSON to stdout
    console.log(jsonOutput)
  }

  log('\n✅ JSON output complete!')
}

main().catch(console.error)
