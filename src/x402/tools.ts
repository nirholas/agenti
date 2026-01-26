/**
 * x402 MCP Tools
 * @description MCP tools for x402 payment protocol - lets AI agents make and receive payments
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { X402Client } from "./sdk/client.js"
import { fetchWith402Handling } from "./sdk/http/handler.js"
import { loadX402Config, isX402Configured, SUPPORTED_CHAINS, validateX402Config } from "./config.js"
import type { X402Chain } from "./sdk/types.js"
import Logger from "@/utils/logger.js"

// Singleton client instance
let x402Client: X402Client | null = null

/**
 * Get or create x402 client
 */
function getClient(): X402Client {
  if (!x402Client) {
    const config = loadX402Config()
    if (!config.privateKey) {
      throw new Error("X402_PRIVATE_KEY not configured. Set the environment variable to enable payments.")
    }
    x402Client = new X402Client({
      chain: config.chain,
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
      enableGasless: config.enableGasless,
      facilitatorUrl: config.facilitatorUrl,
      debug: config.debug,
    })
  }
  return x402Client
}

/**
 * Register x402 payment tools with MCP server
 */
export function registerX402Tools(server: McpServer): void {
  const config = loadX402Config()
  const validation = validateX402Config(config)
  
  if (validation.errors.length > 0) {
    validation.errors.forEach(err => Logger.warn(`x402: ${err}`))
  }

  // Tool 1: Make paid HTTP request
  server.tool(
    "x402_pay_request",
    "Make an HTTP request that automatically handles x402 (HTTP 402) payment requirements. " +
    "Use this to access premium APIs that require cryptocurrency payment.",
    {
      url: z.string().url().describe("The URL to request"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method"),
      body: z.string().optional().describe("Request body (for POST/PUT)"),
      headers: z.record(z.string()).optional().describe("Additional headers"),
      maxPayment: z.string().default("1.00").describe("Maximum payment in USD (e.g. '0.50')"),
    },
    async ({ url, method, body, headers, maxPayment }) => {
      try {
        const client = getClient()
        
        // Use the SDK's 402-aware fetch
        const response = await fetchWith402Handling(url, {
          method,
          body,
          headers,
          client,
          maxPayment,
        })

        const data = await response.json().catch(() => response.text())
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              status: response.status,
              data,
              paymentMade: response.headers.get("x-payment-tx") || null,
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

  // Tool 2: Check wallet balance
  server.tool(
    "x402_balance",
    "Check your x402 payment wallet balance. Shows USDs (Sperax USD) and native token balance.",
    {
      chain: z.enum(["arbitrum", "arbitrum-sepolia", "base", "ethereum", "polygon", "optimism", "bsc"])
        .optional()
        .describe("Chain to check balance on (defaults to configured chain)"),
    },
    async ({ chain }) => {
      try {
        const client = getClient()
        const targetChain = (chain || config.chain) as X402Chain
        
        const balance = await client.getBalance()
        const address = await client.getAddress()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              chain: targetChain,
              chainInfo: SUPPORTED_CHAINS[targetChain],
              balances: {
                usds: balance.usds,
                native: balance.native,
              },
              yieldInfo: balance.pendingYield ? {
                pending: balance.pendingYield,
                apy: balance.apy,
              } : null,
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
              hint: !isX402Configured() ? "Set X402_PRIVATE_KEY to enable wallet features" : undefined,
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 3: Send direct payment
  server.tool(
    "x402_send",
    "Send a direct cryptocurrency payment to an address. Supports USDs (Sperax USD) and native tokens.",
    {
      to: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient address (0x...)"),
      amount: z.string().describe("Amount to send (e.g. '10.00')"),
      token: z.enum(["USDs", "USDC", "native"]).default("USDs").describe("Token to send"),
      memo: z.string().optional().describe("Optional memo/note for the payment"),
    },
    async ({ to, amount, token, memo }) => {
      try {
        const client = getClient()
        
        // Validate amount against max
        const maxPayment = parseFloat(config.maxPaymentPerRequest)
        const sendAmount = parseFloat(amount)
        if (sendAmount > maxPayment) {
          throw new Error(`Amount ${amount} exceeds maximum allowed payment of ${maxPayment}`)
        }
        
        const result = await client.pay(to as `0x${string}`, amount, token as any)
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              transaction: {
                hash: result.hash,
                from: result.from,
                to: result.to,
                amount: result.amount,
                token: result.token,
                chain: config.chain,
                explorerUrl: `${SUPPORTED_CHAINS[config.chain]?.caip2 ? 
                  `https://arbiscan.io/tx/${result.hash}` : result.hash}`,
              },
              memo,
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

  // Tool 6: Get wallet address
  server.tool(
    "x402_address",
    "Get your configured x402 payment wallet address.",
    {},
    async () => {
      try {
        const client = getClient()
        const address = await client.getAddress()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              chain: config.chain,
              chainInfo: SUPPORTED_CHAINS[config.chain],
              fundingInstructions: `Send USDs or ${config.chain === 'arbitrum' ? 'ETH' : 'native token'} to this address to fund your AI agent wallet.`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              configured: false,
              error: "Wallet not configured",
              hint: "Set X402_PRIVATE_KEY environment variable to enable payments",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 7: Get yield info (USDs specific)
  server.tool(
    "x402_yield",
    "Get yield information for your USDs holdings. USDs automatically earns ~5% APY.",
    {},
    async () => {
      try {
        const client = getClient()
        const yieldInfo = await client.getYield()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              balance: yieldInfo.balance,
              pendingYield: yieldInfo.pending,
              apy: yieldInfo.apy,
              totalEarned: yieldInfo.totalEarned,
              lastUpdate: yieldInfo.lastUpdate,
              projectedMonthly: yieldInfo.projectedMonthly,
              note: "USDs automatically rebases - your balance grows without claiming!",
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

  Logger.info(`x402: Registered 7 payment tools (chain: ${config.chain}, configured: ${isX402Configured()})`)
}
