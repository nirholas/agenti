import { describe, it, expect, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { verifyPaymentReceipt } from '../solana/payments.js'

describe('verifyPaymentReceipt transaction version support (#192)', () => {
  it('asks the RPC for transactions newer than version 0', async () => {
    const getTransaction = vi.fn(async (_sig: string, _config: unknown) => null)
    const connection = { getTransaction } as unknown as Connection
    await verifyPaymentReceipt('A'.repeat(88), connection)
    const config = getTransaction.mock.calls[0]?.[1] as { maxSupportedTransactionVersion?: number }
    expect(config.maxSupportedTransactionVersion).toBeGreaterThanOrEqual(1)
  })
})
