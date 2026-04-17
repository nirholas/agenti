import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { buy, sell } from './trade.js'
import { getCoinState } from './coin.js'
import { watchMigration, watchMigrationLogs } from './monitor.js'
import {
  createHeliusConnection,
  getAssetsByOwner,
  getEnrichedHistory,
  getSPLTokenBalances,
} from './helius.js'
import type { BuyParams, SellParams, TradeResult } from './trade.js'
import type { CoinState } from './coin.js'
import type { MigrationEvent, WatchOptions } from './monitor.js'
import type { TokenBalance, EnhancedTransaction } from './helius.js'

export { watchPumpEvents, decodePumpLog } from './events.js'
export type { PumpEvent, EventMonitorOptions } from './events.js'
export { MemoryStore, FileStore } from './storage.js'
export type { EventStore } from './storage.js'

// Payments / x402
export {
  // Program constants
  PROGRAM_ID,
  USDC_MAINNET,
  USDC_DEVNET,
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  X402_VERSION,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_SIGNATURE,
  X402_HEADER_PAYMENT_RESPONSE,
  // PDA helpers
  getGlobalConfigPDA,
  getTokenAgentPaymentsPDA,
  getPaymentInCurrencyPDA,
  getInvoiceIdPDA,
  getBuybackAuthorityPDA,
  getWithdrawAuthorityPDA,
  // Core payment functions
  createAgentPaymentInvoice,
  validatePayment,
  getInvoicePDA,
  acceptPayment,
  createX402Fetch,
} from './payments.js'
export type {
  InvoiceParams,
  AgentPaymentInvoice,
  GetInvoicePDAParams,
  ValidatePaymentParams,
  AcceptPaymentParams,
  X402ClientConfig,
  TransactionSigner,
  TransactionSender,
  PaymentRequirementsBase,
  PumpAgentPaymentRequirements,
  PumpAgentPaymentRequirementsExtra,
  ExactPaymentRequirements,
  PaymentRequirements,
  PaymentRequired,
  PaymentPayload,
} from './payments.js'

export interface SolanaConfig {
  keypair: Keypair
  rpc?: string
  connection?: Connection
  heliusApiKey?: string
  cluster?: 'mainnet-beta' | 'devnet'
}

export interface SolanaInstance {
  keypair: Keypair
  connection: Connection
  buy(params: Omit<BuyParams, 'keypair' | 'connection'>): Promise<TradeResult>
  sell(params: Omit<SellParams, 'keypair' | 'connection'>): Promise<TradeResult>
  coinState(mint: string): Promise<CoinState>
  watchMigration(
    mint: string,
    onMigrate: (event: MigrationEvent) => void | Promise<void>,
    options?: WatchOptions & { useLogs?: boolean }
  ): () => void
  // Helius-powered methods (available when heliusApiKey is set)
  getTokenBalances?(): Promise<TokenBalance[]>
  getAssets?(): Promise<Awaited<ReturnType<typeof getAssetsByOwner>>>
  getTxHistory?(limit?: number): Promise<EnhancedTransaction[]>
}

export function solana(config: SolanaConfig): SolanaInstance {
  const cluster = config.cluster ?? 'mainnet-beta'

  const connection =
    config.connection ??
    (config.heliusApiKey
      ? createHeliusConnection(config.heliusApiKey, cluster)
      : new Connection(config.rpc ?? clusterApiUrl(cluster), 'confirmed'))

  const address = config.keypair.publicKey.toBase58()

  const instance: SolanaInstance = {
    keypair: config.keypair,
    connection,

    buy: (params) => buy({ ...params, keypair: config.keypair, connection }),
    sell: (params) => sell({ ...params, keypair: config.keypair, connection }),
    coinState: getCoinState,

    watchMigration(mint, onMigrate, options) {
      if (options?.useLogs) {
        return watchMigrationLogs(mint, connection, onMigrate)
      }
      return watchMigration(mint, onMigrate, options)
    },
  }

  if (config.heliusApiKey) {
    const apiKey = config.heliusApiKey
    instance.getTokenBalances = () => getSPLTokenBalances(apiKey, address, cluster)
    instance.getAssets = () => getAssetsByOwner(apiKey, address, cluster)
    instance.getTxHistory = (limit = 20) => getEnrichedHistory(apiKey, address, cluster, limit)
  }

  return instance
}

export { buy, sell, getCoinState, watchMigration, watchMigrationLogs }
export type { BuyParams, SellParams, TradeResult, CoinState, MigrationEvent, WatchOptions }
export type { TokenBalance, EnhancedTransaction }

// Smart wallet tracking
export { getTopWallets, getWalletTrades, isSmartWallet, watchWallets } from './wallets.js'
export type { WalletRank, WalletTrade } from './wallets.js'

// Bonding curve math
export {
  getBuyTokenAmount, getSellSolAmount,
  getBuyPriceImpact, getSellPriceImpact,
  getTokenPrice, getGraduationProgress, estimateFee,
} from './curve.js'
export type { BondingCurveState } from './curve.js'

// Multi-endpoint RPC failover
export { createFallbackConnection } from './rpc.js'
export type { RpcEndpoint } from './rpc.js'

// Solana Agent Kit — 100+ Solana actions via sendaifun/solana-agent-kit
export {
  createSolanaAgentKit,
  getSolanaAgentKitLangchainTools,
  getSolanaAgentKitVercelTools,
} from './agent-kit.js'
export type { SolanaAgentKitConfig, SolanaAgentKit } from './agent-kit.js'

// Price oracle — Pyth (primary) + CoinGecko (fallback)
export { getPrice, usdToTokenAmount, tokenAmountToUsd, PYTH_FEEDS, COINGECKO_IDS } from './price-oracle.js'
export type { PriceResult, PriceOracleOptions } from './price-oracle.js'

// Vault — distribute and withdraw agent payment revenue
export { buildDistributeInstructions, buildWithdrawInstructions, getVaultBalances } from './vault.js'
export type { DistributePaymentsParams, VaultBalances } from './vault.js'

// Payment history & receipt verification
export { getPaymentHistory, verifyPaymentReceipt } from './payments.js'
export type { PaymentRecord } from './payments.js'

// Agent action schemas — Zod schemas for AI tool use
export { AgentActionSchemas } from './agent-actions.js'
