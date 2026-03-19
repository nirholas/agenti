/**
 * Simplified factory for Ampersend MCP client.
 *
 * Provides one-liner setup for common use cases.
 */

import type { ClientOptions as McpClientOptions } from "@modelcontextprotocol/sdk/client/index.js"
import type { Implementation } from "@modelcontextprotocol/sdk/types.js"
import type { Address, Hex } from "viem"

import { createAmpersendTreasurer } from "../../ampersend/treasurer.ts"
import { Client } from "./client.ts"

/** Default Ampersend API URL */
const DEFAULT_API_URL = "https://api.ampersend.ai"

/** Default chain ID (Base Sepolia) */
const DEFAULT_CHAIN_ID = 84532

/**
 * Simplified options for Ampersend MCP client.
 * Only requires client info and smart account credentials.
 */
export interface SimpleClientOptions {
  /** Client implementation info (name and version) */
  clientInfo: Implementation
  /** Optional MCP client options */
  mcpOptions?: McpClientOptions
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
 * Create an MCP client with Ampersend payment support.
 *
 * This is the recommended way to create an MCP client with automatic x402
 * payment handling for most use cases.
 *
 * @example
 * ```typescript
 * import { createAmpersendMcpClient } from "@ampersend_ai/ampersend-sdk"
 * import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
 *
 * const client = createAmpersendMcpClient({
 *   clientInfo: { name: "MyApp", version: "1.0.0" },
 *   smartAccountAddress: "0x...",
 *   sessionKeyPrivateKey: "0x...",
 * })
 *
 * const transport = new StreamableHTTPClientTransport(
 *   new URL("https://api.example.com/mcp")
 * )
 * await client.connect(transport)
 *
 * // Call tools - payments handled automatically
 * const result = await client.callTool({ name: "myTool", arguments: {} })
 * ```
 *
 * @param options - Simplified client configuration
 * @returns Configured MCP client with payment support
 */
export function createAmpersendMcpClient(options: SimpleClientOptions): Client {
  const treasurer = createAmpersendTreasurer({
    smartAccountAddress: options.smartAccountAddress,
    sessionKeyPrivateKey: options.sessionKeyPrivateKey,
    apiUrl: options.apiUrl ?? DEFAULT_API_URL,
    chainId: options.chainId ?? DEFAULT_CHAIN_ID,
  })

  return new Client(options.clientInfo, {
    mcpOptions: options.mcpOptions ?? { capabilities: { tools: {} } },
    treasurer,
  })
}

// Re-export original for advanced use cases
export { Client } from "./client.ts"
