import {
  isJSONRPCError,
  isJSONRPCResponse,
  type JSONRPCMessage,
  type JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js"
import { SettleResponseSchema, x402ResponseSchema, type PaymentPayload, type PaymentRequirements } from "x402/types"
import { z } from "zod"

import type { X402Response } from "./types.ts"

export const McpX402PaymentResponseSchema = z.object({
  "x402/payment-response": SettleResponseSchema,
})

export type McpX402PaymentResponse = z.infer<typeof McpX402PaymentResponseSchema>

export const McpX402PaymentRequiredSchema = x402ResponseSchema.extend({
  "x402/payment-response": SettleResponseSchema.optional(),
})

export type McpX402PaymentRequired = z.infer<typeof McpX402PaymentRequiredSchema>

export function buildMessageWithPayment(
  message: JSONRPCRequest,
  payment: PaymentPayload,
  paymentId: string,
): { messageWithPayment: JSONRPCRequest } {
  // Return modified message with payment (using spec-compliant field name)
  const base = message
  const baseParams = base.params || { _meta: {} }
  const baseParamsMeta = baseParams._meta || {}
  const messageWithPayment = {
    ...base,
    params: {
      ...baseParams,
      _meta: {
        ...baseParamsMeta,
        "x402/payment": payment,
        "ampersend/paymentId": paymentId,
      },
    },
  }
  return { messageWithPayment }
}

export function paymentFromRequest(request: JSONRPCRequest): {
  payment: PaymentPayload | null
  paymentId: string | null
} {
  const meta = request.params?._meta
  if (!meta) {
    return { payment: null, paymentId: null }
  }

  const payment = (meta["x402/payment"] as PaymentPayload) || null
  const paymentId = (meta["ampersend/paymentId"] as string) || null

  return { payment, paymentId }
}

export function addMeta(request: JSONRPCRequest, k: string, v: unknown): JSONRPCRequest {
  const base = request
  const baseParams = base.params || { _meta: {} }
  const baseParamsMeta = baseParams._meta || {}
  return {
    ...base,
    params: {
      ...baseParams,
      _meta: {
        ...baseParamsMeta,
        [k]: v,
      },
    },
  }
}

export function x402DataFromJSONRPCMessage(
  msg: JSONRPCMessage,
): McpX402PaymentResponse | McpX402PaymentRequired | null {
  if (isJSONRPCResponse(msg) && msg.result._meta && isMcpX402PaymentResponse(msg.result._meta)) {
    return msg.result._meta as McpX402PaymentResponse
  }

  if (isJSONRPCError(msg) && msg.error.code === 402 && msg.error.data && isMcpX402PaymentRequired(msg.error.data)) {
    return msg.error.data as McpX402PaymentRequired
  }

  return null
}

export function isMcpX402PaymentResponse(data: unknown): data is McpX402PaymentResponse {
  const result = McpX402PaymentResponseSchema.safeParse(data)
  return result.success
}

export function isMcpX402PaymentRequired(data: unknown): data is McpX402PaymentRequired {
  const result = McpX402PaymentRequiredSchema.safeParse(data)
  return result.success
}

// Type guards and validators

/**
 * Type guard to check if a value is a valid PaymentRequirements array
 */
function isPaymentRequirementsArray(arr: unknown): arr is Array<PaymentRequirements> {
  return Array.isArray(arr) && arr.length > 0 && arr.every((req) => req && typeof req === "object" && "scheme" in req)
}

/**
 * Type guard to check if a value is a valid X402Response structure
 */
function isX402Response(obj: unknown): obj is X402Response {
  if (!obj || typeof obj !== "object") return false
  if (!("x402Version" in obj) || !("accepts" in obj)) return false

  const candidate = obj as Record<string, unknown>
  return typeof candidate.x402Version === "number" && isPaymentRequirementsArray(candidate.accepts)
}

/**
 * Type assertion for X402Response with runtime validation.
 * Returns null if the data doesn't match the expected structure.
 */
export function asX402Response(obj: unknown): X402Response | null {
  return isX402Response(obj) ? obj : null
}
