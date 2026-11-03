/**
 * Solana payments where the payer settles for itself.
 *
 * The standard x402 `exact` scheme on Solana has the payer partially sign a
 * transfer that a facilitator co-signs as fee payer and submits; such
 * requirements advertise `extra.feePayer` and are paid by the official
 * `@x402/svm` client. agenti's own `withPayment*` gates (and the `pump-agent`
 * scheme) instead expect the payer to submit and confirm the transfer, then
 * present its signature. Those requirements carry no `feePayer`, and are paid
 * here through the self-settling flow in `../solana/payments.ts`.
 */
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import type { SpendControls } from '@x402/core/client'
import type { PaymentRequirements } from '@x402/core/types'
import { findDefaultAsset } from '@x402/svm'
import type { SolanaWallet } from '@agenti/core'
import { createX402Fetch } from '../solana/payments.js'
import { SOLANA_DEVNET_CAIP2 } from './client.js'

/** True when a requirement asks the payer to submit the Solana transfer itself. */
export function isSelfSettledSolana(requirements: PaymentRequirements): boolean {
  if (!requirements.network.startsWith('solana:')) return false
  if (requirements.scheme === 'pump-agent') return true
  if (requirements.scheme !== 'exact') return false
  return typeof requirements.extra?.feePayer !== 'string'
}

/** Converts "$1.50", "1.5" or 1.5 to atomic units with the given decimals. */
function dollarsToAtomic(value: string | number, decimals: number): bigint {
  const text = String(value).trim().replace(/^\$/, '')
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`Invalid spend limit: ${String(value)}`)
  const [whole = '0', fraction = ''] = text.split('.')
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0')
}

/**
 * Applies the same spend controls the official client enforces, so a
 * self-settled payment is never less guarded than a facilitator-settled one.
 * Returns the reason it is refused, or undefined when it may be paid.
 */
export function selfSettleRefusal(
  requirements: PaymentRequirements,
  controls: SpendControls | false | undefined,
): string | undefined {
  if (controls === false) return undefined
  const amount = /^\d+$/.test(requirements.amount) ? BigInt(requirements.amount) : undefined
  if (amount === undefined) return `invalid amount ${requirements.amount}`

  const known = findDefaultAsset(requirements.asset, requirements.network as `${string}:${string}`)
  const entry =
    controls?.allowedAssets === true
      ? undefined
      : controls?.allowedAssets?.find(
          (candidate) =>
            candidate.asset.toLowerCase() === requirements.asset.toLowerCase() ||
            (known !== undefined && candidate.asset.toLowerCase() === known.symbol.toLowerCase()),
        )

  if (!known && !entry && controls?.allowedAssets !== true) {
    return `asset ${requirements.asset} is not a default stablecoin; allow it with spendControls.allowedAssets`
  }
  if (entry?.maxAmountPerPayment != null) {
    return amount > BigInt(entry.maxAmountPerPayment)
      ? `amount ${amount} exceeds the ${entry.maxAmountPerPayment} cap for ${requirements.asset}`
      : undefined
  }
  if (!known || controls?.maxAmountPerPayment === false) return undefined
  const limit = controls?.maxAmountPerPayment ?? '$1'
  const cap = dollarsToAtomic(limit, known.decimals)
  return amount > cap ? `amount ${amount} exceeds the ${String(limit)} per-payment cap` : undefined
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const value = env?.[name]
  return value && value.length > 0 ? value : undefined
}

/**
 * Validates the keypair and builds the self-settling fetch for one network.
 * Everything that can fail before money moves happens here, so the caller
 * can safely fall back to another offered network when this throws.
 */
export function prepareSelfSettledFetch(
  wallet: SolanaWallet,
  requirements: PaymentRequirements,
  rpcUrl: string | undefined,
): (input: string, init?: RequestInit) => Promise<Response> {
  let keypair: Keypair
  try {
    keypair = Keypair.fromSecretKey(wallet.privateKey)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Solana wallet ${wallet.address} cannot sign x402 payments: ${reason}`)
  }
  const cluster = requirements.network === SOLANA_DEVNET_CAIP2 ? 'devnet' : 'mainnet-beta'
  const endpoint = rpcUrl ?? readEnv('SOLANA_RPC_URL') ?? clusterApiUrl(cluster)
  const connection = new Connection(endpoint, 'confirmed')
  return createX402Fetch(keypair, connection, { network: requirements.network })
}
