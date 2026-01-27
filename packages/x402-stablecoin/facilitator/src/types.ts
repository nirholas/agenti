/**
 * X402 Facilitator Server Types
 * 
 * Type definitions for the production payment facilitator
 */

import { Address } from 'viem';

/**
 * Supported networks
 */
export type Network = 'arbitrum' | 'arbitrum-sepolia';

/**
 * Supported payment tokens
 */
export type PaymentToken = 'USDs' | 'USDC' | 'USDT' | 'DAI';

/**
 * EIP-3009 Transfer Authorization
 */
export interface EIP3009Authorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

/**
 * Payment verification request body
 */
export interface VerifyRequest {
  txHash: string;
  paymentRequest: PaymentRequestDetails;
  signature?: string;
}

/**
 * Payment request details from 402 response
 */
export interface PaymentRequestDetails {
  price: string;
  token: PaymentToken;
  chain: Network;
  recipient: Address;
  reference?: string;
  deadline?: number;
  toolName?: string;
  description?: string;
}

/**
 * Verification response
 */
export interface VerifyResponse {
  verified: boolean;
  txHash: string;
  timestamp: number;
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

/**
 * Settlement request body
 */
export interface SettleRequest {
  authorization: EIP3009Authorization;
  paymentRequest: PaymentRequestDetails;
}

/**
 * Settlement response
 */
export interface SettleResponse {
  success: boolean;
  txHash: string;
  timestamp: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  error?: string;
}

/**
 * Quote request body
 */
export interface QuoteRequest {
  service: string;
  params?: Record<string, unknown>;
  network?: Network;
  token?: PaymentToken;
}

/**
 * Quote response (HTTP 402 Payment Required)
 */
export interface QuoteResponse {
  price: string;
  token: PaymentToken;
  chain: Network;
  recipient: Address;
  deadline: number;
  description: string;
  facilitatorUrl: string;
  x402Version: number;
}

/**
 * Payment status
 */
export interface PaymentStatus {
  txHash: string;
  verified: boolean;
  settled: boolean;
  amount: string;
  token: PaymentToken;
  from?: Address;
  to?: Address;
  timestamp: number;
  blockNumber?: number;
  error?: string;
}

/**
 * Cached payment entry
 */
export interface CachedPayment {
  txHash: string;
  verified: boolean;
  settled: boolean;
  amount: string;
  token: PaymentToken;
  from?: Address;
  to?: Address;
  timestamp: number;
  blockNumber?: number;
  ttl: number;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  network: Network;
  paymentsProcessed: number;
  cacheSize: number;
  blockNumber?: number;
  timestamp: number;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  message?: string;
  path?: string;
  txHash?: string;
}

/**
 * Token configuration
 */
export interface TokenConfig {
  address: Address;
  decimals: number;
  name: string;
  supportsEIP3009: boolean;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  network: Network;
  rpcUrl: string;
  privateKey?: `0x${string}`;
  recipientAddress: Address;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  paymentCacheTtlMs: number;
}
