/**
 * Paymaster integration utilities
 * @module paymaster
 */

export { PaymasterClient, createPaymasterClient } from './client.js';
export * from './helpers.js';

// Re-export paymaster types for convenience
export type {
  PaymasterConfig,
  PaymasterFeeMode,
  BuildTransactionRequest,
  BuildTransactionResponse,
  ExecuteTransactionRequest,
  ExecuteTransactionResponse,
  SupportedTokensResponse,
  IsAvailableResponse,
} from '../types/paymaster.js';
