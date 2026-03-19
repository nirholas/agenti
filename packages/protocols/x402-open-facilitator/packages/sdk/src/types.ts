// ============ Configuration ============

export interface FacilitatorConfig {
  /** Facilitator URL (defaults to https://pay.openfacilitator.io) */
  url?: string;
  /** Optional timeout in ms (default: 30000) */
  timeout?: number;
  /** Optional custom headers */
  headers?: Record<string, string>;
}

// ============ x402 Payment Types ============

/**
 * Payment payload for x402 version 1. Uses flat structure with scheme/network at top level.
 */
export interface PaymentPayloadV1 {
  /** x402 version 1 */
  x402Version: 1;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v1 format (e.g., "base", "solana") */
  network: string;
  /** Payment details */
  payload: {
    /** Signature of the payment */
    signature: string;
    /** Payment authorization */
    authorization: PaymentAuthorization;
  };
}

/**
 * Payment payload for x402 version 2. Uses nested `accepted` structure per @x402/core spec.
 */
export interface PaymentPayloadV2 {
  /** x402 version 2 */
  x402Version: 2;
  /** Optional resource being paid for */
  resource?: {
    /** Resource URL */
    url: string;
    /** Human-readable description */
    description?: string;
    /** MIME type of resource */
    mimeType?: string;
  };
  /** Accepted payment requirements (contains scheme, network, amount, etc.) */
  accepted: {
    /** Payment scheme (e.g., "exact") */
    scheme: string;
    /** Network identifier - CAIP-2 format (e.g., "eip155:8453") */
    network: string;
    /** Token/asset address */
    asset: string;
    /** Amount in base units */
    amount: string;
    /** Recipient address */
    payTo: string;
    /** Maximum timeout in seconds */
    maxTimeoutSeconds: number;
    /** Extra data */
    extra?: Record<string, unknown>;
  };
  /** Payment details (signature, authorization, etc.) */
  payload: Record<string, unknown>;
  /** Optional extensions */
  extensions?: Record<string, unknown>;
}

/**
 * Payment payload union - supports both x402 v1 and v2 formats.
 * Use x402Version to discriminate between versions.
 */
export type PaymentPayload = PaymentPayloadV1 | PaymentPayloadV2;

export interface PaymentAuthorization {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in base units (string to handle large numbers) */
  amount: string;
  /** Token/asset address or identifier */
  asset: string;
  /** Chain ID (for EVM) */
  chainId?: number;
  /** Nonce */
  nonce?: string;
  /** Expiration timestamp */
  validUntil?: number;
  /** Additional fields for specific schemes */
  [key: string]: unknown;
}

// ============ Payment Requirements ============

/**
 * Payment requirements for x402 version 1. Uses maxAmountRequired field.
 */
export interface PaymentRequirementsV1 {
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier */
  network: string;
  /** Maximum amount required in base units */
  maxAmountRequired: string;
  /** Resource URL being paid for */
  resource?: string;
  /** Token/asset address */
  asset: string;
  /** Recipient address */
  payTo?: string;
  /** Human-readable description */
  description?: string;
  /** MIME type of resource */
  mimeType?: string;
  /** Maximum timeout in seconds */
  maxTimeoutSeconds?: number;
  /** Output schema for structured responses */
  outputSchema?: Record<string, unknown>;
  /** Extra data */
  extra?: Record<string, unknown>;
}

/**
 * Payment requirements for x402 version 2.
 * Uses 'amount' instead of 'maxAmountRequired' and has stricter required fields.
 */
export interface PaymentRequirementsV2 {
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier - v2 CAIP-2 format */
  network: string;
  /** Amount required in base units */
  amount: string;
  /** Token/asset address */
  asset: string;
  /** Recipient address */
  payTo: string;
  /** Maximum timeout in seconds */
  maxTimeoutSeconds: number;
  /** Resource URL being paid for */
  resource?: string;
  /** Human-readable description */
  description?: string;
  /** Output schema for structured responses */
  outputSchema?: Record<string, unknown>;
  /** Extra data */
  extra?: Record<string, unknown>;
}

/**
 * Payment requirements union - supports both v1 and v2 formats.
 * V1 uses maxAmountRequired, V2 uses amount.
 */
export type PaymentRequirements = PaymentRequirementsV1 | PaymentRequirementsV2;

// ============ Response Types ============

export interface VerifyResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Reason if invalid (x402 standard) */
  invalidReason?: string;
  /** Payer address */
  payer?: string;
  /** Additional verification details */
  details?: {
    /** Verified amount */
    amount?: string;
    /** Verified recipient */
    recipient?: string;
    /** Payment scheme used */
    scheme?: string;
  };
}

export interface SettleResponse {
  /** Whether settlement was successful */
  success: boolean;
  /** Transaction hash/signature (empty string when failed, x402 standard) */
  transaction: string;
  /** Payer address (x402 standard) */
  payer: string;
  /** Network the transaction was settled on */
  network: string;
  /** Error reason if failed (x402 standard) */
  errorReason?: string;
}

export interface SupportedResponse {
  /** Supported payment kinds */
  kinds: PaymentKind[];
  /** Signer addresses by network namespace */
  signers?: Record<string, string[]>;
  /** Supported extensions */
  extensions?: string[];
}

export interface PaymentKind {
  /** x402 version */
  x402Version: 1 | 2;
  /** Payment scheme */
  scheme: string;
  /** Network identifier */
  network: string;
  /** Extra data (e.g., feePayer for Solana) */
  extra?: {
    feePayer?: string;
    [key: string]: unknown;
  };
}

// ============ Network Types ============

export type NetworkType = 'evm' | 'solana' | 'stacks';

export interface NetworkInfo {
  /** v1 identifier (e.g., "base") */
  v1Id: string;
  /** v2 CAIP-2 identifier (e.g., "eip155:8453") */
  v2Id: string;
  /** Human-readable name */
  name: string;
  /** Network type */
  type: NetworkType;
  /** Chain ID (EVM only) */
  chainId?: number;
  /** Whether this is a testnet */
  testnet: boolean;
}
