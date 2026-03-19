import { x402, x402v2, facilitator } from "@faremeter/types";
import {
  adaptRequirementsV1ToV2,
  adaptRequirementsV2ToV1,
  adaptSupportedKindV1ToV2,
  adaptVerifyResponseV1ToV2,
  adaptSettleResponseLegacyToV2,
} from "@faremeter/types/x402-adapters";
import { normalizeNetworkId } from "@faremeter/info";

export {
  adaptRequirementsV1ToV2,
  adaptRequirementsV2ToV1,
  extractResourceInfoV1,
  adaptPayloadV1ToV2,
  adaptVerifyResponseV2ToV1,
  adaptSettleResponseV2ToV1,
  adaptSettleResponseV2ToV1Legacy,
  adaptSettleResponseLegacyToV2,
  adaptSettleResponseLenientToV2,
  adaptSupportedKindV2ToV1,
  adaptSupportedKindV1ToV2,
  adaptPaymentRequiredResponseV1ToV2,
  adaptPaymentRequiredResponseV2ToV1,
  adaptVerifyResponseV1ToV2,
  adaptSettleResponseV1ToV2,
} from "@faremeter/types/x402-adapters";

/** V1 payment requirements with mimeType guaranteed to be present */
type x402PaymentRequirementsV1Strict = x402.x402PaymentRequirements & {
  mimeType: string;
};

/**
 * Legacy facilitator handler interface using pre-spec field names.
 * Use this to wrap old handlers that return txHash/networkId/error.
 */
export type LegacyFacilitatorHandler = {
  getSupported?: () => Promise<x402.x402SupportedKind>[];
  getRequirements: (
    req: x402PaymentRequirementsV1Strict[],
  ) => Promise<x402.x402PaymentRequirements[]>;
  handleVerify?: (
    requirements: x402PaymentRequirementsV1Strict,
    payment: x402.x402PaymentPayload,
  ) => Promise<x402.x402VerifyResponse | null>;
  handleSettle: (
    requirements: x402PaymentRequirementsV1Strict,
    payment: x402.x402PaymentPayload,
  ) => Promise<x402.x402SettleResponseLegacy | null>;
};

/**
 * Adapts a v1 FacilitatorHandler to the v2 interface.
 * Use this to wrap handlers from external packages that haven't been updated to v2 types.
 */
export function adaptHandlerV1ToV2(
  handler: LegacyFacilitatorHandler,
): facilitator.FacilitatorHandler {
  const adapted: facilitator.FacilitatorHandler = {
    getRequirements: async ({ accepts, resource }) => {
      // Convert v2 requirements to v1, call legacy handler, convert back to v2.
      // Resource may be undefined when the caller has no resource context
      // (e.g. during capability negotiation). Legacy handlers that inspect
      // requirements.resource will see an empty string in that case.
      const fallbackResource: x402v2.x402ResourceInfo = resource ?? {
        url: "",
      };
      const v1Reqs = accepts.map((r) =>
        adaptRequirementsV2ToV1(r, fallbackResource),
      );
      const v1Results = await handler.getRequirements(v1Reqs);
      return v1Results.map((req) =>
        adaptRequirementsV1ToV2(req, normalizeNetworkId),
      );
    },

    handleSettle: async (requirements, payment) => {
      if (!payment.resource) {
        throw new Error(
          "v2 payment payload is missing resource context required for v1 adapter",
        );
      }
      const v1Req = adaptRequirementsV2ToV1(requirements, payment.resource);
      const v1Payload: x402.x402PaymentPayload = {
        x402Version: 1,
        scheme: payment.accepted.scheme,
        network: payment.accepted.network,
        asset: payment.accepted.asset,
        payload: payment.payload,
      };
      const v1Result = await handler.handleSettle(v1Req, v1Payload);
      if (v1Result === null) {
        return null;
      }
      return adaptSettleResponseLegacyToV2(v1Result);
    },
  };

  if (handler.getSupported) {
    const legacyGetSupported = handler.getSupported;
    adapted.getSupported = () =>
      legacyGetSupported().map((p) =>
        p.then((kind) => adaptSupportedKindV1ToV2(kind, normalizeNetworkId)),
      );
  }

  if (handler.handleVerify) {
    const legacyHandleVerify = handler.handleVerify;
    adapted.handleVerify = async (requirements, payment) => {
      if (!payment.resource) {
        throw new Error(
          "v2 payment payload is missing resource context required for v1 adapter",
        );
      }
      const v1Req = adaptRequirementsV2ToV1(requirements, payment.resource);
      const v1Payload: x402.x402PaymentPayload = {
        x402Version: 1,
        scheme: payment.accepted.scheme,
        network: payment.accepted.network,
        asset: payment.accepted.asset,
        payload: payment.payload,
      };
      const v1Result = await legacyHandleVerify(v1Req, v1Payload);
      if (v1Result === null) {
        return null;
      }
      return adaptVerifyResponseV1ToV2(v1Result);
    };
  }

  return adapted;
}
