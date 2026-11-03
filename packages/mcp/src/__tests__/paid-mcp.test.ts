import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getAddress, verifyTypedData } from 'viem'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { FacilitatorClient } from '@x402/core/server'
import type { PaymentPayload, PaymentRequirements, SettleResponse, SupportedResponse, VerifyResponse } from '@x402/core/types'
import { mcpPaywall, monetizeMcp, serveMcpOverHttp, NETWORKS } from '@agenti/gateway'
import type { EVMWallet } from '@agenti/core'
import { connectMcp, connectPaidMcp } from '../paid-mcp.js'
import { createServer } from '../server.js'

// Hardhat/Anvil account #0: a public test vector, never funded on mainnet.
const BUYER: EVMWallet = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
}
const SELLER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const NETWORK = NETWORKS['base-sepolia']
const TX = `0x${'ab'.repeat(32)}`

/**
 * A facilitator that does real cryptographic verification of the EIP-3009
 * authorization and records settlements instead of broadcasting them, so the
 * whole flow runs offline without spending testnet funds.
 */
class RecordingFacilitator implements FacilitatorClient {
  readonly verified: PaymentPayload[] = []
  readonly settled: Array<{ payer: string; amount: string; payTo: string }> = []

  async getSupported(): Promise<SupportedResponse> {
    return { kinds: [{ x402Version: 2, scheme: 'exact', network: NETWORK }], extensions: [], signers: {} }
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    const { authorization, signature } = payload.payload as {
      authorization: { from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: `0x${string}` }
      signature: `0x${string}`
    }
    const valid = await verifyTypedData({
      address: getAddress(authorization.from),
      domain: {
        name: requirements.extra['name'] as string,
        version: requirements.extra['version'] as string,
        chainId: Number(requirements.network.split(':')[1]),
        verifyingContract: getAddress(requirements.asset),
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: getAddress(authorization.from),
        to: getAddress(authorization.to),
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce,
      },
      signature,
    })
    const pays = valid && getAddress(authorization.to) === getAddress(requirements.payTo) && authorization.value === requirements.amount
    if (pays) this.verified.push(payload)
    return pays ? { isValid: true, payer: authorization.from } : { isValid: false, invalidReason: 'invalid_signature' }
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    const { authorization } = payload.payload as { authorization: { from: string; value: string } }
    this.settled.push({ payer: authorization.from, amount: authorization.value, payTo: requirements.payTo })
    return { success: true, transaction: TX, network: requirements.network, payer: authorization.from }
  }
}

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.map((item) => item.text ?? '').join('\n')
}

describe('paid MCP tools end to end', () => {
  const facilitator = new RecordingFacilitator()
  let paidUrl = ''
  let proxyUrl = ''
  const closers: Array<() => Promise<void>> = []

  beforeAll(async () => {
    // A seller's own MCP server with one paid and one free tool.
    const paywall = mcpPaywall({ payTo: { evm: SELLER }, networks: ['base-sepolia'], facilitator })
    const served = await serveMcpOverHttp(
      () => {
        const server = new McpServer({ name: 'premium', version: '1.0.0' })
        server.tool(
          'forecast',
          'Price forecast. $0.01 per call.',
          { symbol: z.string() },
          paywall.charge('forecast', '$0.01', async ({ symbol }) => ({
            content: [{ type: 'text', text: `${String(symbol)} goes up` }],
          })),
        )
        server.tool('ping', 'Free health check', {}, async () => ({ content: [{ type: 'text', text: 'pong' }] }))
        return server
      },
      { port: 0 },
    )
    paidUrl = served.url
    closers.push(served.close)

    // An existing free MCP server, resold through monetizeMcp with per-tool prices.
    const upstreamServer = new McpServer({ name: 'upstream', version: '2.0.0' })
    upstreamServer.tool('echo', 'Echo text back', { text: z.string() }, async ({ text }) => ({
      content: [{ type: 'text', text }],
    }))
    upstreamServer.tool('fail', 'Always fails', {}, async () => ({
      content: [{ type: 'text', text: 'upstream broke' }],
      isError: true,
    }))
    upstreamServer.tool('version', 'Free version check', {}, async () => ({ content: [{ type: 'text', text: '2.0.0' }] }))
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    await upstreamServer.connect(serverSide)
    const upstream = new Client({ name: 'proxy', version: '1.0.0' })
    await upstream.connect(clientSide)
    closers.push(() => upstream.close())

    const resold = monetizeMcp({
      upstream,
      prices: { echo: '$0.02', fail: '$0.02' },
      payTo: { evm: SELLER },
      networks: ['base-sepolia'],
      facilitator,
    })
    const proxy = await serveMcpOverHttp(resold.createServer, { port: 0 })
    proxyUrl = proxy.url
    closers.push(proxy.close)
  })

  afterAll(async () => {
    for (const close of closers.reverse()) await close()
  })

  it('pays for a paid tool and returns the settlement receipt', async () => {
    const mcp = await connectPaidMcp(paidUrl, { evm: BUYER })
    const before = facilitator.settled.length
    const result = await mcp.callTool('forecast', { symbol: 'SOL' })
    await mcp.close()

    expect(textOf(result)).toBe('SOL goes up')
    expect(result.paymentMade).toBe(true)
    expect(result.paymentResponse?.transaction).toBe(TX)
    expect(facilitator.settled.slice(before)).toEqual([{ payer: BUYER.address, amount: '10000', payTo: SELLER }])
  })

  it('leaves free tools free', async () => {
    const mcp = await connectPaidMcp(paidUrl, { evm: BUYER })
    const before = facilitator.settled.length
    const result = await mcp.callTool('ping', {})
    await mcp.close()
    expect(textOf(result)).toBe('pong')
    expect(result.paymentMade).toBe(false)
    expect(facilitator.settled.length).toBe(before)
  })

  it('refuses to sign when the price is above maxAmount', async () => {
    const mcp = await connectPaidMcp(paidUrl, { evm: BUYER, maxAmount: '5000' })
    const before = facilitator.verified.length
    await expect(mcp.callTool('forecast', { symbol: 'SOL' })).rejects.toThrow(
      /forecast costs 10000 \(smallest units\), above maxAmount 5000: refusing to pay/,
    )
    await mcp.close()
    expect(facilitator.verified.length).toBe(before)
  })

  it('advertises resold prices and charges the price set for each tool', async () => {
    const browse = await connectMcp(proxyUrl)
    const { tools } = await browse.listTools()
    await browse.close()
    const echo = tools.find((tool) => tool.name === 'echo')
    expect(echo?._meta?.['x402/price']).toBe('$0.02')
    expect(echo?.description).toMatch(/\$0\.02 per call/)
    expect(tools.find((tool) => tool.name === 'version')?._meta?.['x402/price']).toBeUndefined()

    const mcp = await connectPaidMcp(proxyUrl, { evm: BUYER })
    const before = facilitator.settled.length
    const paid = await mcp.callTool('echo', { text: 'hello' })
    const free = await mcp.callTool('version', {})
    await mcp.close()

    expect(textOf(paid)).toBe('hello')
    expect(paid.paymentMade).toBe(true)
    expect(textOf(free)).toBe('2.0.0')
    expect(facilitator.settled.slice(before)).toEqual([{ payer: BUYER.address, amount: '20000', payTo: SELLER }])
  })

  it('does not settle when the upstream tool fails', async () => {
    const mcp = await connectPaidMcp(proxyUrl, { evm: BUYER })
    const verifiedBefore = facilitator.verified.length
    const settledBefore = facilitator.settled.length
    const result = await mcp.callTool('fail', {})
    await mcp.close()

    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/upstream broke/)
    expect(facilitator.verified.length).toBe(verifiedBefore + 1)
    expect(facilitator.settled.length).toBe(settledBefore)
  })

  it('exposes paid calls to agents through the call_mcp_tool tool', async () => {
    process.env['AGENTI_EVM_PRIVATE_KEY'] = BUYER.privateKey
    const agentiServer = createServer()
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    await agentiServer.connect(serverSide)
    const agent = new Client({ name: 'model', version: '1.0.0' })
    await agent.connect(clientSide)

    const before = facilitator.settled.length
    const result = (await agent.callTool({
      name: 'call_mcp_tool',
      arguments: { server_url: paidUrl, tool: 'forecast', arguments: { symbol: 'ETH' }, max_amount: '10000' },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean }
    await agent.close()
    delete process.env['AGENTI_EVM_PRIVATE_KEY']

    expect(result.isError).toBeFalsy()
    expect(result.content[0]?.text).toBe('ETH goes up')
    expect(JSON.parse(result.content[1]?.text ?? '{}')).toMatchObject({ paid: true, payment: { transaction: TX, network: NETWORK } })
    expect(facilitator.settled.length).toBe(before + 1)
  })
})
