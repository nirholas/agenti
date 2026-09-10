import { Connection, PublicKey } from '@solana/web3.js'
import type { Commitment } from '@solana/web3.js'
import { resolveSolanaNetworkPair, getSolanaNetwork } from './networks.js'
import { hasNonce, markNonce } from '../nonce-store.js'
import type {
  SolanaPaymentPayload,
  PaymentRequired,
  VerifyResult,
  SettleResult,
} from '../types.js'

/**
 * Solana payments settle differently from EVM ones, and the verifier has to
 * reflect that.
 *
 * On EVM the payer hands over a signed EIP-3009 authorization and the
 * facilitator broadcasts it, so settlement is the facilitator's job and the
 * order of operations decides whether work is delivered unpaid.
 *
 * On Solana the payer builds, signs and submits the SPL transfer themselves,
 * and only then presents the signature. The money has already moved by the time
 * the seller sees it. So the seller's job is not to settle, it is to prove that
 * this exact transaction really paid this exact recipient the right amount of
 * the right token on the right cluster, and that nobody has spent this
 * signature on a previous request.
 *
 * That last point is the one that matters: a transaction signature is public
 * the moment it lands. Without consuming it, one real payment buys unlimited
 * requests, from anyone who can read the chain.
 */

export interface SolanaVerifyOptions {
  /** Reuse an existing connection instead of opening one per verification. */
  connection?: Connection
  /**
   * How settled the transaction must be before it counts as payment.
   *
   * 'finalized' (the default) cannot be rolled back. 'confirmed' answers in
   * about a second but sits on a supermajority vote rather than a rooted slot,
   * so a fork can in principle still drop it. Use it only where the price is
   * small enough that the latency is worth more than the certainty.
   */
  commitment?: Extract<Commitment, 'confirmed' | 'finalized'>
  /** Overrides the network's default RPC endpoint. */
  rpcUrl?: string
}

/**
 * How long a claimed signature stays remembered, in seconds.
 *
 * Long enough that a replay is refused well past any plausible retry window,
 * and bounded so the store does not grow without limit.
 */
const SIGNATURE_MEMORY_SECONDS = 24 * 60 * 60

function isValidBase58Signature(signature: string): boolean {
  // Base58 alphabet, and the length range a 64-byte signature encodes to.
  return /^[1-9A-HJ-NP-Za-km-z]{80,96}$/.test(signature)
}

function isValidAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Sums how much of `mint` landed in accounts owned by `owner` in this
 * transaction, read from the pre/post token balances the ledger records.
 *
 * Reading balance deltas rather than decoding instructions is deliberate: it
 * counts what actually moved, so it is correct for TransferChecked, plain
 * Transfer, a transfer made through a CPI, and a transfer bundled with other
 * instructions, and it cannot be fooled by an instruction that looks like a
 * payment but reverted or was overwritten later in the same transaction.
 */
function tokenDelta(
  meta: {
    preTokenBalances?: Array<{ accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }> | null
    postTokenBalances?: Array<{ accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }> | null
  },
  owner: string,
  mint: string,
): bigint {
  const before = new Map<number, bigint>()
  for (const entry of meta.preTokenBalances ?? []) {
    if (entry.mint === mint && entry.owner === owner) {
      before.set(entry.accountIndex, BigInt(entry.uiTokenAmount.amount))
    }
  }

  let delta = 0n
  const seen = new Set<number>()
  for (const entry of meta.postTokenBalances ?? []) {
    if (entry.mint !== mint || entry.owner !== owner) continue
    seen.add(entry.accountIndex)
    // An account created by this transaction has no pre balance, which is zero.
    delta += BigInt(entry.uiTokenAmount.amount) - (before.get(entry.accountIndex) ?? 0n)
  }

  // An account drained and closed within the transaction has a pre balance and
  // no post balance, which reads as the full amount leaving.
  for (const [accountIndex, amount] of before) {
    if (!seen.has(accountIndex)) delta -= amount
  }

  return delta
}

/**
 * Checks that a Solana transaction paid the resource's requirements.
 *
 * This reads the signature store but does not write it, so verifying is
 * idempotent and a payment rejected for some other reason is never burned.
 * Claiming a payment is settleSolanaPayment's job, exactly as broadcasting is
 * the EVM settler's.
 */
export async function verifySolanaPayment(
  payment: SolanaPaymentPayload,
  requirements: PaymentRequired,
  options: SolanaVerifyOptions = {},
): Promise<VerifyResult> {
  const resolved = resolveSolanaNetworkPair(payment.network, requirements.network)
  if ('error' in resolved) return { valid: false, error: resolved.error }

  const { signature, payer } = payment.payload
  if (!signature || !isValidBase58Signature(signature)) {
    return { valid: false, error: 'Malformed transaction signature' }
  }
  if (!isValidAddress(requirements.payTo)) {
    return { valid: false, error: `Malformed payTo address: ${requirements.payTo}` }
  }
  if (!isValidAddress(requirements.asset)) {
    return { valid: false, error: `Malformed asset mint: ${requirements.asset}` }
  }
  if (payer !== undefined && !isValidAddress(payer)) {
    return { valid: false, error: `Malformed payer address: ${payer}` }
  }

  // Checked before touching the network: a replayed signature is the cheap
  // rejection, and it should not cost an RPC round trip.
  if (hasNonce(requirements.payTo, signature)) {
    return { valid: false, error: 'Payment signature already used' }
  }

  const network = resolved.network
  const commitment = options.commitment ?? 'finalized'
  const connection =
    options.connection ?? new Connection(options.rpcUrl ?? network.rpc, commitment)

  let transaction
  try {
    transaction = await connection.getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
    })
  } catch (err) {
    // An RPC that cannot answer is an outage, not a rejected payment, and the
    // caller has to be able to tell those apart.
    throw new Error(`Solana RPC error: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!transaction) {
    return {
      valid: false,
      error: `Transaction not found at ${commitment} commitment. It may still be settling.`,
    }
  }
  if (transaction.meta?.err) {
    return { valid: false, error: 'Transaction failed on-chain' }
  }
  if (!transaction.meta) {
    return { valid: false, error: 'Transaction has no metadata to verify against' }
  }

  const received = tokenDelta(transaction.meta, requirements.payTo, requirements.asset)
  const required = BigInt(requirements.amount)

  if (received <= 0n) {
    return {
      valid: false,
      error: `Transaction moved no ${requirements.asset} to ${requirements.payTo}`,
    }
  }
  if (received < required) {
    return {
      valid: false,
      error: `Insufficient payment amount: received ${received}, required ${required}`,
    }
  }

  // Binding the payer stops one account's payment being presented as another's,
  // which is what an agent's own spend records would otherwise mis-attribute.
  if (payer !== undefined) {
    const spent = tokenDelta(transaction.meta, payer, requirements.asset)
    if (spent >= 0n) {
      return { valid: false, error: `Claimed payer ${payer} did not send this payment` }
    }
  }

  return { valid: true }
}

/**
 * Claims a verified Solana payment.
 *
 * There is nothing to broadcast: the payer already submitted and confirmed the
 * transfer, so settling means verifying it and then consuming the signature so
 * it cannot buy a second request. The returned txHash is the payer's signature,
 * which is the on-chain record of this payment.
 */
export async function settleSolanaPayment(
  payment: SolanaPaymentPayload,
  requirements: PaymentRequired,
  options: SolanaVerifyOptions = {},
): Promise<SettleResult> {
  const verified = await verifySolanaPayment(payment, requirements, options)
  if (!verified.valid) {
    return { settled: false, ...(verified.error !== undefined ? { error: verified.error } : {}) }
  }

  const { signature } = payment.payload

  markNonce(
    requirements.payTo,
    signature,
    BigInt(Math.floor(Date.now() / 1000) + SIGNATURE_MEMORY_SECONDS),
  )

  return { settled: true, txHash: signature }
}

/** The USDC mint on the cluster a network string names, if it names one. */
export function solanaUsdcMint(network: string): string | undefined {
  return getSolanaNetwork(network)?.usdc
}
