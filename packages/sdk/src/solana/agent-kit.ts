import { createRequire } from 'node:module'
import bs58 from 'bs58'
import type { Keypair } from '@solana/web3.js'
import type { SolanaAgentKit } from 'solana-agent-kit'

type SolanaAgentKitModule = typeof import('solana-agent-kit')

export interface SolanaAgentKitConfig {
  keypair: Keypair
  rpcUrl?: string
  openAiApiKey?: string
  /** Extra config passed to SolanaAgentKit (e.g. COINGECKO_API_KEY, etc.) */
  config?: Record<string, string>
}

let agentKitModule: SolanaAgentKitModule | undefined

/**
 * solana-agent-kit is an optional peer dependency. It pulls in a very large
 * dependency tree, so it is loaded on first use instead of when @agenti/sdk is
 * imported. It ships CommonJS only, so a synchronous require keeps this API
 * synchronous.
 */
function loadSolanaAgentKit(): SolanaAgentKitModule {
  if (agentKitModule) return agentKitModule
  const require = createRequire(import.meta.url)
  try {
    agentKitModule = require('solana-agent-kit') as SolanaAgentKitModule
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'MODULE_NOT_FOUND' && String((error as Error).message).includes("'solana-agent-kit'")) {
      throw new Error(
        'Solana Agent Kit support needs the optional peer dependency: npm install solana-agent-kit',
      )
    }
    throw error
  }
  return agentKitModule
}

/**
 * Create a SolanaAgentKit instance from an agenti Keypair.
 * Wraps sendaifun/solana-agent-kit (100+ Solana actions: Jupiter swap, Raydium,
 * NFT, token deploy, staking, Drift perps, and more).
 */
export function createSolanaAgentKit(opts: SolanaAgentKitConfig): SolanaAgentKit {
  const { SolanaAgentKit } = loadSolanaAgentKit()
  const base58Key = bs58.encode(opts.keypair.secretKey)
  const rpcUrl =
    opts.rpcUrl ?? process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
  return new SolanaAgentKit(base58Key, rpcUrl, {
    OPENAI_API_KEY: opts.openAiApiKey ?? process.env['OPENAI_API_KEY'] ?? '',
    ...opts.config,
  })
}

export function getSolanaAgentKitLangchainTools(
  ...args: Parameters<SolanaAgentKitModule['createSolanaTools']>
): ReturnType<SolanaAgentKitModule['createSolanaTools']> {
  return loadSolanaAgentKit().createSolanaTools(...args)
}

export function getSolanaAgentKitVercelTools(
  ...args: Parameters<SolanaAgentKitModule['createVercelAITools']>
): ReturnType<SolanaAgentKitModule['createVercelAITools']> {
  return loadSolanaAgentKit().createVercelAITools(...args)
}

export type { SolanaAgentKit }
