import type { ClientOptions as McpClientOptions } from "@modelcontextprotocol/sdk/client/index.js"
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "x402/types"

import type { X402Treasurer } from "../../x402/treasurer.ts"

/**
 * HTTP 402 response structure with payment requirements
 * Matches the official MCP x402 specification PaymentRequirementsResponse
 */
export interface X402Response {
  readonly x402Version: number
  readonly accepts: ReadonlyArray<PaymentRequirements>
  readonly error?: string
}

/**
 * MCP-specific meta field types for x402 payments
 * Used in request/response _meta fields according to official spec
 */
export interface X402MetaFields {
  "x402/payment"?: PaymentPayload
  "x402/payment-response"?: SettleResponse
}

/**
 * Payment tracking events (for API compatibility)
 */
export type PaymentEvent =
  | { type: "sending" }
  | { type: "accepted" }
  | { type: "rejected"; reason: string }
  | { type: "error"; reason: string }

/**
 * Client options that wrap MCP options and add x402 payment handling
 */
export interface ClientOptions {
  /** Standard MCP client options */
  readonly mcpOptions: McpClientOptions
  /** X402Treasurer for handling payment decisions and status tracking */
  readonly treasurer: X402Treasurer
}
