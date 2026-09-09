import { createPublicClient, createWalletClient, http, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { markNonce } from './nonce-store.js'
import { resolveNetworkPair } from './chains.js'
import type { PaymentPayload, PaymentRequired, SettleResult, FacilitatorConfig } from './types.js'

const TRANSFER_WITH_AUTH_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

function splitSignature(sig: `0x${string}`): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const hex = sig.slice(2)
  const r = `0x${hex.slice(0, 64)}` as `0x${string}`
  const s = `0x${hex.slice(64, 128)}` as `0x${string}`
  let v = parseInt(hex.slice(128, 130), 16)
  if (v < 27) v += 27
  return { v, r, s }
}

export async function settlePayment(
  payment: PaymentPayload,
  requirements: PaymentRequired,
  config: FacilitatorConfig,
): Promise<SettleResult> {
  if (!config.settlerPrivateKey) {
    return { settled: false, error: 'No settler private key configured' }
  }

  const { network, payload } = payment
  const { authorization, signature } = payload

  // Never broadcast on a chain the resource did not ask to be paid on.
  const resolved = resolveNetworkPair(network, requirements.network)
  if ('error' in resolved) return { settled: false, error: resolved.error }
  const chain = resolved.chain.viemChain

  // Callers may key rpcUrls by either the CAIP-2 id or the legacy alias.
  const rpcUrl =
    config.rpcUrls?.[resolved.chain.caip2] ?? config.rpcUrls?.[network] ?? resolved.chain.rpc
  const transport = rpcUrl ? http(rpcUrl) : http()

  const account = privateKeyToAccount(config.settlerPrivateKey)
  const walletClient = createWalletClient({ account, chain, transport })
  const publicClient = createPublicClient({ chain, transport })

  const { v, r, s } = splitSignature(signature)

  try {
    const txHash = await walletClient.writeContract({
      address: getAddress(requirements.asset as `0x${string}`),
      abi: TRANSFER_WITH_AUTH_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce,
        v,
        r,
        s,
      ],
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })
    markNonce(authorization.from, authorization.nonce, BigInt(authorization.validBefore))
    return { settled: true, txHash }
  } catch (err) {
    return { settled: false, error: String(err) }
  }
}
