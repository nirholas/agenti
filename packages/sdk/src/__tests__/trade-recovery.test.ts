import { describe, it, expect, vi, afterEach } from 'vitest'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import type { Connection } from '@solana/web3.js'
import { buy, sell } from '../solana/trade.js'

const MINT = 'So11111111111111111111111111111111111111112'

function quote(keypair: Keypair): string {
  const tx = new Transaction({
    feePayer: keypair.publicKey,
    recentBlockhash: '11111111111111111111111111111111',
  }).add(
    SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 }),
  )
  return tx.serialize({ requireAllSignatures: false }).toString('base64')
}

function stubQuotes(keypair: Keypair) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ transaction: quote(keypair) }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function simulationError(message: string, logs: string[] = []): Error {
  return Object.assign(new Error(`failed to send transaction: ${message}`), { logs })
}

function connectionWith(send: ReturnType<typeof vi.fn>): Connection {
  return {
    sendRawTransaction: send,
    getLatestBlockhash: vi.fn(async () => ({ blockhash: 'b', lastValidBlockHeight: 1 })),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
  } as unknown as Connection
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pump trades recover from a failed simulation (#159)', () => {
  it('re-quotes and retries when the simulation fails on a stale blockhash', async () => {
    const keypair = Keypair.generate()
    const fetchMock = stubQuotes(keypair)
    const send = vi
      .fn()
      .mockRejectedValueOnce(simulationError('Transaction simulation failed: Blockhash not found'))
      .mockResolvedValueOnce('SIG')
    const result = await buy({ mint: MINT, solAmount: 0.1, keypair, connection: connectionWith(send) })
    expect(result.signature).toBe('SIG')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('re-quotes and retries a sell when the price moved past the slippage limit', async () => {
    const keypair = Keypair.generate()
    const fetchMock = stubQuotes(keypair)
    const send = vi
      .fn()
      .mockRejectedValueOnce(
        simulationError('Transaction simulation failed: custom program error: 0x1773', [
          'Program log: AnchorError: TooLittleSolReceived',
        ]),
      )
      .mockResolvedValueOnce('SIG2')
    const result = await sell({ mint: MINT, tokenAmount: 10, keypair, connection: connectionWith(send) })
    expect(result.signature).toBe('SIG2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after a bounded number of attempts with a readable message instead of the raw RPC error', async () => {
    const keypair = Keypair.generate()
    const fetchMock = stubQuotes(keypair)
    const send = vi.fn().mockRejectedValue(simulationError('Transaction simulation failed: Blockhash not found'))
    await expect(
      buy({ mint: MINT, solAmount: 0.1, keypair, connection: connectionWith(send) }),
    ).rejects.toThrow(/after 3 attempts/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a failure that cannot succeed and explains it', async () => {
    const keypair = Keypair.generate()
    const fetchMock = stubQuotes(keypair)
    const send = vi
      .fn()
      .mockRejectedValue(
        simulationError('Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.'),
      )
    await expect(
      buy({ mint: MINT, solAmount: 0.1, keypair, connection: connectionWith(send) }),
    ).rejects.toThrow(/Insufficient SOL/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
