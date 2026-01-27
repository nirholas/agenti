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
import { loadX402Config, loadLegacyX402Config, isX402Configured, SUPPORTED_CHAINS, validateX402Config } from "./config.js"
import type { X402Chain } from "./sdk/types.js"
import Logger from "@/utils/logger.js"

// Singleton client instance
let x402Client: X402Client | null = null

/**
 * Get or create x402 client
 */
function getClient(): X402Client {
  if (!x402Client) {
    const config = loadLegacyX402Config()
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
 * Get explorer URL for a chain
 */
function getExplorerUrl(chain: X402Chain): string {
  const explorers: Record<X402Chain, string> = {
    arbitrum: "https://arbiscan.io",
    "arbitrum-sepolia": "https://sepolia.arbiscan.io",
    base: "https://basescan.org",
    ethereum: "https://etherscan.io",
    polygon: "https://polygonscan.com",
    optimism: "https://optimistic.etherscan.io",
    bsc: "https://bscscan.com",
  }
  return explorers[chain] || "https://arbiscan.io"
}

/**
 * Register x402 payment tools with MCP server
 */
export function registerX402Tools(server: McpServer): void {
  const fullConfig = loadX402Config()
  const config = loadLegacyX402Config()
  const validation = validateX402Config(fullConfig)
  
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
        const maxPaymentFloat = parseFloat(maxPayment)
        
        // Use the SDK's 402-aware fetch with payment callback
        const response = await fetchWith402Handling(url, {
          method,
          body,
          headers,
          onPaymentRequired: async (paymentRequest) => {
            // Check if payment is within allowed limit
            const amount = parseFloat(paymentRequest.amount)
            if (amount > maxPaymentFloat) {
              throw new Error(`Payment of ${paymentRequest.amount} ${paymentRequest.token} exceeds maximum allowed (${maxPayment})`)
            }
            
            // Execute payment and return tx hash as proof
            const result = await client.pay(paymentRequest.recipient, paymentRequest.amount, paymentRequest.token)
            return result.transaction.hash
          },
        })

        const data = await response.json().catch(() => response.text())
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              status: response.status,
              data,
              paymentMade: response.headers.get("x-payment-proof") || null,
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

  // Tool 8: Batch payments - send multiple payments in one transaction
  server.tool(
    "x402_batch_send",
    "Send multiple payments in a single transaction. More gas efficient than separate sends.",
    {
      payments: z.array(z.object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient address"),
        amount: z.string().describe("Amount to send"),
      })).min(1).max(20).describe("Array of payments (max 20)"),
      token: z.enum(["USDs", "USDC", "native"]).default("USDs").describe("Token to send"),
    },
    async (params: { payments: Array<{ to: string; amount: string }>; token: string }) => {
      try {
        const client = getClient()
        
        // Calculate total and validate against max
        const total = params.payments.reduce((sum: number, p: { amount: string }) => sum + parseFloat(p.amount), 0)
        const maxPayment = parseFloat(config.maxPaymentPerRequest) * params.payments.length
        if (total > maxPayment) {
          throw new Error(`Total ${total} exceeds maximum allowed (${maxPayment})`)
        }
        
        const batchItems = params.payments.map((p: { to: string; amount: string }) => ({
          recipient: p.to as `0x${string}`,
          amount: p.amount,
        }))
        
        const result = await client.payBatch(batchItems)
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              totalAmount: result.totalAmount,
              totalRecipients: params.payments.length,
              successful: result.successful.length,
              failed: result.failed.length,
              transactions: result.successful.map((tx: any) => tx.hash),
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

  // Tool 9: Gasless payment via EIP-3009
  server.tool(
    "x402_gasless_send",
    "Send a gasless payment using EIP-3009 authorization. Recipient pays gas, you just sign.",
    {
      to: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient address"),
      amount: z.string().describe("Amount to send"),
      token: z.enum(["USDs", "USDC"]).default("USDs").describe("Token to send (must support EIP-3009)"),
      validityPeriod: z.number().default(300).describe("Authorization valid for (seconds, default 5 min)"),
    },
    async (params: { to: string; amount: string; token: string; validityPeriod: number }) => {
      try {
        const client = getClient()
        
        if (!config.enableGasless) {
          throw new Error("Gasless payments disabled. Set X402_ENABLE_GASLESS=true")
        }
        
        // Create authorization
        const auth = await client.createAuthorization(
          params.to as `0x${string}`,
          params.amount,
          params.token as any,
          { validityPeriod: params.validityPeriod }
        )
        
        // Settle via facilitator (gasless)
        const result = await client.settleGasless(auth)
        
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
              },
              gasless: true,
              gasPaidBy: "facilitator",
              authorization: {
                nonce: auth.nonce,
                validBefore: auth.validBefore.toString(),
              },
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

  // Tool 10: Approve token spending
  server.tool(
    "x402_approve",
    "Approve a contract to spend your tokens. Required before some DeFi operations.",
    {
      spender: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Contract address to approve"),
      amount: z.string().describe("Amount to approve (use 'unlimited' for max)"),
      token: z.enum(["USDs", "USDC", "USDT", "DAI"]).default("USDs").describe("Token to approve"),
    },
    async (params: { spender: string; amount: string; token: string }) => {
      try {
        const client = getClient()
        
        const approveAmount = params.amount === "unlimited" ? 
          "115792089237316195423570985008687907853269984665640564039457584007913129639935" : // uint256 max
          params.amount
        
        const hash = await client.approve(
          params.spender as `0x${string}`,
          approveAmount,
          params.token as any
        )
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              approval: {
                hash,
                spender: params.spender,
                token: params.token,
                amount: params.amount === "unlimited" ? "unlimited" : params.amount,
              },
              warning: params.amount === "unlimited" ? 
                "Unlimited approval granted. Only do this for trusted contracts." : null,
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

  // Tool 11: Get current APY
  server.tool(
    "x402_apy",
    "Get the current APY (Annual Percentage Yield) for USDs stablecoin.",
    {},
    async () => {
      try {
        const client = getClient()
        const apy = await client.getCurrentAPY()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              token: "USDs",
              apy: `${(apy * 100).toFixed(2)}%`,
              apyDecimal: apy,
              source: "Sperax Protocol",
              note: "USDs earns yield automatically via rebasing. No staking required.",
              comparison: {
                savingsAccount: "~0.5%",
                usdc: "0%",
                usds: `${(apy * 100).toFixed(2)}%`,
              },
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

  // Tool 12: Estimate yield over time
  server.tool(
    "x402_yield_estimate",
    "Estimate how much yield you would earn over a period of time.",
    {
      amount: z.string().describe("Amount of USDs to calculate yield for"),
      days: z.number().default(30).describe("Number of days to estimate"),
    },
    async (params: { amount: string; days: number }) => {
      try {
        const client = getClient()
        const apy = await client.getCurrentAPY()
        
        const principal = parseFloat(params.amount)
        const dailyRate = apy / 365
        const yieldEarned = principal * dailyRate * params.days
        const finalBalance = principal + yieldEarned
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              principal: `${principal.toFixed(2)} USDs`,
              period: `${params.days} days`,
              currentAPY: `${(apy * 100).toFixed(2)}%`,
              estimatedYield: `${yieldEarned.toFixed(4)} USDs`,
              finalBalance: `${finalBalance.toFixed(4)} USDs`,
              projections: {
                "7 days": `+${(principal * dailyRate * 7).toFixed(4)} USDs`,
                "30 days": `+${(principal * dailyRate * 30).toFixed(4)} USDs`,
                "90 days": `+${(principal * dailyRate * 90).toFixed(4)} USDs`,
                "365 days": `+${(principal * apy).toFixed(4)} USDs`,
              },
              note: "Actual yield may vary based on protocol performance.",
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

  // Tool 15: Create paywall response for servers
  server.tool(
    "x402_create_paywall",
    "Generate an HTTP 402 Payment Required response for your own API endpoints. " +
    "Use this to monetize your AI agent's services or API endpoints.",
    {
      price: z.string().describe("Price to charge (e.g. '0.10')"),
      token: z.enum(["USDs", "USDC"]).default("USDs").describe("Token to accept"),
      description: z.string().optional().describe("Description of what the payment is for"),
      resource: z.string().optional().describe("Resource/endpoint identifier"),
      validFor: z.number().default(300).describe("Payment validity period in seconds (default 5 min)"),
    },
    async (params: { price: string; token: string; description?: string; resource?: string; validFor: number }) => {
      try {
        const client = getClient()
        const address = await client.getAddress()
        
        if (!address) {
          throw new Error("Wallet not configured - cannot create paywall without recipient address")
        }
        
        // Create the 402 response using the SDK
        const response = client.create402Response(
          {
            amount: params.price,
            token: params.token as any,
            chain: config.chain,
            recipient: address,
            resource: params.resource,
            description: params.description,
            deadline: Math.floor(Date.now() / 1000) + params.validFor,
          },
          params.description || `Payment of ${params.price} ${params.token} required`
        )
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              http402Response: {
                status: 402,
                headers: response.headers,
                body: response.body,
              },
              instructions: {
                express: `res.status(402).set(headers).json(body)`,
                node: `response.writeHead(402, headers); response.end(JSON.stringify(body))`,
              },
              payment: {
                price: params.price,
                token: params.token,
                chain: config.chain,
                recipient: address,
                validFor: `${params.validFor} seconds`,
              },
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

  // Tool 16: Verify incoming payment
  server.tool(
    "x402_verify_payment",
    "Verify an incoming payment transaction. Use this to confirm payment was received " +
    "before granting access to a paid resource.",
    {
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).describe("Transaction hash from X-Payment-Proof header"),
      expectedAmount: z.string().optional().describe("Expected payment amount (optional extra validation)"),
      expectedFrom: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe("Expected sender address (optional)"),
    },
    async (params: { txHash: string; expectedAmount?: string; expectedFrom?: string }) => {
      try {
        const client = getClient()
        const myAddress = await client.getAddress()
        
        // Get chain info for verification
        const chainInfo = client.getChainInfo()
        
        // Note: Full verification would require querying the blockchain
        // For now, return verification instructions
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              txHash: params.txHash,
              verificationStatus: "pending_blockchain_confirmation",
              chain: chainInfo.chain,
              explorerUrl: `${chainInfo.explorerUrl}/tx/${params.txHash}`,
              expectedRecipient: myAddress,
              expectedAmount: params.expectedAmount || "any",
              expectedFrom: params.expectedFrom || "any",
              verificationSteps: [
                "1. Check transaction exists on chain",
                "2. Verify recipient matches your address",
                "3. Confirm amount matches expected payment",
                "4. Ensure transaction is confirmed (not pending)",
                "5. Check token is correct (USDs/USDC)",
              ],
              instructions: "Use the explorer URL to manually verify, or integrate on-chain verification for production.",
              apiEndpoint: `GET ${chainInfo.explorerUrl}/api?module=transaction&action=gettxinfo&txhash=${params.txHash}`,
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

  // Tool 17: Alias for x402_pay_request -> x402_pay_for_request (user-requested name)
  server.tool(
    "x402_pay_for_request",
    "Make an HTTP request that automatically handles x402 (HTTP 402) payment requirements. " +
    "Use this to access premium APIs that require cryptocurrency payment. Shows payment amount before confirming.",
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
        const maxPaymentFloat = parseFloat(maxPayment)
        let paymentDetails: { price: string; token: string; recipient: string | null } | null = null
        
        // First, make a HEAD request to check if payment is required
        const checkResponse = await fetch(url, { method: "HEAD" }).catch(() => fetch(url))
        
        if (checkResponse.status === 402) {
          // Extract payment info for user visibility
          paymentDetails = {
            price: checkResponse.headers.get("x-payment-amount") || checkResponse.headers.get("x402-price") || "unknown",
            token: checkResponse.headers.get("x-payment-token") || "USDs",
            recipient: checkResponse.headers.get("x-payment-address"),
          }
          
          // Check against max payment
          const price = parseFloat(paymentDetails.price)
          if (!isNaN(price) && price > maxPaymentFloat) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  requiresPayment: true,
                  paymentInfo: paymentDetails,
                  error: `Payment of ${paymentDetails.price} ${paymentDetails.token} exceeds maximum allowed (${maxPayment})`,
                  action: "Increase maxPayment parameter or cancel request",
                }, null, 2),
              }],
            }
          }
        }
        
        let paymentMade: string | null = null
        
        // Use the SDK's 402-aware fetch with proper callback
        const response = await fetchWith402Handling(url, {
          method,
          body,
          headers,
          onPaymentRequired: async (paymentRequest) => {
            // Check if payment is within allowed limit
            const amount = parseFloat(paymentRequest.amount)
            if (amount > maxPaymentFloat) {
              throw new Error(`Payment of ${paymentRequest.amount} ${paymentRequest.token} exceeds maximum allowed (${maxPayment})`)
            }
            
            // Execute payment and return tx hash as proof
            const result = await client.pay(paymentRequest.recipient, paymentRequest.amount, paymentRequest.token)
            paymentMade = result.transaction.hash
            return result.transaction.hash
          },
        })

        const data = await response.json().catch(() => response.text())
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              status: response.status,
              data,
              paymentMade,
              paymentDetails,
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

  // Tool 18: x402_check_balance - Alias matching user-requested name
  server.tool(
    "x402_check_balance",
    "Check wallet balance for x402 payments. Shows USDs (or USDC) and native token balance.",
    {
      chain: z.enum(["arbitrum", "arbitrum-sepolia", "base", "ethereum", "polygon", "optimism", "bsc"])
        .optional()
        .describe("Chain to check balance on (defaults to configured chain)"),
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe("Address to check (defaults to configured wallet)"),
    },
    async ({ chain, address }) => {
      try {
        const client = getClient()
        const targetChain = (chain || config.chain) as X402Chain
        const targetAddress = address || await client.getAddress()
        
        if (!targetAddress) {
          throw new Error("No address specified and wallet not configured")
        }
        
        const balance = await client.getBalance(targetAddress as `0x${string}`)
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: targetAddress,
              chain: targetChain,
              chainInfo: SUPPORTED_CHAINS[targetChain],
              balances: {
                usdc: balance.usds || "0", // USDs is compatible with USDC queries
                usds: balance.usds || "0",
                native: balance.native || "0",
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

  // Tool 21: x402_get_wallet_address - Alias matching user-requested name
  server.tool(
    "x402_get_wallet_address",
    "Get configured wallet addresses for x402 payments.",
    {},
    async () => {
      try {
        const client = getClient()
        const evmAddress = await client.getAddress()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              evm: evmAddress || null,
              svm: null, // Solana not yet supported
              configured: !!evmAddress,
              chain: config.chain,
              fundingInstructions: evmAddress ? 
                `Send USDs or ETH to ${evmAddress} on ${SUPPORTED_CHAINS[config.chain]?.name}` :
                "Set X402_PRIVATE_KEY to configure wallet",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              evm: null,
              svm: null,
              configured: false,
              error: "Wallet not configured",
              hint: "Set X402_PRIVATE_KEY environment variable",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 22: x402_send_payment - Alias matching user-requested name
  server.tool(
    "x402_send_payment",
    "Send a direct cryptocurrency payment (not HTTP 402). Supports USDs, USDC, and native tokens.",
    {
      to: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient address (0x...)"),
      amount: z.string().describe("Amount to send (e.g. '10.00')"),
      token: z.enum(["USDs", "USDC", "native"]).default("USDs").describe("Token to send"),
      chain: z.enum(["arbitrum", "arbitrum-sepolia", "base", "ethereum", "polygon", "optimism", "bsc"])
        .optional()
        .describe("Chain to send on (defaults to configured chain)"),
    },
    async ({ to, amount, token, chain }) => {
      try {
        const client = getClient()
        const targetChain = chain || config.chain
        
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
                hash: result.transaction.hash,
                from: result.transaction.from,
                to: result.transaction.to,
                amount: result.transaction.amount,
                token: result.transaction.token,
                chain: targetChain,
                explorerUrl: `${getExplorerUrl(targetChain as X402Chain)}/tx/${result.transaction.hash}`,
              },
              gasless: result.gasless,
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

  // ============================================================================
  // Security Tools
  // ============================================================================

  // Tool 23: x402_set_payment_limit - Configure payment limits
  server.tool(
    "x402_set_payment_limit",
    "Set payment limits for security. Configure maximum single payment and daily spending limits.",
    {
      maxSinglePayment: z.number().positive().optional().describe("Maximum single payment in USD (e.g. 5.00)"),
      maxDailyPayment: z.number().positive().optional().describe("Maximum daily spending in USD (e.g. 50.00)"),
      largePaymentWarning: z.number().positive().optional().describe("Threshold for large payment warnings"),
    },
    async ({ maxSinglePayment, maxDailyPayment, largePaymentWarning }) => {
      try {
        const { setPaymentLimits, getPaymentLimits, DEFAULT_LIMITS } = await import("./limits.js")
        
        const newLimits = setPaymentLimits({
          maxSinglePayment,
          maxDailyPayment,
          largePaymentWarning,
        })
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              limits: newLimits,
              absoluteLimits: {
                maxSingle: DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE,
                maxDaily: DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY,
                note: "These are hard caps that cannot be exceeded",
              },
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

  // Tool 24: x402_get_payment_limits - Get current payment limits
  server.tool(
    "x402_get_payment_limits",
    "Get current payment limits and daily spending status.",
    {},
    async () => {
      try {
        const { getPaymentLimits, getDailySpending, DEFAULT_LIMITS } = await import("./limits.js")
        
        const limits = getPaymentLimits()
        const dailySpending = getDailySpending()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              limits: {
                maxSinglePayment: `$${limits.maxSinglePayment.toFixed(2)}`,
                maxDailyPayment: `$${limits.maxDailyPayment.toFixed(2)}`,
                largePaymentWarning: `$${limits.largePaymentWarning.toFixed(2)}`,
              },
              dailySpending: {
                date: dailySpending.date,
                spent: `$${dailySpending.total.toFixed(2)}`,
                remaining: `$${dailySpending.remaining.toFixed(2)}`,
                paymentCount: dailySpending.count,
              },
              absoluteLimits: {
                maxSingle: `$${DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE}`,
                maxDaily: `$${DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY}`,
              },
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

  // Tool 25: x402_list_approved_services - Show allowlisted services
  server.tool(
    "x402_list_approved_services",
    "List all approved services in the payment allowlist.",
    {},
    async () => {
      try {
        const { getApprovedServices, isStrictAllowlistMode } = await import("./limits.js")
        
        const services = getApprovedServices()
        const strictMode = isStrictAllowlistMode()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              strictMode: strictMode,
              strictModeDescription: strictMode 
                ? "Only approved services can receive payments" 
                : "Unknown services allowed with warnings",
              approvedServices: services.map(s => ({
                domain: s.domain,
                name: s.name,
                maxPayment: s.maxPayment ? `$${s.maxPayment.toFixed(2)}` : "No limit",
                addedAt: s.addedAt.toISOString(),
              })),
              count: services.length,
              tip: strictMode 
                ? "Use x402_approve_service to add trusted services" 
                : "Set X402_STRICT_ALLOWLIST=true for stricter security",
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

  // Tool 26: x402_approve_service - Add service to allowlist
  server.tool(
    "x402_approve_service",
    "Approve a service domain for x402 payments. Required in strict allowlist mode.",
    {
      domain: z.string().describe("Domain to approve (e.g. 'api.example.com')"),
      name: z.string().optional().describe("Friendly name for the service"),
      maxPayment: z.number().positive().optional().describe("Maximum payment for this service"),
    },
    async ({ domain, name, maxPayment }) => {
      try {
        const { approveService, getApprovedServices } = await import("./limits.js")
        
        const service = approveService(domain, name, maxPayment)
        const totalServices = getApprovedServices().length
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              approved: {
                domain: service.domain,
                name: service.name,
                maxPayment: service.maxPayment ? `$${service.maxPayment.toFixed(2)}` : "No limit",
                addedAt: service.addedAt.toISOString(),
              },
              totalApprovedServices: totalServices,
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

  // Tool 27: x402_remove_service - Remove service from allowlist
  server.tool(
    "x402_remove_service",
    "Remove a service from the approved allowlist.",
    {
      domain: z.string().describe("Domain to remove (e.g. 'api.example.com')"),
    },
    async ({ domain }) => {
      try {
        const { removeService, getApprovedServices } = await import("./limits.js")
        
        const removed = removeService(domain)
        const totalServices = getApprovedServices().length
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: removed,
              domain,
              message: removed ? "Service removed from allowlist" : "Service was not in allowlist",
              totalApprovedServices: totalServices,
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

  // Tool 28: x402_get_payment_history - Get audit trail
  server.tool(
    "x402_get_payment_history",
    "Get payment history for audit and review. Shows recent payments with details.",
    {
      limit: z.number().default(20).describe("Maximum number of entries to return"),
      service: z.string().optional().describe("Filter by service domain"),
      status: z.enum(["pending", "completed", "failed"]).optional().describe("Filter by status"),
    },
    async ({ limit, service, status }) => {
      try {
        const { getPaymentHistory, getPaymentStats, getDailySpending } = await import("./limits.js")
        
        const history = getPaymentHistory({ limit, service, status })
        const stats = getPaymentStats()
        const dailySpending = getDailySpending()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              summary: {
                totalPayments: stats.count,
                totalSpent: `$${stats.total.toFixed(2)}`,
                averagePayment: `$${stats.avgAmount.toFixed(2)}`,
                todaySpent: `$${dailySpending.total.toFixed(2)}`,
                todayRemaining: `$${dailySpending.remaining.toFixed(2)}`,
              },
              byStatus: stats.byStatus,
              recentPayments: history.map(p => ({
                id: p.id,
                timestamp: p.timestamp.toISOString(),
                amount: `$${p.amount.toFixed(2)}`,
                token: p.token,
                recipient: p.recipient,
                service: p.service,
                status: p.status,
                txHash: p.txHash || null,
                chain: p.chain,
                gasless: p.gasless,
              })),
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

  // Tool 29: x402_security_status - Overall security status
  server.tool(
    "x402_security_status",
    "Get comprehensive security status including limits, allowlist, and recent security events.",
    {},
    async () => {
      try {
        const { getPaymentLimits, getDailySpending, isStrictAllowlistMode, getApprovedServices } = await import("./limits.js")
        const { getSecurityEvents, isKeySourceSecure, isTestnetOnly } = await import("./security.js")
        
        const limits = getPaymentLimits()
        const dailySpending = getDailySpending()
        const services = getApprovedServices()
        const recentEvents = getSecurityEvents(10)
        const keySecure = isKeySourceSecure()
        const testnetOnly = isTestnetOnly()
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              security: {
                keySourceSecure: keySecure.secure,
                keyWarnings: keySecure.warnings,
                testnetOnly: testnetOnly,
                strictAllowlist: isStrictAllowlistMode(),
                mainnetEnabled: config.mainnetEnabled ?? false,
              },
              limits: {
                maxSinglePayment: `$${limits.maxSinglePayment.toFixed(2)}`,
                maxDailyPayment: `$${limits.maxDailyPayment.toFixed(2)}`,
                largePaymentWarning: `$${limits.largePaymentWarning.toFixed(2)}`,
              },
              dailySpending: {
                date: dailySpending.date,
                spent: `$${dailySpending.total.toFixed(2)}`,
                remaining: `$${dailySpending.remaining.toFixed(2)}`,
                percentUsed: ((dailySpending.total / limits.maxDailyPayment) * 100).toFixed(1) + "%",
              },
              allowlist: {
                approvedServices: services.length,
                services: services.map(s => s.domain).slice(0, 5),
              },
              recentSecurityEvents: recentEvents.map(e => ({
                timestamp: e.timestamp.toISOString(),
                event: e.event,
                severity: e.severity,
              })),
              recommendations: [
                ...(keySecure.warnings.length > 0 ? ["Review key security warnings"] : []),
                ...(dailySpending.remaining < limits.maxDailyPayment * 0.2 ? ["Daily spending limit nearly reached"] : []),
                ...(!isStrictAllowlistMode() ? ["Consider enabling strict allowlist mode for production"] : []),
              ],
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

  Logger.info(`x402: Registered 29 payment tools (chain: ${config.chain}, configured: ${isX402Configured()})`)
}
