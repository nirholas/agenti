import type { x402PaymentRequirements } from "@faremeter/types/x402";

/**
 * Creates a JSON Response with the given status and body.
 *
 * @param status - HTTP status code.
 * @param body - Object to serialize as JSON.
 * @returns A Response with JSON content type.
 */
export function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a failed verify response.
 *
 * @param reason - Reason for verification failure.
 * @returns A 200 Response with isValid: false.
 */
export function verifyFailedResponse(reason: string): Response {
  return jsonResponse(200, {
    isValid: false,
    invalidReason: reason,
    payer: "",
  });
}

/**
 * Creates a successful verify response.
 *
 * @returns A 200 Response with isValid: true.
 */
export function verifySuccessResponse(): Response {
  return jsonResponse(200, {
    isValid: true,
    payer: "test-payer",
  });
}

/**
 * Creates a failed settle response (v1 format).
 *
 * @param errorReason - Reason for settlement failure.
 * @returns A 200 Response with success: false.
 */
export function settleFailedResponse(errorReason: string): Response {
  return jsonResponse(200, {
    success: false,
    errorReason,
    transaction: "",
    network: "",
    payer: "",
  });
}

/**
 * Creates a failed settle response (v2 format).
 *
 * @param errorReason - Reason for settlement failure.
 * @param network - Network identifier for the response.
 * @returns A 200 Response with success: false.
 */
export function settleFailedResponseV2(
  errorReason: string,
  network: string,
): Response {
  return jsonResponse(200, {
    success: false,
    errorReason,
    transaction: "",
    network,
  });
}

/**
 * Creates a successful settle response (v1 format).
 *
 * @param transaction - Transaction identifier.
 * @param network - Network identifier.
 * @returns A 200 Response with success: true.
 */
export function settleSuccessResponse(
  transaction: string,
  network: string,
): Response {
  return jsonResponse(200, {
    success: true,
    transaction,
    network,
    payer: "test-payer",
  });
}

/**
 * Creates a successful settle response (v2 format).
 *
 * @param transaction - Transaction identifier.
 * @param network - Network identifier.
 * @returns A 200 Response with success: true.
 */
export function settleSuccessResponseV2(
  transaction: string,
  network: string,
): Response {
  return jsonResponse(200, {
    success: true,
    transaction,
    network,
  });
}

/**
 * Creates a 402 Payment Required response.
 *
 * @param accepts - Payment requirements the server accepts.
 * @param error - Optional error message.
 * @returns A 402 Response with x402Version: 1.
 */
export function paymentRequiredResponse(
  accepts: x402PaymentRequirements[],
  error = "",
): Response {
  return jsonResponse(402, {
    x402Version: 1,
    accepts,
    error,
  });
}

/**
 * Creates a network error for testing error handling.
 *
 * @param message - Error message.
 * @returns An Error to be thrown by interceptors.
 */
export function networkError(message = "Network error"): Error {
  return new Error(message);
}

/**
 * Creates a timeout error for testing timeout handling.
 *
 * @returns An Error with "Request timed out" message.
 */
export function timeoutError(): Error {
  return new Error("Request timed out");
}

/**
 * Creates an HTTP error response.
 *
 * @param status - HTTP status code.
 * @param message - Error message.
 * @returns A Response with the error JSON body.
 */
export function httpError(status: number, message: string): Response {
  return jsonResponse(status, { error: message });
}
