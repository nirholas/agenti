import type { Address, Hex } from 'viem';

/**
 * Chain ID can be number (EVM) or string (non-EVM like Solana)
 */
export type ChainId = number | string;

/**
 * Supported blockchain network configuration
 */
export interface ChainConfig {
  chainId: ChainId;
  name: string;
  network: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  isEVM: boolean;
}

/**
 * Token configuration for a specific chain
 */
export interface TokenConfig {
  address: string; // Address for EVM, mint address for Solana
  symbol: string;
  decimals: number;
  chainId: ChainId;
}

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  ownerAddress: string;
  supportedChains: ChainId[];
  supportedTokens: TokenConfig[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * x402 Payment header structure
 */
export interface X402PaymentHeader {
  version: string;
  scheme: string;
  network: string;
  payload: X402PaymentPayload;
}

/**
 * x402 Payment payload
 */
export interface X402PaymentPayload {
  signature: Hex | string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: Hex | string;
  };
}

/**
 * Verification request body
 */
export interface VerifyRequest {
  x402Version: number;
  paymentPayload: string;
  paymentRequirements: PaymentRequirements;
}

/**
 * Payment requirements from the resource server.
 * Supports both x402 v1 (maxAmountRequired) and v2 (amount) formats.
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  /** v1 field - Amount required in base units */
  maxAmountRequired?: string;
  /** v2 field - Amount required in base units */
  amount?: string;
  resource?: string;
  asset: string; // Token contract address
  payTo?: string; // Required in v2, optional in v1
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number; // Required in v2
  outputSchema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

/**
 * Get the amount from payment requirements, supporting both v1 and v2 formats.
 * v1 uses maxAmountRequired, v2 uses amount.
 */
export function getRequiredAmount(requirements: PaymentRequirements): string {
  return requirements.maxAmountRequired ?? requirements.amount ?? '0';
}

/**
 * Verification response (x402 standard format)
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

/**
 * Settlement request body
 */
export interface SettleRequest {
  x402Version: number;
  paymentPayload: string;
  paymentRequirements: PaymentRequirements;
}

/**
 * Settlement response (x402 standard format)
 */
export interface SettleResponse {
  success: boolean;
  transaction: string;  // Transaction hash, empty string "" when failed
  payer: string;        // Payer address
  network: string;      // Network identifier
  errorReason?: string; // Error reason when success is false
}

/**
 * Supported tokens/chains response (PayAI format)
 */
export interface SupportedResponse {
  kinds: SupportedKind[];
  extensions?: string[];
  signers?: Record<string, string[]>;
}

/**
 * A supported payment kind (network + token combination)
 */
export interface SupportedKind {
  x402Version: number;
  scheme: string;
  network: string;
  asset?: string;
  extra?: Record<string, unknown>;
}

/**
 * Transaction record for history tracking
 */
export interface TransactionRecord {
  id: string;
  facilitatorId: string;
  type: 'verify' | 'settle';
  network: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  transactionHash?: string;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

// ============================================
// Multi-Settle Types
// ============================================

/**
 * Multi-settle authorization request
 * The user signs a spending cap that can be settled multiple times
 */
export interface MultiSettleAuthorizationRequest {
  x402Version?: number;
  paymentPayload: string | object;
  paymentRequirements: PaymentRequirements;
  /** The total spending cap (e.g., "5000000" for $5 USDC) */
  capAmount: string;
  /** Unix timestamp when this authorization expires */
  validUntil: number;
}

/**
 * Multi-settle authorization response
 */
export interface MultiSettleAuthorizationResponse {
  success: boolean;
  /** Unique identifier for this multi-settle authorization */
  authorizationId?: string;
  /** The original cap amount */
  capAmount?: string;
  /** Current remaining amount */
  remainingAmount?: string;
  /** Unix timestamp when this expires */
  validUntil?: number;
  /** The nonce from the signature */
  nonce?: string;
  errorMessage?: string;
}

/**
 * Multi-settle settlement request
 */
export interface MultiSettleSettlementRequest {
  /** The authorization ID returned from the authorize endpoint */
  authorizationId: string;
  /** The recipient address for this settlement */
  payTo: string;
  /** The amount to settle in this transaction */
  amount: string;
}

/**
 * Multi-settle settlement response
 */
export interface MultiSettleSettlementResponse {
  success: boolean;
  /** Transaction hash if settled on-chain */
  transactionHash?: string;
  /** Remaining amount after this settlement */
  remainingAmount?: string;
  /** Network the transaction was settled on */
  network?: string;
  errorMessage?: string;
}

/**
 * Multi-settle status check response
 */
export interface MultiSettleStatusResponse {
  authorizationId: string;
  status: 'active' | 'exhausted' | 'expired' | 'revoked';
  network: string;
  asset: string;
  fromAddress: string;
  capAmount: string;
  remainingAmount: string;
  validUntil: number;
  createdAt: string;
  settlements: MultiSettleSettlementSummary[];
}

/**
 * Summary of a settlement in a multi-settle authorization
 */
export interface MultiSettleSettlementSummary {
  id: string;
  payTo: string;
  amount: string;
  transactionHash?: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
}

/**
 * Multi-settle revocation request
 */
export interface MultiSettleRevocationRequest {
  authorizationId: string;
}

/**
 * Multi-settle revocation response
 */
export interface MultiSettleRevocationResponse {
  success: boolean;
  errorMessage?: string;
}
