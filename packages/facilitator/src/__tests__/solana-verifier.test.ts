import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { verifySolanaPayment, settleSolanaPayment } from '../solana/verifier.js'
import { resolveSolanaNetworkPair, getSolanaNetwork, isSolanaNetwork } from '../solana/networks.js'
import type { SolanaPaymentPayload, PaymentRequired } from '../types.js'

const MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const WSOL = 'So11111111111111111111111111111111111111112'
const MERCHANT = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const PAYER = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'

/** A distinct base58 signature per test, so one test cannot burn another's. */
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
let signatureCounter = 0
function freshSignature(): string {
  signatureCounter += 1
  let suffix = ''
  let n = signatureCounter
  do {
    suffix = (BASE58[n % 58] as string) + suffix
    n = Math.floor(n / 58)
  } while (n > 0)
  return 'A'.repeat(88 - suffix.length) + suffix
}

interface BalanceEntry {
  accountIndex: number
  mint: string
  owner: string
  amount: string
}

/**
 * Builds a getTransaction response in the shape the RPC actually returns, so
 * the verifier runs its real balance-delta path rather than a shortcut.
 */
function transaction(opts: {
  pre?: BalanceEntry[]
  post?: BalanceEntry[]
  err?: unknown
} = {}) {
  return {
    slot: 1,
    blockTime: Math.floor(Date.now() / 1000),
    meta: {
      err: opts.err ?? null,
      preTokenBalances: (opts.pre ?? []).map((b) => ({
        accountIndex: b.accountIndex,
        mint: b.mint,
        owner: b.owner,
        uiTokenAmount: { amount: b.amount, decimals: 6, uiAmount: 0, uiAmountString: b.amount },
      })),
      postTokenBalances: (opts.post ?? []).map((b) => ({
        accountIndex: b.accountIndex,
        mint: b.mint,
        owner: b.owner,
        uiTokenAmount: { amount: b.amount, decimals: 6, uiAmount: 0, uiAmountString: b.amount },
      })),
    },
  }
}

/** A transfer of `amount` USDC from PAYER to MERCHANT, both ATAs pre-existing. */
function paidTransaction(amount: string, mint = USDC, recipient = MERCHANT) {
  return transaction({
    pre: [
      { accountIndex: 1, mint, owner: PAYER, amount: '10000000' },
      { accountIndex: 2, mint, owner: recipient, amount: '0' },
    ],
    post: [
      { accountIndex: 1, mint, owner: PAYER, amount: String(10000000n - BigInt(amount)) },
      { accountIndex: 2, mint, owner: recipient, amount },
    ],
  })
}

function connectionReturning(result: unknown): Connection {
  return { getTransaction: vi.fn(async () => result) } as unknown as Connection
}

function payment(overrides: Partial<SolanaPaymentPayload> = {}): SolanaPaymentPayload {
  return {
    x402Version: 2,
    scheme: 'exact',
    network: MAINNET,
    payload: { signature: freshSignature(), payer: PAYER },
    ...overrides,
  }
}

function requirements(overrides: Partial<PaymentRequired> = {}): PaymentRequired {
  return {
    scheme: 'exact',
    network: MAINNET,
    asset: USDC,
    payTo: MERCHANT,
    amount: '100000',
    ...overrides,
  }
}

describe('Solana network resolution', () => {
  it('recognises Solana networks by CAIP-2 and by alias', () => {
    expect(isSolanaNetwork(MAINNET)).toBe(true)
    expect(isSolanaNetwork('solana-devnet')).toBe(true)
    expect(isSolanaNetwork('eip155:8453')).toBe(false)
  })

  it('resolves an alias to the same cluster as its CAIP-2 id', () => {
    expect(getSolanaNetwork('mainnet-beta')?.caip2).toBe(MAINNET)
    expect(getSolanaNetwork('devnet')?.caip2).toBe(DEVNET)
  })

  it('rejects a devnet payment against a mainnet requirement', () => {
    const result = resolveSolanaNetworkPair(DEVNET, MAINNET)
    expect('error' in result && result.error).toContain('Network mismatch')
  })
})

describe('verifySolanaPayment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts a confirmed transfer of the required amount', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    await expect(
      verifySolanaPayment(payment(), requirements(), { connection }),
    ).resolves.toEqual({ valid: true })
  })

  it('accepts an overpayment', async () => {
    const connection = connectionReturning(paidTransaction('250000'))
    const result = await verifySolanaPayment(payment(), requirements(), { connection })
    expect(result.valid).toBe(true)
  })

  it('rejects an underpayment', async () => {
    const connection = connectionReturning(paidTransaction('99999'))
    const result = await verifySolanaPayment(payment(), requirements(), { connection })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Insufficient payment amount')
  })

  it('rejects a transfer of a different token', async () => {
    const connection = connectionReturning(paidTransaction('100000', WSOL))
    const result = await verifySolanaPayment(payment(), requirements(), { connection })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('moved no')
  })

  it('rejects a transfer to a different recipient', async () => {
    const connection = connectionReturning(paidTransaction('100000', USDC, PAYER))
    const result = await verifySolanaPayment(payment(), requirements(), { connection })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('moved no')
  })

  it('counts a recipient account created by the same transaction', async () => {
    // No pre balance for the merchant: the ATA did not exist until this transfer.
    const connection = connectionReturning(
      transaction({
        pre: [{ accountIndex: 1, mint: USDC, owner: PAYER, amount: '10000000' }],
        post: [
          { accountIndex: 1, mint: USDC, owner: PAYER, amount: '9900000' },
          { accountIndex: 2, mint: USDC, owner: MERCHANT, amount: '100000' },
        ],
      }),
    )
    const result = await verifySolanaPayment(payment(), requirements(), { connection })
    expect(result.valid).toBe(true)
  })

  it('rejects a transaction that failed on-chain', async () => {
    const failed = paidTransaction('100000')
    failed.meta.err = { InstructionError: [0, 'Custom'] } as never

    const result = await verifySolanaPayment(payment(), requirements(), {
      connection: connectionReturning(failed),
    })
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Transaction failed on-chain')
  })

  it('rejects a transaction the cluster has not seen', async () => {
    const connection = connectionReturning(null)
    const result = await verifySolanaPayment(payment(), requirements(), { connection })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('rejects a payment claiming a cluster the resource did not ask for', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const result = await verifySolanaPayment(
      payment({ network: DEVNET }),
      requirements(),
      { connection },
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Network mismatch')
  })

  it('rejects a payer who did not send this payment', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const result = await verifySolanaPayment(
      payment({ payload: { signature: freshSignature(), payer: MERCHANT } }),
      requirements(),
      { connection },
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('did not send this payment')
  })

  it('rejects a malformed signature without calling the RPC', async () => {
    const getTransaction = vi.fn()
    const connection = { getTransaction } as unknown as Connection
    const result = await verifySolanaPayment(
      payment({ payload: { signature: 'not-a-signature', payer: PAYER } }),
      requirements(),
      { connection },
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Malformed transaction signature')
    expect(getTransaction).not.toHaveBeenCalled()
  })

  it('rejects a malformed payTo address', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const result = await verifySolanaPayment(
      payment(),
      requirements({ payTo: 'not-an-address' }),
      { connection },
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Malformed payTo')
  })

  it('surfaces an RPC outage as a throw, not as a rejected payment', async () => {
    const connection = {
      getTransaction: vi.fn(async () => {
        throw new Error('503 Service Unavailable')
      }),
    } as unknown as Connection

    await expect(verifySolanaPayment(payment(), requirements(), { connection })).rejects.toThrow(
      /Solana RPC error/,
    )
  })

  it('does not consume the signature, so verifying twice both pass', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const one = payment()

    await expect(verifySolanaPayment(one, requirements(), { connection })).resolves.toEqual({
      valid: true,
    })
    await expect(verifySolanaPayment(one, requirements(), { connection })).resolves.toEqual({
      valid: true,
    })
  })
})

describe('settleSolanaPayment', () => {
  it('claims the payment and returns the payer signature as the tx hash', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const one = payment()

    const result = await settleSolanaPayment(one, requirements(), { connection })
    expect(result.settled).toBe(true)
    expect(result.txHash).toBe(one.payload.signature)
  })

  it('refuses to settle the same signature twice', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const one = payment()

    await settleSolanaPayment(one, requirements(), { connection })
    const replay = await settleSolanaPayment(one, requirements(), { connection })

    expect(replay.settled).toBe(false)
    expect(replay.error).toBe('Payment signature already used')
  })

  it('refuses to verify a signature that has already been settled', async () => {
    const connection = connectionReturning(paidTransaction('100000'))
    const one = payment()

    await settleSolanaPayment(one, requirements(), { connection })
    const result = await verifySolanaPayment(one, requirements(), { connection })

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Payment signature already used')
  })

  it('does not burn the signature when settlement is refused for another reason', async () => {
    const one = payment()

    const underpaid = await settleSolanaPayment(one, requirements({ amount: '999999999' }), {
      connection: connectionReturning(paidTransaction('100000')),
    })
    expect(underpaid.settled).toBe(false)

    // The payer corrects the requirements and the same transfer still works.
    const retry = await settleSolanaPayment(one, requirements(), {
      connection: connectionReturning(paidTransaction('100000')),
    })
    expect(retry.settled).toBe(true)
  })
})
