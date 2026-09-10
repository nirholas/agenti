import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'

// Capture tool registrations before imports so they're available in the mock
// factory. Descriptions and schemas are kept too: they are what an LLM sees, so
// they are as much a part of the tool as the handler.
const { handlers, registrations } = vi.hoisted(() => ({
  handlers: {} as Record<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>>,
  registrations: [] as Array<{
    name: string
    description: string
    schema: Record<string, { description?: string; _def?: { description?: string } }>
  }>,
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    tool(
      name: string,
      description: string,
      schema: Record<string, { description?: string; _def?: { description?: string } }>,
      fn: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>
    ) {
      handlers[name] = fn
      registrations.push({ name, description, schema })
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

describe('tool surface', () => {
  // Other suites create a server per test, so registrations accumulate. Take
  // one clean snapshot of what a single server actually registers.
  let tools: typeof registrations = []

  beforeAll(async () => {
    const { createServer } = await import('../server.js')
    registrations.length = 0
    createServer()
    tools = [...registrations]
  })

  it('registers every tool with a unique name', () => {
    const names = tools.map((r) => r.name)
    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
  })

  it('registers the whole documented tool surface', () => {
    expect(tools.length).toBeGreaterThanOrEqual(58)
  })

  it('names every tool in snake_case, which is what MCP clients expect', () => {
    const wrong = tools.map((r) => r.name).filter((n) => !/^[a-z][a-z0-9_]*$/.test(n))
    expect(wrong).toEqual([])
  })

  it('describes every tool, because an undescribed tool is one an agent cannot choose', () => {
    const undescribed = tools
      .filter((r) => !r.description || r.description.trim().length < 20)
      .map((r) => r.name)
    expect(undescribed).toEqual([])
  })

  it('describes every parameter of every tool', () => {
    const undescribed: string[] = []
    for (const { name, schema } of tools) {
      if (!schema || typeof schema !== 'object') continue
      for (const [param, def] of Object.entries(schema)) {
        const description = def?.description ?? def?._def?.description
        if (!description) undescribed.push(`${name}.${param}`)
      }
    }
    expect(undescribed).toEqual([])
  })

  it('exposes a handler for every registered tool', () => {
    const missing = tools.filter((r) => typeof handlers[r.name] !== 'function')
    expect(missing.map((r) => r.name)).toEqual([])
  })

  it('warns in the description of every tool that can spend money', () => {
    // A model choosing between tools sees only names and descriptions. Anything
    // that moves funds has to say so there, not only in the README.
    const spending = [
      'pay',
      'solana_swap',
      'solana_transfer',
      'solana_deploy_token',
      'solana_stake',
      'bnb_transfer',
      'bnb_swap',
      'pump_buy',
      'pump_sell',
      'jupiter_swap',
      'bitrefill_create_invoice',
      'gmgn_copy_trade',
    ]
    const registered = new Map(tools.map((r) => [r.name, r.description]))
    const silent: string[] = []
    for (const name of spending) {
      const description = registered.get(name)
      if (description === undefined) continue
      if (!/pay|spend|cost|fund|real|requires|transfer|buy|sell|swap|stake|deploy/i.test(description)) {
        silent.push(name)
      }
    }
    expect(silent).toEqual([])
  })
})
