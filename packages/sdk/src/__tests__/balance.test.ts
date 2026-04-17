import { vi, describe, it, expect } from 'vitest'
import { createPublicClient } from 'viem'
import { Connection } from '@solana/web3.js'
import { getBalances } from '../balance.js'

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return { ...actual, createPublicClient: vi.fn() }
})

vi.mock('@solana/web3.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>()
  return { ...actual, Connection: vi.fn() }
})

// Valid Solana public key (System Program address)
const EVM_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const SOL_ADDR = '11111111111111111111111111111111'

function setupMocks(usdcRaw: bigint, lamports: number) {
  vi.mocked(createPublicClient).mockReturnValue({
    readContract: vi.fn().mockResolvedValue(usdcRaw),
  } as unknown as ReturnType<typeof createPublicClient>)

  vi.mocked(Connection).mockImplementation(() => ({
    getBalance: vi.fn().mockResolvedValue(lamports),
  }) as unknown as InstanceType<typeof Connection>)
}

describe('getBalances', () => {
  it('returns USDC balance from EVM chain', async () => {
    setupMocks(BigInt('1500000'), 0) // 1.5 USDC, 0 SOL
    const balances = await getBalances(EVM_ADDR, SOL_ADDR)
    const usdc = balances.find((b) => b.token === 'USDC')
    expect(usdc).toEqual({ token: 'USDC', amount: '1.5', chain: 'base' })
  })

  it('returns SOL balance from Solana', async () => {
    setupMocks(BigInt('0'), 2_500_000_000) // 0 USDC, 2.5 SOL
    const balances = await getBalances(EVM_ADDR, SOL_ADDR)
    const sol = balances.find((b) => b.token === 'SOL')
    expect(sol).toEqual({ token: 'SOL', amount: '2.5', chain: 'solana' })
  })

  it('returns zero for empty wallets', async () => {
    setupMocks(BigInt('0'), 0)
    const balances = await getBalances(EVM_ADDR, SOL_ADDR)
    expect(balances).toHaveLength(2)
    expect(balances.find((b) => b.token === 'USDC')?.amount).toBe('0')
    expect(balances.find((b) => b.token === 'SOL')?.amount).toBe('0')
  })

  it('returns only successful results when one call fails', async () => {
    vi.mocked(createPublicClient).mockReturnValue({
      readContract: vi.fn().mockRejectedValue(new Error('RPC error')),
    } as unknown as ReturnType<typeof createPublicClient>)
    vi.mocked(Connection).mockImplementation(() => ({
      getBalance: vi.fn().mockResolvedValue(1_000_000_000),
    }) as unknown as InstanceType<typeof Connection>)

    const balances = await getBalances(EVM_ADDR, SOL_ADDR)
    expect(balances).toHaveLength(1)
    expect(balances[0]?.token).toBe('SOL')
  })
})
