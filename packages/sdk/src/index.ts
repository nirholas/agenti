export { agenti } from './agenti.js'
export type { AgentiConfig, AgentiInstance } from './agenti.js'
export { getBalances } from './balance.js'
export { generateWallet, walletFromKeys } from '@agenti/core'
export type { Chain, AgentiWallet, Balance, Invoice } from '@agenti/core'

// Solana trading
export { solana, buy, sell, getCoinState, watchMigration, watchMigrationLogs } from './solana/index.js'
export type { SolanaConfig, SolanaInstance } from './solana/index.js'
export type { BuyParams, SellParams, TradeResult } from './solana/trade.js'
export type { CoinState, CoinPhase } from './solana/coin.js'
export type { MigrationEvent, WatchOptions } from './solana/monitor.js'

// ERC-8004 agent identity
export { registerAgent, getAgentIdentity, getAgentsByOwner } from './identity.js'
export type { AgentIdentity, ERC8004Registration, ERC8004Service } from './identity.js'

// x402 payment gating
export { withPaymentExpress, withPaymentHono, withPayment } from './serve.js'
export type { PaymentConfig } from './serve.js'

// Framework adapters
export { agentiPlugin } from './frameworks/eliza.js'
export { agentiLangChainTools } from './frameworks/langchain.js'
export { agentiTools } from './frameworks/vercel-ai.js'
