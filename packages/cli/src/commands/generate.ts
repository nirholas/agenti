import fs from 'fs'
import path from 'path'
import { fetchAbi } from '../abi/fetcher.js'
import { generateMcpServer } from '../abi/generator.js'

export interface GenerateOptions {
  chain: string
  out: string
  name?: string
  rpc?: string
}

export async function runGenerate(source: string, options: GenerateOptions): Promise<void> {
  console.log(`Fetching ABI for ${source} on ${options.chain}...`)

  const abi = await fetchAbi(source, options.chain)
  console.log(`Found ${abi.length} ABI items.`)

  const contractAddress = source.startsWith('0x') ? source : '0x0000000000000000000000000000000000000000'
  const contractName = options.name

  const serverSource = generateMcpServer(abi, {
    contractAddress,
    ...(contractName !== undefined ? { contractName } : {}),
    chain: options.chain,
    ...(options.rpc !== undefined ? { rpc: options.rpc } : {}),
  })

  const outDir = path.resolve(options.out)
  fs.mkdirSync(outDir, { recursive: true })

  const serverPath = path.join(outDir, 'server.ts')
  fs.writeFileSync(serverPath, serverSource, 'utf-8')

  const pkgJson = {
    name: contractName ? contractName.toLowerCase().replace(/\s+/g, '-') + '-mcp' : 'contract-mcp',
    version: '1.0.0',
    type: 'module',
    scripts: { start: 'node --loader ts-node/esm server.ts' },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.10.0',
      viem: '^2.21.0',
      zod: '^3.23.0',
    },
  }
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8')

  const envExample = [
    `RPC_URL=${options.rpc ?? ''}`,
    `# PRIVATE_KEY=0x...  # required for write functions`,
  ].join('\n')
  fs.writeFileSync(path.join(outDir, '.env.example'), envExample, 'utf-8')

  console.log(`\nGenerated MCP server in ${outDir}`)
  console.log(`  server.ts     — MCP server source`)
  console.log(`  package.json  — project manifest`)
  console.log(`  .env.example  — environment variable template`)
  console.log(`\nNext steps:`)
  console.log(`  cd ${options.out}`)
  console.log(`  cp .env.example .env && vim .env`)
  console.log(`  npm install && node server.ts`)
}
