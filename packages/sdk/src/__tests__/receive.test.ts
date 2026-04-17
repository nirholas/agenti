import { describe, it, expect } from 'vitest'
import type { AgentiWallet } from '@agenti/core'
import { createInvoice } from '../receive.js'

const TEST_WALLET: AgentiWallet = {
  evm: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  solana: {
    address: '11111111111111111111111111111111',
    privateKey: new Uint8Array(64),
  },
}

describe('createInvoice', () => {
  it('generates a unique invoice ID each call', () => {
    const i1 = createInvoice({ amount: 1, token: 'USDC', chain: 'base', wallet: TEST_WALLET })
    const i2 = createInvoice({ amount: 1, token: 'USDC', chain: 'base', wallet: TEST_WALLET })
    expect(i1.id).not.toBe(i2.id)
    // UUID v4 format
    expect(i1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('sets expiry 30 minutes from now', () => {
    const before = Date.now()
    const invoice = createInvoice({ amount: 1, token: 'USDC', chain: 'base', wallet: TEST_WALLET })
    const after = Date.now()
    const expiryMs = invoice.expiresAt.getTime()
    expect(expiryMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000)
    expect(expiryMs).toBeLessThanOrEqual(after + 30 * 60 * 1000)
  })

  it('routes EVM chains to EVM address', () => {
    for (const chain of ['base', 'arbitrum', 'ethereum', 'polygon'] as const) {
      const invoice = createInvoice({ amount: 10, token: 'USDC', chain, wallet: TEST_WALLET })
      expect(invoice.address).toBe(TEST_WALLET.evm.address)
      expect(invoice.chain).toBe(chain)
    }
  })

  it('routes solana chain to Solana address', () => {
    const invoice = createInvoice({ amount: 0.1, token: 'SOL', chain: 'solana', wallet: TEST_WALLET })
    expect(invoice.address).toBe(TEST_WALLET.solana.address)
    expect(invoice.chain).toBe('solana')
  })

  it('preserves amount and token on the invoice', () => {
    const invoice = createInvoice({ amount: 5.5, token: 'USDC', chain: 'base', wallet: TEST_WALLET })
    expect(invoice.amount).toBe('5.5')
    expect(invoice.token).toBe('USDC')
  })
})
