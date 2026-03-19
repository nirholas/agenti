// Proxy server
export { initializeProxyServer } from "./server/index.ts"

// Proxy types
export type {
  EOAWalletConfig,
  HTTPTransportOptions,
  WalletConfig,
  ProxyContext,
  ProxyServerOptions,
  SmartAccountWalletConfig,
  TransportConfig,
} from "./types.ts"
export { ProxyError } from "./types.ts"

// Proxy utilities
export { createWalletConfig, createTransportConfig } from "./cli.ts"
export { parseTargetFromQuery } from "./utils.ts"
export { createEnvSchema, parseEnvConfig } from "./env.ts"
export type { ProxyEnvConfig } from "./env.ts"
