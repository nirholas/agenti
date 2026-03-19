import type {
  PaymentCreatedContext,
  PaymentCreationContext,
  PaymentCreationFailureContext,
  x402Client,
} from "@x402/core/client"
import type {
  PaymentPayload as V2PaymentPayload,
  PaymentRequired as V2PaymentRequired,
  PaymentRequirements as V2PaymentRequirements,
} from "@x402/core/types"
import type { PaymentRequirements } from "x402/types"

import type { Authorization, X402Treasurer } from "../treasurer.ts"
import { v1NetworkToCaip2, v1PayloadToV2, v2RequirementsToV1, type V2PaymentContext } from "./v2-adapter.ts"

/** Store entry for v1 payments */
interface V1StoreEntry {
  version: 1
  authorization: Authorization
}

/** Store entry for v2 payments (includes context for payload conversion) */
interface V2StoreEntry {
  version: 2
  authorization: Authorization
  context: V2PaymentContext
}

type StoreEntry = V1StoreEntry | V2StoreEntry

/**
 * Scheme client that retrieves payments from the treasurer via a shared WeakMap.
 * Compatible with @x402/core's SchemeNetworkClient interface for v1 protocol.
 *
 * Note: We don't implement SchemeNetworkClient directly because @x402/core
 * exports v2 types, but registerV1() passes v1 types at runtime.
 */
class TreasurerSchemeClientV1 {
  readonly scheme = "exact"

  constructor(private readonly paymentStore: WeakMap<object, StoreEntry>) {}

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements,
  ): Promise<{ x402Version: number; scheme: string; network: string; payload: Record<string, unknown> }> {
    const entry = this.paymentStore.get(requirements)
    if (!entry) {
      throw new Error("No payment authorization found for requirements")
    }

    // Clean up after retrieval
    this.paymentStore.delete(requirements)

    return {
      x402Version,
      scheme: entry.authorization.payment.scheme,
      network: entry.authorization.payment.network,
      payload: entry.authorization.payment.payload,
    }
  }
}

/**
 * Scheme client for v2 protocol.
 * Converts v1 payment payloads to v2 format using stored context.
 */
class TreasurerSchemeClientV2 {
  readonly scheme = "exact"

  constructor(private readonly paymentStore: WeakMap<object, StoreEntry>) {}

  async createPaymentPayload(
    x402Version: number,
    requirements: V2PaymentRequirements,
  ): Promise<Pick<V2PaymentPayload, "x402Version" | "payload">> {
    const entry = this.paymentStore.get(requirements)
    if (!entry || entry.version !== 2) {
      throw new Error("No v2 payment authorization found for requirements")
    }

    // Clean up after retrieval
    this.paymentStore.delete(requirements)

    // Convert v1 payment to v2 format
    return v1PayloadToV2(entry.authorization.payment, entry.context)
  }
}

/**
 * Detect if requirements are v2 format (has 'amount' field instead of 'maxAmountRequired').
 */
function isV2Requirements(requirements: unknown): requirements is V2PaymentRequirements {
  return (
    typeof requirements === "object" &&
    requirements !== null &&
    "amount" in requirements &&
    !("maxAmountRequired" in requirements)
  )
}

/**
 * Wraps an x402Client to use an ampersend-sdk treasurer for payment decisions.
 *
 * This adapter integrates ampersend-sdk treasurers with Coinbase's x402 SDK,
 * allowing you to use sophisticated payment authorization logic (budgets, policies,
 * approvals) with the standard x402 HTTP client ecosystem.
 *
 * Supports both v1 and v2 x402 protocols. The underlying wallets produce v1 payment
 * payloads which are automatically converted to v2 format when needed.
 *
 * @param client - The x402Client instance to wrap
 * @param treasurer - The X402Treasurer that handles payment authorization
 * @param networks - Array of v1 network names to register (e.g., 'base', 'base-sepolia')
 * @returns The configured x402Client instance (same instance, mutated)
 *
 * @example
 * ```typescript
 * import { x402Client } from '@x402/core/client'
 * import { wrapFetchWithPayment } from '@x402/fetch'
 * import { wrapWithAmpersend, NaiveTreasurer, AccountWallet } from '@ampersend_ai/ampersend-sdk'
 *
 * const wallet = AccountWallet.fromPrivateKey('0x...')
 * const treasurer = new NaiveTreasurer(wallet)
 *
 * const client = wrapWithAmpersend(
 *   new x402Client(),
 *   treasurer,
 *   ['base', 'base-sepolia']
 * )
 *
 * const fetchWithPay = wrapFetchWithPayment(fetch, client)
 * const response = await fetchWithPay('https://paid-api.com/endpoint')
 * ```
 */
export function wrapWithAmpersend(client: x402Client, treasurer: X402Treasurer, networks: Array<string>): x402Client {
  // Shared store for correlating payments between hooks and scheme clients
  // Keyed by the original requirements object (v1 or v2)
  const paymentStore = new WeakMap<object, StoreEntry>()

  // Create scheme clients for both v1 and v2
  const schemeClientV1 = new TreasurerSchemeClientV1(paymentStore)
  const schemeClientV2 = new TreasurerSchemeClientV2(paymentStore)

  // Register for both v1 and v2 protocols on each network
  for (const network of networks) {
    // v1: uses network names like "base-sepolia"
    client.registerV1(network, schemeClientV1 as any)

    // v2: uses CAIP-2 format like "eip155:84532"
    const caip2Network = v1NetworkToCaip2(network)
    client.register(caip2Network, schemeClientV2 as any)
  }

  // Track authorization for status updates (keyed by original requirements)
  const authorizationByRequirements = new WeakMap<object, Authorization>()

  // beforePaymentCreation: Consult treasurer for payment authorization
  client.onBeforePaymentCreation(async (context: PaymentCreationContext) => {
    const originalRequirements = context.selectedRequirements
    const paymentRequired = context.paymentRequired as V2PaymentRequired

    // Convert v2 requirements to v1 for treasurer (which speaks v1 internally)
    let v1Requirements: PaymentRequirements
    let storeEntry: StoreEntry

    if (isV2Requirements(originalRequirements)) {
      // v2 path: convert to v1 for treasurer
      v1Requirements = v2RequirementsToV1(originalRequirements, paymentRequired.resource)

      const authorization = await treasurer.onPaymentRequired([v1Requirements], {
        method: "http",
        params: {
          resource: paymentRequired.resource.url,
        },
      })

      if (!authorization) {
        return { abort: true, reason: "Payment declined by treasurer" }
      }

      // Store v2 entry with context for payload conversion
      storeEntry = {
        version: 2,
        authorization,
        context: {
          resource: paymentRequired.resource,
          originalRequirements,
        },
      }

      paymentStore.set(originalRequirements, storeEntry)
      authorizationByRequirements.set(originalRequirements, authorization)
    } else {
      // v1 path: pass directly to treasurer
      v1Requirements = originalRequirements as unknown as PaymentRequirements

      const authorization = await treasurer.onPaymentRequired([v1Requirements], {
        method: "http",
        params: {
          resource: paymentRequired.resource,
        },
      })

      if (!authorization) {
        return { abort: true, reason: "Payment declined by treasurer" }
      }

      // Store v1 entry
      storeEntry = {
        version: 1,
        authorization,
      }

      paymentStore.set(originalRequirements, storeEntry)
      authorizationByRequirements.set(originalRequirements, authorization)
    }

    return
  })

  // afterPaymentCreation: Notify treasurer payment is being sent
  client.onAfterPaymentCreation(async (context: PaymentCreatedContext) => {
    const paymentRequired = context.paymentRequired as V2PaymentRequired
    const authorization = authorizationByRequirements.get(context.selectedRequirements)
    if (authorization) {
      // Extract resource URL (v2 has resource.url, v1 has resource as string)
      const resourceUrl =
        typeof paymentRequired.resource === "object" ? paymentRequired.resource.url : paymentRequired.resource
      await treasurer.onStatus("sending", authorization, {
        method: "http",
        params: {
          resource: resourceUrl,
        },
      })
    }
  })

  // onPaymentCreationFailure: Notify treasurer of error
  client.onPaymentCreationFailure(async (context: PaymentCreationFailureContext) => {
    const paymentRequired = context.paymentRequired as V2PaymentRequired
    const authorization = authorizationByRequirements.get(context.selectedRequirements)
    if (authorization) {
      // Extract resource URL (v2 has resource.url, v1 has resource as string)
      const resourceUrl =
        typeof paymentRequired.resource === "object" ? paymentRequired.resource.url : paymentRequired.resource
      await treasurer.onStatus("error", authorization, {
        method: "http",
        params: {
          resource: resourceUrl,
          error: context.error.message,
        },
      })
    }

    // Don't recover - let the error propagate
    return
  })

  return client
}
