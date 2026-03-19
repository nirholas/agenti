/**
 * Payment Pre-Auth Cache
 *
 * Wraps the @x402/fetch SDK with pre-authorization caching.
 * After the first 402 response, caches payment requirements per endpoint.
 * On subsequent requests, pre-signs payment and attaches it to the first
 * request, skipping the 402 round trip (~200ms savings per request).
 *
 * Falls back to normal 402 flow if pre-signed payment is rejected.
 */

import type { x402Client } from "@x402/fetch";
import { x402HTTPClient } from "@x402/fetch";

type PaymentRequired = Parameters<InstanceType<typeof x402Client>["createPaymentPayload"]>[0];

interface CachedEntry {
  paymentRequired: PaymentRequired;
  cachedAt: number;
}

const DEFAULT_TTL_MS = 3_600_000; // 1 hour

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createPayFetchWithPreAuth(
  baseFetch: FetchFn,
  client: x402Client,
  ttlMs = DEFAULT_TTL_MS,
  options?: { skipPreAuth?: boolean },
): FetchFn {
  const httpClient = new x402HTTPClient(client);
  const cache = new Map<string, CachedEntry>();

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const urlPath = new URL(request.url).pathname;

    // Try pre-auth if we have cached payment requirements
    // Skip for Solana: payments use per-tx blockhashes that expire ~60-90s,
    // making cached requirements useless and causing double charges.
    const cached = !options?.skipPreAuth ? cache.get(urlPath) : undefined;
    if (cached && Date.now() - cached.cachedAt < ttlMs) {
      try {
        const payload = await client.createPaymentPayload(cached.paymentRequired);
        const headers = httpClient.encodePaymentSignatureHeader(payload);
        const preAuthRequest = request.clone();
        for (const [key, value] of Object.entries(headers)) {
          preAuthRequest.headers.set(key, value);
        }
        const response = await baseFetch(preAuthRequest);
        if (response.status !== 402) {
          return response; // Pre-auth worked — saved ~200ms
        }
        // Pre-auth rejected (params may have changed) — invalidate and fall through
        cache.delete(urlPath);
      } catch {
        // Pre-auth signing failed — invalidate and fall through
        cache.delete(urlPath);
      }
    }

    // Normal flow: make request, handle 402 if needed
    const clonedRequest = request.clone();
    const response = await baseFetch(request);
    if (response.status !== 402) {
      return response;
    }

    // Parse 402 response and cache for future pre-auth
    let paymentRequired: PaymentRequired;
    try {
      const getHeader = (name: string) => response.headers.get(name);
      let body: unknown;
      try {
        const responseText = await Promise.race([
          response.text(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Body read timeout")), 30_000),
          ),
        ]);
        if (responseText) body = JSON.parse(responseText);
      } catch {
        /* empty body is fine */
      }
      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);
      cache.set(urlPath, { paymentRequired, cachedAt: Date.now() });
    } catch (error) {
      throw new Error(
        `Failed to parse payment requirements: ${error instanceof Error ? error.message : "Unknown error"}`,
        { cause: error },
      );
    }

    // Sign payment and retry
    const payload = await client.createPaymentPayload(paymentRequired);
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);
    for (const [key, value] of Object.entries(paymentHeaders)) {
      clonedRequest.headers.set(key, value);
    }
    return baseFetch(clonedRequest);
  };
}
