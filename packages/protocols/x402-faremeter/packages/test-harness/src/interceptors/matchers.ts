import type { RequestMatcher } from "./types";

export const matchFacilitatorAccepts: RequestMatcher = (url) =>
  url.includes("/facilitator/accepts");

export const matchFacilitatorVerify: RequestMatcher = (url) =>
  url.includes("/facilitator/verify");

export const matchFacilitatorSettle: RequestMatcher = (url) =>
  url.includes("/facilitator/settle");

export const matchFacilitatorSupported: RequestMatcher = (url) =>
  url.includes("/facilitator/supported");

export const matchFacilitator: RequestMatcher = (url) =>
  matchFacilitatorAccepts(url) ||
  matchFacilitatorVerify(url) ||
  matchFacilitatorSettle(url) ||
  matchFacilitatorSupported(url);

export const matchResource: RequestMatcher = (url) => !matchFacilitator(url);

/**
 * Combines matchers with logical AND: all must match.
 *
 * @param matchers - Matchers to combine.
 * @returns A matcher that succeeds only if all provided matchers succeed.
 */
export function and(...matchers: RequestMatcher[]): RequestMatcher {
  return (url, init) => matchers.every((m) => m(url, init));
}

/**
 * Combines matchers with logical OR: any must match.
 *
 * @param matchers - Matchers to combine.
 * @returns A matcher that succeeds if any provided matcher succeeds.
 */
export function or(...matchers: RequestMatcher[]): RequestMatcher {
  return (url, init) => matchers.some((m) => m(url, init));
}

/**
 * Negates a matcher.
 *
 * @param matcher - Matcher to negate.
 * @returns A matcher that succeeds when the provided matcher fails.
 */
export function not(matcher: RequestMatcher): RequestMatcher {
  return (url, init) => !matcher(url, init);
}

/**
 * Creates a matcher that checks the URL against a pattern.
 *
 * @param pattern - String to search for or RegExp to test.
 * @returns A matcher that succeeds if the URL matches the pattern.
 */
export function matchURL(pattern: string | RegExp): RequestMatcher {
  if (typeof pattern === "string") {
    return (url) => url.includes(pattern);
  }
  return (url) => pattern.test(url);
}

/**
 * Creates a matcher that checks the HTTP method.
 *
 * @param method - HTTP method to match (case-insensitive).
 * @returns A matcher that succeeds if the request uses the specified method.
 */
export function matchMethod(method: string): RequestMatcher {
  const upperMethod = method.toUpperCase();
  return (_url, init) => (init?.method?.toUpperCase() ?? "GET") === upperMethod;
}

export const matchAll: RequestMatcher = () => true;
export const matchNone: RequestMatcher = () => false;
