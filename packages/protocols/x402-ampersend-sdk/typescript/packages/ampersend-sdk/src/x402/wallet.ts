import type { PaymentPayload, PaymentRequirements } from "x402/types"

/**
 * Error thrown when wallet cannot create a payment
 */
export class WalletError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message)
    this.name = "WalletError"
  }
}

/**
 * X402Wallet interface - Creates payment payloads from requirements
 *
 * An X402Wallet is responsible for creating cryptographically signed payment payloads
 * that can be submitted to sellers. Different wallet implementations support
 * different account types (EOA, smart accounts, etc.).
 *
 * @example
 * ```typescript
 * class AccountWallet implements X402Wallet {
 *   constructor(private account: Account) {}
 *
 *   async createPayment(requirements: PaymentRequirements): Promise<PaymentPayload> {
 *     if (requirements.scheme !== "exact") {
 *       throw new WalletError(`Unsupported scheme: ${requirements.scheme}`)
 *     }
 *     // Create and sign payment
 *     return signedPayment
 *   }
 * }
 * ```
 */
export interface X402Wallet {
  /**
   * Creates a payment payload from requirements.
   *
   * @param requirements - Payment requirements from seller
   * @returns Signed payment payload ready for submission
   * @throws {WalletError} If unable to create payment (unsupported scheme, insufficient funds, etc.)
   */
  createPayment(requirements: PaymentRequirements): Promise<PaymentPayload>
}
