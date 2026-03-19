import {
  CustomMcpError,
  type AudioContent,
  type ContentResult,
  type ImageContent,
  type ResourceContent,
  type ResourceLink,
  type TextContent,
} from "fastmcp"
import { type PaymentPayload, type PaymentRequirements, type SettleResponse } from "x402/types"

/**
 * Callback to determine if payment is required for tool execution
 */
export type OnExecute = (context: { args: unknown }) => Promise<PaymentRequirements | null>

/**
 * Callback when payment provided
 */
export type OnPayment = (context: {
  payment: PaymentPayload
  requirements: PaymentRequirements
}) => Promise<SettleResponse | void>

/**
 * Options for the x402 payment middleware
 */
export interface WithX402PaymentOptions {
  onExecute: OnExecute
  onPayment: OnPayment
}

/**
 * Payment error data structure with x402 fields
 */
interface PaymentErrorData {
  message: string
  code: number
  x402Version: number
  accepts: Array<PaymentRequirements>
  error?: string
  "x402/payment-response"?: SettleResponse
}

/**
 * FastMCP context with request metadata
 */
interface FastMCPContext {
  requestMetadata?: {
    "x402/payment"?: PaymentPayload
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * The execute function signature from FastMCP
 */
type ExecuteFunction<TArgs = any, TResult = any> = (args: TArgs, context: FastMCPContext) => Promise<TResult>

/**
 * Creates a payment error with x402 requirements
 *
 * Workaround: Embeds x402 data as JSON in the error message for when FastMCP
 * doesn't properly propagate the data field. This allows the client to fall back
 * to parsing the data from the message.
 */
function createPaymentError(
  requirements: PaymentRequirements,
  errorReason: string | null = null,
  paymentResponse: SettleResponse | null = null,
): CustomMcpError {
  const data: PaymentErrorData = {
    message: "Payment required for tool execution",
    code: 402,
    x402Version: 1,
    accepts: [requirements],
  }
  if (errorReason) {
    data.error = errorReason
  }
  if (paymentResponse) {
    data["x402/payment-response"] = paymentResponse
  }

  return new CustomMcpError(402, data.message, data)
}

export type ToolExecuteReturn =
  | AudioContent
  | ContentResult
  | ImageContent
  | ResourceContent
  | ResourceLink
  | string
  | TextContent
  | void

function normalizeToolResult(result: ToolExecuteReturn): ContentResult {
  if (result === undefined || result === null) {
    return { content: [] }
  }

  if (typeof result === "string") {
    return { content: [{ text: result, type: "text" }] }
  }

  // Check if it's an individual content type (has 'type' property)
  if ("type" in result) {
    return { content: [result] }
  }

  // Already a ContentResult
  return result
}

/**
 * Middleware that wraps a FastMCP execute function to handle x402 payments
 *
 * Extracts payment from requestMetadata["x402/payment"] field and adds settlement
 * response to result _meta["x402/payment-response"] according to official MCP x402 spec.
 */
export function withX402Payment<TArgs = any, TResult = any>(
  options: WithX402PaymentOptions,
): (execute: ExecuteFunction<TArgs, TResult>) => ExecuteFunction<TArgs, TResult> {
  return (execute: ExecuteFunction<TArgs, TResult>) => {
    return async (args: TArgs, context: FastMCPContext): Promise<TResult> => {
      // Extract payment from MCP request metadata (via FastMCP context)
      const payment = context.requestMetadata?.["x402/payment"]

      // Check if payment is required
      const requirements = await options.onExecute({ args })
      // No payment required - execute normally
      if (!requirements) {
        return execute(args, context)
      }

      // Payment is required
      if (!payment) {
        // No payment provided - return error with requirements
        throw createPaymentError(requirements)
      }

      // Payment provided
      let onPaymentResp: SettleResponse | void
      try {
        onPaymentResp = await options.onPayment({
          payment,
          requirements,
        })
      } catch (error) {
        // Payment invalid - extract reason from error
        const reason = error instanceof Error ? error.message : String(error)
        throw createPaymentError(requirements, reason)
      }
      if (onPaymentResp && !onPaymentResp.success) {
        // Payment rejected - return error with reason
        throw createPaymentError(requirements, onPaymentResp.errorReason, onPaymentResp)
      }

      // Payment valid - proceed with execution
      const result = await execute(args, context)

      // Did not settle
      if (!onPaymentResp) {
        return result
      }

      const normalizedResult = normalizeToolResult(result as ToolExecuteReturn)

      // Add settlement response to result _meta (official spec)
      normalizedResult._meta = {
        ...normalizedResult._meta,
        "x402/payment-response": onPaymentResp,
      }

      return normalizedResult as TResult
    }
  }
}

/**
 * Convenience function that directly wraps an execute function
 */
export function createX402Execute<TArgs = any, TResult = any>(
  options: WithX402PaymentOptions,
  execute: ExecuteFunction<TArgs, TResult>,
): ExecuteFunction<TArgs, TResult> {
  return withX402Payment(options)(execute)
}
