import { createPublicClient, createWalletClient, http, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, arbitrum, mainnet, polygon, baseSepolia } from 'viem/chains'
import type { Chain } from 'viem'
import { markNonce } from './nonce-store.js'
import type { PaymentPayload, PaymentRequired, SettleResult, FacilitatorConfig } from './types.js'

const CHAIN_MAP: Record<string, Chain> = {
  'eip155:1': mainnet,
  'eip155:8453': base,
  'eip155:42161': arbitrum,
  'eip155:137': polygon,
  'eip155:84532': baseSepolia,
  'base-mainnet': base,
  'arbitrum-mainnet': arbitrum,
  'ethereum-mainnet': mainnet,
  'polygon-mainnet': polygon,
}

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

  const chain = CHAIN_MAP[network]
  if (!chain) return { settled: false, error: `Unsupported network: ${network}` }

  const rpcUrl = config.rpcUrls?.[network]
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
