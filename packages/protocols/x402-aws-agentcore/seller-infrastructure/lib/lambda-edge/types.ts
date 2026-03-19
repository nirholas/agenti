/**
 * x402 v2 Types based on specification
 * Shared types for the payment verifier and content configuration
 */

// ============================================================================
// x402 Protocol Types
// ============================================================================

/**
 * Resource information for payment requirements
 */
export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

/**
 * Payment requirements that a seller accepts
 */
export interface PaymentRequirements {
  /** Payment scheme (e.g., 'exact') */
  scheme: string;
  /** Network identifier in CAIP-2 format (e.g., 'eip155:84532') */
  network: string;
  /** Amount in atomic units (e.g., '1000' for 0.001 USDC with 6 decimals) */
  amount: string;
  /** Asset contract address */
  asset: string;
  /** Recipient wallet address */
  payTo: string;
  /** Maximum timeout in seconds for payment validity */
  maxTimeoutSeconds: number;
  /** Extra metadata */
  extra?: {
    name?: string;
    version?: string;
    assetTransferMethod?: string;
  };
}

/**
 * 402 Payment Required response body
 */
export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

/**
 * EIP-3009 Authorization structure
 */
export interface Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * Exact EVM payment payload
 */
export interface ExactEvmPayload {
  signature: string;
  authorization: Authorization;
}

/**
 * Complete payment payload from client
 */
export interface PaymentPayload {
  x402Version: number;
  resource?: ResourceInfo;
  accepted: PaymentRequirements;
  payload: ExactEvmPayload;
  extensions?: Record<string, unknown>;
}

/**
 * EIP-3009 Authorization structure
 */
export interface Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * Exact EVM payment payload
 */
export interface ExactEvmPayload {
  signature: string;
  authorization: Authorization;
}

/**
 * Verification response from facilitator
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

/**
 * Settlement response from facilitator
 */
export interface SettlementResponse {
  success: boolean;
  transaction: string;
  network: string;
  payer?: string;
  errorReason?: string;
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Metric names for CloudWatch
 */
export enum MetricName {
  REQUEST_COUNT = 'RequestCount',
  PAYMENT_REQUIRED = 'PaymentRequired',
  PAYMENT_RECEIVED = 'PaymentReceived',
  PAYMENT_VERIFIED = 'PaymentVerified',
  PAYMENT_SETTLED = 'PaymentSettled',
  PAYMENT_FAILED = 'PaymentFailed',
  VALIDATION_ERROR = 'ValidationError',
  FACILITATOR_ERROR = 'FacilitatorError',
  LATENCY = 'Latency',
  VERIFICATION_LATENCY = 'VerificationLatency',
  SETTLEMENT_LATENCY = 'SettlementLatency',
  CONTENT_GENERATED = 'ContentGenerated',
  CONTENT_CACHE_HIT = 'ContentCacheHit',
  S3_FETCH_SUCCESS = 'S3FetchSuccess',
  S3_FETCH_ERROR = 'S3FetchError',
  S3_CACHE_HIT = 'S3CacheHit',
  // New custom metrics
  PAYMENT_AMOUNT_WEI = 'PaymentAmountWei',
  PAYMENT_AMOUNT_USD = 'PaymentAmountUSD',
  UNIQUE_PAYERS = 'UniquePayers',
  CONTENT_BYTES_SERVED = 'ContentBytesServed',
  AUTHORIZATION_EXPIRED = 'AuthorizationExpired',
  SIGNATURE_INVALID = 'SignatureInvalid',
  AMOUNT_INSUFFICIENT = 'AmountInsufficient',
  NETWORK_MISMATCH = 'NetworkMismatch',
  ASSET_MISMATCH = 'AssetMismatch',
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  uri?: string;
  payer?: string;
  amount?: string;
  network?: string;
  transactionHash?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  [key: string]: unknown;
}

/**
 * CloudWatch Embedded Metric Format (EMF) structure
 */
export interface EMFMetric {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{
        Name: string;
        Unit: string;
      }>;
    }>;
  };
  [key: string]: unknown;
}
