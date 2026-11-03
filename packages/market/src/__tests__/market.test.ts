import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TOOLS, TOOL_GROUPS, createToolContext, ApiError } from '../index.js'

describe('registry', () => {
  it('has unique snake_case names', () => {
    const names = TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('gives every tool a real description, group, schema and /api route', () => {
    for (const t of TOOLS) {
      expect(t.title, t.name).toBeTruthy()
      expect(t.description.length, t.name).toBeGreaterThan(20)
      expect(TOOL_GROUPS, t.name).toContain(t.group)
      expect(t.endpoint, t.name).toMatch(/^(GET|POST) \/api\//)
      expect(typeof t.run).toBe('function')
    }
  })
})

describe('HTTP client against a local server', () => {
  let srv: Server
  let base = ''
  const seen: { url: string; ua?: string; key?: string }[] = []

  beforeAll(async () => {
    srv = createServer((req, res) => {
      seen.push({ url: req.url ?? '', ua: req.headers['user-agent'], key: req.headers['x-api-key'] as string | undefined })
      if (req.url?.startsWith('/api/fail')) {
        res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"nope"}')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, path: req.url }))
    })
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((r) => srv.close(() => r())))

  it('sends query params and a user agent', async () => {
    const ctx = createToolContext({ baseUrl: base, timeoutMs: 5000 })
    const out = (await ctx.get('/api/news', { limit: 3, category: 'defi', skip: undefined })) as { path: string }
    expect(out.path).toBe('/api/news?limit=3&category=defi')
    expect(seen.at(-1)?.ua).toMatch(/agenti|crypto-news/)
  })

  it('turns an HTTP error into an ApiError with a readable message', async () => {
    const ctx = createToolContext({ baseUrl: base, timeoutMs: 5000 })
    await expect(ctx.get('/api/fail')).rejects.toBeInstanceOf(ApiError)
  })

  it('runs a registered tool end to end', async () => {
    const ctx = createToolContext({ baseUrl: base, timeoutMs: 5000 })
    const tool = TOOLS.find((t) => t.name === 'get_fear_greed')!
    const out = (await tool.run({} as never, ctx)) as { ok: boolean }
    expect(out.ok).toBe(true)
  })
})
