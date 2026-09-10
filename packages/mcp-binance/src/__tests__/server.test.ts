import { vi, describe, it, expect, beforeAll } from 'vitest'

// Capture what each tool registers. Descriptions and parameter descriptions are
// the only thing a model sees when choosing a tool, so they are part of the
// tool's contract, not documentation about it.
const { registrations } = vi.hoisted(() => ({
  registrations: [] as Array<{
    name: string
    description: string
    schema: Record<string, { description?: string; _def?: { description?: string } }>
    handler: unknown
  }>,
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    tool(
      name: string,
      description: string,
      schema: Record<string, { description?: string; _def?: { description?: string } }>,
      handler: unknown,
    ) {
      registrations.push({ name, description, schema, handler })
    }
  },
}))

describe('Binance MCP tool surface', () => {
  let tools: typeof registrations = []

  beforeAll(async () => {
    const { createBinanceMcpServer } = await import('../server.js')
    registrations.length = 0
    createBinanceMcpServer()
    tools = [...registrations]
  })

  it('registers the documented tools with unique names', () => {
    expect(tools.length).toBeGreaterThanOrEqual(12)
    const names = tools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('namespaces every tool, so it cannot collide with another server in the same client', () => {
    const unprefixed = tools.map((t) => t.name).filter((n) => !n.startsWith('binance_'))
    expect(unprefixed).toEqual([])
  })

  it('names every tool in snake_case', () => {
    const wrong = tools.map((t) => t.name).filter((n) => !/^[a-z][a-z0-9_]*$/.test(n))
    expect(wrong).toEqual([])
  })

  it('describes every tool', () => {
    const undescribed = tools
      .filter((t) => !t.description || t.description.trim().length < 20)
      .map((t) => t.name)
    expect(undescribed).toEqual([])
  })

  it('describes every parameter of every tool', () => {
    const undescribed: string[] = []
    for (const { name, schema } of tools) {
      if (!schema || typeof schema !== 'object') continue
      for (const [param, def] of Object.entries(schema)) {
        if (!(def?.description ?? def?._def?.description)) undescribed.push(`${name}.${param}`)
      }
    }
    expect(undescribed).toEqual([])
  })

  it('gives every tool a callable handler', () => {
    const broken = tools.filter((t) => typeof t.handler !== 'function').map((t) => t.name)
    expect(broken).toEqual([])
  })

  it('says in the description that placing an order spends real money', () => {
    const place = tools.find((t) => t.name === 'binance_place_order')
    expect(place).toBeDefined()
    expect(place?.description).toMatch(/real|live|spend|fund|money|test_order/i)
  })
})
