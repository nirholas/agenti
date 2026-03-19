/**
 * Extracts the URL string from various request input types.
 *
 * @param input - A URL string, URL object, or Request object.
 * @returns The URL as a string.
 */
export function getURLFromRequestInfo(
  input: RequestInfo | URL | string,
): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}
