import { createHelius } from 'helius-sdk'
import { Connection } from '@solana/web3.js'
import type { EnhancedTransaction } from 'helius-sdk/enhanced/types'
import type { Asset } from 'helius-sdk/types/das'

export type HeliusCluster = 'mainnet-beta' | 'devnet'
export type { EnhancedTransaction }

export interface TokenBalance {
  mint: string
  amount: string
  decimals: number
  symbol?: string
}

function heliusNetwork(cluster: HeliusCluster): 'mainnet' | 'devnet' {
  return cluster === 'devnet' ? 'devnet' : 'mainnet'
}

export function heliusRpcUrl(apiKey: string, cluster: HeliusCluster = 'mainnet-beta'): string {
  if (cluster === 'devnet') return `https://devnet.helius-rpc.com/?api-key=${apiKey}`
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
}

export function createHeliusConnection(apiKey: string, cluster: HeliusCluster = 'mainnet-beta'): Connection {
  return new Connection(heliusRpcUrl(apiKey, cluster), 'confirmed')
}

export function createHeliusClient(apiKey: string, cluster: HeliusCluster = 'mainnet-beta') {
  return createHelius({ apiKey, network: heliusNetwork(cluster) })
}

export async function getSPLTokenBalances(
  apiKey: string,
  ownerAddress: string,
  cluster: HeliusCluster = 'mainnet-beta',
): Promise<TokenBalance[]> {
  const helius = createHeliusClient(apiKey, cluster)
  const result = await helius.getAssetsByOwner({
    ownerAddress,
    page: 1,
    limit: 1000,
    displayOptions: { showFungible: true },
  })

  return (result.items ?? [])
    .filter((asset: Asset) => asset.token_info?.balance && asset.token_info.balance > 0)
    .map((asset: Asset) => {
      const info = asset.token_info!
      const raw = info.balance ?? 0
      const decimals = info.decimals ?? 0
      return {
        mint: asset.id,
        amount: decimals > 0 ? (raw / 10 ** decimals).toString() : raw.toString(),
        decimals,
        symbol: info.symbol,
      }
    })
}

export async function getAssetsByOwner(
  apiKey: string,
  ownerAddress: string,
  cluster: HeliusCluster = 'mainnet-beta',
) {
  const helius = createHeliusClient(apiKey, cluster)
  return helius.getAssetsByOwner({ ownerAddress, page: 1, limit: 100 })
}

export async function getEnrichedHistory(
  apiKey: string,
  address: string,
  cluster: HeliusCluster = 'mainnet-beta',
  limit = 20,
): Promise<EnhancedTransaction[]> {
  const helius = createHeliusClient(apiKey, cluster)
  const result = await helius.enhanced.getTransactionsByAddress({ address, options: { limit } })
  return result.transactions ?? []
}
