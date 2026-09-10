/**
 * Solana network resolution, mirroring what chains.ts does for EVM.
 *
 * x402 identifies a Solana cluster by CAIP-2, which embeds the genesis hash
 * rather than a chain id. Callers also use the plain cluster names, so both
 * resolve here and a payment is compared against requirements by resolved
 * cluster rather than by raw string.
 */

export interface SolanaNetworkConfig {
  /** CAIP-2 identifier, e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp". */
  caip2: string
  /** Cluster name used in RPC URLs and logs. */
  cluster: 'mainnet-beta' | 'devnet'
  /** Circle's USDC mint on this cluster. */
  usdc: string
  /** Default RPC endpoint, overridable per network. */
  rpc: string
  /** Alternative names callers may send for this cluster. */
  aliases: string[]
}

export const SOLANA_NETWORKS: SolanaNetworkConfig[] = [
  {
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    cluster: 'mainnet-beta',
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    rpc: process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com',
    aliases: ['solana', 'solana-mainnet', 'mainnet-beta'],
  },
  {
    caip2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    cluster: 'devnet',
    usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    rpc: process.env['SOLANA_DEVNET_RPC_URL'] ?? 'https://api.devnet.solana.com',
    aliases: ['solana-devnet', 'devnet'],
  },
]

/** True when a network string names a Solana cluster rather than an EVM chain. */
export function isSolanaNetwork(network: string): boolean {
  return getSolanaNetwork(network) !== undefined
}

/** Resolves a CAIP-2 id or cluster alias to its network, or undefined. */
export function getSolanaNetwork(network: string): SolanaNetworkConfig | undefined {
  const wanted = network.toLowerCase()
  return SOLANA_NETWORKS.find(
    (n) => n.caip2.toLowerCase() === wanted || n.aliases.includes(wanted),
  )
}

/**
 * Resolves the cluster a payment claims against the cluster the resource asked
 * to be paid on, and requires them to be the same.
 *
 * Same reasoning as the EVM side: without this a payer can present a devnet
 * transfer against a mainnet price, where the asset mint is a token anyone can
 * faucet for free.
 */
export function resolveSolanaNetworkPair(
  paymentNetwork: string,
  requirementsNetwork: string,
): { network: SolanaNetworkConfig } | { error: string } {
  const paid = getSolanaNetwork(paymentNetwork)
  if (!paid) return { error: `Unsupported network: ${paymentNetwork}` }

  const required = getSolanaNetwork(requirementsNetwork)
  if (!required) return { error: `Unsupported required network: ${requirementsNetwork}` }

  if (paid.caip2 !== required.caip2) {
    return {
      error:
        `Network mismatch: payment is on ${paid.cluster} ` +
        `but payment is required on ${required.cluster}`,
    }
  }

  return { network: paid }
}
