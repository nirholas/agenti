/**
 * Transport-agnostic v2 ↔ v1 protocol adapter.
 *
 * The x402 v2 protocol uses CAIP-2 network identifiers, a different field
 * layout (amount vs maxAmountRequired, resource/accepted envelope), and the
 * same underlying ERC-3009 signatures. Internally the SDK speaks v1 everywhere
 * (treasurer, wallet, types), so this module converts at the protocol boundary.
 */

import type {
  PaymentPayload as V2PaymentPayload,
  PaymentRequired as V2PaymentRequired,
  PaymentRequirements as V2PaymentRequirements,
} from "@x402/core/types"
import { ChainIdToNetwork, EvmNetworkToChainId, type PaymentPayload, type PaymentRequirements } from "x402/types"

const DEFAULT_MAX_TIMEOUT_SECONDS = 300

// ============================================================================
// Network Conversion
// ============================================================================

/**
 * Convert a v1 network name to CAIP-2 format.
 *
 * @example
 * v1NetworkToCaip2("base-sepolia") // => "eip155:84532"
 * v1NetworkToCaip2("base")         // => "eip155:8453"
 */
export function v1NetworkToCaip2(network: string): `eip155:${number}` {
  const chainId = EvmNetworkToChainId.get(network as Parameters<typeof EvmNetworkToChainId.get>[0])
  if (chainId === undefined) {
    throw new Error(`Unknown v1 network: ${network}`)
  }
  return `eip155:${chainId}`
}

/**
 * Extract chain ID from a CAIP-2 identifier or passthrough.
 *
 * @example
 * parseCaip2ChainId("eip155:8453") // => 8453
 * parseCaip2ChainId("8453")        // => 8453
 */
export function parseCaip2ChainId(network: string): number {
  const parts = network.split(":")
  const chainIdStr = parts.length > 1 ? parts[1] : parts[0]
  return parseInt(chainIdStr, 10)
}

/**
 * Convert a CAIP-2 network identifier to v1 network name.
 *
 * @example
 * caip2ToV1Network("eip155:84532") // => "base-sepolia"
 * caip2ToV1Network("eip155:8453")  // => "base"
 */
export function caip2ToV1Network(network: string): string {
  const chainId = parseCaip2ChainId(network)
  const v1Network = ChainIdToNetwork[chainId]
  if (!v1Network) {
    throw new Error(`Unknown chain ID: ${chainId}`)
  }
  return v1Network
}

// ============================================================================
// V2 Payment Context
// ============================================================================

/**
 * Original v2 data preserved for building the outbound payment.
 */
export interface V2PaymentContext {
  /** The resource info from the v2 payment required response */
  resource: V2PaymentRequired["resource"]
  /** The original v2 requirements for reconstructing the accepted field */
  originalRequirements: V2PaymentRequirements
}

// ============================================================================
// Inbound: v2 → v1 Conversion
// ============================================================================

/**
 * Convert v2 PaymentRequirements to v1 format.
 *
 * This allows the treasurer and wallet (which speak v1) to process v2 requirements.
 */
export function v2RequirementsToV1(
  v2Req: V2PaymentRequirements,
  resource: V2PaymentRequired["resource"],
): PaymentRequirements {
  const v1Network = caip2ToV1Network(v2Req.network)

  return {
    scheme: v2Req.scheme as "exact",
    network: v1Network as PaymentRequirements["network"],
    maxAmountRequired: v2Req.amount,
    resource: resource.url,
    description: resource.description || resource.url,
    mimeType: resource.mimeType || "",
    payTo: v2Req.payTo,
    maxTimeoutSeconds: v2Req.maxTimeoutSeconds ?? DEFAULT_MAX_TIMEOUT_SECONDS,
    asset: v2Req.asset,
    extra: v2Req.extra ?? {},
  }
}

// ============================================================================
// Outbound: v1 → v2 Conversion
// ============================================================================

/**
 * Build a v2 PaymentPayload from a v1 payment payload.
 *
 * The accepted field is reconstructed from the original v2 requirements.
 */
export function v1PayloadToV2(
  v1Payload: PaymentPayload,
  context: V2PaymentContext,
): Pick<V2PaymentPayload, "x402Version" | "payload"> & Partial<V2PaymentPayload> {
  return {
    x402Version: 2,
    resource: context.resource,
    accepted: context.originalRequirements,
    payload: v1Payload.payload,
  }
}
