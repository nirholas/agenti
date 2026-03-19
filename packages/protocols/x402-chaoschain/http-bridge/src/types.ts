import { z } from "zod";

/**
 * x402 Protocol Types
 * Based on: https://github.com/coinbase/x402
 */

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Payment Requirements Schema
 * Specifies what the resource server accepts for payment
 */
export const PaymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  maxAmountRequired: z.string(),
  resource: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().optional(),
  asset: z.string(),
  extra: z.record(z.any()).nullable().optional(),
});

export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;

/**
 * Payment Header Schema (decoded from base64)
 */
export const PaymentHeaderSchema = z.object({
  sender: z.string(),
  nonce: z.string(),
  validAfter: z.string().optional(),
  validBefore: z.string().optional(),
  signature: z.string().optional(),
});

export type PaymentHeader = z.infer<typeof PaymentHeaderSchema>;

/**
 * Verify Request Schema
 * POST /verify request body
 */
export const VerifyRequestSchema = z.object({
  x402Version: z.number(),
  paymentHeader: z.union([z.string(), PaymentHeaderSchema]), // base64 string or decoded object
  paymentRequirements: PaymentRequirementsSchema,
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

/**
 * Settle Request Schema
 * POST /settle request body
 */
export const SettleRequestSchema = z.object({
  x402Version: z.number(),
  paymentHeader: z.union([z.string(), PaymentHeaderSchema]), // base64 string or decoded object
  paymentRequirements: PaymentRequirementsSchema,
  agentId: z.string().optional(), // ERC-8004 token ID for Proof-of-Agency
});

export type SettleRequest = z.infer<typeof SettleRequestSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Amount breakdown for transparency
 */
export interface AmountBreakdown {
  human: string;   // Human-readable amount (e.g., "1.00")
  base: string;    // Base units (e.g., "1000000")
  symbol: string;  // Token symbol (e.g., "USDC")
  decimals?: number; // Token decimals (e.g., 6)
}

export interface FeeBreakdown {
  human: string;   // Human-readable fee (e.g., "0.01")
  base: string;    // Base units (e.g., "10000")
  bps: number;     // Basis points (e.g., 100 for 1%)
}

export interface NetBreakdown {
  human: string;   // Human-readable net (e.g., "0.99")
  base: string;    // Base units (e.g., "990000")
}

/**
 * Verification Response
 * Returned by POST /verify
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason: string | null;
  consensusProof: string | null; // CRE consensus proof (ChaosChain extension)
  reportId?: string; // Report identifier (ChaosChain extension)
  timestamp?: number; // Unix timestamp (ChaosChain extension)
  // Fee transparency (always present)
  amount?: AmountBreakdown;
  fee?: FeeBreakdown;
  net?: NetBreakdown;
}

/**
 * Settlement Response
 * Returned by POST /settle
 */
export interface SettleResponse {
  success: boolean;
  error: string | null;
  txHash: string | null;
  txHashFee?: string; // Fee transfer tx hash (managed mode)
  networkId: string | null;
  consensusProof?: string; // CRE consensus proof (ChaosChain extension)
  timestamp?: number; // Unix timestamp (ChaosChain extension)
  status?: 'pending' | 'partial_settlement' | 'confirmed' | 'failed'; // Settlement status (managed mode)
  evidenceHash?: string; // Evidence hash for Proof-of-Agency (ChaosChain extension)
  proofOfAgency?: string; // ValidationRegistry tx hash (ChaosChain extension)
  // Fee transparency (always present)
  amount?: AmountBreakdown;
  fee?: FeeBreakdown;
  net?: NetBreakdown;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error Response
 * Returned when request validation or processing fails
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Bridge Configuration
 */
export interface BridgeConfig {
  port: number;
  mode: 'managed' | 'decentralized'; // Facilitator mode
  creMode: "simulate" | "remote"; // CRE workflow mode (for decentralized)
  creWorkflowUrl?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  defaultChain: string; // Default blockchain (e.g., 'base-sepolia')
  chaoschainEnabled: boolean; // Enable ChaosChain ERC-8004 integration
}

