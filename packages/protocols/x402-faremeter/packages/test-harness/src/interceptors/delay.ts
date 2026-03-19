import type { Interceptor, RequestMatcher } from "./types";
import { getURLFromRequestInfo } from "./utils";

/**
 * Creates an interceptor that delays matching requests before sending.
 *
 * @param match - Predicate to determine which requests to delay.
 * @param delayMs - Delay in milliseconds.
 * @returns An interceptor that adds request delay.
 */
export function createDelayInterceptor(
  match: RequestMatcher,
  delayMs: number,
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);

    if (match(url, init)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return fetch(input, init);
  };
}

/**
 * Creates an interceptor that delays matching responses after receiving.
 *
 * @param match - Predicate to determine which responses to delay.
 * @param delayMs - Delay in milliseconds.
 * @returns An interceptor that adds response delay.
 */
export function createResponseDelayInterceptor(
  match: RequestMatcher,
  delayMs: number,
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);
    const response = await fetch(input, init);

    if (match(url, init)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return response;
  };
}

/**
 * Creates an interceptor with variable delay based on request context.
 *
 * @param match - Predicate to determine which requests to delay.
 * @param getDelay - Function returning delay in ms for each request.
 * @returns An interceptor with dynamic delay.
 */
export function createVariableDelayInterceptor(
  match: RequestMatcher,
  getDelay: (url: string, init?: RequestInit) => number,
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);

    if (match(url, init)) {
      const delayMs = getDelay(url, init);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return fetch(input, init);
  };
}
