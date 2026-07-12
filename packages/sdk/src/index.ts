export { agenti } from './agenti.js'
export type { AgentiConfig, AgentiInstance } from './agenti.js'
export type { PayOptions } from './pay.js'
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
  getTokenPrice, getGraduationProgress, estimateFee, createFallbackConnection, getPriorityFee,
} from './solana/index.js'
export type { BondingCurveState, RpcEndpoint, PriorityLevel } from './solana/index.js'

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

// GMGN token data — trending tokens, token stats, new pairs
export { getGmgnTrending, getGmgnTokenStat, getGmgnNewPairs } from './solana/index.js'
export type { GmgnToken, GmgnTokenStat, GmgnNewPair } from './solana/index.js'

// Jupiter v6 — quote, swap
export { getJupiterQuote, executeJupiterSwap, jupiterSwap } from './solana/index.js'
export type { JupiterQuote, JupiterQuoteParams, JupiterSwapResult } from './solana/index.js'

// Hyperliquid perpetuals — read + signed order placement
export { HyperliquidClient } from './hyperliquid.js'
export type {
  HlMeta, HlUniverse, HlAssetCtx, HlL2Book, HlL2Level,
  HlPosition, HlAccountState, HlOrderResult, HlOrderStatus,
  HlFundingInfo, HlOrderParams,
} from './hyperliquid.js'

// Execution algorithms — TWAP, VWAP, Almgren-Chriss optimal execution
export {
  executeTwap,
  previewTwap,
} from './execution/twap.js'
export type { TwapConfig, TwapSlice, TwapResult, TwapCallbacks } from './execution/twap.js'

export {
  executeVwap,
  flatVolumeProfile,
  buildVolumeProfile,
  computeRealizedVwap,
  annotateMarketVwap,
} from './execution/vwap.js'
export type { VwapConfig, VwapSlice, VwapResult, VolumeBucket, VwapCallbacks } from './execution/vwap.js'

export {
  computeACSchedule,
  calibrateRiskAversion,
  formatACSchedule,
} from './execution/almgren-chriss.js'
export type { ACParams, ACPeriod, ACSchedule } from './execution/almgren-chriss.js'

// Jupiter Limit Orders — GTC limit buy/sell, cancel, query
export {
  createLimitOrder,
  cancelLimitOrders,
  getOpenLimitOrders,
  getLimitOrderHistory,
  limitBuy,
  limitSell,
} from './solana/limit-orders.js'
export type { LimitOrderParams, LimitOrderResult, OpenLimitOrder, CancelOrdersResult } from './solana/limit-orders.js'

// Market microstructure — L2 order book, VPIN, spread metrics, depth analysis
export {
  getOrderBook,
  computeSpreadMetrics,
  classifyTrade,
  classifyPriceSeries,
  computeVPIN,
  inferBucketSize,
  liquidityWithinBand,
  estimateFillPrice,
  watchOrderBook,
} from './solana/orderbook.js'
export type {
  L2Level,
  OrderBook,
  TradeTick,
  VPINBucket,
  VPINResult,
  SpreadMetrics,
} from './solana/orderbook.js'
