import type { PaymentPayload, PaymentRequirements } from "x402/types"

/**
 * Context information for payment decisions
 */
export interface PaymentContext {
  method: string
  params: any
  metadata?: Record<string, unknown>
}

/**
 * Authorization linking a payment with a tracking ID
 */
export interface Authorization {
  payment: PaymentPayload
  authorizationId: string
}

/**
 * Payment status types for tracking payment lifecycle
 */
export type PaymentStatus =
  | "sending" // Payment submitted to seller
  | "accepted" // Payment verified and accepted
  | "rejected" // Payment rejected by seller
  | "declined" // Buyer declined to pay
  | "error" // Error during payment processing

/**
 * X402Treasurer interface - Separates payment decision logic from payment creation
 *
 * An X402Treasurer decides whether to approve or reject payment requests,
 * tracks payment status, and delegates actual payment creation to an X402Wallet.
 *
 * @example
 * ```typescript
 * class BudgetTreasurer implements X402Treasurer {
 *   constructor(private wallet: X402Wallet, private dailyLimit: number) {}
 *
 *   async onPaymentRequired(requirements, context) {
 *     if (this.wouldExceedBudget(requirements[0])) {
 *       return null // Decline
 *     }
 *     const payment = await this.wallet.createPayment(requirements[0])
 *     return { payment, authorizationId: crypto.randomUUID() }
 *   }
 *
 *   async onStatus(status, authorization, context) {
 *     console.log(`Payment ${authorization.authorizationId}: ${status}`)
 *   }
 * }
 * ```
 */
export interface X402Treasurer {
  /**
   * Called when payment is required.
   *
   * @param requirements - Array of payment requirements from seller (typically use first)
   * @param context - Optional context about the request requiring payment
   * @returns Authorization to proceed with payment, or null to decline
   */
  onPaymentRequired(
    requirements: ReadonlyArray<PaymentRequirements>,
    context?: PaymentContext,
  ): Promise<Authorization | null>

  /**
   * Called with payment status updates throughout the payment lifecycle.
   *
   * @param status - Current payment status
   * @param authorization - The authorization returned from onPaymentRequired
   * @param context - Optional context about the status update
   */
  onStatus(status: PaymentStatus, authorization: Authorization, context?: PaymentContext): Promise<void>
}
