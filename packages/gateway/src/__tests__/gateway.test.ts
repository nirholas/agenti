import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mcpPaywall, paywall, NETWORKS } from '../index.js'

const EVM = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
const SVM = '11111111111111111111111111111112'

describe('MCP paywall config validation', () => {
  it('requires a payTo address', () => {
    expect(() => mcpPaywall({ payTo: {} })).toThrow(/mcpPaywall: payTo/)
  })
  it('requires a payTo for each requested chain', () => {
    expect(() => mcpPaywall({ payTo: { svm: SVM }, networks: ['base-sepolia'] })).toThrow(/payTo\.evm/)
  })
  it('refuses mainnet without a facilitator', () => {
    const saved = process.env['AGENTI_FACILITATOR_URL']
    delete process.env['AGENTI_FACILITATOR_URL']
    try {
      expect(() => mcpPaywall({ payTo: { evm: EVM } })).toThrow(/mainnet networks need a facilitator/)
    } finally {
      if (saved !== undefined) process.env['AGENTI_FACILITATOR_URL'] = saved
    }
  })
  it('offers every requested testnet in order', () => {
    const pw = mcpPaywall({ payTo: { evm: EVM, svm: SVM }, networks: ['base-sepolia', 'solana-devnet'] })
    expect(pw.networks).toEqual([NETWORKS['base-sepolia'], NETWORKS['solana-devnet']])
  })
  it('rejects a malformed tool price up front', () => {
    const pw = mcpPaywall({ payTo: { evm: EVM }, networks: ['base-sepolia'] })
    expect(() => pw.charge('t', 'ten cents', async () => ({ content: [] }))).toThrow(/Invalid price "ten cents"/)
  })
})

describe('config validation', () => {
  it('rejects an empty route table', () => {
    expect(() => paywall({ routes: {}, payTo: { evm: EVM } })).toThrow(/routes is empty/)
  })
  it('requires a payTo address', () => {
    expect(() => paywall({ routes: { 'GET /a': '$0.01' }, payTo: {} })).toThrow(/payTo/)
  })
  it('requires a payTo for each requested chain', () => {
    expect(() => paywall({ routes: { 'GET /a': '$0.01' }, payTo: { evm: EVM }, networks: ['solana-devnet'] })).toThrow(/payTo\.svm/)
  })
  it('refuses mainnet without a facilitator', () => {
    delete process.env['AGENTI_FACILITATOR_URL']
    expect(() => paywall({ routes: { 'GET /a': '$0.01' }, payTo: { evm: EVM } })).toThrow(/facilitator/)
  })
})

describe('402 flow with the public testnet facilitator', () => {
  let srv: Server
  let base = ''
  beforeAll(async () => {
    const app = express()
    app.use(
      paywall({
        routes: { 'GET /api/data': { price: '$0.01', description: 'Premium data' } },
        payTo: { evm: EVM, svm: SVM },
        networks: ['base-sepolia', 'solana-devnet'],
      }),
    )
    app.get('/api/data', (_req, res) => res.json({ secret: 42 }))
    app.get('/health', (_req, res) => res.json({ ok: true }))
    srv = await new Promise<Server>((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
  }, 30_000)
  afterAll(() => new Promise<void>((r) => srv.close(() => r())))

  it('leaves unlisted routes free', async () => {
    const r = await fetch(`${base}/health`)
    expect(r.status).toBe(200)
  })

  it('answers an unpaid request with 402 and both payment options', async () => {
    const r = await fetch(`${base}/api/data`)
    expect(r.status).toBe(402)
    const header = r.headers.get('payment-required')
    expect(header).toBeTruthy()
    const req = JSON.parse(Buffer.from(header!, 'base64').toString())
    expect(req.x402Version).toBe(2)
    const nets = req.accepts.map((a: { network: string }) => a.network)
    expect(nets).toContain(NETWORKS['base-sepolia'])
    expect(nets).toContain(NETWORKS['solana-devnet'])
    expect(req.accepts[0].amount).toBe('10000')
  })
})
