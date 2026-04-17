import { createPublicClient, http, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js'
import type { Balance } from '@agenti/core'

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export async function getBalances(evmAddress: string, solanaAddress: string): Promise<Balance[]> {
  const results = await Promise.allSettled([
    getUSDCBalance(evmAddress),
    getSOLBalance(solanaAddress),
  ])

  return results
    .filter((r): r is PromiseFulfilledResult<Balance> => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function getUSDCBalance(address: string): Promise<Balance> {
  const client = createPublicClient({ chain: base, transport: http() })
  const raw = await client.readContract({
    address: USDC_BASE,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  return { token: 'USDC', amount: formatUnits(raw, 6), chain: 'base' }
}

async function getSOLBalance(address: string): Promise<Balance> {
  const connection = new Connection(clusterApiUrl('mainnet-beta'))
  const lamports = await connection.getBalance(new PublicKey(address))
  return { token: 'SOL', amount: (lamports / LAMPORTS_PER_SOL).toString(), chain: 'solana' }
}
