export const X402_ERRORS = {
  INVALID_SIGNATURE: "invalid_exact_aptos_payload_signature",
  NONCE_USED: "nonce_already_used",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  INVALID_AMOUNT: "invalid_exact_aptos_payload_authorization_value",
  EXPIRED_PROOF: "payment_proof_expired",
  VERIFICATION_FAILED: "payment_verification_failed",
  SETTLEMENT_FAILED: "payment_settlement_failed",
  UNSUPPORTED_NETWORK: "unsupported_network",
  UNSUPPORTED_SCHEME: "unsupported_scheme",

  INVALID_AUTHORIZATION_VALID_AFTER: "invalid_exact_aptos_payload_authorization_valid_after",
  INVALID_AUTHORIZATION_VALID_BEFORE: "invalid_exact_aptos_payload_authorization_valid_before",
  RECIPIENT_MISMATCH: "invalid_exact_aptos_payload_recipient_mismatch",
  INVALID_TRANSACTION_STATE: "invalid_transaction_state",
  UNEXPECTED_VERIFY_ERROR: "unexpected_verify_error",
  UNEXPECTED_SETTLE_ERROR: "unexpected_settle_error",

  INVALID_PAYMENT_HEADER: "invalid_payment_header",
  INVALID_PAYMENT_REQUIREMENTS: "invalid_payment_requirements",
  REGISTRY_NOT_INITIALIZED: "registry_not_initialized",
  INVALID_PUBLIC_KEY: "invalid_public_key",
  INVALID_RECIPIENTS: "invalid_recipients",
} as const;

export const X402_ERROR_MESSAGES: Record<string, string> = {
  [X402_ERRORS.INVALID_SIGNATURE]: "Invalid payment signature",
  [X402_ERRORS.NONCE_USED]: "Payment nonce already used",
  [X402_ERRORS.INSUFFICIENT_FUNDS]: "Insufficient funds for payment",
  [X402_ERRORS.INVALID_AMOUNT]: "Invalid payment amount",
  [X402_ERRORS.EXPIRED_PROOF]: "Payment proof has expired",
  [X402_ERRORS.VERIFICATION_FAILED]: "Payment verification failed",
  [X402_ERRORS.SETTLEMENT_FAILED]: "Payment settlement failed",
  [X402_ERRORS.UNSUPPORTED_NETWORK]: "Unsupported blockchain network",
  [X402_ERRORS.UNSUPPORTED_SCHEME]: "Unsupported payment scheme",
  [X402_ERRORS.INVALID_AUTHORIZATION_VALID_AFTER]:
    "Payment authorization valid_after timestamp is invalid",
  [X402_ERRORS.INVALID_AUTHORIZATION_VALID_BEFORE]:
    "Payment authorization valid_before timestamp is invalid",
  [X402_ERRORS.RECIPIENT_MISMATCH]: "Payment recipient does not match expected recipient",
  [X402_ERRORS.INVALID_TRANSACTION_STATE]: "Transaction is in an invalid state",
  [X402_ERRORS.UNEXPECTED_VERIFY_ERROR]: "Unexpected error during payment verification",
  [X402_ERRORS.UNEXPECTED_SETTLE_ERROR]: "Unexpected error during payment settlement",
  [X402_ERRORS.INVALID_PAYMENT_HEADER]: "Payment header format is invalid",
  [X402_ERRORS.INVALID_PAYMENT_REQUIREMENTS]: "Payment requirements are invalid",
  [X402_ERRORS.REGISTRY_NOT_INITIALIZED]: "Nonce registry not initialized for this account",
  [X402_ERRORS.INVALID_PUBLIC_KEY]: "Public key format is invalid",
  [X402_ERRORS.INVALID_RECIPIENTS]: "Recipient list is invalid",
};
