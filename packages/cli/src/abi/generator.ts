import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { AbiItem, AbiParameter, ParsedFunction } from './parser.js'
import { parseFunctions, solidityTypeToZod, toSnakeCase, toPascalCase } from './parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VIEM_CHAINS: Record<string, { import: string; name: string; rpc: string }> = {
  mainnet: { import: 'mainnet', name: 'mainnet', rpc: 'https://eth.llamarpc.com' },
  eth: { import: 'mainnet', name: 'mainnet', rpc: 'https://eth.llamarpc.com' },
  base: { import: 'base', name: 'base', rpc: 'https://mainnet.base.org' },
  arbitrum: { import: 'arbitrum', name: 'arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
  optimism: { import: 'optimism', name: 'optimism', rpc: 'https://mainnet.optimism.io' },
  polygon: { import: 'polygon', name: 'polygon', rpc: 'https://polygon-rpc.com' },
  bsc: { import: 'bsc', name: 'bsc', rpc: 'https://bsc-dataseed.binance.org' },
  avalanche: { import: 'avalanche', name: 'avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
}

export interface GeneratorOptions {
  contractAddress: string
  contractName?: string
  chain?: string
  rpc?: string
}

export function generateMcpServer(abi: AbiItem[], options: GeneratorOptions): string {
  const chain = options.chain ?? 'mainnet'
  const chainConfig = VIEM_CHAINS[chain] ?? VIEM_CHAINS['mainnet']!
  const rpc = options.rpc ?? chainConfig.rpc
  const contractName = options.contractName ?? deriveContractName(options.contractAddress)

  const templatePath = path.resolve(__dirname, '../templates/mcp-server.ts.template')
  let template = fs.readFileSync(templatePath, 'utf-8')

  const functions = parseFunctions(abi)
  const toolsCode = functions.map((fn) => generateTool(fn, contractName)).join('\n\n')

  template = template
    .replace(/{{CONTRACT_ADDRESS}}/g, options.contractAddress)
    .replace(/{{CHAIN}}/g, chain)
    .replace(/{{DEFAULT_RPC}}/g, rpc)
    .replace(/{{VIEM_CHAIN_IMPORT}}/g, chainConfig!.import)
    .replace(/{{VIEM_CHAIN_NAME}}/g, chainConfig!.name)
    .replace(/{{CONTRACT_NAME}}/g, contractName)
    .replace(/{{ABI_JSON}}/g, JSON.stringify(abi, null, 2))
    .replace(/{{TOOLS}}/g, toolsCode)

  return template
}

function generateTool(fn: ParsedFunction, contractName: string): string {
  const toolName = toSnakeCase(fn.name)
  const description = buildDescription(fn, contractName)
  const schemaEntries = buildSchemaEntries(fn)
  const paramsDestructure = fn.inputs.length
    ? `{ ${fn.inputs.map((p, i) => p.name || `arg${i}`).join(', ')} }`
    : '_args'

  const body =
    fn.kind === 'read' ? buildReadBody(fn) : buildWriteBody(fn)

  const schemaBlock =
    fn.inputs.length === 0 && fn.kind === 'read'
      ? '{}'
      : `{\n${schemaEntries}\n  }`

  return `server.tool(
  '${toolName}',
  '${description}',
  ${schemaBlock},
  async (${paramsDestructure}) => {
${body}
  }
)`
}

function buildDescription(fn: ParsedFunction, contractName: string): string {
  const base = `${contractName}.${fn.name}()`
  if (fn.kind === 'read') return `${base} — read-only, no gas required`
  if (fn.kind === 'payable') return `${base} — payable write function, sends ETH with transaction`
  return `${base} — write function, modifies on-chain state`
}

function buildSchemaEntries(fn: ParsedFunction): string {
  const lines: string[] = []

  fn.inputs.forEach((p, i) => {
    const name = p.name ?? `arg${i}`
    const schema = solidityTypeToZod(p.type, p.components)
    lines.push(`    ${name}: ${schema}.describe('${p.type} ${name}'),`)
  })

  if (fn.kind === 'payable') {
    lines.push(`    value_wei: z.string().optional().describe('ETH value in wei to send'),`)
  }

  if (fn.kind !== 'read') {
    lines.push(`    simulate: z.boolean().optional().describe('Simulate without broadcasting (default true)'),`)
  }

  return lines.join('\n')
}

function buildReadBody(fn: ParsedFunction): string {
  const args = buildCallArgs(fn.inputs)
  return `    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: '${fn.name}',
      args: [${args}],
    })
    return { content: [{ type: 'text', text: JSON.stringify(result, bigintReplacer, 2) }] }`
}

function buildWriteBody(fn: ParsedFunction): string {
  const args = buildCallArgs(fn.inputs)
  const valueParam = fn.kind === 'payable' ? '\n      value: BigInt(value_wei ?? \'0\'),' : ''
  return `    if (!walletClient) {
      return { content: [{ type: 'text', text: 'Error: PRIVATE_KEY env var not set' }] }
    }
    if (simulate !== false) {
      const simResult = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: '${fn.name}',
        args: [${args}],
        account: walletClient.account,${valueParam}
      })
      return { content: [{ type: 'text', text: JSON.stringify({ simulated: true, request: simResult.request }, bigintReplacer, 2) }] }
    }
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: '${fn.name}',
      args: [${args}],${valueParam}
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    return { content: [{ type: 'text', text: JSON.stringify({ hash, status: receipt.status, gasUsed: receipt.gasUsed }, bigintReplacer, 2) }] }`
}

function buildCallArgs(inputs: AbiParameter[]): string {
  return inputs.map((p, i) => p.name || `arg${i}`).join(', ')
}

function deriveContractName(address: string): string {
  return `Contract_${address.slice(2, 8)}`
}

