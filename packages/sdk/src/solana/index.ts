import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { buy, sell } from './trade.js'
import { getCoinState } from './coin.js'
import { watchMigration, watchMigrationLogs } from './monitor.js'
import type { BuyParams, SellParams, TradeResult } from './trade.js'
import type { CoinState } from './coin.js'
import type { MigrationEvent, WatchOptions } from './monitor.js'

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
}

export function solana(config: SolanaConfig): SolanaInstance {
  const connection =
    config.connection ?? new Connection(config.rpc ?? clusterApiUrl('mainnet-beta'), 'confirmed')

  return {
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
}

export { buy, sell, getCoinState, watchMigration, watchMigrationLogs }
export type { BuyParams, SellParams, TradeResult, CoinState, MigrationEvent, WatchOptions }
