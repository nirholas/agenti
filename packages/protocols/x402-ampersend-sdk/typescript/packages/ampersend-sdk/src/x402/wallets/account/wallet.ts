import type { Account, Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { createPaymentHeader } from "x402/client"
import type { PaymentPayload, PaymentRequirements } from "x402/types"

import { WalletError, type X402Wallet } from "../../wallet.ts"

/**
 * AccountWallet - EOA (Externally Owned Account) wallet implementation
 *
 * Creates payment payloads signed by an EOA private key.
 * Supports the "exact" payment scheme.
 *
 * @example
 * ```typescript
 * import { privateKeyToAccount } from "viem/accounts"
 *
 * // From viem Account
 * const account = privateKeyToAccount("0x...")
 * const wallet = new AccountWallet(account)
 *
 * // From private key directly
 * const wallet = AccountWallet.fromPrivateKey("0x...")
 * ```
 */
export class AccountWallet implements X402Wallet {
  private account: Account

  constructor(account: Account) {
    this.account = account
  }

  /**
   * Creates an AccountWallet from a private key
   */
  static fromPrivateKey(privateKey: Hex): AccountWallet {
    return new AccountWallet(privateKeyToAccount(privateKey))
  }

  /**
   * Creates a payment payload from requirements.
   * Only supports "exact" payment scheme.
   */
  async createPayment(requirements: PaymentRequirements): Promise<PaymentPayload> {
    if (requirements.scheme !== "exact") {
      throw new WalletError(`Unsupported payment scheme: ${requirements.scheme}. AccountWallet only supports "exact".`)
    }

    try {
      // Create payment header using x402 client utility
      const paymentHeader = await createPaymentHeader(this.account as any, 1, requirements)

      // Decode base64 payment header to PaymentPayload
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8")
      const payment = JSON.parse(decoded) as PaymentPayload

      return payment
    } catch (error) {
      throw new WalletError(
        `Failed to create payment: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Returns the account address
   */
  get address(): Hex {
    return this.account.address
  }
}
