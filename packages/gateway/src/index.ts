import { paymentMiddleware, x402ResourceServer, type PaywallConfig } from '@x402/express'
import { HTTPFacilitatorClient, type FacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { ExactSvmScheme } from '@x402/svm/exact/server'

/** Friendly aliases for the CAIP-2 network ids x402 v2 uses. */
export const NETWORKS = {
  base: 'eip155:8453',
  'base-sepolia': 'eip155:84532',
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
} as const

export type NetworkAlias = keyof typeof NETWORKS

/** The public facilitator at x402.org settles testnets only. */
export const TESTNET_FACILITATOR = 'https://x402.org/facilitator'

const TESTNETS = new Set<string>([NETWORKS['base-sepolia'], NETWORKS['solana-devnet']])

export interface RoutePrice {
  /** Dollar price such as "$0.01". Settled in USDC. */
  price: string
  description?: string
  mimeType?: string
}

export interface PaywallOptions {
  /** Route table. Keys are "METHOD /path" (wildcards allowed, e.g. "GET /api/premium/*"). */
  routes: Record<string, string | RoutePrice>
  /** Where payments land. Provide one address per chain family you accept. */
  payTo: { evm?: string; svm?: string }
  /** Networks to accept, as aliases or raw CAIP-2 ids. Defaults to every chain you gave a payTo for, on mainnet. */
  networks?: Array<NetworkAlias | (string & {})>
  /**
   * Facilitator that verifies and settles payments: a URL or a ready client.
   * Defaults to AGENTI_FACILITATOR_URL, then the x402.org testnet facilitator.
   * Mainnet requires one of the first two (for example a self-hosted @agenti/facilitator).
   */
  facilitator?: string | FacilitatorClient
  paywall?: PaywallConfig
  /** Skip fetching supported kinds from the facilitator at startup. */
  syncFacilitatorOnStart?: boolean
}

function resolveNetwork(n: string): string {
  return (NETWORKS as Record<string, string>)[n] ?? n
}

function family(network: string): 'evm' | 'svm' {
  if (network.startsWith('eip155:')) return 'evm'
  if (network.startsWith('solana:')) return 'svm'
  throw new Error(`Unsupported network "${network}". Use an eip155:* or solana:* CAIP-2 id, or one of: ${Object.keys(NETWORKS).join(', ')}`)
}

/**
 * Express middleware that puts routes behind an x402 paywall.
 *
 * ```ts
 * app.use(paywall({
 *   routes: { 'GET /api/data': '$0.01' },
 *   payTo: { evm: '0x...', svm: 'Sol...' },
 *   facilitator: 'https://my-facilitator.example',
 * }))
 * ```
 */
export function paywall(options: PaywallOptions): ReturnType<typeof paymentMiddleware> {
  const { routes, payTo } = options
  if (Object.keys(routes).length === 0) throw new Error('paywall: routes is empty')
  if (!payTo.evm && !payTo.svm) throw new Error('paywall: payTo needs an evm and/or svm address')

  const networks = (options.networks ?? [payTo.evm ? 'base' : undefined, payTo.svm ? 'solana' : undefined].filter(Boolean) as string[]).map(resolveNetwork)
  for (const n of networks) {
    if (!payTo[family(n)]) throw new Error(`paywall: network ${n} needs payTo.${family(n)}`)
  }

  const facilitatorUrl = typeof options.facilitator === 'string' ? options.facilitator : undefined
  const configured = facilitatorUrl ?? process.env['AGENTI_FACILITATOR_URL']
  if (!options.facilitator && !configured && networks.some((n) => !TESTNETS.has(n))) {
    throw new Error(
      'paywall: mainnet networks need a facilitator. Pass `facilitator` or set AGENTI_FACILITATOR_URL (see @agenti/facilitator to self-host one).',
    )
  }
  const client: FacilitatorClient =
    typeof options.facilitator === 'object' ? options.facilitator : new HTTPFacilitatorClient({ url: configured ?? TESTNET_FACILITATOR })

  const server = new x402ResourceServer(client)
  const registered = new Set<string>()
  for (const n of networks) {
    server.register(n as never, family(n) === 'evm' ? new ExactEvmScheme() : new ExactSvmScheme())
    registered.add(n)
  }

  const table: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(routes)) {
    const spec = typeof value === 'string' ? { price: value } : value
    table[key] = {
      accepts: networks.map((n) => ({ scheme: 'exact', price: spec.price, network: n, payTo: payTo[family(n)] })),
      ...(spec.description ? { description: spec.description } : {}),
      ...(spec.mimeType ? { mimeType: spec.mimeType } : {}),
    }
  }

  return paymentMiddleware(table as never, server, options.paywall, undefined, options.syncFacilitatorOnStart)
}

export { x402ResourceServer, paymentMiddleware } from '@x402/express'
