/**
 * px402 SDK - Private x402 Payments
 *
 * @example
 * ```typescript
 * import {
 *   PrivacySDK,
 *   encryptNote,
 *   decryptNote,
 *   decodeXPaymentResponse,
 *   getNoteBalance
 * } from '@prxvt/sdk';
 *
 * // Initialize SDK
 * const sdk = new PrivacySDK({ chain: 'base' });
 *
 * // Deposit USDC to create a note
 * const note = await sdk.depositFast(10, privateKey);
 *
 * // Encrypt note for storage
 * const encrypted = await encryptNote(note, 'password');
 *
 * // Use wrapFetch for automatic x402 payments
 * sdk.setNote(note);
 * const fetchWithPay = sdk.wrapFetch(fetch);
 * const response = await fetchWithPay('https://api.example.com/paid');
 *
 * // Decode payment response
 * const paymentResponse = decodeXPaymentResponse(response.headers.get('x-payment-response'));
 * ```
 */

// Main SDK
export { PrivacySDK } from './PrivacySDK';

// Types
export type {
  Note,
  NoteCommitment,
  PrivacySDKConfig,
  ChainConfig,
  PaymentResult,
} from './types';

// Encryption utilities
export {
  encryptNote,
  decryptNote,
  isEncryptedNote,
} from './encryption';
export type { EncryptedNote } from './encryption';

// Error types
export {
  PrivacySDKError,
  InsufficientBalanceError,
  InvalidNoteError,
  DecryptionError,
  MerkleProofError,
  ProofGenerationError,
  BundlerError,
  NetworkError,
  PaymentRequiredError,
  TransactionError,
  NullifierSpentError,
} from './errors';

// Helper functions
export {
  decodeXPaymentResponse,
  encodeXPayment,
  parsePaymentRequirements,
  getNoteBalance,
  hasEnoughBalance,
  formatUSDCAmount,
  parseUSDCAmount,
  withRetry,
  timeout,
} from './helpers';
export type { XPaymentResponse, X402PaymentRequirement } from './helpers';

// Re-export x402 utilities (legacy)
export { wrapFetchWithPrivacy, getUpdatedNote } from './x402';

// Cross-chain attestor utilities
export {
  isCrossChain,
  getChainEid,
  getChainName,
  requestNullifierAttestation,
  encodeAttestationData,
  getAttestationForPayment,
} from './attestor';
export type { AttestationResponse } from './attestor';

// Utility functions
export {
  getChainConfig,
  getBundlerUrl,
  calculateNoteBalance,
  validateNote,
  parseUSDC,
  formatUSDC,
} from './utils';

// Logger for debug configuration
export { logger } from './logger';
export type { LogLevel } from './logger';
