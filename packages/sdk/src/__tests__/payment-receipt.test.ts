import { describe, it, expect, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { verifyPaymentReceipt } from '../solana/payments.js'

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const WSOL = 'So11111111111111111111111111111111111111112'
const MERCHANT = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const PAYER = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'
const SIGNATURE = 'A'.repeat(88)

function balance(accountIndex: number, mint: string, owner: string, amount: string) {
  return {
    accountIndex,
    mint,
    owner,
    uiTokenAmount: { amount, decimals: 6, uiAmount: 0, uiAmountString: amount },
  }
}

function transaction(opts: {
  pre?: ReturnType<typeof balance>[]
  post?: ReturnType<typeof balance>[]
  logs?: string[]
  err?: unknown
}) {
  return {
    slot: 1,
    blockTime: 1_700_000_000,
    meta: {
      err: opts.err ?? null,
      logMessages: opts.logs ?? [],
      preTokenBalances: opts.pre ?? [],
      postTokenBalances: opts.post ?? [],
    },
  }
}

function connectionReturning(result: unknown): Connection {
  return { getTransaction: vi.fn(async () => result) } as unknown as Connection
}

/** A transfer of `amount` USDC from PAYER to MERCHANT. */
function transfer(amount: string, logs?: string[]) {
  return transaction({
    pre: [balance(1, USDC, PAYER, '10000000'), balance(2, USDC, MERCHANT, '0')],
    post: [
      balance(1, USDC, PAYER, String(10000000n - BigInt(amount))),
      balance(2, USDC, MERCHANT, amount),
    ],
    ...(logs ? { logs } : {}),
  })
}

describe('verifyPaymentReceipt', () => {
  it('reports the amount that actually moved, not zero', async () => {
    const record = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(transfer('2500000')),
    )
    expect(record?.amount).toBe('2500000')
  })

  it('identifies the payer as the account whose balance fell', async () => {
    const record = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(transfer('2500000')),
    )
    expect(record?.payer).toBe(PAYER)
    expect(record?.agentMint).toBe(MERCHANT)
  })

  it('reads an SPL memo when the payment carried one', async () => {
    const record = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(transfer('100000', ['Program log: Memo (len 7): "invoice"'])),
    )
    expect(record?.memo).toBe('invoice')
  })

  it('reports no memo as null rather than inventing one', async () => {
    const record = await verifyPaymentReceipt(SIGNATURE, connectionReturning(transfer('100000')))
    expect(record?.memo).toBeNull()
  })

  it('counts a recipient account created by the same transaction', async () => {
    const record = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(
        transaction({
          pre: [balance(1, USDC, PAYER, '10000000')],
          post: [balance(1, USDC, PAYER, '9900000'), balance(2, USDC, MERCHANT, '100000')],
        }),
      ),
    )
    expect(record?.amount).toBe('100000')
  })

  it('returns null for a transaction that failed', async () => {
    const failed = transfer('100000')
    failed.meta.err = { InstructionError: [0, 'Custom'] } as never
    await expect(
      verifyPaymentReceipt(SIGNATURE, connectionReturning(failed)),
    ).resolves.toBeNull()
  })

  it('returns null when the transaction does not exist', async () => {
    await expect(verifyPaymentReceipt(SIGNATURE, connectionReturning(null))).resolves.toBeNull()
  })

  it('returns null when nothing of the token moved', async () => {
    const record = await verifyPaymentReceipt(SIGNATURE, connectionReturning(transfer('100000')), {
      currencyMint: WSOL,
    })
    expect(record).toBeNull()
  })

  it('checks a specific recipient when one is named', async () => {
    const forMerchant = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(transfer('100000')),
      { payTo: MERCHANT },
    )
    expect(forMerchant?.amount).toBe('100000')

    const forSomeoneElse = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(transfer('100000')),
      { payTo: '11111111111111111111111111111111' },
    )
    expect(forSomeoneElse).toBeNull()
  })

  it('picks the largest recipient when several were paid', async () => {
    const record = await verifyPaymentReceipt(
      SIGNATURE,
      connectionReturning(
        transaction({
          pre: [balance(1, USDC, PAYER, '10000000')],
          post: [
            balance(1, USDC, PAYER, '9000000'),
            balance(2, USDC, MERCHANT, '900000'),
            balance(3, USDC, '11111111111111111111111111111111', '100000'),
          ],
        }),
      ),
    )
    expect(record?.agentMint).toBe(MERCHANT)
    expect(record?.amount).toBe('900000')
  })
})
