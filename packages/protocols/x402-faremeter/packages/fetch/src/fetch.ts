import { type RequestContext } from "@faremeter/types/client";

import {
  type ProcessPaymentRequiredResponseOpts,
  processPaymentRequiredResponse,
  X_PAYMENT_HEADER,
  V2_PAYMENT_HEADER,
} from "./internal";

/**
 * Error thrown when payment fails after exhausting all retry attempts.
 * Contains the final 402 response for inspection.
 */
export class WrappedFetchError extends Error {
  constructor(
    message: string,
    /** The final 402 response after all retry attempts failed. */
    public response: Response,
  ) {
    super(message);
  }
}

/**
 * Configuration options for wrapping a fetch function with x402 payment handling.
 */
export type WrapOpts = ProcessPaymentRequiredResponseOpts & {
  /** Optional fetch function for the initial request (phase 1). Defaults to phase2Fetch. */
  phase1Fetch?: typeof fetch;
  /** Number of retry attempts after initial failure. Defaults to 2. */
  retryCount?: number;
  /** Initial delay between retries in milliseconds. Doubles after each attempt. Defaults to 100. */
  initialRetryDelay?: number;
  /** If true, returns the 402 response instead of throwing on payment failure. */
  returnPaymentFailure?: boolean;
};

/**
 * Wraps a fetch function with automatic x402 payment handling.
 *
 * When a 402 Payment Required response is received, the wrapper automatically
 * processes the payment requirements, executes payment via the configured handlers,
 * and retries the request with the payment header attached.
 *
 * @param phase2Fetch - The fetch function to use for the paid request (phase 2)
 * @param options - Configuration including payment handlers and retry settings
 * @returns A wrapped fetch function with the same signature as native fetch
 */
export function wrap(phase2Fetch: typeof fetch, options: WrapOpts) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    async function makeRequest() {
      const response = await (options.phase1Fetch ?? phase2Fetch)(input, init);

      if (response.status !== 402) {
        return response;
      }

      const ctx: RequestContext = {
        request: input,
      };

      const { paymentHeader, detectedVersion } =
        await processPaymentRequiredResponse(ctx, response, options);

      const headers = new Headers(init.headers);
      const headerName =
        detectedVersion === 2 ? V2_PAYMENT_HEADER : X_PAYMENT_HEADER;
      headers.set(headerName, paymentHeader);

      const newInit: RequestInit = {
        ...init,
        headers,
      };

      const secondResponse = await phase2Fetch(input, newInit);
      return secondResponse;
    }

    let attempt = (options.retryCount ?? 2) + 1;
    let backoff = options.initialRetryDelay ?? 100;
    let response: Response;

    do {
      response = await makeRequest();

      if (response.status != 402) {
        return response;
      }

      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2;
    } while (--attempt > 0);

    if (options.returnPaymentFailure) {
      return response;
    }

    throw new WrappedFetchError(
      "failed to complete payment after retries",
      response,
    );
  };
}
