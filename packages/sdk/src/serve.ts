/**
 * serve.ts — 402-gate any Express / Hono / Next.js handler.
 *
 * Pattern:
 *   withPayment(handler, { amount, token, network, address })
 *
 * The wrapper:
 *   1. Checks for a payment header (PAYMENT-SIGNATURE for v2, X-Payment for v1).
 *   2. If absent, returns a 402 with the payment requirements JSON so the caller
 *      knows exactly what to pay and where.
 *   3. If present, decodes and verifies the EIP-3009 signature by forwarding to
 *      the x402 facilitator (https://x402.org/facilitator by default).
 *   4. Settles the payment on-chain through the same facilitator, and only then
 *      calls the wrapped handler. A handler never runs for a payment that did
 *      not settle, so non-reversible work is not delivered unpaid.
 *   5. Echoes the settle receipt back on the X-PAYMENT-RESPONSE header.
 *
 * Verification alone is not payment: it proves a signature is good but moves no
 * funds and consumes no nonce, which leaves the authorization replayable. Set
 * `mode: 'verify'` to opt an endpoint back into that soft gate when the work it
 * does is free to repeat.
 *
 * Supports Express (Request/Response/NextFunction), Hono (Context), and
 * Next.js App Router (NextRequest → NextResponse) handler signatures.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How hard a 402 gate is: settle the payment on-chain before the handler runs,
 * or verify the signature only and leave settlement to the caller.
 */
export type PaymentGateMode = 'settle' | 'verify'

/** Configuration for a 402-gated endpoint. */
export interface PaymentConfig {
  /** Amount in the token's smallest unit (e.g. "1000000" = 1 USDC). */
  amount: string
  /**
   * Token contract address.
   * Defaults to USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   */
  token?: string
  /**
   * CAIP-2 network identifier or legacy x402 v1 name.
   * Examples: "eip155:8453" (Base mainnet), "base-mainnet" (v1 legacy)
   * Defaults to "eip155:8453".
   */
  network?: string
  /** The address that will receive the payment. */
  address: string
  /**
   * Facilitator base URL for verify/settle calls.
   * Defaults to https://x402.org/facilitator
   */
  facilitatorUrl?: string
  /**
   * Maximum seconds the signed authorization is valid.
   * Defaults to 300 (5 minutes).
   */
  maxTimeoutSeconds?: number
  /** Human-readable description of what the user is paying for. */
  description?: string
  /**
   * How hard the gate is.
   *
   * - `'settle'` (default): verify, then settle on-chain before the handler
   *   runs. The payment is final and cannot be replayed. Use this for anything
   *   that delivers real work.
   * - `'verify'`: verify only, then run the handler. No funds move and the
   *   authorization stays replayable, so only choose this for a soft gate in
   *   front of work that is cheap and safe to repeat, and settle it yourself
   *   later.
   */
  mode?: PaymentGateMode
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DEFAULT_FACILITATOR = 'https://x402.org/facilitator'

/** Points to a locally-running agenti-facilitator instance (default port 3402). */
export const LOCAL_FACILITATOR = 'http://localhost:3402'

const DEFAULT_NETWORK = 'eip155:8453'
const DEFAULT_USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const DEFAULT_USDC_NAME = 'USD Coin'
const DEFAULT_USDC_VERSION = '2'

/** Well-known token contract addresses across supported chains. */
export const TOKENS = {
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDC_ARB: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDC_ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT_BSC: '0x55d398326f99059fF775485246999027B3197955',
  BUSD_BSC: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
} as const

/**
 * Builds the JSON body for a 402 response.
 * Shape matches x402 v2 PaymentRequired so any x402-aware client can parse it.
 * The `x402Version: 1` field is also included for backwards-compatible clients.
 */
function buildPaymentRequired(url: string, config: PaymentConfig): Record<string, unknown> {
  const {
    amount,
    token = DEFAULT_USDC_BASE,
    network = DEFAULT_NETWORK,
    address,
    maxTimeoutSeconds = 300,
    description,
  } = config

  return {
    // v2 shape
    x402Version: 2,
    resource: { url, description: description ?? 'Payment required' },
    accepts: [
      {
        scheme: 'exact',
        network,
        amount,
        payTo: address,
        maxTimeoutSeconds,
        asset: token,
        extra: {
          name: DEFAULT_USDC_NAME,
          version: DEFAULT_USDC_VERSION,
        },
      },
    ],
  }
}

/**
 * Decodes a base64-encoded payment header into the raw payment payload object.
 * Handles both standard base64 (x402 core) and the older Buffer.from approach.
 */
function decodePaymentHeader(header: string): Record<string, unknown> | null {
  try {
    let json: string
    if (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as typeof globalThis & { atob?: (s: string) => string }).atob === 'function'
    ) {
      const atob = (globalThis as typeof globalThis & { atob: (s: string) => string }).atob
      const binary = atob(header)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      json = new TextDecoder('utf-8').decode(bytes)
    } else {
      json = Buffer.from(header, 'base64').toString('utf-8')
    }
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Base64-encodes a JSON object for transport in a response header. */
function encodeBase64Json(value: unknown): string {
  const json = JSON.stringify(value)
  const btoaFn = (globalThis as typeof globalThis & { btoa?: (s: string) => string }).btoa
  if (typeof btoaFn === 'function') {
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number)
    return btoaFn(binary)
  }
  return Buffer.from(json, 'utf-8').toString('base64')
}

/**
 * Builds the `paymentRequirements` object that /verify and /settle are given.
 * Must match one of the `accepts` entries handed to the client in the 402 body,
 * or the facilitator will reject the payload as mismatched.
 */
function buildRequirements(config: PaymentConfig): Record<string, unknown> {
  const {
    amount,
    token = DEFAULT_USDC_BASE,
    network = DEFAULT_NETWORK,
    address,
    maxTimeoutSeconds = 300,
  } = config

  return {
    scheme: 'exact',
    network,
    amount,
    payTo: address,
    maxTimeoutSeconds,
    asset: token,
    extra: { name: DEFAULT_USDC_NAME, version: DEFAULT_USDC_VERSION },
  }
}

/**
 * Calls the x402 facilitator /verify endpoint to validate a payment payload
 * against the payment requirements.
 *
 * Verification proves the signature is well-formed and the payer is good for the
 * amount. It does NOT move funds and does NOT consume the authorization nonce,
 * so a verified-but-unsettled payload can be replayed. Settlement is what makes
 * a payment final: see {@link settleWithFacilitator}.
 *
 * Returns { isValid: true } on success, { isValid: false, invalidReason } on
 * failure, and throws on network / facilitator errors.
 */
async function verifyWithFacilitator(
  paymentPayload: Record<string, unknown>,
  paymentRequirements: Record<string, unknown>,
  facilitatorUrl: string,
): Promise<{ isValid: boolean; invalidReason?: string; invalidMessage?: string }> {
  const response = await fetch(`${facilitatorUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x402Version: paymentPayload.x402Version ?? 1,
      paymentPayload,
      paymentRequirements,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`Facilitator verify failed (${response.status}): ${text.slice(0, 200)}`)
  }

  return (await response.json()) as {
    isValid: boolean
    invalidReason?: string
    invalidMessage?: string
  }
}

/**
 * Calls the x402 facilitator /settle endpoint to broadcast the transfer on-chain
 * and consume the authorization nonce.
 *
 * This is the call that makes a payment final and non-replayable. Run it before
 * a handler does non-reversible work, not after.
 *
 * Returns the facilitator's settle response, and throws on network / facilitator
 * transport errors.
 */
async function settleWithFacilitator(
  paymentPayload: Record<string, unknown>,
  paymentRequirements: Record<string, unknown>,
  facilitatorUrl: string,
): Promise<{
  success: boolean
  transaction?: string
  network?: string
  payer?: string
  errorReason?: string
}> {
  const response = await fetch(`${facilitatorUrl}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x402Version: paymentPayload.x402Version ?? 1,
      paymentPayload,
      paymentRequirements,
      // agenti-facilitator reads these shorter aliases; x402.org reads the pair above.
      payment: paymentPayload,
      requirements: paymentRequirements,
    }),
  })

  const body = (await response.json().catch(() => null)) as {
    success?: boolean
    settled?: boolean
    transaction?: string
    txHash?: string
    network?: string
    payer?: string
    errorReason?: string
    error?: string
  } | null

  if (!body) {
    throw new Error(`Facilitator settle failed (${response.status}): unreadable response`)
  }

  // The reference facilitator answers { success, transaction }; the bundled
  // agenti-facilitator answers { settled, txHash }. Normalize both.
  const success = body.success ?? body.settled ?? false
  const result: {
    success: boolean
    transaction?: string
    network?: string
    payer?: string
    errorReason?: string
  } = { success }

  const transaction = body.transaction ?? body.txHash
  if (transaction !== undefined) result.transaction = transaction
  if (body.network !== undefined) result.network = body.network
  if (body.payer !== undefined) result.payer = body.payer

  const errorReason = body.errorReason ?? body.error
  if (!success) result.errorReason = errorReason ?? `Settlement failed (${response.status})`

  return result
}

// ---------------------------------------------------------------------------
// Shared payment gate
// ---------------------------------------------------------------------------

/** A gate that let the request through, with the receipt to echo to the caller. */
interface GateAllowed {
  ok: true
  /** Base64 x402 settle receipt for the X-PAYMENT-RESPONSE header, when settled. */
  paymentResponse?: string
}

/** A gate that stopped the request, with the exact response to send. */
interface GateRejected {
  ok: false
  status: number
  body: Record<string, unknown>
}

type GateResult = GateAllowed | GateRejected

/**
 * The full payment gate: decode, verify, and (unless the endpoint opted into
 * soft-gating) settle, before the caller is allowed to run the handler.
 *
 * Every rejection path returns the status and body to send, so the three
 * framework adapters below stay thin and cannot drift apart.
 */
async function runPaymentGate(
  rawHeader: string,
  config: PaymentConfig,
  facilitatorUrl: string,
): Promise<GateResult> {
  const payload = decodePaymentHeader(rawHeader)
  if (!payload) {
    return { ok: false, status: 402, body: { error: 'Invalid payment header encoding' } }
  }

  const requirements = buildRequirements(config)

  let verified: { isValid: boolean; invalidReason?: string; invalidMessage?: string }
  try {
    verified = await verifyWithFacilitator(payload, requirements, facilitatorUrl)
  } catch (err) {
    return {
      ok: false,
      status: 502,
      body: {
        error: 'Facilitator error',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }

  if (!verified.isValid) {
    const body: Record<string, unknown> = { error: verified.invalidReason ?? 'Payment invalid' }
    if (verified.invalidMessage !== undefined) body.message = verified.invalidMessage
    return { ok: false, status: 402, body }
  }

  // Soft gate: the endpoint explicitly accepted replayable, unsettled payments.
  if (config.mode === 'verify') return { ok: true }

  let settled: Awaited<ReturnType<typeof settleWithFacilitator>>
  try {
    settled = await settleWithFacilitator(payload, requirements, facilitatorUrl)
  } catch (err) {
    return {
      ok: false,
      status: 502,
      body: {
        error: 'Facilitator error',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }

  if (!settled.success) {
    return {
      ok: false,
      status: 402,
      body: {
        error: 'Payment settlement failed',
        message: settled.errorReason ?? 'The facilitator could not settle this payment',
      },
    }
  }

  return {
    ok: true,
    paymentResponse: encodeBase64Json({
      success: true,
      transaction: settled.transaction ?? null,
      network: settled.network ?? config.network ?? DEFAULT_NETWORK,
      payer: settled.payer ?? null,
    }),
  }
}

// ---------------------------------------------------------------------------
// Express adapter
// ---------------------------------------------------------------------------

// Minimal Express-compatible type surface so the library has no hard dep on
// the express package while still working with real Express instances.
interface ExpressRequest {
  url: string
  method: string
  headers: Record<string, string | string[] | undefined>
  path?: string
}
interface ExpressResponse {
  status(code: number): ExpressResponse
  json(body: unknown): void
  setHeader(name: string, value: string): void
}
type ExpressNext = (err?: unknown) => void
type ExpressHandler = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNext,
) => Promise<void> | void

/**
 * Wraps an Express route handler with x402 payment enforcement.
 *
 * The payment is settled on-chain before your handler runs, so a handler that
 * ships non-reversible work never runs for an unpaid request.
 *
 * @example
 * ```typescript
 * import express from 'express'
 * import { withPaymentExpress } from '@agenti/sdk/serve'
 *
 * const app = express()
 *
 * app.get(
 *   '/api/secret',
 *   withPaymentExpress(
 *     async (req, res) => { res.json({ secret: 42 }) },
 *     { amount: '100000', address: '0xYourAddress' }
 *   )
 * )
 * ```
 */
export function withPaymentExpress(
  handler: ExpressHandler,
  config: PaymentConfig,
): ExpressHandler {
  const facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR

  return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Check for payment header (support both v1 and v2 header names)
    const rawHeader =
      (req.headers['payment-signature'] as string | undefined) ||
      (req.headers['x-payment'] as string | undefined)

    if (!rawHeader) {
      // Return 402 with payment requirements
      const requirements = buildPaymentRequired(req.url, config)
      res.status(402).json(requirements)
      return
    }

    const gate = await runPaymentGate(rawHeader, config, facilitatorUrl)
    if (!gate.ok) {
      res.status(gate.status).json(gate.body)
      return
    }

    if (gate.paymentResponse) res.setHeader('X-PAYMENT-RESPONSE', gate.paymentResponse)

    return handler(req, res, next)
  }
}

// ---------------------------------------------------------------------------
// Hono adapter
// ---------------------------------------------------------------------------

// Minimal Hono Context surface.
interface HonoContext {
  req: {
    url: string
    method: string
    path: string
    header(name: string): string | undefined
  }
  json(body: unknown, status?: number): Response
  header?(name: string, value: string): void
  status?: number
}
type HonoNext = () => Promise<void>
type HonoHandler = (c: HonoContext, next: HonoNext) => Promise<Response | void>

/**
 * Wraps a Hono route handler with x402 payment enforcement.
 *
 * The payment is settled on-chain before your handler runs, so a handler that
 * ships non-reversible work never runs for an unpaid request.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono'
 * import { withPaymentHono } from '@agenti/sdk/serve'
 *
 * const app = new Hono()
 *
 * app.get(
 *   '/api/secret',
 *   withPaymentHono(
 *     async (c) => c.json({ secret: 42 }),
 *     { amount: '100000', address: '0xYourAddress' }
 *   )
 * )
 * ```
 */
export function withPaymentHono(handler: HonoHandler, config: PaymentConfig): HonoHandler {
  const facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR

  return async (c: HonoContext, next: HonoNext) => {
    const rawHeader =
      c.req.header('payment-signature') || c.req.header('x-payment')

    if (!rawHeader) {
      const requirements = buildPaymentRequired(c.req.url, config)
      return c.json(requirements, 402)
    }

    const gate = await runPaymentGate(rawHeader, config, facilitatorUrl)
    if (!gate.ok) {
      return c.json(gate.body, gate.status)
    }

    if (gate.paymentResponse && typeof c.header === 'function') {
      c.header('X-PAYMENT-RESPONSE', gate.paymentResponse)
    }

    return handler(c, next)
  }
}

// ---------------------------------------------------------------------------
// Next.js App Router adapter
// ---------------------------------------------------------------------------

// We keep Next.js types loose here to avoid a hard dependency on next.
interface NextReqLike {
  url: string
  method: string
  headers: { get(name: string): string | null }
}
interface NextResLike {
  status: number
  headers: Headers
}

type NextHandler<T extends NextResLike = NextResLike> = (
  req: NextReqLike,
) => Promise<T>

/**
 * Wraps a Next.js App Router API route handler with x402 payment enforcement.
 *
 * The payment is settled on-chain before your handler runs, so a handler that
 * ships non-reversible work never runs for an unpaid request.
 *
 * @example
 * ```typescript
 * // app/api/secret/route.ts
 * import { NextRequest, NextResponse } from 'next/server'
 * import { withPayment } from '@agenti/sdk/serve'
 *
 * const handler = async (req: NextRequest) =>
 *   NextResponse.json({ secret: 42 })
 *
 * export const GET = withPayment(handler, {
 *   amount: '100000',
 *   address: '0xYourAddress',
 * })
 * ```
 */
export function withPayment<T extends NextResLike = NextResLike>(
  handler: NextHandler<T>,
  config: PaymentConfig,
): NextHandler<T> {
  const facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR

  return async (req: NextReqLike): Promise<T> => {
    const rawHeader =
      req.headers.get('payment-signature') || req.headers.get('x-payment')

    if (!rawHeader) {
      const requirements = buildPaymentRequired(req.url, config)
      return new Response(JSON.stringify(requirements), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as T
    }

    const gate = await runPaymentGate(rawHeader, config, facilitatorUrl)
    if (!gate.ok) {
      return new Response(JSON.stringify(gate.body), {
        status: gate.status,
        headers: { 'Content-Type': 'application/json' },
      }) as unknown as T
    }

    const response = await handler(req)
    if (gate.paymentResponse && response?.headers?.set) {
      response.headers.set('X-PAYMENT-RESPONSE', gate.paymentResponse)
    }
    return response
  }
}
