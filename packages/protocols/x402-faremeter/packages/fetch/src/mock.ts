export type MockFetchType = typeof fetch;
export type MockResponse = Response;

/**
 * Creates a mock fetch that returns responses from a queue in order.
 *
 * Each call to the returned fetch function shifts the next response from the array.
 * Responses can be either Response objects or fetch functions for dynamic behavior.
 *
 * @param responses - Array of responses or fetch functions to return in order
 * @returns A fetch function that serves responses from the queue
 */
export function responseFeeder(
  responses: (MockFetchType | MockResponse)[],
): MockFetchType {
  return async (input, init?) => {
    const t = responses.shift();

    if (t === undefined) {
      throw new Error("out of responses to feed");
    }

    if (t instanceof Function) {
      return t(input, init);
    }

    return t;
  };
}
