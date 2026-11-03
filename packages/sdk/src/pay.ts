import { x402HTTPClient } from '@x402/core/client'
import type { SpendControls } from '@x402/core/client'
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types'
import { networkMatchesPattern } from '@x402/core/utils'
import type { EVMWallet, SolanaWallet } from '@agenti/core'
import { emitEvent } from './events.js'
import { getCachedPayment, cachePayment, readIdempotencyKey } from './idempotency.js'
import { createAgentiX402Client } from './x402/client.js'
import { isSelfSettledSolana, prepareSelfSettledFetch, selfSettleRefusal } from './x402/self-settle.js'

/** Options for {@link pay}: a superset of the standard fetch RequestInit. */
export interface PayOptions extends RequestInit {
  /**
   * Hard ceiling on what a single call may pay, in the asset's smallest unit
   * (e.g. "1000000" = 1 USDC). Options above it are never signed. When set, it
   * replaces the reference client's default $1 USD cap, so it is the one limit
   * in force. Accepts a decimal string or bigint.
   */
  maxAmount?: string | bigint
  /**
   * Networks to prefer when the server offers several, most preferred first.
   * CAIP-2 ids, wildcards or v1 names: `['solana:*', 'eip155:8453']`.
   * Options on other networks are still used as fallbacks, in server order.
   */
  preferNetworks?: string[]
  /** Solana RPC used to build SPL payment transactions. Defaults to SOLANA_RPC_URL. */
  solanaRpcUrl?: string
  /**
   * Reference-client spend controls. Omitted, payments are limited to
   * well-known stablecoins and $1 each (or to `maxAmount` when that is set).
   * Pass `{ allowedAssets: true }` to pay in any token, or `false` to disable.
   */
  spendControls?: SpendControls | false
}

type AnyRequirements = PaymentRequirements & { maxAmountRequired?: string }

function amountOf(requirements: AnyRequirements): string {
  return requirements.maxAmountRequired ?? requirements.amount
}

function parseAtomic(value: string): bigint | undefined {
  return /^\d+$/.test(value) ? BigInt(value) : undefined
}

function orderByPreference(
  accepts: AnyRequirements[],
  prefer: string[] | undefined,
): AnyRequirements[] {
  if (!prefer?.length) return accepts
  const rank = (requirements: AnyRequirements): number => {
    const index = prefer.findIndex(
      (pattern) =>
        pattern === requirements.network ||
        networkMatchesPattern(pattern as `${string}:${string}`, requirements.network),
    )
    return index === -1 ? prefer.length : index
  }
  return accepts
    .map((requirements, position) => ({ requirements, position, rank: rank(requirements) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((entry) => entry.requirements)
}

/**
 * Copies caller headers into a plain object without changing their casing,
 * minus any payment headers we are about to set ourselves.
 */
function headerRecord(headers: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  const entries: Iterable<[string, string]> =
    typeof Headers !== 'undefined' && headers instanceof Headers
      ? headers.entries()
      : Array.isArray(headers)
        ? (headers as [string, string][])
        : Object.entries(headers as Record<string, string>)
  for (const [name, value] of entries) {
    const lower = name.toLowerCase()
    if (lower === 'payment-signature' || lower === 'x-payment') continue
    out[name] = value
  }
  return out
}

async function readPaymentRequired(
  http: x402HTTPClient,
  response: Response,
): Promise<PaymentRequired | undefined> {
  const getHeader = (name: string): string | null | undefined => response.headers.get(name)
  let body: unknown
  if (!getHeader('PAYMENT-REQUIRED')) {
    // Read a clone where possible so the caller still gets an unread 402 back
    // when the body is not an x402 challenge.
    const source = typeof response.clone === 'function' ? response.clone() : response
    body = await source.json().catch(() => undefined)
  }
  try {
    return http.getPaymentRequiredResponse(getHeader, body)
  } catch {
    return undefined
  }
}

/**
 * Fetches `url`, paying any x402 402 challenge with the agent's wallets.
 *
 * Parsing, signing and header encoding come from the official `@x402/core`,
 * `@x402/evm` and `@x402/svm` packages, so payments work against every
 * conformant x402 v1 or v2 server, on EVM (EIP-3009 and Permit2) and Solana.
 *
 * Guarantees on top of the reference client:
 * - `maxAmount` is enforced on the atomic amount before anything is signed.
 * - With an `Idempotency-Key` header, retries replay the first authorization,
 *   so a retried purchase can only settle once.
 * - If one offered network cannot be paid (no key, spend control, RPC error),
 *   the next offered option is tried before giving up.
 * - Solana requirements without a facilitator fee payer (agenti's own
 *   `withPayment*` gates, the `pump-agent` scheme) are paid by submitting the
 *   transfer and presenting its signature, under the same spend controls.
 * - Exactly one paid retry: a second 402 is returned to the caller as is.
 */
export async function pay(
  url: string,
  evmWallet: EVMWallet,
  solanaWallet: SolanaWallet,
  options?: PayOptions,
): Promise<Response> {
  const { maxAmount, preferNetworks, solanaRpcUrl, spendControls, ...init } = options ?? {}
  const response = await fetch(url, init)
  if (response.status !== 402) return response

  // An explicit maxAmount replaces the reference $1 USD cap; it is enforced
  // below on the atomic amount, which works for every asset.
  const controls: SpendControls | false | undefined =
    spendControls ?? (maxAmount !== undefined ? { maxAmountPerPayment: false } : undefined)
  const client = createAgentiX402Client({
    evm: evmWallet,
    solana: solanaWallet,
    ...(solanaRpcUrl ? { solanaRpcUrl } : {}),
    ...(controls !== undefined ? { spendControls: controls } : {}),
  })
  const http = new x402HTTPClient(client)

  const required = await readPaymentRequired(http, response)
  if (!required || !required.accepts?.length) return response

  let accepts = required.accepts as AnyRequirements[]
  if (maxAmount !== undefined) {
    const cap = BigInt(maxAmount)
    const affordable = accepts.filter((requirements) => {
      const amount = parseAtomic(amountOf(requirements))
      return amount !== undefined && amount <= cap
    })
    if (affordable.length === 0) {
      const asked = accepts.map(amountOf).join(', ')
      throw new Error(`Payment of ${asked} exceeds maxAmount ${cap.toString()}: refusing to pay`)
    }
    accepts = affordable
  }
  accepts = orderByPreference(accepts, preferNetworks)

  const idempotencyKey = readIdempotencyKey(init.headers)
  const failures: string[] = []

  for (const requirements of accepts) {
    const amount = amountOf(requirements)
    const identity = {
      network: requirements.network,
      asset: requirements.asset,
      payTo: requirements.payTo,
      amount,
    }

    if (isSelfSettledSolana(requirements)) {
      // Pre-flight only: a refusal or a bad key falls through to the next
      // option. Once the transfer is submitted, errors propagate, because
      // falling back then could pay twice.
      const refusal = selfSettleRefusal(requirements, controls)
      if (refusal) {
        failures.push(`${requirements.network}: ${refusal}`)
        continue
      }
      let selfSettledFetch: (input: string, init?: RequestInit) => Promise<Response>
      try {
        selfSettledFetch = prepareSelfSettledFetch(solanaWallet, requirements, solanaRpcUrl)
      } catch (err) {
        failures.push(`${requirements.network}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
      const result = await selfSettledFetch(url, init)
      if (result.status !== 402) {
        emitEvent({ type: 'pay', url, amount, network: requirements.network, ts: Date.now() })
      }
      return result
    }

    let encoded = idempotencyKey ? getCachedPayment(idempotencyKey, identity) : undefined
    if (!encoded) {
      try {
        const payload = await http.createPaymentPayload({ ...required, accepts: [requirements] })
        encoded = Object.values(http.encodePaymentSignatureHeader(payload))[0]
      } catch (err) {
        failures.push(`${requirements.network}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
      if (!encoded) continue
      if (idempotencyKey) {
        const expiresAt = Math.floor(Date.now() / 1000) + (requirements.maxTimeoutSeconds || 60)
        cachePayment(idempotencyKey, identity, encoded, expiresAt)
      }
    }

    const headers = headerRecord(init.headers)
    if (required.x402Version >= 2) headers['PAYMENT-SIGNATURE'] = encoded
    else headers['X-Payment'] = encoded

    const result = await fetch(url, { ...init, headers })

    if (result.status !== 402) {
      let txHash: string | undefined
      try {
        txHash = http.getPaymentSettleResponse((name) => result.headers.get(name)).transaction
      } catch {
        txHash = undefined
      }
      emitEvent({
        type: 'pay',
        url,
        amount,
        network: requirements.network,
        ...(txHash ? { txHash } : {}),
        ts: Date.now(),
      })
    }
    return result
  }

  throw new Error(`Could not pay for ${url}: ${failures.join('; ')}`)
}
