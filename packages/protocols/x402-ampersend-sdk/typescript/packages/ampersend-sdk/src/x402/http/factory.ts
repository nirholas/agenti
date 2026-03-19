/**
 * Simplified factory for Ampersend HTTP client.
 *
 * Provides one-liner setup for wrapping x402 HTTP clients with Ampersend payment support.
 */

import { x402Client } from "@x402/core/client"
import type { Address, Hex } from "viem"
import { EvmNetworkToChainId, type Network } from "x402/types"

import { createAmpersendTreasurer } from "../../ampersend/treasurer.ts"
import { wrapWithAmpersend } from "./adapter.ts"

/** Default Ampersend API URL */
const DEFAULT_API_URL = "https://api.ampersend.ai"

/** Default network (Base mainnet for production) */
const DEFAULT_NETWORK: Network = "base"

/**
 * Simplified options for Ampersend HTTP client wrapper.
 */
export interface SimpleHttpClientOptions {
  /** Smart account address */
  smartAccountAddress: Address
  /** Session key private key for signing */
  sessionKeyPrivateKey: Hex
  /** The x402Client instance to wrap (created automatically if not provided) */
  client?: x402Client
  /** Ampersend API URL (defaults to production) */
  apiUrl?: string
  /** Network to use (defaults to "base"). Chain ID is inferred from this. */
  network?: Network
}

/**
 * Create an x402 HTTP client with Ampersend payment support.
 *
 * This integrates ampersend-sdk with Coinbase's x402 SDK, allowing you to use
 * sophisticated payment authorization logic with the standard x402 HTTP client ecosystem.
 *
 * @example
 * ```typescript
 * import { wrapFetchWithPayment } from "@x402/fetch"
 * import { createAmpersendHttpClient } from "@ampersend_ai/ampersend-sdk"
 *
 * const client = createAmpersendHttpClient({
 *   smartAccountAddress: "0x...",
 *   sessionKeyPrivateKey: "0x...",
 * })
 *
 * const fetchWithPay = wrapFetchWithPayment(fetch, client)
 * const response = await fetchWithPay("https://paid-api.com/endpoint")
 * ```
 *
 * @param options - Simplified HTTP client configuration
 * @returns The configured x402Client instance
 */
export function createAmpersendHttpClient(options: SimpleHttpClientOptions): x402Client {
  const network = options.network ?? DEFAULT_NETWORK
  const chainId = EvmNetworkToChainId.get(network)

  if (chainId === undefined) {
    throw new Error(`Unknown network: ${network}`)
  }

  const treasurer = createAmpersendTreasurer({
    smartAccountAddress: options.smartAccountAddress,
    sessionKeyPrivateKey: options.sessionKeyPrivateKey,
    apiUrl: options.apiUrl ?? DEFAULT_API_URL,
    chainId,
  })

  const client = options.client ?? new x402Client()
  return wrapWithAmpersend(client, treasurer, [network])
}

// Re-export original for advanced use cases
export { wrapWithAmpersend } from "./adapter.ts"
