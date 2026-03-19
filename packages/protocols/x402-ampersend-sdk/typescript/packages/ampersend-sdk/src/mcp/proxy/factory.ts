/**
 * Simplified factory for Ampersend MCP proxy.
 *
 * Provides one-liner setup for common use cases.
 */

import type { Address, Hex } from "viem"

import { createAmpersendTreasurer } from "../../ampersend/treasurer.ts"
import { initializeProxyServer as initializeProxyServerInternal } from "./server/index.ts"
import type { ProxyServer } from "./server/server.ts"

/** Default Ampersend API URL */
const DEFAULT_API_URL = "https://api.ampersend.ai"

/** Default chain ID (Base Sepolia) */
const DEFAULT_CHAIN_ID = 84532

/**
 * Simplified options for Ampersend MCP proxy.
 * Only requires smart account credentials and port.
 */
export interface SimpleProxyOptions {
  /** Port to run the proxy server on */
  port: number
  /** Smart account address */
  smartAccountAddress: Address
  /** Session key private key for signing */
  sessionKeyPrivateKey: Hex
  /** Ampersend API URL (defaults to production) */
  apiUrl?: string
  /** Chain ID (defaults to Base Sepolia 84532) */
  chainId?: number
}

/**
 * Initialize an MCP proxy with minimal configuration.
 *
 * This is the recommended way to start an Ampersend MCP proxy for most use cases.
 * It automatically creates and configures the treasurer with your smart account.
 *
 * @example
 * ```typescript
 * import { createAmpersendProxy } from "@ampersend_ai/ampersend-sdk"
 *
 * const { server } = await createAmpersendProxy({
 *   port: 3000,
 *   smartAccountAddress: "0x...",
 *   sessionKeyPrivateKey: "0x...",
 * })
 *
 * // Proxy is now running at http://localhost:3000
 * // Connect with: http://localhost:3000/mcp?target=<TARGET_URL>
 * ```
 *
 * @param options - Simplified proxy configuration
 * @returns Promise resolving to the proxy server instance
 */
export async function createAmpersendProxy(options: SimpleProxyOptions): Promise<{ server: ProxyServer }> {
  const treasurer = createAmpersendTreasurer({
    smartAccountAddress: options.smartAccountAddress,
    sessionKeyPrivateKey: options.sessionKeyPrivateKey,
    apiUrl: options.apiUrl ?? DEFAULT_API_URL,
    chainId: options.chainId ?? DEFAULT_CHAIN_ID,
  })

  return initializeProxyServerInternal({
    transport: { type: "http", port: options.port },
    treasurer,
  })
}

// Re-export original for advanced use cases
export { initializeProxyServer } from "./server/index.ts"
