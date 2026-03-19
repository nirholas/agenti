/**
 * x402 Wallet Tools
 * @description Wallet and balance tools: check balance, get address, approve tokens
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { isX402Configured, SUPPORTED_CHAINS } from "../config.js"
import type { X402Chain } from "../sdk/types.js"
import type { LegacyConfig, FullConfig } from "./shared.js"
import { getClient } from "./shared.js"

export function registerWalletTools(server: McpServer, config: LegacyConfig, fullConfig: FullConfig): void {

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
}
