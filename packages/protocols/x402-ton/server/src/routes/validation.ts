/**
 * Input validation helpers for route handlers (C5 security fix).
 * Manual typeof checks — no external dependencies.
 */

export type PayloadValidationError = string;

/**
 * Validates paymentPayload inner fields (common to verify and settle).
 * Assumes x402Version has already been checked.
 * Returns an error message string or null if valid.
 */
export function validatePaymentPayload(paymentPayload: unknown): PayloadValidationError | null {
  if (typeof paymentPayload !== 'object' || paymentPayload === null || Array.isArray(paymentPayload)) {
    return 'paymentPayload must be an object';
  }

  const pp = paymentPayload as Record<string, unknown>;

  if (typeof pp.payload !== 'object' || pp.payload === null || Array.isArray(pp.payload)) {
    return 'paymentPayload.payload must be an object';
  }

  const inner = pp.payload as Record<string, unknown>;

  if (typeof inner.signedBoc !== 'string' || inner.signedBoc.length === 0) {
    return 'paymentPayload.payload.signedBoc must be a non-empty string';
  }

  if (typeof inner.walletPublicKey !== 'string') {
    return 'paymentPayload.payload.walletPublicKey must be a string';
  }

  return null;
}

/**
 * Validates paymentRequirements inner fields (common to verify and settle).
 * Returns an error message string or null if valid.
 */
export function validatePaymentRequirements(paymentRequirements: unknown): PayloadValidationError | null {
  if (
    typeof paymentRequirements !== 'object' ||
    paymentRequirements === null ||
    Array.isArray(paymentRequirements)
  ) {
    return 'paymentRequirements must be an object';
  }

  const pr = paymentRequirements as Record<string, unknown>;

  if (typeof pr.scheme !== 'string') {
    return 'paymentRequirements.scheme must be a string';
  }

  if (typeof pr.network !== 'string') {
    return 'paymentRequirements.network must be a string';
  }

  return null;
}

/**
 * Additional settle-only validation for paymentRequirements.
 * Returns an error message string or null if valid.
 */
export function validateSettleRequirements(paymentRequirements: unknown): PayloadValidationError | null {
  // validatePaymentRequirements must have already passed
  const pr = paymentRequirements as Record<string, unknown>;

  if (typeof pr.amount !== 'string') {
    return 'paymentRequirements.amount must be a string';
  }

  if (!/^\d+$/.test(pr.amount) || pr.amount === '0') {
    return 'paymentRequirements.amount must be a positive integer string';
  }

  if (typeof pr.payTo !== 'string') {
    return 'paymentRequirements.payTo must be a string';
  }

  return null;
}
