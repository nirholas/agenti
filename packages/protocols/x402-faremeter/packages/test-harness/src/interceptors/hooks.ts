import type { Interceptor, RequestMatcher } from "./types";
import { getURLFromRequestInfo } from "./utils";

/**
 * Creates an interceptor that calls a hook before matching requests.
 *
 * @param match - Predicate to determine which requests to hook.
 * @param hook - Callback invoked before the request is sent.
 * @returns An interceptor with request-side hooks.
 */
export function createRequestHook(
  match: RequestMatcher,
  hook: (url: string, init?: RequestInit) => void | Promise<void>,
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);

    if (match(url, init)) {
      await hook(url, init);
    }

    return fetch(input, init);
  };
}

/**
 * Creates an interceptor that calls a hook after matching responses.
 *
 * @param match - Predicate to determine which responses to hook.
 * @param hook - Callback invoked after the response is received.
 * @returns An interceptor with response-side hooks.
 */
export function createResponseHook(
  match: RequestMatcher,
  hook: (
    url: string,
    response: Response,
    init?: RequestInit,
  ) => void | Promise<void>,
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);
    const response = await fetch(input, init);

    if (match(url, init)) {
      await hook(url, response, init);
    }

    return response;
  };
}

/**
 * Creates an interceptor with both request and response hooks.
 *
 * @param match - Predicate to determine which requests to hook.
 * @param hooks - Object with optional onRequest and onResponse callbacks.
 * @returns An interceptor with both-side hooks.
 */
export function createHook(
  match: RequestMatcher,
  hooks: {
    onRequest?: (url: string, init?: RequestInit) => void | Promise<void>;
    onResponse?: (
      url: string,
      response: Response,
      init?: RequestInit,
    ) => void | Promise<void>;
  },
): Interceptor {
  return (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);

    if (match(url, init) && hooks.onRequest) {
      await hooks.onRequest(url, init);
    }

    const response = await fetch(input, init);

    if (match(url, init) && hooks.onResponse) {
      await hooks.onResponse(url, response, init);
    }

    return response;
  };
}

type CapturedRequest = {
  url: string;
  init?: RequestInit | undefined;
  response: Response;
  timestamp: number;
};

/**
 * Creates an interceptor that captures matching requests for later inspection.
 *
 * @param match - Predicate to determine which requests to capture.
 * @returns Object with the interceptor, captured array, and clear function.
 */
export function createCaptureInterceptor(match: RequestMatcher): {
  interceptor: Interceptor;
  captured: CapturedRequest[];
  clear: () => void;
} {
  const captured: CapturedRequest[] = [];

  const interceptor: Interceptor = (fetch) => async (input, init) => {
    const url = getURLFromRequestInfo(input);
    const response = await fetch(input, init);

    if (match(url, init)) {
      captured.push({
        url,
        init,
        response: response.clone(), // Clone so the original can still be consumed
        timestamp: Date.now(),
      });
    }

    return response;
  };

  return {
    interceptor,
    captured,
    clear: () => {
      captured.length = 0;
    },
  };
}
