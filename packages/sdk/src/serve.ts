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
 *      the x402 facilitator (https://x402.org/facilitator by default), then calls
 *      the wrapped handler.
 *
 * Supports Express (Request/Response/NextFunction), Hono (Context), and
 * Next.js App Router (NextRequest → NextResponse) handler signatures.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/**
 * Calls the x402 facilitator /verify endpoint to validate a payment payload
 * against the payment requirements.
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

    // Decode and verify
    const payload = decodePaymentHeader(rawHeader)
    if (!payload) {
      res.status(402).json({ error: 'Invalid payment header encoding' })
      return
    }

    const {
      amount,
      token = DEFAULT_USDC_BASE,
      network = DEFAULT_NETWORK,
      address,
      maxTimeoutSeconds = 300,
    } = config

    const requirements = {
      scheme: 'exact',
      network,
      amount,
      payTo: address,
      maxTimeoutSeconds,
      asset: token,
      extra: { name: DEFAULT_USDC_NAME, version: DEFAULT_USDC_VERSION },
    }

    try {
      const result = await verifyWithFacilitator(payload, requirements, facilitatorUrl)
      if (!result.isValid) {
        res.status(402).json({
          error: result.invalidReason ?? 'Payment invalid',
          message: result.invalidMessage,
        })
        return
      }
    } catch (err) {
      res.status(502).json({
        error: 'Facilitator error',
        message: err instanceof Error ? err.message : String(err),
      })
      return
    }

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
  status?: number
}
type HonoNext = () => Promise<void>
type HonoHandler = (c: HonoContext, next: HonoNext) => Promise<Response | void>

/**
 * Wraps a Hono route handler with x402 payment enforcement.
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

    const payload = decodePaymentHeader(rawHeader)
    if (!payload) {
      return c.json({ error: 'Invalid payment header encoding' }, 402)
    }

    const {
      amount,
      token = DEFAULT_USDC_BASE,
      network = DEFAULT_NETWORK,
      address,
      maxTimeoutSeconds = 300,
    } = config

    const requirements = {
      scheme: 'exact',
      network,
      amount,
      payTo: address,
      maxTimeoutSeconds,
      asset: token,
      extra: { name: DEFAULT_USDC_NAME, version: DEFAULT_USDC_VERSION },
    }

    try {
      const result = await verifyWithFacilitator(payload, requirements, facilitatorUrl)
      if (!result.isValid) {
        return c.json(
          {
            error: result.invalidReason ?? 'Payment invalid',
            message: result.invalidMessage,
          },
          402,
        )
      }
    } catch (err) {
      return c.json(
        {
          error: 'Facilitator error',
          message: err instanceof Error ? err.message : String(err),
        },
        502,
      )
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

    const payload = decodePaymentHeader(rawHeader)
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment header encoding' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      ) as unknown as T
    }

    const {
      amount,
      token = DEFAULT_USDC_BASE,
      network = DEFAULT_NETWORK,
      address,
      maxTimeoutSeconds = 300,
    } = config

    const requirements = {
      scheme: 'exact',
      network,
      amount,
      payTo: address,
      maxTimeoutSeconds,
      asset: token,
      extra: { name: DEFAULT_USDC_NAME, version: DEFAULT_USDC_VERSION },
    }

    try {
      const result = await verifyWithFacilitator(payload, requirements, facilitatorUrl)
      if (!result.isValid) {
        return new Response(
          JSON.stringify({
            error: result.invalidReason ?? 'Payment invalid',
            message: result.invalidMessage,
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } },
        ) as unknown as T
      }
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Facilitator error',
          message: err instanceof Error ? err.message : String(err),
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ) as unknown as T
    }

    return handler(req)
  }
}
