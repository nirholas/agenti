import { toHex, type Address, type Hex } from "viem"
import type { PaymentPayload, PaymentRequirements } from "x402/types"

import { signERC3009Authorization } from "../../../smart-account/index.ts"

/**
 * Generates a random 32-byte nonce for use in authorization signatures
 */
function createNonce(): Hex {
  const cryptoObj =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function"
      ? globalThis.crypto
      : // Dynamic require is needed to support node.js
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("crypto").webcrypto
  return toHex(cryptoObj.getRandomValues(new Uint8Array(32)))
}

/**
 * Configuration for creating an exact payment with ERC-3009
 */
export interface ExactPaymentConfig {
  /** Smart account address (payment sender) */
  smartAccountAddress: Address
  /** Session key private key for signing */
  sessionKeyPrivateKey: Hex
  /** Chain ID for the blockchain network */
  chainId: number
  /** OwnableValidator address for ERC-1271 validation */
  validatorAddress: Address
}

/**
 * Creates a payment payload using the "exact" scheme with ERC-3009 USDC authorization
 *
 * This implements the x402 "exact" payment scheme, which uses USDC's transferWithAuthorization
 * (ERC-3009) to create signed payment authorizations. The signature is created using ERC-1271
 * from a smart account via the OwnableValidator module.
 *
 * @param requirements - Payment requirements from the x402 server
 * @param config - Configuration for the smart account wallet
 * @returns Payment payload ready to send to x402 server
 * @throws Error if payment requirements are invalid or signing fails
 */
export async function createExactPayment(
  requirements: PaymentRequirements,
  config: ExactPaymentConfig,
): Promise<PaymentPayload> {
  // Generate nonce and validity timestamps
  const nonce = createNonce()
  const validAfter = BigInt(Math.floor(Date.now() / 1000) - 600) // 10 minutes before
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds)

  // Prepare authorization data for ERC-3009 signing
  const authData = {
    from: config.smartAccountAddress,
    to: requirements.payTo as Address,
    value: BigInt(requirements.maxAmountRequired),
    validAfter,
    validBefore,
    nonce,
  }

  // Get domain params from requirements.extra (provided by server)
  const domainName = requirements.extra?.name as string | undefined
  const domainVersion = requirements.extra?.version as string | undefined

  if (!domainName || !domainVersion) {
    throw new Error("requirements.extra must contain 'name' and 'version' for EIP-712 domain")
  }

  // Sign using ERC-1271 with OwnableValidator
  const signature = await signERC3009Authorization(
    config.sessionKeyPrivateKey,
    config.smartAccountAddress,
    authData,
    requirements.asset as Address,
    config.chainId,
    config.validatorAddress,
    domainName,
    domainVersion,
  )

  // Construct payment payload matching x402 exact scheme format
  const paymentPayload: PaymentPayload = {
    x402Version: 1,
    scheme: "exact" as const,
    network: requirements.network,
    payload: {
      signature: signature as string,
      authorization: {
        from: config.smartAccountAddress as string,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce: nonce as string,
      },
    },
  }

  return paymentPayload
}
