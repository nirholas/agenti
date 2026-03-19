import { ProxyError } from "./types.js"

/**
 * Parses target URL from HTTP query parameters
 */
export function parseTargetFromQuery(query: URLSearchParams): string {
  const target = query.get("target")
  if (!target) {
    throw new ProxyError("Missing required 'target' query parameter for HTTP mode", "MISSING_TARGET")
  }

  return target
}
