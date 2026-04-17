import { SolanaAgentKit, createSolanaTools, createVercelAITools } from 'solana-agent-kit'
import bs58 from 'bs58'
import type { Keypair } from '@solana/web3.js'

export interface SolanaAgentKitConfig {
  keypair: Keypair
  rpcUrl?: string
  openAiApiKey?: string
  /** Extra config passed to SolanaAgentKit (e.g. COINGECKO_API_KEY, etc.) */
  config?: Record<string, string>
}

/**
 * Create a SolanaAgentKit instance from an agenti Keypair.
 * Wraps sendaifun/solana-agent-kit (100+ Solana actions: Jupiter swap, Raydium,
 * NFT, token deploy, staking, Drift perps, and more).
 */
export function createSolanaAgentKit(opts: SolanaAgentKitConfig): SolanaAgentKit {
  const base58Key = bs58.encode(opts.keypair.secretKey)
  const rpcUrl =
    opts.rpcUrl ?? process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
  return new SolanaAgentKit(base58Key, rpcUrl, {
    OPENAI_API_KEY: opts.openAiApiKey ?? process.env['OPENAI_API_KEY'] ?? '',
    ...opts.config,
  })
}

export { createSolanaTools as getSolanaAgentKitLangchainTools }
export { createVercelAITools as getSolanaAgentKitVercelTools }
export type { SolanaAgentKit }
