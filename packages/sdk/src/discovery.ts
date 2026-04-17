/**
 * discovery.ts — x402scan-compatible discovery document builders.
 *
 * Generates OpenAPI 3.1 specs and /.well-known/x402 manifests from
 * route definitions so agents can reliably discover and invoke x402-gated APIs.
 *
 * Usage:
 *   import { withDiscoveryExpress } from '@agenti/sdk'
 *   withDiscoveryExpress(app, routes, { title: 'My API' })
 */

import type { PaymentConfig } from './serve.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A payment-gated route that returns 402 until paid. */
export interface PayableRouteSpec {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payment: PaymentConfig
  summary?: string
  description?: string
  /** JSON Schema for the request body (required for strict x402scan parsing). */
  inputSchema?: Record<string, unknown>
}

/** A route that requires SIWX wallet identity but no payment. */
export interface SiwxRouteSpec {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  siwx: true
  summary?: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/** An unauthenticated/free route to include in the OpenAPI document. */
export interface FreeRouteSpec {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  summary?: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export type RouteSpec = PayableRouteSpec | SiwxRouteSpec | FreeRouteSpec

export interface OpenAPIOptions {
  title: string
  version?: string
  /** High-level usage guidance shown to agents during discovery. */
  guidance?: string
  description?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDC_DECIMALS = 6

function isPayable(r: RouteSpec): r is PayableRouteSpec {
  return 'payment' in r
}

function isSiwx(r: RouteSpec): r is SiwxRouteSpec {
  return 'siwx' in r && (r as SiwxRouteSpec).siwx === true
}

/** Convert token amount in smallest units to human-readable USD string. */
function toUsdAmount(amount: string, token?: string): string {
  const addr = (token ?? USDC_BASE).toLowerCase()
  // Only USDC (Base) uses 6 decimals — fall back to raw amount for other tokens.
  if (addr === USDC_BASE.toLowerCase()) {
    const val = Number(amount) / 10 ** USDC_DECIMALS
    return val.toFixed(val < 0.01 ? 6 : 2)
  }
  return amount
}

function buildPathItem(route: RouteSpec, hasSiwx: boolean): Record<string, unknown> {
  const method = route.method.toLowerCase()
  const op: Record<string, unknown> = {}

  if (route.summary) op.summary = route.summary
  if (route.description) op.description = route.description

  if ('inputSchema' in route && route.inputSchema) {
    op.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: route.inputSchema,
        },
      },
    }
  }

  const responses: Record<string, unknown> = {
    '200': { description: 'OK' },
  }

  if (isPayable(route)) {
    const { amount, token, network = 'eip155:8453' } = route.payment
    const usdAmount = toUsdAmount(amount, token)

    op['x-payment-info'] = {
      price: { mode: 'fixed', currency: 'USD', amount: usdAmount },
      protocols: [
        { x402: {} },
        { mpp: { method: '', intent: '', currency: '' } },
      ],
    }

    const networkLabel = network.startsWith('eip155:') ? `Chain ${network.split(':')[1]}` : network
    responses['402'] = {
      description: `Payment Required — ${usdAmount} USD on ${networkLabel}`,
    }
  } else if (isSiwx(route) && hasSiwx) {
    op.security = [{ siwx: [] }]
    responses['401'] = { description: 'Unauthorized — SIWX wallet proof required' }
  }

  op.responses = responses

  return { [method]: op }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an OpenAPI 3.1 document from a list of route specs.
 *
 * @example
 * ```ts
 * const spec = buildOpenAPI(routes, { title: 'My API', guidance: 'Call /api/quote to get a price quote.' })
 * ```
 */
export function buildOpenAPI(
  routes: RouteSpec[],
  options: OpenAPIOptions,
): Record<string, unknown> {
  const { title, version = '1.0.0', guidance, description } = options

  const hasSiwxRoutes = routes.some(isSiwx)
  const paths: Record<string, unknown> = {}

  for (const route of routes) {
    const item = buildPathItem(route, hasSiwxRoutes)
    if (paths[route.path]) {
      Object.assign(paths[route.path] as object, item)
    } else {
      paths[route.path] = item
    }
  }

  const info: Record<string, unknown> = { title, version }
  if (description) info.description = description
  if (guidance) info['x-guidance'] = guidance

  const doc: Record<string, unknown> = {
    openapi: '3.1.0',
    info,
    paths,
  }

  if (hasSiwxRoutes) {
    doc.components = {
      securitySchemes: {
        siwx: {
          type: 'apiKey',
          in: 'header',
          name: 'SIGN-IN-WITH-X',
          description: 'Wallet-signed identity proof (SIWX). Use fetch_with_auth from agentcash.',
        },
      },
    }
  }

  return doc
}

/**
 * Build a /.well-known/x402 manifest listing all payable resources.
 *
 * @example
 * ```ts
 * const manifest = buildWellKnown(routes)
 * // { version: 1, resources: ["POST /api/quote"] }
 * ```
 */
export function buildWellKnown(routes: RouteSpec[]): { version: 1; resources: string[] } {
  const resources = routes
    .filter(isPayable)
    .map((r) => `${r.method.toUpperCase()} ${r.path}`)

  return { version: 1, resources }
}

// ---------------------------------------------------------------------------
// Express adapter
// ---------------------------------------------------------------------------

// Minimal Express app surface to avoid hard dep on express types.
interface ExpressApp {
  get(path: string, handler: (req: unknown, res: ExpressResLike) => void): void
}

interface ExpressResLike {
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

// ---------------------------------------------------------------------------
// Next.js App Router handlers
// ---------------------------------------------------------------------------

const JSON_CT = { 'Content-Type': 'application/json' }

/**
 * Next.js App Router GET handler for `/openapi.json`.
 *
 * @example
 * ```ts
 * // app/openapi.json/route.ts
 * import { openApiNextHandler } from '@agenti/sdk'
 * export const GET = openApiNextHandler(routes, { title: 'My API' })
 * ```
 */
export function openApiNextHandler(
  routes: RouteSpec[],
  options: OpenAPIOptions,
): () => Response {
  const body = JSON.stringify(buildOpenAPI(routes, options), null, 2)
  return () => new Response(body, { headers: JSON_CT })
}

/**
 * Next.js App Router GET handler for `/.well-known/x402`.
 *
 * @example
 * ```ts
 * // app/.well-known/x402/route.ts
 * import { wellKnownNextHandler } from '@agenti/sdk'
 * export const GET = wellKnownNextHandler(routes)
 * ```
 */
export function wellKnownNextHandler(routes: RouteSpec[]): () => Response {
  const body = JSON.stringify(buildWellKnown(routes))
  return () => new Response(body, { headers: JSON_CT })
}

// ---------------------------------------------------------------------------
// SIWX middleware
// ---------------------------------------------------------------------------

/**
 * The HTTP header name for SIWX (Sign-In with X) wallet identity proofs.
 * Agents with an agentcash wallet supply this automatically.
 */
export const SIWX_HEADER = 'SIGN-IN-WITH-X'

type NextLikeReq = { headers: { get(name: string): string | null }; url: string }
type NextLikeHandler<T> = (req: NextLikeReq) => Promise<T>

/**
 * Next.js-compatible SIWX gate. Returns 401 if the SIGN-IN-WITH-X header is
 * absent. Does not verify the signature — pass the header to a SIWX verifier
 * if you need cryptographic validation.
 *
 * @example
 * ```ts
 * // app/api/me/route.ts
 * import { withSiwx } from '@agenti/sdk'
 * export const GET = withSiwx(async (req) => Response.json({ ok: true }))
 * ```
 */
export function withSiwx<T extends { status: number }>(
  handler: NextLikeHandler<T>,
): NextLikeHandler<T> {
  return async (req) => {
    if (!req.headers.get(SIWX_HEADER)) {
      return new Response(
        JSON.stringify({ error: 'SIGN-IN-WITH-X header required' }),
        { status: 401, headers: JSON_CT },
      ) as unknown as T
    }
    return handler(req)
  }
}

// ---------------------------------------------------------------------------
// Express adapter
// ---------------------------------------------------------------------------

// Minimal Express app surface to avoid hard dep on express types.
/**
 * Mount /openapi.json and /.well-known/x402 routes on an Express app.
 *
 * @example
 * ```ts
 * import express from 'express'
 * import { withDiscoveryExpress, withPaymentExpress } from '@agenti/sdk'
 *
 * const app = express()
 *
 * const routes = [
 *   {
 *     path: '/api/quote',
 *     method: 'POST' as const,
 *     payment: { amount: '50000', address: '0x...' },
 *     summary: 'Get a price quote',
 *     inputSchema: { type: 'object', properties: { symbol: { type: 'string' } } },
 *   },
 * ]
 *
 * withDiscoveryExpress(app, routes, { title: 'Quote API', guidance: 'POST /api/quote with a symbol.' })
 *
 * app.post('/api/quote', withPaymentExpress(handler, routes[0].payment))
 * ```
 */
export function withDiscoveryExpress(
  app: ExpressApp,
  routes: RouteSpec[],
  options: OpenAPIOptions,
): void {
  const openapi = buildOpenAPI(routes, options)
  const wellKnown = buildWellKnown(routes)

  app.get('/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.json(openapi)
  })

  app.get('/.well-known/x402', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.json(wellKnown)
  })
}
