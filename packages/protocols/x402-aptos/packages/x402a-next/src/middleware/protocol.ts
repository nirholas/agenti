// Import types and constants from main package to avoid duplication
import type { AptosPaymentPayloadData, PaymentPayload, PaymentRequirements } from "x402a/server";
import { X402_HEADER, X402_RESPONSE_HEADER, X402_VERSION } from "x402a/server";

// Re-export for convenience
export { X402_HEADER, X402_RESPONSE_HEADER, X402_VERSION };
export type { PaymentRequirements, PaymentPayload, AptosPaymentPayloadData };

export function parsePaymentHeader(paymentHeader: string): PaymentPayload {
  try {
    const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
    return JSON.parse(decoded) as PaymentPayload;
  } catch (_error) {
    throw new Error("Invalid payment header format");
  }
}
