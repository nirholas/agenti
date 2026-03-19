/**
 * Exact Starknet Client Scheme
 *
 * Client-side implementation for Starknet exact payments.
 * Requires typedData to be present for settlement.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";
import type { Account } from "starknet";
import {
  createPaymentPayload,
  DEFAULT_PAYMASTER_ENDPOINTS,
  PAYMENT_REQUIREMENTS_SCHEMA,
  type PaymentRequirements as StarknetPaymentRequirements,
} from "x402-starknet";
import {
  toStarknetCanonicalCaip,
  toStarknetLegacyCaip,
  type StarknetCaipId,
  type StarknetLegacyCaipId,
} from "../../networks.js";

// ============================================================================
// Types
// ============================================================================

export interface ExactStarknetClientSchemeConfig {
  /** User account for signing Starknet typed data */
  account: Account;
  /** Paymaster endpoint override (string for all networks or per-network map) */
  paymasterEndpoint?: string | Partial<Record<StarknetCaipId, string>>;
  /** Paymaster API key (string for all networks or per-network map) */
  paymasterApiKey?: string | Partial<Record<StarknetCaipId, string>>;
}

export interface ExactStarknetClientConfig extends ExactStarknetClientSchemeConfig {
  /** Optional specific networks to register (defaults to mainnet + sepolia) */
  networks?: StarknetCaipId | StarknetCaipId[];
}

const DEFAULT_STARKNET_CLIENT_NETWORKS: StarknetCaipId[] = [
  "starknet:SN_MAIN",
  "starknet:SN_SEPOLIA",
];

// ============================================================================
// Helpers
// ============================================================================

export function assertStarknetTypedData(
  payload: unknown
): asserts payload is { typedData: Record<string, unknown> } {
  const typedData = (payload as { typedData?: unknown }).typedData;
  const isObject =
    typeof typedData === "object" && typedData !== null && !Array.isArray(typedData);
  if (!isObject) {
    throw new Error("Starknet payment payload missing typedData (required).");
  }
}

function toStarknetRequirements(
  requirements: PaymentRequirements,
  legacyNetwork: StarknetLegacyCaipId
): StarknetPaymentRequirements {
  const parsed = PAYMENT_REQUIREMENTS_SCHEMA.safeParse({
    ...requirements,
    network: legacyNetwork,
  });
  if (parsed.success) {
    return parsed.data;
  }

  const message = parsed.error.issues.map((issue) => issue.message).join("; ");
  throw new Error(`Invalid Starknet payment requirements: ${message}`);
}

function resolvePaymasterEndpoint(
  network: StarknetCaipId,
  override?: string | Partial<Record<StarknetCaipId, string>>
): string {
  if (typeof override === "string") {
    return override;
  }
  if (override?.[network]) {
    return override[network] as string;
  }
  const legacyNetwork = toStarknetLegacyCaip(network);
  if (!legacyNetwork) {
    throw new Error(`Unsupported Starknet network: ${network}`);
  }
  return DEFAULT_PAYMASTER_ENDPOINTS[legacyNetwork];
}

function resolvePaymasterApiKey(
  network: StarknetCaipId,
  override?: string | Partial<Record<StarknetCaipId, string>>
): string | undefined {
  if (typeof override === "string") {
    return override;
  }
  return override?.[network];
}

// ============================================================================
// Client Scheme
// ============================================================================

export class ExactStarknetClientScheme implements SchemeNetworkClient {
  readonly scheme = "exact";

  private readonly account: Account;
  private readonly paymasterEndpoint?: string | Partial<Record<StarknetCaipId, string>>;
  private readonly paymasterApiKey?: string | Partial<Record<StarknetCaipId, string>>;

  constructor(config: ExactStarknetClientSchemeConfig) {
    if (!config.account) {
      throw new Error("Starknet account is required.");
    }
    this.account = config.account;
    this.paymasterEndpoint = config.paymasterEndpoint;
    this.paymasterApiKey = config.paymasterApiKey;
  }

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<
    Pick<PaymentPayload, "x402Version" | "payload"> & {
      typedData: Record<string, unknown>;
      paymasterEndpoint: string;
    }
  > {
    const canonicalNetwork = toStarknetCanonicalCaip(requirements.network);
    if (!canonicalNetwork) {
      throw new Error(`Unsupported Starknet network: ${requirements.network}`);
    }

    const legacyNetwork = toStarknetLegacyCaip(canonicalNetwork);
    if (!legacyNetwork) {
      throw new Error(`Unsupported Starknet network: ${requirements.network}`);
    }

    const starknetRequirements = toStarknetRequirements(
      requirements,
      legacyNetwork
    );
    const network = legacyNetwork;
    const paymasterEndpoint = resolvePaymasterEndpoint(
      canonicalNetwork,
      this.paymasterEndpoint
    );
    const paymasterApiKey = resolvePaymasterApiKey(
      canonicalNetwork,
      this.paymasterApiKey
    );

    const paymentPayload = await createPaymentPayload(
      this.account,
      x402Version,
      starknetRequirements,
      {
        endpoint: paymasterEndpoint,
        network,
        ...(paymasterApiKey ? { apiKey: paymasterApiKey } : {}),
      }
    );

    assertStarknetTypedData(paymentPayload);

    return {
      x402Version: paymentPayload.x402Version,
      payload: paymentPayload.payload as unknown as Record<string, unknown>,
      typedData: paymentPayload.typedData,
      paymasterEndpoint: paymentPayload.paymasterEndpoint ?? paymasterEndpoint,
    };
  }
}

// ============================================================================
// Registration Helper
// ============================================================================

export function registerExactStarknetClientScheme(
  client: { register(network: string, scheme: SchemeNetworkClient): unknown },
  config: ExactStarknetClientConfig
): ExactStarknetClientScheme {
  const { networks, ...schemeConfig } = config;
  const scheme = new ExactStarknetClientScheme(schemeConfig);
  const registerNetworks = Array.isArray(networks)
    ? networks
    : networks
      ? [networks]
      : DEFAULT_STARKNET_CLIENT_NETWORKS;

  for (const network of registerNetworks) {
    client.register(network, scheme);
  }

  return scheme;
}
