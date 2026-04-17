import { base, arbitrum, mainnet, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem'

export interface ChainConfig {
  caip2: string
  viemChain: Chain
  usdc: `0x${string}`
  rpc?: string | undefined
}

export const CHAINS: ChainConfig[] = [
  {
    caip2: 'eip155:1',
    viemChain: mainnet,
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    rpc: process.env['ETH_RPC_URL'],
  },
  {
    caip2: 'eip155:8453',
    viemChain: base,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    rpc: process.env['BASE_RPC_URL'],
  },
  {
    caip2: 'eip155:42161',
    viemChain: arbitrum,
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    rpc: process.env['ARB_RPC_URL'],
  },
  {
    caip2: 'eip155:84532',
    viemChain: baseSepolia,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    rpc: process.env['BASE_SEPOLIA_RPC_URL'],
  },
]

export function getChain(network: string): ChainConfig | undefined {
  return CHAINS.find((c) => c.caip2 === network)
}
