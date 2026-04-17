import { recoverTypedDataAddress, getAddress } from 'viem'
import { base, arbitrum, mainnet, polygon, baseSepolia } from 'viem/chains'
import type { PaymentPayload, PaymentRequired, VerifyResult } from './types.js'

const CHAIN_MAP: Record<string, { id: number }> = {
  'eip155:8453': base,
  'eip155:42161': arbitrum,
  'eip155:1': mainnet,
  'eip155:137': polygon,
  'eip155:84532': baseSepolia,
  'base-mainnet': base,
  'arbitrum-mainnet': arbitrum,
  'ethereum-mainnet': mainnet,
  'polygon-mainnet': polygon,
}

// In-memory nonce registry — production deployments should replace with persistent storage.
const usedNonces = new Set<string>()

export function markNonceUsed(network: string, nonce: string): void {
  usedNonces.add(`${network}:${nonce}`)
}

export function isNonceUsed(network: string, nonce: string): boolean {
  return usedNonces.has(`${network}:${nonce}`)
}

export async function verifyPayment(
  payment: PaymentPayload,
  requirements: PaymentRequired,
): Promise<VerifyResult> {
  const { network, payload } = payment
  const { authorization, signature } = payload

  const chain = CHAIN_MAP[network]
  if (!chain) return { valid: false, error: `Unsupported network: ${network}` }

  const now = Math.floor(Date.now() / 1000)
  if (now <= Number(authorization.validAfter))
    return { valid: false, error: 'Payment not yet valid' }
  if (now >= Number(authorization.validBefore))
    return { valid: false, error: 'Payment expired' }

  if (isNonceUsed(network, authorization.nonce))
    return { valid: false, error: 'Nonce already used' }

  const extra = requirements.extra as { name?: string; version?: string } | undefined

  let recovered: `0x${string}`
  try {
    recovered = await recoverTypedDataAddress({
      domain: {
        name: extra?.name ?? 'USD Coin',
        version: extra?.version ?? '2',
        chainId: chain.id,
        verifyingContract: getAddress(requirements.asset as `0x${string}`),
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
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
  } catch (err) {
    return { valid: false, error: `Signature recovery failed: ${String(err)}` }
  }

  if (recovered.toLowerCase() !== authorization.from.toLowerCase())
    return { valid: false, error: 'Signer does not match from address' }

  if (getAddress(authorization.to) !== getAddress(requirements.payTo as `0x${string}`))
    return { valid: false, error: 'Payment recipient mismatch' }

  if (BigInt(authorization.value) < BigInt(requirements.amount))
    return { valid: false, error: 'Insufficient payment amount' }

  return { valid: true }
}
