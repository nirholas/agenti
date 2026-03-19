import { type Address, type Hex } from "viem"
import type { PaymentPayload, PaymentRequirements } from "x402/types"

import { OWNABLE_VALIDATOR } from "../../../smart-account/constants.ts"
import { WalletError, type X402Wallet } from "../../wallet.ts"
import { createExactPayment } from "./exact.ts"

/**
 * Configuration for SmartAccountWallet
 */
export interface SmartAccountConfig {
  /** Smart account address */
  smartAccountAddress: Address
  /** Session key private key for signing */
  sessionKeyPrivateKey: Hex
  /** Chain ID for the blockchain network */
  chainId: number
  /** OwnableValidator address (defaults to standard OwnableValidator) */
  validatorAddress?: Address
}

/**
 * SmartAccountWallet - Smart account wallet implementation using ERC-1271
 *
 * Creates payment payloads signed by a smart account using ERC-1271 standard.
 * Supports Safe accounts with OwnableValidator module.
 * Only supports the "exact" payment scheme with ERC-3009 (USDC) authorizations.
 *
 * @example
 * ```typescript
 * const wallet = new SmartAccountWallet({
 *   smartAccountAddress: "0x...",  // Smart account address
 *   sessionKeyPrivateKey: "0x...",  // Session key
 *   chainId: 84532,  // Base Sepolia
 *   validatorAddress: "0x..."  // OwnableValidator (optional, defaults to standard validator)
 * })
 *
 * const payment = await wallet.createPayment(requirements)
 * ```
 */
export class SmartAccountWallet implements X402Wallet {
  private readonly config: SmartAccountConfig & { validatorAddress: Address }

  constructor(config: SmartAccountConfig) {
    // Apply default validator address if not provided
    this.config = {
      ...config,
      validatorAddress: config.validatorAddress ?? OWNABLE_VALIDATOR,
    }
  }

  /**
   * Creates a payment payload from requirements.
   * Only supports "exact" payment scheme with ERC-3009 authorizations.
   */
  async createPayment(requirements: PaymentRequirements): Promise<PaymentPayload> {
    if (requirements.scheme !== "exact") {
      throw new WalletError(
        `Unsupported payment scheme: ${requirements.scheme}. SmartAccountWallet only supports "exact".`,
      )
    }

    try {
      return await createExactPayment(requirements, this.config)
    } catch (error) {
      throw new WalletError(
        `Failed to create smart account payment: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Returns the smart account address
   */
  get address(): Address {
    return this.config.smartAccountAddress
  }
}
