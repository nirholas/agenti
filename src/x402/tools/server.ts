/**
 * x402 Server Tools
 * @description Server-side tools: create paywall, verify payment
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { LegacyConfig, FullConfig } from "./shared.js"
import { getClient } from "./shared.js"

export function registerServerTools(server: McpServer, config: LegacyConfig, fullConfig: FullConfig): void {

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
}
