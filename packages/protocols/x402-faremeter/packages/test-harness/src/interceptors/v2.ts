import type { Interceptor } from "./types";
import { x402PaymentRequiredResponse } from "@faremeter/types/x402";
import { isValidationError } from "@faremeter/types";
import { adaptPaymentRequiredResponseV1ToV2 } from "@faremeter/types/x402-adapters";
import { V2_PAYMENT_REQUIRED_HEADER } from "@faremeter/types/x402v2";
import { normalizeNetworkId } from "@faremeter/info";

/**
 * Creates an interceptor that transforms v1 402 responses to v2 format.
 *
 * This allows testing v2 client behavior by making the middleware appear
 * to respond with v2 format even though it defaults to v1.
 *
 * The transformation:
 * - Parses the JSON body as v1 PaymentRequiredResponse
 * - Converts to v2 PaymentRequiredResponse format
 * - Encodes as base64 in PAYMENT-REQUIRED header
 * - Returns 402 with the new header
 */
export function createV2ResponseInterceptor(): Interceptor {
  return (baseFetch) => async (input, init) => {
    const response = await baseFetch(input, init);

    // Only transform 402 responses that don't already have v2 header
    if (
      response.status !== 402 ||
      response.headers.has(V2_PAYMENT_REQUIRED_HEADER)
    ) {
      return response;
    }

    const cloned = response.clone();
    let body: unknown;
    try {
      body = await cloned.json();
    } catch {
      return response;
    }

    const v1Response = x402PaymentRequiredResponse(body);
    if (isValidationError(v1Response)) {
      return response;
    }

    // Convert to v2 format using shared adapter
    const resourceURL = v1Response.accepts[0]?.resource ?? "";
    const v2Response = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      resourceURL,
      normalizeNetworkId,
    );

    // Encode as base64
    const encoded = btoa(JSON.stringify(v2Response));

    // Create new response with v2 header
    const newHeaders = new Headers(response.headers);
    newHeaders.set(V2_PAYMENT_REQUIRED_HEADER, encoded);

    return new Response(null, {
      status: 402,
      statusText: "Payment Required",
      headers: newHeaders,
    });
  };
}
