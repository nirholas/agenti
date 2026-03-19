/**
 * x402 Payment Tools
 * @description Core payment tools: pay requests, send payments, batch send, gasless send
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { fetchWith402Handling } from "../sdk/http/handler.js"
import { SUPPORTED_CHAINS } from "../config.js"
import type { LegacyConfig, FullConfig } from "./shared.js"
import { getClient, getExplorerUrl } from "./shared.js"
import type { X402Chain } from "../sdk/types.js"

export function registerPaymentTools(server: McpServer, config: LegacyConfig, fullConfig: FullConfig): void {

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
}
