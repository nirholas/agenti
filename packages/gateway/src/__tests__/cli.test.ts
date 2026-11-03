import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { NETWORKS } from '../index.js'
import { parsePrices, splitCommand } from '../cli-args.js'

const BIN = fileURLToPath(new URL('../../dist/bin.js', import.meta.url))
const UPSTREAM = fileURLToPath(new URL('./fixtures/echo-server.mjs', import.meta.url))
const SELLER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('CLI argument parsing', () => {
  it('splits commands and keeps quoted arguments whole', () => {
    expect(splitCommand(`npx -y "my server" --flag 'a b' ""`)).toEqual(['npx', '-y', 'my server', '--flag', 'a b', ''])
  })
  it('rejects an unterminated quote', () => {
    expect(() => splitCommand('node "oops')).toThrow(/Unterminated/)
  })
  it('parses tool prices, including the * default', () => {
    expect(parsePrices(['*=$0.01', 'search=$0.05'])).toEqual({ '*': '$0.01', search: '$0.05' })
    expect(() => parsePrices(['search'])).toThrow(/tool=\$price/)
  })
})

describe('agenti-gateway mcp', () => {
  let facilitator: Server
  let gateway: ChildProcess
  let url = ''

  beforeAll(async () => {
    // Answers the one facilitator call an unpaid challenge needs: what it supports.
    facilitator = createServer((req, res) => {
      if (req.url?.endsWith('/supported')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ kinds: [{ x402Version: 2, scheme: 'exact', network: NETWORKS['base-sepolia'] }], extensions: [], signers: {} }))
        return
      }
      res.writeHead(404).end()
    })
    await new Promise<void>((resolve) => facilitator.listen(0, '127.0.0.1', resolve))
    const facilitatorUrl = `http://127.0.0.1:${(facilitator.address() as AddressInfo).port}`

    gateway = spawn(
      process.execPath,
      [BIN, 'mcp', '--stdio', `"${process.execPath}" "${UPSTREAM}"`, '--price', 'echo=$0.02', '--pay-to-evm', SELLER, '--network', 'base-sepolia', '--facilitator', facilitatorUrl, '--port', '0'],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    )
    url = await new Promise<string>((resolve, reject) => {
      let out = ''
      gateway.stdout?.on('data', (chunk: Buffer) => {
        out += chunk.toString()
        const match = /serving \d+ tools at (\S+)/.exec(out)
        if (match?.[1]) resolve(match[1])
      })
      gateway.once('exit', (code) => reject(new Error(`gateway exited with ${code}: ${out}`)))
    })
  }, 30_000)

  afterAll(async () => {
    gateway?.kill('SIGTERM')
    await new Promise<void>((resolve) => facilitator.close(() => resolve()))
  })

  async function connect(): Promise<Client> {
    const client = new Client({ name: 'cli-test', version: '1.0.0' })
    await client.connect(new StreamableHTTPClientTransport(new URL(url)))
    return client
  }

  it('lists the upstream tools with their prices', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    await client.close()
    expect(tools.map((tool) => tool.name).sort()).toEqual(['echo', 'version'])
    expect(tools.find((tool) => tool.name === 'echo')?._meta?.['x402/price']).toBe('$0.02')
    expect(tools.find((tool) => tool.name === 'version')?._meta?.['x402/price']).toBeUndefined()
  })

  it('passes free tools straight through', async () => {
    const client = await connect()
    const result = await client.callTool({ name: 'version', arguments: {} })
    await client.close()
    expect(result.content).toEqual([{ type: 'text', text: '3.1.0' }])
  })

  it('answers an unpaid call to a priced tool with an x402 challenge', async () => {
    const client = await connect()
    const result = (await client.callTool({ name: 'echo', arguments: { text: 'hi' } })) as {
      isError?: boolean
      structuredContent?: { x402Version: number; accepts: Array<{ network: string; amount: string; payTo: string }> }
    }
    await client.close()
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.x402Version).toBe(2)
    expect(result.structuredContent?.accepts[0]).toMatchObject({ network: NETWORKS['base-sepolia'], amount: '20000', payTo: SELLER })
  })
})
