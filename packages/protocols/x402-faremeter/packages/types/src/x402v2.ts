import { type } from "arktype";

/**
 * HTTP header name for v2 client payment signatures.
 */
export const V2_PAYMENT_HEADER = "PAYMENT-SIGNATURE";

/**
 * HTTP header name for v2 402 payment required responses.
 */
export const V2_PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";

/**
 * HTTP header name for v2 server payment responses.
 */
export const V2_PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

export const x402ResourceInfo = type({
  url: "string",
  "description?": "string",
  "mimeType?": "string",
});

export type x402ResourceInfo = typeof x402ResourceInfo.infer;

export const x402PaymentRequirements = type({
  scheme: "string",
  network: "string",
  amount: "string.numeric",
  asset: "string",
  payTo: "string",
  maxTimeoutSeconds: "number.integer",
  "extra?": "object",
});

export type x402PaymentRequirements = typeof x402PaymentRequirements.infer;

export const x402PaymentRequiredResponse = type({
  x402Version: "2",
  "error?": "string",
  resource: x402ResourceInfo,
  accepts: x402PaymentRequirements.array(),
  "extensions?": "object",
});

export type x402PaymentRequiredResponse =
  typeof x402PaymentRequiredResponse.infer;

export const x402PaymentPayload = type({
  x402Version: "2",
  "resource?": x402ResourceInfo,
  accepted: x402PaymentRequirements,
  payload: "object",
  "extensions?": "object",
});

export type x402PaymentPayload = typeof x402PaymentPayload.infer;

export const x402PaymentHeaderToPayload = type("string.base64")
  .pipe.try((x) => atob(x))
  .to("string.json.parse")
  .to(x402PaymentPayload);

export const x402VerifyRequest = type({
  paymentPayload: x402PaymentPayload,
  paymentRequirements: x402PaymentRequirements,
});

export type x402VerifyRequest = typeof x402VerifyRequest.infer;

export const x402VerifyResponse = type({
  isValid: "boolean",
  "invalidReason?": "string",
  "payer?": "string",
});

export type x402VerifyResponse = typeof x402VerifyResponse.infer;

export const x402SettleRequest = x402VerifyRequest;
export type x402SettleRequest = typeof x402SettleRequest.infer;

export const x402SettleResponse = type({
  success: "boolean",
  "errorReason?": "string",
  "payer?": "string",
  transaction: "string",
  network: "string",
  "extensions?": "object",
});

export type x402SettleResponse = typeof x402SettleResponse.infer;

export const x402SupportedKind = type({
  x402Version: "2",
  scheme: "string",
  network: "string",
  "extra?": "object",
});

export type x402SupportedKind = typeof x402SupportedKind.infer;

// SupportedKind that accepts either v1 or v2 version numbers
export const x402SupportedKindAny = type({
  x402Version: "1 | 2",
  scheme: "string",
  network: "string",
  "extra?": "object",
});

export type x402SupportedKindAny = typeof x402SupportedKindAny.infer;

export const x402SupportedResponse = type({
  kinds: x402SupportedKindAny.array(),
  extensions: "string[]",
  signers: type("Record<string, string[]>"),
});

export type x402SupportedResponse = typeof x402SupportedResponse.infer;
