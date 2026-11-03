#!/usr/bin/env node
/**
 * agenti-gateway: put any MCP server behind per-tool x402 prices.
 *
 *   agenti-gateway mcp --stdio "npx -y some-mcp-server" --price '*=$0.01' --pay-to-evm 0x...
 *   agenti-gateway mcp --url https://upstream.example/mcp --price 'search=$0.05' --pay-to-svm So1...
 */
import { parseArgs } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { monetizeMcp, serveMcpOverHttp } from './mcp.js'
import { parsePrices, splitCommand } from './cli-args.js'

const USAGE = `Usage: agenti-gateway mcp (--stdio "<command>" | --url <endpoint>) --price <tool=$price>... [options]

Resells an MCP server over Streamable HTTP, charging per tool call with x402.

Upstream (one of):
  --stdio "<command>"     Spawn a stdio MCP server, e.g. "npx -y @modelcontextprotocol/server-everything"
  --url <endpoint>        Connect to a Streamable HTTP (or SSE) MCP server

Pricing:
  --price <tool=$price>   Repeatable. Use *=$0.01 for every tool not listed. Unpriced tools stay free.

Payment:
  --pay-to-evm <0x...>    Base / EVM receiving address   (env AGENTI_PAY_TO_EVM)
  --pay-to-svm <base58>   Solana receiving address       (env AGENTI_PAY_TO_SVM)
  --network <name>        Repeatable: base, base-sepolia, solana, solana-devnet, or a CAIP-2 id.
                          Defaults to mainnet for each address given.
  --facilitator <url>     Required for mainnet          (env AGENTI_FACILITATOR_URL)

Server:
  --port <n>              Default 4022 (env PORT)
  --host <addr>           Default 127.0.0.1; use 0.0.0.0 to accept remote clients
  --path <path>           Default /mcp
`

async function connectUpstream(stdio: string | undefined, url: string | undefined): Promise<Client> {
  const client = new Client({ name: 'agenti-gateway', version: '0.1.0' })
  if (stdio) {
    const [command, ...args] = splitCommand(stdio)
    if (!command) throw new Error('--stdio needs a command')
    await client.connect(new StdioClientTransport({ command, args, stderr: 'inherit' }))
    return client
  }
  const endpoint = new URL(url as string)
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint))
    return client
  } catch (streamableError) {
    const sse = new Client({ name: 'agenti-gateway', version: '0.1.0' })
    try {
      await sse.connect(new SSEClientTransport(endpoint))
      return sse
    } catch {
      throw streamableError
    }
  }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  if (command !== 'mcp' || rest.includes('--help') || rest.includes('-h')) {
    process.stdout.write(USAGE)
    process.exitCode = command === 'mcp' || command === '--help' || command === '-h' || command === undefined ? 0 : 1
    return
  }
  const { values } = parseArgs({
    args: rest,
    options: {
      stdio: { type: 'string' },
      url: { type: 'string' },
      price: { type: 'string', multiple: true },
      'pay-to-evm': { type: 'string' },
      'pay-to-svm': { type: 'string' },
      network: { type: 'string', multiple: true },
      facilitator: { type: 'string' },
      port: { type: 'string' },
      host: { type: 'string' },
      path: { type: 'string' },
    },
    strict: true,
  })

  if (!values.stdio === !values.url) throw new Error('Pass exactly one of --stdio or --url.')
  const prices = parsePrices(values.price ?? [])
  if (Object.keys(prices).length === 0) throw new Error('Pass at least one --price, e.g. --price "*=$0.01".')
  const evm = values['pay-to-evm'] ?? process.env['AGENTI_PAY_TO_EVM']
  const svm = values['pay-to-svm'] ?? process.env['AGENTI_PAY_TO_SVM']
  const facilitator = values.facilitator ?? process.env['AGENTI_FACILITATOR_URL']
  const port = Number(values.port ?? process.env['PORT'] ?? 4022)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid --port ${values.port}`)

  const upstream = await connectUpstream(values.stdio, values.url)
  const resold = monetizeMcp({
    upstream,
    prices,
    payTo: { ...(evm ? { evm } : {}), ...(svm ? { svm } : {}) },
    ...(values.network ? { networks: values.network } : {}),
    ...(facilitator ? { facilitator } : {}),
  })
  const served = await serveMcpOverHttp(resold.createServer, {
    port,
    ...(values.host ? { host: values.host } : {}),
    ...(values.path ? { path: values.path } : {}),
  })

  const { tools } = await upstream.listTools()
  const lines = tools.map((tool) => {
    const spec = resolved(resold.priceFor(tool.name))
    return `  ${tool.name.padEnd(28)} ${spec}`
  })
  process.stdout.write(
    `agenti-gateway: serving ${tools.length} tools at ${served.url}\n` +
      `  networks: ${resold.paywall.networks.join(', ')}\n${lines.join('\n')}\n`,
  )

  const shutdown = async (): Promise<void> => {
    await served.close()
    await upstream.close()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
}

function resolved(spec: { price: string } | undefined): string {
  if (!spec) return 'free'
  return spec.price.startsWith('$') ? spec.price : `$${spec.price}`
}

main(process.argv.slice(2)).catch((err: unknown) => {
  process.stderr.write(`agenti-gateway: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
