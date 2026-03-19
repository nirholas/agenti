import type { Interceptor, RequestMatcher } from "./types";
import { getURLFromRequestInfo } from "./utils";

/**
 * Creates an interceptor that fails matching requests.
 *
 * @param match - Predicate to determine which requests to fail.
 * @param failFn - Function returning the failure (Response or Error).
 * @returns An interceptor that fails matching requests.
 */
export function createFailureInterceptor(
  match: RequestMatcher,
  failFn: () => Response | Error | Promise<Response | Error>,
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);

    if (match(url, init)) {
      const result = await failFn();
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }

    return fetch(input, init);
  };
}

/**
 * Creates an interceptor that fails the first matching request only.
 *
 * @param match - Predicate to determine which requests to fail.
 * @param failFn - Function returning the failure.
 * @returns An interceptor that fails once then passes through.
 */
export function failOnce(
  match: RequestMatcher,
  failFn: () => Response | Error,
): Interceptor {
  let triggered = false;

  return createFailureInterceptor(
    (url, init) => {
      if (triggered) return false;
      return match(url, init);
    },
    () => {
      triggered = true;
      return failFn();
    },
  );
}

/**
 * Creates an interceptor that fails the first N matching requests.
 *
 * @param n - Number of times to fail before passing through.
 * @param match - Predicate to determine which requests to fail.
 * @param failFn - Function returning the failure.
 * @returns An interceptor that fails N times then passes through.
 */
export function failNTimes(
  n: number,
  match: RequestMatcher,
  failFn: () => Response | Error,
): Interceptor {
  let count = 0;

  return createFailureInterceptor(
    (url, init) => {
      if (count >= n) return false;
      return match(url, init);
    },
    () => {
      count++;
      return failFn();
    },
  );
}

/**
 * Creates an interceptor that fails until manually cleared.
 *
 * Call `clear()` on the returned interceptor to stop failing.
 *
 * @param match - Predicate to determine which requests to fail.
 * @param failFn - Function returning the failure.
 * @returns An interceptor with a `clear()` method.
 */
export function failUntilCleared(
  match: RequestMatcher,
  failFn: () => Response | Error,
): Interceptor & { clear(): void } {
  let active = true;

  const interceptor = createFailureInterceptor(
    (url, init) => active && match(url, init),
    failFn,
  ) as Interceptor & { clear(): void };

  interceptor.clear = () => {
    active = false;
  };

  return interceptor;
}

/**
 * Creates an interceptor that fails based on a dynamic condition.
 *
 * The condition receives the URL and attempt count, allowing patterns
 * like "fail every other request" or "fail first 3 attempts".
 *
 * @param match - Predicate to determine which requests to consider.
 * @param shouldFail - Condition that receives context with attempt count.
 * @param failFn - Function returning the failure.
 * @returns An interceptor with conditional failure logic.
 */
export function failWhen(
  match: RequestMatcher,
  shouldFail: (ctx: { url: string; attemptCount: number }) => boolean,
  failFn: () => Response | Error,
): Interceptor {
  const attemptCounts = new Map<string, number>();

  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);

    if (match(url, init)) {
      const attemptCount = (attemptCounts.get(url) ?? 0) + 1;
      attemptCounts.set(url, attemptCount);

      if (shouldFail({ url, attemptCount })) {
        const result = failFn();
        if (result instanceof Error) {
          throw result;
        }
        return result;
      }
    }

    return fetch(input, init);
  };
}
