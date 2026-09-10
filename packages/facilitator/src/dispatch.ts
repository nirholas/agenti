import { verifyPayment as verifyEVMPayment } from './verifier.js'
import { settlePayment as settleEVMPayment } from './settler.js'
import { verifySolanaPayment, settleSolanaPayment } from './solana/verifier.js'
import type { SolanaVerifyOptions } from './solana/verifier.js'
import { isSolanaNetwork } from './solana/networks.js'
import { isSolanaPayload } from './types.js'
import type {
  PaymentPayload,
  PaymentRequired,
  VerifyResult,
  SettleResult,
  FacilitatorConfig,
} from './types.js'

/**
 * Chain-agnostic entry points.
 *
 * Callers should not have to know that EVM and Solana reach settlement by
 * opposite routes, one where the facilitator broadcasts a signed authorization
 * and one where the payer has already broadcast and hands over a receipt. These
 * dispatch on what actually arrived and return the same shapes either way.
 */

function mismatch(payment: PaymentPayload, requirements: PaymentRequired): string | undefined {
  const paymentIsSolana = isSolanaNetwork(payment.network)
  const requiredIsSolana = isSolanaNetwork(requirements.network)
  if (paymentIsSolana !== requiredIsSolana) {
    return (
      `Network mismatch: payment is on ${payment.network} ` +
      `but payment is required on ${requirements.network}`
    )
  }
  return undefined
}

/** Verifies a payment on whichever chain it was made. Never consumes it. */
export async function verify(
  payment: PaymentPayload,
  requirements: PaymentRequired,
  options: { facilitator?: FacilitatorConfig; solana?: SolanaVerifyOptions } = {},
): Promise<VerifyResult> {
  const crossChain = mismatch(payment, requirements)
  if (crossChain) return { valid: false, error: crossChain }

  if (isSolanaPayload(payment)) {
    return verifySolanaPayment(payment, requirements, options.solana ?? {})
  }
  return verifyEVMPayment(payment, requirements)
}

/**
 * Settles a payment on whichever chain it was made.
 *
 * On EVM this broadcasts the authorization. On Solana the transfer is already
 * on-chain, so it verifies and consumes the signature, which is what stops one
 * real payment from buying every subsequent request.
 */
export async function settle(
  payment: PaymentPayload,
  requirements: PaymentRequired,
  options: { facilitator?: FacilitatorConfig; solana?: SolanaVerifyOptions } = {},
): Promise<SettleResult> {
  const crossChain = mismatch(payment, requirements)
  if (crossChain) return { settled: false, error: crossChain }

  if (isSolanaPayload(payment)) {
    return settleSolanaPayment(payment, requirements, options.solana ?? {})
  }
  return settleEVMPayment(payment, requirements, options.facilitator ?? {})
}
