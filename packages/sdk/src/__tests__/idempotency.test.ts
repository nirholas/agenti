import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { EVMWallet, SolanaWallet } from '@agenti/core'
import { pay } from '../pay.js'
import { clearIdempotencyCache, readIdempotencyKey } from '../idempotency.js'

// Hardhat/Anvil account #0 — safe public test vector
const EVM_WALLET: EVMWallet = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
}
const SOLANA_WALLET: SolanaWallet = {
  address: '11111111111111111111111111111111',
  privateKey: new Uint8Array(64),
}

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

function requirementsBody(amount = '1000000') {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'base-mainnet',
        maxAmountRequired: amount,
        payTo: RECIPIENT,
        maxTimeoutSeconds: 300,
        asset: USDC_BASE,
        extra: { name: 'USD Coin', version: '2' },
      },
    ],
  }
}

/**
 * Answers the first request of each pair with a 402 carrying requirements and
 * the second with success, recording every payment header that was presented.
 */
function mockPaidEndpoint(amount = '1000000') {
  const presented: string[] = []
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    const header = headers['X-Payment']
    if (!header) {
      return new Response(JSON.stringify(requirementsBody(amount)), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    presented.push(header)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { presented, fetchMock }
}

/** Pulls the EIP-3009 nonce back out of a base64 payment header. */
function nonceOf(header: string): string {
  const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'))
  return decoded.payload.authorization.nonce
}

describe('readIdempotencyKey', () => {
  it('reads the key from a plain object regardless of casing', () => {
    expect(readIdempotencyKey({ 'Idempotency-Key': 'abc' })).toBe('abc')
    expect(readIdempotencyKey({ 'idempotency-key': 'abc' })).toBe('abc')
    expect(readIdempotencyKey({ 'IDEMPOTENCY-KEY': 'abc' })).toBe('abc')
  })

  it('reads the key from a Headers instance', () => {
    expect(readIdempotencyKey(new Headers({ 'Idempotency-Key': 'abc' }))).toBe('abc')
  })

  it('reads the key from an array of header tuples', () => {
    expect(readIdempotencyKey([['Idempotency-Key', 'abc']])).toBe('abc')
  })

  it('returns undefined when there is no key', () => {
    expect(readIdempotencyKey(undefined)).toBeUndefined()
    expect(readIdempotencyKey({ 'Content-Type': 'application/json' })).toBeUndefined()
  })
})

describe('pay() idempotency', () => {
  beforeEach(() => {
    clearIdempotencyCache()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearIdempotencyCache()
  })

  it('signs a fresh authorization for every call when no key is given', async () => {
    const { presented } = mockPaidEndpoint()

    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET)
    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET)

    expect(presented).toHaveLength(2)
    expect(nonceOf(presented[0] as string)).not.toBe(nonceOf(presented[1] as string))
  })

  it('replays the same authorization for retries under one idempotency key', async () => {
    const { presented } = mockPaidEndpoint()
    const headers = { 'Idempotency-Key': 'purchase-1' }

    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, { headers })
    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, { headers })
    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, { headers })

    expect(presented).toHaveLength(3)
    const nonces = new Set(presented.map(nonceOf))
    expect(nonces.size).toBe(1)
    expect(presented[0]).toBe(presented[1])
    expect(presented[1]).toBe(presented[2])
  })

  it('forwards the idempotency key upstream so the server can dedupe too', async () => {
    const { fetchMock } = mockPaidEndpoint()

    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, {
      headers: { 'Idempotency-Key': 'purchase-1' },
    })

    const paidCall = fetchMock.mock.calls.find(
      (call) => (call[1]?.headers as Record<string, string>)?.['X-Payment'],
    )
    expect((paidCall?.[1]?.headers as Record<string, string>)['Idempotency-Key']).toBe('purchase-1')
  })

  it('signs separately for different idempotency keys', async () => {
    const { presented } = mockPaidEndpoint()

    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, {
      headers: { 'Idempotency-Key': 'purchase-1' },
    })
    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, {
      headers: { 'Idempotency-Key': 'purchase-2' },
    })

    expect(new Set(presented.map(nonceOf)).size).toBe(2)
  })

  it('does not replay an authorization across different payment requirements', async () => {
    const first = mockPaidEndpoint('1000000')
    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, {
      headers: { 'Idempotency-Key': 'reused' },
    })
    vi.unstubAllGlobals()

    // Same key, but the resource now charges a different amount.
    const second = mockPaidEndpoint('9000000')
    await pay('https://example.com/api', EVM_WALLET, SOLANA_WALLET, {
      headers: { 'Idempotency-Key': 'reused' },
    })

    expect(nonceOf(first.presented[0] as string)).not.toBe(nonceOf(second.presented[0] as string))
  })
})
