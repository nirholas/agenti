export { agenti } from './agenti.js'
export type { AgentiConfig, AgentiInstance } from './agenti.js'
export { getBalances } from './balance.js'
export {
  generateWallet, walletFromKeys,
  generateMnemonic, validateMnemonic,
  walletFromMnemonic, evmWalletFromMnemonic, solanaWalletFromMnemonic,
} from '@agenti/core'
export type { Chain, AgentiWallet, Balance, Invoice } from '@agenti/core'
export { signEIP712, verifyEIP712, signMessage, verifyMessage } from './signing.js'
export type { TypedDataDomain } from './signing.js'

// Solana trading
export { solana, buy, sell, getCoinState, watchMigration, watchMigrationLogs } from './solana/index.js'
export type { SolanaConfig, SolanaInstance } from './solana/index.js'
export type { BuyParams, SellParams, TradeResult } from './solana/trade.js'
export type { CoinState, CoinPhase } from './solana/coin.js'
export type { MigrationEvent, WatchOptions } from './solana/monitor.js'

// Solana event monitoring — pump.fun launches, graduations, trades, claims
export { watchPumpEvents, decodePumpLog, MemoryStore, FileStore } from './solana/index.js'
export type { PumpEvent, EventMonitorOptions, EventStore } from './solana/index.js'

// Smart wallet tracking — GMGN + Helius
export { getTopWallets, getWalletTrades, isSmartWallet, watchWallets } from './solana/index.js'
export type { WalletRank, WalletTrade } from './solana/index.js'

// Bonding curve math & RPC failover
export {
  getBuyTokenAmount, getSellSolAmount, getBuyPriceImpact, getSellPriceImpact,
  getTokenPrice, getGraduationProgress, estimateFee, createFallbackConnection,
} from './solana/index.js'
export type { BondingCurveState, RpcEndpoint } from './solana/index.js'

// Helius — RPC, DAS, enriched transactions
export {
  heliusRpcUrl,
  createHeliusConnection,
  createHeliusClient,
  getSPLTokenBalances,
  getAssetsByOwner,
  getEnrichedHistory,
} from './solana/helius.js'
export type { TokenBalance, EnhancedTransaction, HeliusCluster } from './solana/helius.js'

// Helius webhooks — monitor wallet addresses for incoming transfers
export {
  createAddressWebhook,
  deleteAddressWebhook,
  listAddressWebhooks,
  updateAddressWebhook,
} from './solana/webhooks.js'
export type { CreateWatchOptions, WebhookInfo } from './solana/webhooks.js'

// ERC-8004 agent identity
export { registerAgent, getAgentIdentity, getAgentsByOwner } from './identity.js'
export type { AgentIdentity, ERC8004Registration, ERC8004Service } from './identity.js'

// x402 payment gating
export { withPaymentExpress, withPaymentHono, withPayment, LOCAL_FACILITATOR } from './serve.js'
export type { PaymentConfig } from './serve.js'

// x402scan discovery
export {
  withDiscoveryExpress,
  buildOpenAPI,
  buildWellKnown,
  openApiNextHandler,
  wellKnownNextHandler,
  withSiwx,
  SIWX_HEADER,
} from './discovery.js'
export type { RouteSpec, PayableRouteSpec, SiwxRouteSpec, FreeRouteSpec, OpenAPIOptions } from './discovery.js'

// Market data — CoinGecko, DeFiLlama, CryptoPanic (no API key required)
export {
  getCoinPrice,
  getTrendingCoins,
  getProtocolTvl,
  getTopProtocols,
  getCryptoNews,
  getOhlcv,
  searchCoins,
  getGlobalStats,
} from './market-data.js'
export type {
  CoinPrice,
  TrendingCoin,
  ProtocolTvl,
  TopProtocol,
  NewsItem,
  OhlcvCandle,
  CoinSearchResult,
  GlobalStats,
} from './market-data.js'

// Bitrefill — gift cards, eSIMs, and mobile top-ups via crypto
export { searchProducts, createInvoice, waitForOrder, getFeaturedProducts } from './bitrefill.js'
export type { BitrefillProduct, BitrefillInvoice, BitrefillOrder, BitrefillConfig } from './bitrefill.js'

// BNB Chain
export { bnb, getBnbTokenPrice, swapBnbTokens, parseUnits } from './bnb.js'
export type { BNBConfig, BNBInstance } from './bnb.js'
export { TOKENS } from './serve.js'

// Solana Agent Kit — wrap sendaifun/solana-agent-kit for 100+ on-chain actions
export {
  createSolanaAgentKit,
  getSolanaAgentKitLangchainTools,
  getSolanaAgentKitVercelTools,
} from './solana/agent-kit.js'
export type { SolanaAgentKitConfig, SolanaAgentKit } from './solana/agent-kit.js'

// Trade thesis extraction, routing, and P&L tracking
export { extractTradingIdeas, routeIdea, calculatePnl } from './trade-router.js'
export type { TradingIdea, Market, TradeRecord } from './trade-router.js'

// Agent activity events
export { agentiEvents, emitEvent, onAgentiEvent } from './events.js'
export type { AgentiEvent } from './events.js'

// Framework adapters
export { agentiPlugin } from './frameworks/eliza.js'
export { agentiLangChainTools } from './frameworks/langchain.js'
export { agentiTools } from './frameworks/vercel-ai.js'

// Price oracle — Pyth + CoinGecko
export { getPrice, usdToTokenAmount, tokenAmountToUsd, PYTH_FEEDS, COINGECKO_IDS } from './solana/price-oracle.js'
export type { PriceResult, PriceOracleOptions } from './solana/price-oracle.js'

// Vault — distribute and withdraw agent payment revenue
export { buildDistributeInstructions, buildWithdrawInstructions, getVaultBalances } from './solana/vault.js'
export type { DistributePaymentsParams, VaultBalances } from './solana/vault.js'

// Payment history & receipt verification
export { getPaymentHistory, verifyPaymentReceipt } from './solana/payments.js'
export type { PaymentRecord } from './solana/payments.js'

// Agent action schemas — Zod schemas for AI tool use
export { AgentActionSchemas } from './solana/agent-actions.js'

// Resilience — circuit breaker, retry with backoff, in-process cache
export { fetchWithRetry, createCircuitBreaker, ResponseCache } from './resilience.js'
export type { RetryOptions, CircuitBreakerOptions } from './resilience.js'

// Anomaly detection — Modified Z-Score, EWMA, volatility, rolling Z-score
export { detectAnomalies, ewma, getVolatility, rollingZScore } from './anomaly.js'
export type { Anomaly, AnomalyType, PricePoint } from './anomaly.js'
