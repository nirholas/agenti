/**
 * Privacy SDK Error Types
 * Clear, typed errors for better developer experience
 */

/** Base error class for all SDK errors */
export class PrivacySDKError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PrivacySDKError';
  }
}

/** Insufficient balance in note */
export class InsufficientBalanceError extends PrivacySDKError {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(
      `Insufficient balance. Required: ${required} USDC, available: ${available} USDC`,
      'INSUFFICIENT_BALANCE'
    );
    this.name = 'InsufficientBalanceError';
  }
}

/** Invalid note format or corrupted note */
export class InvalidNoteError extends PrivacySDKError {
  constructor(message: string = 'Invalid or corrupted note') {
    super(message, 'INVALID_NOTE');
    this.name = 'InvalidNoteError';
  }
}

/** Note decryption failed (wrong password) */
export class DecryptionError extends PrivacySDKError {
  constructor(message: string = 'Failed to decrypt note. Wrong password?') {
    super(message, 'DECRYPTION_FAILED');
    this.name = 'DecryptionError';
  }
}

/** Merkle proof generation or verification failed */
export class MerkleProofError extends PrivacySDKError {
  constructor(message: string) {
    super(message, 'MERKLE_PROOF_ERROR');
    this.name = 'MerkleProofError';
  }
}

/** ZK proof generation failed */
export class ProofGenerationError extends PrivacySDKError {
  constructor(message: string) {
    super(message, 'PROOF_GENERATION_ERROR');
    this.name = 'ProofGenerationError';
  }
}

/** Bundler API error */
export class BundlerError extends PrivacySDKError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message, 'BUNDLER_ERROR');
    this.name = 'BundlerError';
  }
}

/** Network/RPC error */
export class NetworkError extends PrivacySDKError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/** x402 payment required but failed */
export class PaymentRequiredError extends PrivacySDKError {
  constructor(
    public readonly amount: number,
    public readonly recipient: string,
    public readonly network: string
  ) {
    super(
      `Payment required: ${amount} USDC to ${recipient} on ${network}`,
      'PAYMENT_REQUIRED'
    );
    this.name = 'PaymentRequiredError';
  }
}

/** Transaction failed or reverted */
export class TransactionError extends PrivacySDKError {
  constructor(
    message: string,
    public readonly txHash?: string,
    public readonly reason?: string
  ) {
    super(message, 'TRANSACTION_ERROR');
    this.name = 'TransactionError';
  }
}

/** Nullifier already spent (double-spend attempt) */
export class NullifierSpentError extends PrivacySDKError {
  constructor(public readonly nullifierHash: string) {
    super('Note has already been spent', 'NULLIFIER_SPENT');
    this.name = 'NullifierSpentError';
  }
}
