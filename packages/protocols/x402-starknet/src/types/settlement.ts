/**
 * Settlement and verification type definitions for Starknet x402
 * Spec compliance: x402 v2
 */

import type { StarknetNetworkId } from './network.js';

/**
 * Reason for invalid payment
 * Spec compliance: x402 v2 - Error Codes
 */
export type InvalidPaymentReason =
  // Generic error codes
  | 'invalid_signature'
  | 'insufficient_funds'
  | 'invalid_network'
  | 'invalid_amount'
  | 'invalid_payload'
  | 'invalid_payment_requirements'
  | 'invalid_scheme'
  | 'unsupported_scheme'
  | 'invalid_x402_version'
  | 'invalid_transaction_state'
  | 'unexpected_verify_error'
  | 'unexpected_settle_error'
  // Starknet-specific error codes (following v2 scheme naming pattern)
  | 'invalid_exact_starknet_payload_authorization_valid_until'
  | 'invalid_exact_starknet_payload_authorization_value'
  | 'invalid_exact_starknet_payload_signature'
  | 'invalid_exact_starknet_payload_recipient_mismatch'
  | 'invalid_exact_starknet_payload_token_mismatch'
  | 'invalid_exact_starknet_payload_nonce_used';

/**
 * Verification response from facilitator
 * Spec compliance: x402 v2 - VerifyResponse Schema
 */
export interface VerifyResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Reason for invalidity if isValid is false */
  invalidReason?: InvalidPaymentReason;
  /** Payer address (optional per v2 spec) */
  payer?: string;
  /** Additional verification details (internal use) */
  details?: {
    /** Current token balance of payer */
    balance?: string;
    /** Whether nonce has been used */
    nonceUsed?: boolean;
    /** Current timestamp */
    timestamp?: number;
    /** Error message for debugging */
    error?: string;
    /** Valid until timestamp */
    validUntil?: string;
    /** Current timestamp at verification */
    currentTimestamp?: string;
  };
}

/**
 * Settlement response from facilitator
 * Spec compliance: x402 v2 - SettlementResponse Schema
 */
export interface SettleResponse {
  /** Whether settlement was successful */
  success: boolean;
  /** Reason for failure if success is false */
  errorReason?: string;
  /** Payer address (optional per v2 spec) */
  payer?: string;
  /** Transaction hash (empty string if failed) */
  transaction: string;
  /** Network the transaction was submitted to (CAIP-2 format) */
  network: StarknetNetworkId;
  /** Transaction status (Starknet-specific) */
  status?: 'pending' | 'accepted_on_l2' | 'accepted_on_l1' | 'rejected';
  /** Block number (if accepted) */
  blockNumber?: number;
  /** Block hash (if accepted) */
  blockHash?: string;
}

/**
 * Settlement request to facilitator
 * Spec compliance: x402 v2 - Facilitator API
 */
export interface SettleRequest {
  /** Payment payload from client */
  paymentPayload: unknown;
  /** Payment requirements from server */
  paymentRequirements: unknown;
}

/**
 * Verification request to facilitator
 * Spec compliance: x402 v2 - Facilitator API
 */
export interface VerifyRequest {
  /** Payment payload from client */
  paymentPayload: unknown;
  /** Payment requirements from server */
  paymentRequirements: unknown;
}

/**
 * Supported payment kind
 * Spec compliance: x402 v2 - GET /supported
 */
export interface SupportedKind {
  /** x402 protocol version */
  x402Version: 2;
  /** Payment scheme */
  scheme: 'exact';
  /** Network identifier (CAIP-2 format) */
  network: StarknetNetworkId;
  /** Additional scheme-specific data */
  extra?: Record<string, unknown>;
}

/**
 * Supported payment kinds response
 * Spec compliance: x402 v2 - GET /supported Response
 */
export interface SupportedResponse {
  /** Array of supported payment kinds */
  kinds: Array<SupportedKind>;
  /** Supported protocol extensions */
  extensions: Array<string>;
  /** Signer addresses by network pattern */
  signers: Record<string, Array<string>>;
}
