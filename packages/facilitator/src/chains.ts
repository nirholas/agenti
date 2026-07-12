import { base, arbitrum, mainnet, polygon, baseSepolia } from 'viem/chains'
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
    caip2: 'eip155:137',
    viemChain: polygon,
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    rpc: process.env['POLYGON_RPC_URL'],
  },
  {
    caip2: 'eip155:84532',
    viemChain: baseSepolia,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    rpc: process.env['BASE_SEPOLIA_RPC_URL'],
  },
]

// Legacy x402 v1 plain-name aliases → CAIP-2. Accepted alongside the CAIP-2 form.
const NETWORK_ALIASES: Record<string, string> = {
  'ethereum-mainnet': 'eip155:1',
  'base-mainnet': 'eip155:8453',
  'arbitrum-mainnet': 'eip155:42161',
  'polygon-mainnet': 'eip155:137',
}

export function getChain(network: string): ChainConfig | undefined {
  const caip2 = NETWORK_ALIASES[network] ?? network
  return CHAINS.find((c) => c.caip2 === caip2)
}

/**
 * Resolves a network to its config and asserts the supplied asset is that
 * network's canonical USDC. Returns an error string on any mismatch, or null
 * when the pairing is valid. This prevents the facilitator from being coerced
 * into signing/broadcasting `transferWithAuthorization` against an arbitrary
 * attacker-supplied contract with its own gas key.
 */
export function checkAsset(network: string, asset: string): string | null {
  const chain = getChain(network)
  if (!chain) return `Unsupported network: ${network}`
  if (asset.toLowerCase() !== chain.usdc.toLowerCase()) {
    return `Unsupported asset for ${network}: ${asset}`
  }
  return null
}
