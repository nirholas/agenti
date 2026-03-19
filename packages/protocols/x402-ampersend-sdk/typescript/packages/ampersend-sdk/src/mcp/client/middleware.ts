import { type JSONRPCMessage, type JSONRPCRequest } from "@modelcontextprotocol/sdk/types.js"

import type { Authorization, PaymentStatus, X402Treasurer } from "../../x402/treasurer.ts"
import {
  buildMessageWithPayment,
  isMcpX402PaymentResponse,
  paymentFromRequest,
  x402DataFromJSONRPCMessage,
} from "./protocol.ts"

export interface X402MiddlewareOptions {
  /** X402Treasurer for handling payment decisions and status tracking */
  readonly treasurer: X402Treasurer
}

export class X402Middleware {
  private readonly _treasurer: X402Treasurer
  // Track authorizations by payment ID for status updates
  private readonly _authorizations = new Map<string, Authorization>()

  constructor(options: X402MiddlewareOptions) {
    this._treasurer = options.treasurer
  }

  async onMessage(request: JSONRPCRequest, response: JSONRPCMessage): Promise<JSONRPCRequest | void> {
    const x402Data = x402DataFromJSONRPCMessage(response)
    if (!x402Data) {
      return
    }

    if (isMcpX402PaymentResponse(x402Data)) {
      const { paymentId } = paymentFromRequest(request)
      if (!paymentId) {
        throw new Error("Payment response received but original payment ID is missing")
      }

      const authorization = this._authorizations.get(paymentId)
      if (!authorization) {
        throw new Error(`No authorization found for payment ID ${paymentId}`)
      }

      const status: PaymentStatus = x402Data["x402/payment-response"].success ? "accepted" : "rejected"
      await this._treasurer.onStatus(status, authorization)

      // Clean up tracked authorization
      this._authorizations.delete(paymentId)
      return
    }

    // If request already includes payment, do not attempt to pay again
    if (request.params?._meta?.["x402/payment"]) {
      return
    }

    const paymentResult = await this.decidePayment(request, x402Data.accepts!)
    if (!paymentResult) {
      return // Payment declined
    }

    const { authorization, messageWithPayment } = paymentResult

    // Track authorization for later status updates
    this._authorizations.set(authorization.authorizationId, authorization)

    // Notify treasurer that payment is being sent
    await this._treasurer.onStatus("sending", authorization)

    return messageWithPayment
  }

  /**
   * Decides x402 payment request and return modified message if payment approved
   */
  private async decidePayment(
    request: JSONRPCRequest,
    requirements: ReadonlyArray<any>,
  ): Promise<{ messageWithPayment: JSONRPCRequest; authorization: Authorization } | null> {
    // Build payment context from request
    const paymentContext = {
      method: request.method,
      params: request.params,
      metadata: { requestId: request.id },
    }

    // Get payment decision from treasurer
    const authorization = await this._treasurer.onPaymentRequired(requirements as any, paymentContext)

    if (!authorization) {
      // Payment declined
      return null
    }

    // Build message with payment
    const { messageWithPayment } = buildMessageWithPayment(
      request,
      authorization.payment,
      authorization.authorizationId,
    )

    return { messageWithPayment, authorization }
  }
}
