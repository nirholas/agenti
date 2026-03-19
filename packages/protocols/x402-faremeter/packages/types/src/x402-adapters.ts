/**
 * Shared conversion functions between x402 v1 and v2 protocol types.
 *
 * All packages that need to convert between v1 and v2 types should import
 * from this module to avoid duplicating conversion logic.
 */

import type {
  x402PaymentRequirements as x402PaymentRequirementsV1,
  x402PaymentPayload as x402PaymentPayloadV1,
  x402PaymentRequiredResponse as x402PaymentRequiredResponseV1,
  x402PaymentRequiredResponseLenient,
  x402VerifyResponse as x402VerifyResponseV1,
  x402VerifyResponseLenient,
  x402SettleResponse as x402SettleResponseV1,
  x402SettleResponseLegacy,
  x402SettleResponseLenient,
  x402SupportedKind as x402SupportedKindV1,
} from "./x402";

import { normalizeSettleResponse } from "./x402";

import type {
  x402PaymentRequirements,
  x402PaymentPayload,
  x402PaymentRequiredResponse,
  x402ResourceInfo,
  x402VerifyResponse,
  x402SettleResponse,
  x402SupportedKind,
  x402SupportedKindAny,
} from "./x402v2";

/**
 * Callback for translating network identifiers between formats.
 *
 * For v1→v2 adapters: translates legacy network names to CAIP-2 identifiers.
 * For v2→v1 adapters: translates CAIP-2 identifiers to legacy network names.
 *
 * Returns the translated network identifier, or the input unchanged if
 * no translation is available.
 */
export type NetworkTranslator = (network: string) => string;

/**
 * Converts v1 payment requirements to v2 format.
 *
 * @param req - The v1 payment requirements
 * @param translateNetwork - Function to translate legacy network IDs to CAIP-2
 * @returns The v2 payment requirements
 */
export function adaptRequirementsV1ToV2(
  req: x402PaymentRequirementsV1,
  translateNetwork: NetworkTranslator,
): x402PaymentRequirements {
  const result: x402PaymentRequirements = {
    scheme: req.scheme,
    network: translateNetwork(req.network),
    amount: req.maxAmountRequired,
    asset: req.asset,
    payTo: req.payTo,
    maxTimeoutSeconds: req.maxTimeoutSeconds,
  };
  if (req.extra !== undefined) {
    result.extra = req.extra;
  }
  return result;
}

/**
 * Converts v2 payment requirements to v1 format.
 *
 * @param req - The v2 payment requirements
 * @param resource - Resource information to populate v1 fields
 * @param translateNetwork - Optional function to translate CAIP-2 to legacy IDs
 * @returns The v1 payment requirements with mimeType guaranteed
 */
export function adaptRequirementsV2ToV1(
  req: x402PaymentRequirements,
  resource: x402ResourceInfo,
  translateNetwork?: NetworkTranslator,
): x402PaymentRequirementsV1 & { mimeType: string } {
  const result: x402PaymentRequirementsV1 & { mimeType: string } = {
    scheme: req.scheme,
    network: translateNetwork ? translateNetwork(req.network) : req.network,
    maxAmountRequired: req.amount,
    resource: resource.url,
    description: resource.description ?? "",
    mimeType: resource.mimeType ?? "",
    payTo: req.payTo,
    maxTimeoutSeconds: req.maxTimeoutSeconds,
    asset: req.asset,
  };
  if (req.extra !== undefined) {
    result.extra = req.extra;
  }
  return result;
}

/**
 * Extracts resource information from v1 payment requirements.
 *
 * @param req - The v1 payment requirements containing resource fields
 * @returns The extracted resource information
 */
export function extractResourceInfoV1(
  req: x402PaymentRequirementsV1,
): x402ResourceInfo {
  const result: x402ResourceInfo = {
    url: req.resource,
  };
  if (req.description) {
    result.description = req.description;
  }
  if (req.mimeType) {
    result.mimeType = req.mimeType;
  }
  return result;
}

/**
 * Converts a v1 payment payload to v2 format.
 *
 * @param payload - The v1 payment payload
 * @param requirements - The v1 requirements used for resource extraction
 * @param translateNetwork - Function to translate legacy network IDs to CAIP-2
 * @returns The v2 payment payload
 */
export function adaptPayloadV1ToV2(
  payload: x402PaymentPayloadV1,
  requirements: x402PaymentRequirementsV1,
  translateNetwork: NetworkTranslator,
): x402PaymentPayload {
  return {
    x402Version: 2,
    accepted: adaptRequirementsV1ToV2(requirements, translateNetwork),
    payload: payload.payload,
    resource: extractResourceInfoV1(requirements),
  };
}

/**
 * Converts a v1 payment required response to v2 format.
 *
 * @param v1Response - The v1 payment required response
 * @param resourceURL - The URL of the protected resource
 * @param translateNetwork - Function to translate legacy network IDs to CAIP-2
 * @returns The v2 payment required response
 */
export function adaptPaymentRequiredResponseV1ToV2(
  v1Response: x402PaymentRequiredResponseLenient,
  resourceURL: string,
  translateNetwork: NetworkTranslator,
): x402PaymentRequiredResponse {
  const firstAccept = v1Response.accepts[0];
  const resourceInfo: x402ResourceInfo = {
    url: resourceURL,
  };
  if (firstAccept?.description) {
    resourceInfo.description = firstAccept.description;
  }
  if (firstAccept?.mimeType) {
    resourceInfo.mimeType = firstAccept.mimeType;
  }

  const result: x402PaymentRequiredResponse = {
    x402Version: 2,
    resource: resourceInfo,
    accepts: v1Response.accepts.map((req) =>
      adaptRequirementsV1ToV2(req, translateNetwork),
    ),
  };

  if (v1Response.error) {
    result.error = v1Response.error;
  }

  return result;
}

/**
 * Converts a v2 payment required response to v1 format.
 *
 * @param v2Response - The v2 payment required response
 * @param translateNetwork - Optional function to translate CAIP-2 to legacy IDs
 * @returns The v1 payment required response
 */
export function adaptPaymentRequiredResponseV2ToV1(
  v2Response: x402PaymentRequiredResponse,
  translateNetwork?: NetworkTranslator,
): x402PaymentRequiredResponseV1 {
  return {
    x402Version: 1,
    accepts: v2Response.accepts.map((req) =>
      adaptRequirementsV2ToV1(req, v2Response.resource, translateNetwork),
    ),
    error: v2Response.error ?? "",
  };
}

/**
 * Converts a v2 verify response to v1 format.
 *
 * @param res - The v2 verify response
 * @returns The v1 verify response
 */
export function adaptVerifyResponseV2ToV1(
  res: x402VerifyResponse,
): x402VerifyResponseV1 {
  const result: x402VerifyResponseV1 = {
    isValid: res.isValid,
    payer: res.payer ?? "",
  };
  if (res.invalidReason !== undefined) {
    result.invalidReason = res.invalidReason;
  }
  return result;
}

/**
 * Converts a v1 verify response to v2 format.
 *
 * @param res - The v1 verify response (lenient)
 * @returns The v2 verify response
 */
export function adaptVerifyResponseV1ToV2(
  res: x402VerifyResponseLenient,
): x402VerifyResponse {
  const result: x402VerifyResponse = {
    isValid: res.isValid,
  };
  if (res.invalidReason !== undefined && res.invalidReason !== null) {
    result.invalidReason = res.invalidReason;
  }
  if (res.payer) {
    result.payer = res.payer;
  }
  return result;
}

/**
 * Adapt v2 settle response to spec-compliant v1 format.
 * Since v1 spec uses the same field names as v2 (transaction, network, errorReason),
 * this is primarily a network translation pass.
 */
export function adaptSettleResponseV2ToV1(
  res: x402SettleResponse,
  translateNetwork?: NetworkTranslator,
): x402SettleResponseV1 {
  const result: x402SettleResponseV1 = {
    success: res.success,
    transaction: res.transaction,
    network: translateNetwork ? translateNetwork(res.network) : res.network,
    payer: res.payer ?? "",
  };
  if (res.errorReason !== undefined) {
    result.errorReason = res.errorReason;
  }
  return result;
}

/**
 * Adapt v2 settle response to legacy v1 format with old field names.
 * Use this only for backward compatibility with clients expecting
 * txHash/networkId/error field names.
 * @deprecated Prefer adaptSettleResponseV2ToV1 for spec-compliant output
 */
export function adaptSettleResponseV2ToV1Legacy(
  res: x402SettleResponse,
  translateNetwork?: NetworkTranslator,
): x402SettleResponseLegacy {
  const result: x402SettleResponseLegacy = {
    success: res.success,
    txHash: res.transaction,
    networkId: translateNetwork ? translateNetwork(res.network) : res.network,
  };
  if (res.errorReason !== undefined) {
    result.error = res.errorReason;
  }
  if (res.payer !== undefined) {
    result.payer = res.payer;
  }
  return result;
}

/**
 * Adapt v1 settle response to v2 format.
 * Accepts lenient input that may have optional/nullable fields from older handlers.
 */
export function adaptSettleResponseV1ToV2(
  res: x402SettleResponseLenient,
): x402SettleResponse {
  const network = res.network ?? res.networkId;
  const transaction = res.transaction ?? res.txHash;
  if (network == null) {
    throw new Error("v1 settle response is missing network");
  }
  if (res.success && transaction == null) {
    throw new Error(
      "v1 settle response has success: true but missing transaction",
    );
  }
  const result: x402SettleResponse = {
    success: res.success,
    transaction: transaction ?? "",
    network: network,
  };
  const errorReason = res.errorReason ?? res.error;
  if (errorReason !== undefined && errorReason !== null) {
    result.errorReason = errorReason;
  }
  if (res.payer) {
    result.payer = res.payer;
  }
  return result;
}

/**
 * Adapt legacy v1 settle response (with txHash/networkId/error) to v2 format.
 * Use this when receiving data from older clients that use legacy field names.
 */
export function adaptSettleResponseLegacyToV2(
  res: x402SettleResponseLegacy,
): x402SettleResponse {
  if (res.networkId == null) {
    throw new Error("legacy v1 settle response is missing networkId");
  }
  if (res.success && res.txHash == null) {
    throw new Error(
      "legacy v1 settle response has success: true but missing txHash",
    );
  }
  const result: x402SettleResponse = {
    success: res.success,
    transaction: res.txHash ?? "",
    network: res.networkId,
  };
  if (res.error !== undefined && res.error !== null) {
    result.errorReason = res.error;
  }
  if (res.payer !== undefined) {
    result.payer = res.payer;
  }
  return result;
}

/**
 * Adapt a lenient v1 settle response (accepting either legacy or spec-compliant
 * field names) to v2 format. This is the most flexible adapter for parsing
 * incoming settle responses from unknown sources.
 */
export function adaptSettleResponseLenientToV2(
  res: x402SettleResponseLenient,
): x402SettleResponse {
  const normalized = normalizeSettleResponse(res);
  return adaptSettleResponseV1ToV2(normalized);
}

/**
 * Converts a v2 supported kind to v1 format.
 *
 * @param kind - The v2 supported kind
 * @param translateNetwork - Optional function to translate CAIP-2 to legacy IDs
 * @returns The v1 supported kind
 */
export function adaptSupportedKindV2ToV1(
  kind: x402SupportedKind,
  translateNetwork?: NetworkTranslator,
): x402SupportedKindAny {
  const result: x402SupportedKindAny = {
    x402Version: 1,
    scheme: kind.scheme,
    network: translateNetwork ? translateNetwork(kind.network) : kind.network,
  };
  if (kind.extra !== undefined) {
    result.extra = kind.extra;
  }
  return result;
}

/**
 * Converts a v1 supported kind to v2 format.
 *
 * @param kind - The v1 supported kind
 * @param translateNetwork - Function to translate legacy network IDs to CAIP-2
 * @returns The v2 supported kind
 */
export function adaptSupportedKindV1ToV2(
  kind: x402SupportedKindV1,
  translateNetwork: NetworkTranslator,
): x402SupportedKind {
  const result: x402SupportedKind = {
    x402Version: 2,
    scheme: kind.scheme,
    network: translateNetwork(kind.network),
  };
  if (kind.extra !== undefined) {
    result.extra = kind.extra;
  }
  return result;
}
