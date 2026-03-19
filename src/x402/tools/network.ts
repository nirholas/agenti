/**
 * x402 Network Tools
 * @description Network/config tools: list networks, estimate costs, check tx status, get config
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { isX402Configured, SUPPORTED_CHAINS, validateX402Config } from "../config.js"
import type { X402Chain } from "../sdk/types.js"
import type { LegacyConfig, FullConfig } from "./shared.js"
import { getExplorerUrl } from "./shared.js"

export function registerNetworkTools(server: McpServer, config: LegacyConfig, fullConfig: FullConfig): void {

  // Tool 4: Estimate payment cost
  server.tool(
    "x402_estimate",
    "Estimate the payment required for a URL without actually paying. " +
    "Useful to check costs before making a request.",
    {
      url: z.string().url().describe("The URL to check"),
    },
    async ({ url }) => {
      try {
        // Make a HEAD or GET request to get 402 info
        const response = await fetch(url, { method: "HEAD" }).catch(() =>
          fetch(url, { method: "GET" })
        )

        if (response.status === 402) {
          // Parse x402 payment info from headers
          const paymentInfo = {
            price: response.headers.get("x-payment-amount") || response.headers.get("x402-price"),
            token: response.headers.get("x-payment-token") || response.headers.get("x402-token") || "USDs",
            network: response.headers.get("x-payment-network") || response.headers.get("x402-network"),
            recipient: response.headers.get("x-payment-address") || response.headers.get("x402-recipient"),
            description: response.headers.get("x-payment-description"),
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                requiresPayment: true,
                ...paymentInfo,
              }, null, 2),
            }],
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              requiresPayment: false,
              status: response.status,
              message: "This URL does not require x402 payment",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 5: List supported networks
  server.tool(
    "x402_networks",
    "List all supported networks for x402 payments with their CAIP-2 identifiers.",
    {},
    async () => {
      const networks = Object.entries(SUPPORTED_CHAINS).map(([id, info]) => ({
        id,
        ...info,
        isConfigured: id === config.chain,
      }))

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            configuredChain: config.chain,
            supportedNetworks: networks,
            paymentToken: "USDs (Sperax USD) - auto-yield stablecoin",
          }, null, 2),
        }],
      }
    }
  )

  // Tool 13: Payment status check (for pending/recent transactions)
  server.tool(
    "x402_tx_status",
    "Check the status of a payment transaction.",
    {
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).describe("Transaction hash to check"),
    },
    async (params: { txHash: string }) => {
      try {
        // Transaction status check - simplified
        const explorerUrl = `https://arbiscan.io/tx/${params.txHash}`

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              hash: params.txHash,
              explorerUrl,
              message: "Check the explorer link for transaction status.",
              chain: config.chain,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              hash: params.txHash,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 14: Get wallet configuration info
  server.tool(
    "x402_config",
    "Get current x402 payment configuration and status.",
    {},
    async () => {
      const validation = validateX402Config(config)

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            configured: isX402Configured(),
            chain: config.chain,
            chainInfo: SUPPORTED_CHAINS[config.chain],
            maxPaymentPerRequest: `$${config.maxPaymentPerRequest}`,
            gaslessEnabled: config.enableGasless,
            facilitatorUrl: config.facilitatorUrl || "default",
            debug: config.debug,
            validation: {
              valid: validation.valid,
              warnings: validation.errors,
            },
            environmentVariables: {
              X402_PRIVATE_KEY: isX402Configured() ? "✓ set" : "✗ not set",
              X402_CHAIN: config.chain,
              X402_MAX_PAYMENT: config.maxPaymentPerRequest,
              X402_ENABLE_GASLESS: String(config.enableGasless),
            },
          }, null, 2),
        }],
      }
    }
  )

  // Tool 19: x402_estimate_cost - Alias matching user-requested name
  server.tool(
    "x402_estimate_cost",
    "Estimate the payment cost for an x402-protected endpoint without making a payment.",
    {
      url: z.string().url().describe("The URL to check for payment requirements"),
    },
    async ({ url }) => {
      try {
        // Make a HEAD or GET request to get 402 info
        const response = await fetch(url, { method: "HEAD" }).catch(() =>
          fetch(url, { method: "GET" })
        )

        if (response.status === 402) {
          // Parse x402 payment info from headers
          const price = response.headers.get("x-payment-amount") ||
                       response.headers.get("x402-price") ||
                       response.headers.get("www-authenticate")?.match(/price="([\d.]+)/)?.[1]
          const token = response.headers.get("x-payment-token") ||
                       response.headers.get("x402-token") || "USDs"
          const network = response.headers.get("x-payment-network") ||
                         response.headers.get("x402-network") || config.chain
          const recipient = response.headers.get("x-payment-address") ||
                           response.headers.get("x402-recipient")

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                requiresPayment: true,
                cost: {
                  price: price || "unknown",
                  token,
                  network,
                  networkInfo: SUPPORTED_CHAINS[network as X402Chain] || null,
                },
                recipient,
                url,
              }, null, 2),
            }],
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              requiresPayment: false,
              status: response.status,
              message: "This URL does not require x402 payment",
              url,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 20: x402_list_supported_networks - Alias matching user-requested name
  server.tool(
    "x402_list_supported_networks",
    "List all supported networks for x402 payments with their chain IDs, CAIP-2 identifiers, and explorer URLs.",
    {},
    async () => {
      const networks = Object.entries(SUPPORTED_CHAINS).map(([id, info]) => ({
        chainId: id,
        name: info.name,
        caip2: info.caip2,
        paymentToken: "USDs (Sperax USD)",
        explorerUrl: getExplorerUrl(id as X402Chain),
        testnet: info.testnet,
        isConfigured: id === config.chain,
      }))

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            configuredChain: config.chain,
            networks,
            defaultPaymentToken: "USDs - yield-bearing stablecoin (~5% APY)",
          }, null, 2),
        }],
      }
    }
  )
}
