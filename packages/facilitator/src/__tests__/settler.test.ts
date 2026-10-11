import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAsset, getChain } from '../chains.js'
import type { EVMPaymentPayload, PaymentRequired } from '../types.js'

const receiptStatus = vi.hoisted(() => ({ value: 'success' as 'success' | 'reverted' }))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({
      waitForTransactionReceipt: async () => ({ status: receiptStatus.value }),
    }),
    createWalletClient: () => ({ writeContract: async () => '0xabc' }),
  }
})

import { settlePayment } from '../settler.js'

const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const PAY_TO = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const PAYER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const

let nonceCounter = 0
function payment(): EVMPaymentPayload {
  nonceCounter += 1
  return {
    x402Version: 1,
    scheme: 'exact',
    network: 'eip155:8453',
    payload: {
      signature: '0x' + '11'.repeat(65),
      authorization: {
        from: PAYER,
        to: PAY_TO,
        value: '1000',
        validAfter: '0',
        validBefore: String(Math.floor(Date.now() / 1000) + 600),
        nonce: '0x' + nonceCounter.toString(16).padStart(64, '0'),
      },
    },
  } as unknown as EVMPaymentPayload
}

function requirements(asset: string): PaymentRequired {
  return {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000',
    payTo: PAY_TO,
    asset,
  } as unknown as PaymentRequired
}

describe('checkAsset', () => {
  const base = getChain('eip155:8453')!

  it('accepts the canonical USDC, in any case', () => {
    expect(checkAsset(base, BASE_USDC)).toBeNull()
    expect(checkAsset(base, BASE_USDC.toLowerCase())).toBeNull()
  })

  it('rejects any other contract', () => {
    expect(checkAsset(base, '0x000000000000000000000000000000000000dEaD')).toMatch(/Unsupported asset/)
  })
})

describe('settlePayment', () => {
  beforeEach(() => {
    receiptStatus.value = 'success'
  })

  it('reports a mined, successful transfer as settled', async () => {
    const result = await settlePayment(payment(), requirements(BASE_USDC), { settlerPrivateKey: KEY })
    expect(result.settled).toBe(true)
  })

  it('does not report a reverted transfer as settled', async () => {
    receiptStatus.value = 'reverted'
    const result = await settlePayment(payment(), requirements(BASE_USDC), { settlerPrivateKey: KEY })
    expect(result.settled).toBe(false)
    expect(result.error).toMatch(/reverted/)
  })

  it('never broadcasts to a non-USDC contract', async () => {
    const result = await settlePayment(
      payment(),
      requirements('0x000000000000000000000000000000000000dEaD'),
      { settlerPrivateKey: KEY },
    )
    expect(result.settled).toBe(false)
    expect(result.error).toMatch(/Unsupported asset/)
  })
})
