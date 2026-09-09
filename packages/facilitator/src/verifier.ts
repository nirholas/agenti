import { verifyTypedData, getAddress } from 'viem'
import { hasNonce } from './nonce-store.js'
import { resolveNetworkPair } from './chains.js'
import type { PaymentPayload, PaymentRequired, VerifyResult } from './types.js'

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export async function verifyPayment(
  payment: PaymentPayload,
  requirements: PaymentRequired,
): Promise<VerifyResult> {
  const { network, payload } = payment
  const { authorization, signature } = payload

  // Bind the claimed network to the one the resource asked to be paid on
  // before the EIP-712 domain is built from it.
  const resolved = resolveNetworkPair(network, requirements.network)
  if ('error' in resolved) return { valid: false, error: resolved.error }
  const chainId = resolved.chain.viemChain.id

  const now = Math.floor(Date.now() / 1000)
  if (now <= Number(authorization.validAfter)) {
    return { valid: false, error: 'Payment not yet valid' }
  }
  if (now >= Number(authorization.validBefore)) {
    return { valid: false, error: 'Payment expired' }
  }

  if (hasNonce(authorization.from, authorization.nonce)) {
    return { valid: false, error: 'Nonce already used' }
  }

  const extra = requirements.extra as { name?: string; version?: string } | undefined

  const isValid = await verifyTypedData({
    address: authorization.from,
    domain: {
      name: extra?.name ?? 'USD Coin',
      version: extra?.version ?? '2',
      chainId,
      verifyingContract: getAddress(requirements.asset as `0x${string}`),
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
    signature,
  })

  if (!isValid) {
    return { valid: false, error: 'Signer does not match from address' }
  }

  if (getAddress(authorization.to) !== getAddress(requirements.payTo as `0x${string}`)) {
    return { valid: false, error: 'Payment recipient mismatch' }
  }

  if (BigInt(authorization.value) < BigInt(requirements.amount)) {
    return { valid: false, error: 'Insufficient payment amount' }
  }

  return { valid: true }
}
