// Simplified factories (recommended)
export {
  createAmpersendTreasurer,
  AmpersendTreasurer,
  type AmpersendTreasurerConfig,
  type SimpleAmpersendTreasurerConfig,
  type FullAmpersendTreasurerConfig,
} from "./ampersend/index.ts"
export { createAmpersendProxy, type SimpleProxyOptions } from "./mcp/proxy/factory.ts"
export { createAmpersendMcpClient, type SimpleClientOptions } from "./mcp/client/factory.ts"
export { createAmpersendHttpClient, type SimpleHttpClientOptions } from "./x402/http/factory.ts"

// Types
export type { X402Treasurer, Authorization, PaymentContext, PaymentStatus } from "./x402/index.ts"
export type { X402Wallet, SmartAccountConfig } from "./x402/index.ts"

// Advanced building blocks
export { AccountWallet, SmartAccountWallet, WalletError } from "./x402/index.ts"
export { initializeProxyServer } from "./mcp/proxy/index.ts"
export { Client } from "./mcp/client/index.ts"
export { wrapWithAmpersend } from "./x402/http/index.ts"
