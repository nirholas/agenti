import type { X402Treasurer } from "../../x402/treasurer.ts"

// Re-export wallet config types from x402
export type { EOAWalletConfig, SmartAccountWalletConfig, WalletConfig } from "../../x402/wallets/index.ts"

export interface HTTPTransportOptions {
  type: "http"
  port: number
}

/**
 * Transport configuration for the proxy server
 * Only HTTP transport is currently supported
 */
export type TransportConfig = HTTPTransportOptions

/**
 * Configuration options for the MCP x402 proxy server
 */
export interface ProxyServerOptions {
  transport: TransportConfig
  /** X402Treasurer for handling payment decisions. Required. */
  treasurer: X402Treasurer
}

/**
 * Runtime context for proxy operations
 */
export interface ProxyContext {
  /** Target server URL for the current session */
  targetUrl: string
}

/**
 * Error thrown when target URL is missing or invalid
 */
export class ProxyError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
    this.name = "ProxyError"
  }
}
