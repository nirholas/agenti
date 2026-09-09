import { base, arbitrum, mainnet, polygon, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem'

export interface ChainConfig {
  caip2: string
  viemChain: Chain
  usdc: `0x${string}`
  rpc?: string | undefined
  /** Legacy x402 v1 network names that resolve to this chain. */
  aliases: string[]
}

/**
 * The single source of truth for the networks this facilitator accepts.
 *
 * Verification, settlement and /health all read this list, so a chain is either
 * fully supported or not present. Every `usdc` address below implements
 * EIP-3009 with the EIP-712 domain { name: "USD Coin", version: "2" }, which is
 * what the verifier reconstructs when requirements carry no `extra`.
 */
export const CHAINS: ChainConfig[] = [
  {
    caip2: 'eip155:1',
    viemChain: mainnet,
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    rpc: process.env['ETH_RPC_URL'],
    aliases: ['ethereum-mainnet'],
  },
  {
    caip2: 'eip155:8453',
    viemChain: base,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    rpc: process.env['BASE_RPC_URL'],
    aliases: ['base-mainnet'],
  },
  {
    caip2: 'eip155:42161',
    viemChain: arbitrum,
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    rpc: process.env['ARB_RPC_URL'],
    aliases: ['arbitrum-mainnet'],
  },
  {
    caip2: 'eip155:137',
    viemChain: polygon,
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    rpc: process.env['POLYGON_RPC_URL'],
    aliases: ['polygon-mainnet'],
  },
  {
    caip2: 'eip155:84532',
    viemChain: baseSepolia,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    rpc: process.env['BASE_SEPOLIA_RPC_URL'],
    aliases: ['base-sepolia'],
  },
]

/**
 * Resolves a CAIP-2 identifier or a legacy x402 v1 network name to its chain.
 * Returns undefined for a network this facilitator does not support.
 */
export function getChain(network: string): ChainConfig | undefined {
  return CHAINS.find((c) => c.caip2 === network || c.aliases.includes(network))
}

/**
 * Resolves the network a payment claims against the network the resource asked
 * to be paid on, and requires them to be the same chain.
 *
 * Without this binding a payer can have an EIP-3009 authorization verified and
 * settled on a chain of their choosing while the server only ever advertised
 * another, which is how a payment lands on a testnet, or on a chain where
 * `requirements.asset` is a different token entirely. The two are compared as
 * resolved chains rather than raw strings so a v1 client sending
 * "base-mainnet" still matches a server that advertised "eip155:8453".
 */
export function resolveNetworkPair(
  paymentNetwork: string,
  requirementsNetwork: string,
): { chain: ChainConfig } | { error: string } {
  const paymentChain = getChain(paymentNetwork)
  if (!paymentChain) return { error: `Unsupported network: ${paymentNetwork}` }

  const requiredChain = getChain(requirementsNetwork)
  if (!requiredChain) return { error: `Unsupported required network: ${requirementsNetwork}` }

  if (paymentChain.caip2 !== requiredChain.caip2) {
    return {
      error:
        `Network mismatch: payment is on ${paymentChain.caip2} ` +
        `but payment is required on ${requiredChain.caip2}`,
    }
  }

  return { chain: paymentChain }
}
