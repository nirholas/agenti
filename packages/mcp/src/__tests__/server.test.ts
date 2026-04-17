import { vi, describe, it, expect, beforeEach } from 'vitest'

// Capture tool handlers before imports so they're available in the mock factory
const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>>,
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    tool(
      name: string,
      _description: string,
      _schema: unknown,
      fn: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>
    ) {
      handlers[name] = fn
    }
  },
}))

// Mock @agenti/sdk so we don't pull in the `ai` peer dep or live network code.
// Implementations mirror the real agenti/core logic so the tool outputs are realistic.
vi.mock('@agenti/sdk', async () => {
  const { generateWallet, walletFromKeys } = await import('@agenti/core')
  const { randomUUID } = await import('crypto')

  function agenti(
    config: {
      evm?: { privateKey: `0x${string}` }
      solana?: { privateKey: Uint8Array }
    } = {}
  ) {
    const wallet =
      config.evm?.privateKey
        ? walletFromKeys(config.evm.privateKey, config.solana?.privateKey)
        : generateWallet()

    return {
      wallet,
      pay: () => Promise.resolve(new Response('ok', { status: 200 })),
      balance: () => Promise.resolve([]),
      receive: ({
        amount,
        token,
        chain,
      }: {
        amount: number
        token: string
        chain: string
      }) =>
        Promise.resolve({
          id: randomUUID(),
          amount: amount.toString(),
          token,
          chain,
          address:
            chain === 'solana' ? wallet.solana.address : wallet.evm.address,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        }),
    }
  }

  return { agenti, generateWallet }
})

import { createServer } from '../server.js'

describe('MCP tools', () => {
  beforeEach(() => {
    // Clear stale handlers then re-register by constructing a fresh server
    for (const key of Object.keys(handlers)) delete handlers[key]
    createServer()
  })

  it('create_wallet returns evm_address and solana_address', async () => {
    const result = await handlers['create_wallet']!({})
    const parsed = JSON.parse(result.content[0]!.text)
    expect(parsed.evm.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(parsed.solana.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    expect(parsed.warning).toBeDefined()
  })

  it('create_invoice returns invoice object', async () => {
    const result = await handlers['create_invoice']!({
      amount: 1,
      token: 'USDC',
      chain: 'base',
      evm_private_key:
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    })
    const invoice = JSON.parse(result.content[0]!.text)
    expect(invoice.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(invoice.amount).toBe('1')
    expect(invoice.token).toBe('USDC')
    expect(invoice.chain).toBe('base')
    expect(invoice.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('pay requires an EVM private key', async () => {
    delete process.env['AGENTI_EVM_PRIVATE_KEY']
    await expect(
      handlers['pay']!({ url: 'https://example.com', method: 'GET' })
    ).rejects.toThrow(/EVM private key required/)
  })

  it('get_balance works with mock keys', async () => {
    const result = await handlers['get_balance']!({
      evm_private_key:
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    })
    // balance() returns [] in our mock — result should be parseable JSON
    const parsed = JSON.parse(result.content[0]!.text)
    expect(Array.isArray(parsed)).toBe(true)
  })
})
