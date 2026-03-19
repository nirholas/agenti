/**
 * Exact Starknet Facilitator Scheme
 *
 * Implements the SchemeNetworkFacilitator interface for Starknet exact payments.
 * Uses x402-starknet to verify and settle via a configured paymaster.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import {
  createProvider,
  verifyPayment,
  settlePayment,
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  type PaymentPayload as StarknetPaymentPayload,
  type PaymentRequirements as StarknetPaymentRequirements,
} from "x402-starknet";
import {
  toStarknetCanonicalCaip,
  toStarknetLegacyCaip,
  type StarknetCaipId,
  type StarknetLegacyCaipId,
} from "../../networks.js";

export interface StarknetConfig {
  /** CAIP-2 network identifier (e.g., "starknet:SN_MAIN") */
  network: StarknetCaipId;
  /** RPC URL for Starknet network */
  rpcUrl: string;
  /** Paymaster endpoint to use for settlement */
  paymasterEndpoint: string;
  /** Optional paymaster API key */
  paymasterApiKey?: string;
  /** Sponsor address for /supported signers */
  sponsorAddress: string;
}

function hasTypedData(
  payload: StarknetPaymentPayload
): payload is StarknetPaymentPayload & { typedData: Record<string, unknown> } {
  const typedData = (payload as { typedData?: unknown }).typedData;
  return (
    typeof typedData === "object" && typedData !== null && !Array.isArray(typedData)
  );
}

function parseStarknetPayload(
  payload: PaymentPayload
): StarknetPaymentPayload | null {
  const legacyNetwork = toStarknetLegacyCaip(payload.accepted.network);
  if (!legacyNetwork) {
    return null;
  }

  const parsed = PAYMENT_PAYLOAD_SCHEMA.safeParse({
    ...payload,
    accepted: {
      ...payload.accepted,
      network: legacyNetwork,
    },
  });
  return parsed.success ? parsed.data : null;
}

function parseStarknetRequirements(
  requirements: PaymentRequirements
): StarknetPaymentRequirements | null {
  const legacyNetwork = toStarknetLegacyCaip(requirements.network);
  if (!legacyNetwork) {
    return null;
  }

  const parsed = PAYMENT_REQUIREMENTS_SCHEMA.safeParse({
    ...requirements,
    network: legacyNetwork,
  });
  return parsed.success ? parsed.data : null;
}

export class ExactStarknetScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "starknet:*";

  private readonly provider: ReturnType<typeof createProvider>;
  private readonly canonicalNetwork: StarknetCaipId;
  private readonly legacyNetwork: StarknetLegacyCaipId;
  private readonly config: StarknetConfig;

  constructor(config: StarknetConfig) {
    if (!config.sponsorAddress) {
      throw new Error("Starknet sponsor address is required.");
    }
    const canonicalNetwork = toStarknetCanonicalCaip(config.network);
    if (!canonicalNetwork) {
      throw new Error(`Unsupported Starknet network: ${config.network}`);
    }

    const legacyNetwork = toStarknetLegacyCaip(canonicalNetwork);
    if (!legacyNetwork) {
      throw new Error(`Unsupported Starknet network: ${config.network}`);
    }

    this.canonicalNetwork = canonicalNetwork;
    this.legacyNetwork = legacyNetwork;
    this.config = { ...config, network: canonicalNetwork };
    this.provider = createProvider({
      network: legacyNetwork,
      rpcUrl: config.rpcUrl,
    });
  }

  getExtra(_network: string): Record<string, unknown> | undefined {
    return {
      paymasterEndpoint: this.config.paymasterEndpoint,
      sponsorAddress: this.config.sponsorAddress,
    };
  }

  getSigners(_network: string): string[] {
    return [this.config.sponsorAddress];
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const parsedPayload = parseStarknetPayload(payload);
    const parsedRequirements = parseStarknetRequirements(requirements);

    if (!parsedPayload) {
      return { isValid: false, invalidReason: "invalid_payload" };
    }
    if (!parsedRequirements) {
      return { isValid: false, invalidReason: "invalid_payment_requirements" };
    }
    if (!hasTypedData(parsedPayload)) {
      return { isValid: false, invalidReason: "invalid_payload" };
    }
    return verifyPayment(
      this.provider,
      parsedPayload,
      parsedRequirements
    );
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const parsedPayload = parseStarknetPayload(payload);
    const parsedRequirements = parseStarknetRequirements(requirements);

    if (!parsedPayload) {
      return {
        success: false,
        errorReason: "invalid_payload",
        transaction: "",
        network: requirements.network,
      };
    }

    if (!parsedRequirements) {
      return {
        success: false,
        errorReason: "invalid_payment_requirements",
        transaction: "",
        network: requirements.network,
      };
    }

    if (!hasTypedData(parsedPayload)) {
      return {
        success: false,
        errorReason: "invalid_payload",
        transaction: "",
        network: requirements.network,
      };
    }
    return settlePayment(
      this.provider,
      parsedPayload,
      parsedRequirements,
      {
        paymasterConfig: {
          endpoint: this.config.paymasterEndpoint,
          network: this.legacyNetwork,
          ...(this.config.paymasterApiKey
            ? { apiKey: this.config.paymasterApiKey }
            : {}),
        },
      }
    ).then((result) => ({
      ...result,
      network: this.canonicalNetwork,
    }));
  }
}
