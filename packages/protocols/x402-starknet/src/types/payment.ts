/**
 * Payment type definitions for Starknet x402
 * Spec compliance: x402 v2
 */

import type { StarknetNetworkId } from './network.js';

/**
 * Payment scheme type
 * Currently only "exact" is supported
 */
export type PaymentScheme = 'exact';

/**
 * Signature structure for Starknet
 */
export interface Signature {
  /** r component of signature (felt252) */
  r: string;
  /** s component of signature (felt252) */
  s: string;
}

/**
 * Payment authorization structure
 */
export interface PaymentAuthorization {
  /** Payer address (felt252) */
  from: string;
  /** Recipient address (felt252) */
  to: string;
  /** Payment amount (u256 as string) */
  amount: string;
  /** Token contract address (felt252) */
  token: string;
  /** Nonce for replay protection (felt252) */
  nonce: string;
  /** Expiry timestamp (Unix timestamp in seconds) */
  validUntil: string;
}

// ============================================================================
// x402 v2 Types
// ============================================================================

/**
 * Resource information for protected resources
 * Spec compliance: x402 v2 - ResourceInfo Schema
 */
export interface ResourceInfo {
  /** URL of the protected resource */
  url: string;
  /** Human-readable description of the resource */
  description?: string;
  /** MIME type of the expected response */
  mimeType?: string;
}

/**
 * Extension data structure for protocol extensions
 * Spec compliance: x402 v2 - Extensions System
 */
export interface ExtensionData {
  /** Extension-specific information */
  info: unknown;
  /** JSON Schema defining expected structure */
  schema?: object;
}

/**
 * Payment requirements sent by server (v2)
 * Spec compliance: x402 v2 - PaymentRequirements Schema
 */
export interface PaymentRequirements {
  /** Payment scheme */
  scheme: PaymentScheme;
  /** Network identifier (CAIP-2 format, e.g., "starknet:sepolia") */
  network: StarknetNetworkId;
  /** Required payment amount (u256 as string, in token's smallest unit) */
  amount: string;
  /** Token contract address (felt252) */
  asset: string;
  /** Recipient address (felt252) */
  payTo: string;
  /** Maximum timeout in seconds for payment completion */
  maxTimeoutSeconds: number;
  /** Additional scheme-specific data */
  extra?: {
    /** Token name (e.g., "USD Coin") */
    name?: string;
    /** Token symbol (e.g., "USDC") */
    symbol?: string;
    /** Token decimals (e.g., 6 for USDC) */
    decimals?: number;
    /** Payment contract address for settlement */
    paymentContract?: string;
  };
}

/**
 * Payment required response from server (402 response)
 * Spec compliance: x402 v2 - PaymentRequired Schema
 */
export interface PaymentRequired {
  /** x402 protocol version */
  x402Version: 2;
  /** Human-readable error message explaining why payment is required */
  error?: string;
  /** Information about the protected resource */
  resource: ResourceInfo;
  /** Array of acceptable payment methods */
  accepts: Array<PaymentRequirements>;
  /** Protocol extensions */
  extensions?: Record<string, ExtensionData>;
}

/**
 * Exact scheme payload for Starknet
 * Spec compliance: x402 v2 - scheme_exact_starknet
 */
export interface ExactStarknetPayload {
  /** Signature over the authorization */
  signature: Signature;
  /** Authorization details */
  authorization: PaymentAuthorization;
}

/**
 * Payment payload created by client (v2)
 * Spec compliance: x402 v2 - PaymentPayload Schema
 */
export interface PaymentPayload {
  /** x402 protocol version */
  x402Version: 2;
  /** Information about the protected resource (optional, echo from PaymentRequired) */
  resource?: ResourceInfo;
  /** The chosen payment requirement from accepts array */
  accepted: PaymentRequirements;
  /** Scheme-specific payment data */
  payload: ExactStarknetPayload;
  /** Protocol extensions */
  extensions?: Record<string, unknown>;
  /** Typed data used for signature (required for settlement) */
  typedData?: unknown;
  /** Paymaster endpoint for settlement (optional) */
  paymasterEndpoint?: string;
}

/**
 * Payment requirements selector function type
 */
export type PaymentRequirementsSelector = (
  requirements: Array<PaymentRequirements>
) => Promise<PaymentRequirements> | PaymentRequirements;
