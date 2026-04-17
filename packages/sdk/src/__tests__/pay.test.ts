import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { EVMWallet, SolanaWallet } from '@agenti/core'
import { pay } from '../pay.js'

// Hardhat/Anvil account #0 — safe public test vector
const EVM_WALLET: EVMWallet = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
}
const SOLANA_WALLET: SolanaWallet = {
  address: '11111111111111111111111111111111',
  privateKey: new Uint8Array(64),
}

// Realistic USDC contract on Base (used as payTo / asset in test payloads)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

function makeV1Body() {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'base-mainnet',
        maxAmountRequired: '1000000',
        payTo: RECIPIENT,
        maxTimeoutSeconds: 300,
        asset: USDC_BASE,
        extra: { name: 'USD Coin', version: '2' },
      },
    ],
  }
}

function makeV2HeaderValue() {
  const v2 = {
    x402Version: 2,
    resource: { url: 'https://example.com/api' },
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '500000',
        payTo: RECIPIENT,
        maxTimeoutSeconds: 300,
        asset: USDC_BASE,
      },
    ],
  }
  return Buffer.from(JSON.stringify(v2)).toString('base64')
}

function mock402V1() {
  return {
    status: 402,
    headers: { get: (_h: string) => null },
    json: vi.fn().mockResolvedValue(makeV1Body()),
  }
}

function mock402V2() {
  const encoded = makeV2HeaderValue()
  return {
    status: 402,
    headers: { get: (h: string) => (h === 'PAYMENT-REQUIRED' ? encoded : null) },
    json: vi.fn(),
  }
}

function mock200() {
  return { status: 200, headers: { get: () => null } }
}

describe('x402 flow', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes through non-402 responses immediately', async () => {
    mockFetch.mockResolvedValueOnce(mock200())
    const res = await pay('https://example.com', EVM_WALLET, SOLANA_WALLET)
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries with payment header after 402 (v1)', async () => {
    mockFetch.mockResolvedValueOnce(mock402V1()).mockResolvedValueOnce(mock200())
    const res = await pay('https://example.com/resource', EVM_WALLET, SOLANA_WALLET)
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const [, retryOpts] = mockFetch.mock.calls[1] as [string, RequestInit]
    const headers = retryOpts.headers as Record<string, string>
    expect(headers['X-Payment']).toBeDefined()
  })

  it('parses v1 payment requirements from body', async () => {
    mockFetch.mockResolvedValueOnce(mock402V1()).mockResolvedValueOnce(mock200())
    await pay('https://example.com/resource', EVM_WALLET, SOLANA_WALLET)
    const [, retryOpts] = mockFetch.mock.calls[1] as [string, RequestInit]
    const headers = retryOpts.headers as Record<string, string>
    // Decode and verify it's a valid x402 v1 payment object
    const decoded = JSON.parse(Buffer.from(headers['X-Payment']!, 'base64').toString())
    expect(decoded.x402Version).toBe(1)
    expect(decoded.network).toBe('base-mainnet')
    expect(decoded.payload.authorization.value).toBe('1000000')
  })

  it('parses v2 payment requirements from headers', async () => {
    mockFetch.mockResolvedValueOnce(mock402V2()).mockResolvedValueOnce(mock200())
    await pay('https://example.com/resource', EVM_WALLET, SOLANA_WALLET)
    const [, retryOpts] = mockFetch.mock.calls[1] as [string, RequestInit]
    const headers = retryOpts.headers as Record<string, string>
    // v2 sets both PAYMENT-SIGNATURE and X-Payment
    expect(headers['PAYMENT-SIGNATURE']).toBeDefined()
    const decoded = JSON.parse(Buffer.from(headers['PAYMENT-SIGNATURE']!, 'base64').toString())
    expect(decoded.x402Version).toBe(2)
    expect(decoded.network).toBe('eip155:8453')
    expect(decoded.payload.authorization.value).toBe('500000')
  })

  it('signs EIP-3009 transferWithAuthorization correctly', async () => {
    mockFetch.mockResolvedValueOnce(mock402V1()).mockResolvedValueOnce(mock200())
    await pay('https://example.com/resource', EVM_WALLET, SOLANA_WALLET)
    const [, retryOpts] = mockFetch.mock.calls[1] as [string, RequestInit]
    const headers = retryOpts.headers as Record<string, string>
    const decoded = JSON.parse(Buffer.from(headers['X-Payment']!, 'base64').toString())
    const { authorization } = decoded.payload
    expect(authorization.from).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(authorization.to).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(authorization.nonce).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(decoded.payload.signature).toMatch(/^0x/)
    expect(Number(authorization.validAfter)).toBeLessThan(Math.floor(Date.now() / 1000))
    expect(Number(authorization.validBefore)).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('gives up after the single retry — returns whatever the retry yields', async () => {
    // Even if the retry also returns 402, there is no infinite loop
    mockFetch.mockResolvedValueOnce(mock402V1()).mockResolvedValueOnce(mock402V1())
    await pay('https://example.com/resource', EVM_WALLET, SOLANA_WALLET)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
