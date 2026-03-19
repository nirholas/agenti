/**
 * Simple URL validation for proxy server
 *
 * This is NOT a security feature - the proxy is designed for internal use only.
 */

export class URLValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
    this.name = "URLValidationError"
  }
}

const ALLOWED_PROTOCOLS = ["http:", "https:"]

/**
 * Validates target URL format and protocol.
 *
 * @param targetUrl - The URL to validate
 * @returns Parsed URL object
 * @throws URLValidationError if URL is invalid or uses unsupported protocol
 */
export function validateTargetURL(targetUrl: string): URL {
  // Parse URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    throw new URLValidationError(`Invalid URL format: ${targetUrl}`, "INVALID_URL")
  }

  // Check protocol (prevent file://, ftp://, etc.)
  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    throw new URLValidationError(
      `Protocol "${parsedUrl.protocol}" not supported. Use http:// or https://`,
      "INVALID_PROTOCOL",
    )
  }

  return parsedUrl
}
