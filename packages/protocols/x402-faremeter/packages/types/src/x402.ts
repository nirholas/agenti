import { type } from "arktype";
import { caseInsensitiveLiteral } from "./literal";
import { isValidationError } from "./validation";

/**
 * HTTP header name for v1 client payment payloads.
 */
export const X_PAYMENT_HEADER = "X-PAYMENT";

/**
 * HTTP header name for v1 server payment responses.
 */
export const X_PAYMENT_RESPONSE_HEADER = "X-PAYMENT-RESPONSE";

export const x402PaymentId = type({
  scheme: "string",
  network: "string",
  asset: "string",
});

export type x402PaymentId = typeof x402PaymentId.infer;

export const x402PaymentRequirements = type({
  scheme: "string",
  network: "string",
  maxAmountRequired: "string.numeric",
  resource: "string.url",
  description: "string",
  "mimeType?": "string",
  outputSchema: "object?",
  payTo: "string",
  maxTimeoutSeconds: "number.integer",
  asset: "string",
  extra: "object?",
});

export type x402PaymentRequirements = typeof x402PaymentRequirements.infer;

export const x402PaymentRequiredResponse = type({
  x402Version: "number.integer",
  accepts: x402PaymentRequirements.array(),
  error: "string",
});

export type x402PaymentRequiredResponse =
  typeof x402PaymentRequiredResponse.infer;

/**
 * Lenient payment required response parser that accepts optional error field.
 * Use this when parsing incoming data from older servers that may not include
 * the error field.
 */
export const x402PaymentRequiredResponseLenient = type({
  x402Version: "number.integer",
  accepts: x402PaymentRequirements.array(),
  "error?": "string",
});

export type x402PaymentRequiredResponseLenient =
  typeof x402PaymentRequiredResponseLenient.infer;

/**
 * Normalize a lenient payment required response to spec-compliant field values.
 * Defaults error to empty string when missing.
 */
export function normalizePaymentRequiredResponse(
  res: x402PaymentRequiredResponseLenient,
): x402PaymentRequiredResponse {
  return {
    x402Version: res.x402Version,
    accepts: res.accepts,
    error: res.error ?? "",
  };
}

export const x402PaymentPayload = type({
  x402Version: "number.integer",
  scheme: "string",
  network: "string",
  asset: "string?",
  payload: "object",
});

export type x402PaymentPayload = typeof x402PaymentPayload.infer;

export const x402PaymentHeaderToPayload = type("string.base64")
  .pipe.try((x) => atob(x))
  .to("string.json.parse")
  .to(x402PaymentPayload);

export const x402VerifyRequest = type({
  paymentHeader: "string?",
  paymentPayload: x402PaymentPayload.optional(),
  paymentRequirements: x402PaymentRequirements,
});

export type x402VerifyRequest = typeof x402VerifyRequest.infer;

export const x402VerifyResponse = type({
  isValid: "boolean",
  "invalidReason?": "string",
  payer: "string",
});

export type x402VerifyResponse = typeof x402VerifyResponse.infer;

/**
 * Lenient verify response parser that accepts optional payer field.
 * Use this when parsing incoming data from older facilitators that may
 * not include the payer field.
 */
export const x402VerifyResponseLenient = type({
  isValid: "boolean",
  "invalidReason?": "string | null",
  "payer?": "string",
});

export type x402VerifyResponseLenient = typeof x402VerifyResponseLenient.infer;

/**
 * Normalize a lenient verify response to spec-compliant field values.
 * Defaults payer to empty string and strips null from invalidReason.
 */
export function normalizeVerifyResponse(
  res: x402VerifyResponseLenient,
): x402VerifyResponse {
  const result: x402VerifyResponse = {
    isValid: res.isValid,
    payer: res.payer ?? "",
  };
  const invalidReason = res.invalidReason;
  if (invalidReason !== undefined && invalidReason !== null) {
    result.invalidReason = invalidReason;
  }
  return result;
}

export const x402SettleRequest = x402VerifyRequest;
export type x402SettleRequest = typeof x402SettleRequest.infer;

/**
 * Legacy settle response type with pre-spec field names (txHash, networkId, error).
 * Use x402SettleResponse for spec-compliant field names (transaction, network, errorReason).
 *
 * This type exists for backward compatibility when interfacing with older clients
 * that use legacy field names.
 */
export const x402SettleResponseLegacy = type({
  success: "boolean",
  "error?": "string | null",
  txHash: "string | null",
  networkId: "string | null",
  "payer?": "string",
});

export type x402SettleResponseLegacy = typeof x402SettleResponseLegacy.infer;

/**
 * Spec-compliant settle response per x402-specification-v1.md Section 5.3.
 * Field names: transaction, network, errorReason (not txHash, networkId, error)
 */
export const x402SettleResponse = type({
  success: "boolean",
  "errorReason?": "string",
  transaction: "string",
  network: "string",
  payer: "string",
});

export type x402SettleResponse = typeof x402SettleResponse.infer;

/**
 * Lenient settle response parser that accepts either legacy or spec-compliant
 * field names. Use this when parsing incoming data that may come from older
 * clients using legacy field names.
 */
export const x402SettleResponseLenient = type({
  success: "boolean",
  "errorReason?": "string | null",
  "error?": "string | null",
  "transaction?": "string | null",
  "txHash?": "string | null",
  "network?": "string | null",
  "networkId?": "string | null",
  "payer?": "string",
});

export type x402SettleResponseLenient = typeof x402SettleResponseLenient.infer;

/**
 * Normalize a lenient settle response to spec-compliant field names.
 * Converts legacy field names (txHash, networkId, error) to spec-compliant
 * names (transaction, network, errorReason).
 */
export function normalizeSettleResponse(
  res: x402SettleResponseLenient,
): x402SettleResponse {
  const result: x402SettleResponse = {
    success: res.success,
    transaction: res.transaction ?? res.txHash ?? "",
    network: res.network ?? res.networkId ?? "",
    payer: res.payer ?? "",
  };
  const errorReason = res.errorReason ?? res.error;
  if (errorReason !== undefined && errorReason !== null) {
    result.errorReason = errorReason;
  }
  return result;
}

export const x402SupportedKind = type({
  x402Version: "number.integer",
  scheme: "string",
  network: "string",
  extra: "object?",
});

export type x402SupportedKind = typeof x402SupportedKind.infer;

export const x402SupportedResponse = type({
  kinds: x402SupportedKind.array(),
});

export type x402SupportedResponse = typeof x402SupportedResponse.infer;

/**
 * Creates a matcher function for filtering payment requirements.
 *
 * The matcher performs case-insensitive matching on scheme, network,
 * and asset fields.
 *
 * @param scheme - Accepted payment scheme names
 * @param network - Accepted network identifiers
 * @param asset - Accepted asset addresses
 * @returns Object with the matcher tuple and isMatchingRequirement function
 */
export function generateRequirementsMatcher(
  scheme: string[],
  network: string[],
  asset: string[],
) {
  const matchTuple = type({
    scheme: caseInsensitiveLiteral(...scheme),
    network: caseInsensitiveLiteral(...network),
    asset: caseInsensitiveLiteral(...asset),
  });

  const isMatchingRequirement = (req: typeof matchTuple.inferIn) => {
    return !isValidationError(matchTuple(req));
  };

  return {
    matchTuple,
    isMatchingRequirement,
  };
}
