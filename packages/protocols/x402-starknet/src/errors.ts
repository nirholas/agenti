/**
 * Custom error classes for x402-starknet
 *
 * This module provides typed errors with stable codes and predictable shapes.
 * All errors extend X402Error with a fixed ErrorCode enum.
 */

/**
 * Standard error codes following EINVALID_INPUT pattern.
 * These codes are part of the public API and must remain stable.
 */
export type ErrorCode =
  | 'EINVALID_INPUT' // Input validation failed
  | 'ENOT_FOUND' // Resource not found
  | 'ETIMEOUT' // Operation timed out
  | 'ECONFLICT' // Conflicting state or data
  | 'ECANCELLED' // Operation cancelled by user/signal
  | 'EINTERNAL' // Internal error or unexpected failure
  | 'ENETWORK' // Network-related error
  | 'EPAYMASTER'; // Paymaster-specific error

/**
 * Base error class for all x402-starknet errors.
 * Never throw plain Error objects at public boundaries - always use X402Error.
 */
export class X402Error extends Error {
  /**
   * Stable error code for programmatic error handling
   */
  public readonly code: ErrorCode;

  /**
   * Original error cause (if wrapping another error)
   */
  public override readonly cause?: unknown;

  /**
   * Additional structured details (safe for serialization)
   * Never include secrets, tokens, or PII in details.
   */
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts?: { cause?: unknown; details?: Record<string, unknown> }
  ) {
    super(message);
    this.name = 'X402Error';
    this.code = code;
    if (opts?.cause !== undefined) this.cause = opts.cause;
    if (opts?.details !== undefined) this.details = opts.details;
    // Maintains proper stack trace for where our error was thrown (Node.js only)
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error factory functions for common error scenarios.
 * These provide consistent error creation across the library.
 */
export const err = {
  /**
   * Input validation failed.
   * @param msg - Short, specific message describing what's invalid
   * @param details - Machine-readable details (no secrets!)
   */
  invalid(msg: string, details?: Record<string, unknown>): X402Error {
    return new X402Error(
      'EINVALID_INPUT',
      msg,
      details ? { details } : undefined
    );
  },

  /**
   * Resource not found.
   * @param what - Description of what wasn't found
   */
  notFound(what: string): X402Error {
    return new X402Error('ENOT_FOUND', `${what} not found`);
  },

  /**
   * Operation timed out.
   * @param ms - Timeout duration in milliseconds
   */
  timeout(ms: number): X402Error {
    return new X402Error('ETIMEOUT', `Timed out after ${ms.toString()} ms`, {
      details: { ms },
    });
  },

  /**
   * Conflicting state or data.
   * @param msg - Description of the conflict
   */
  conflict(msg: string, details?: Record<string, unknown>): X402Error {
    return new X402Error('ECONFLICT', msg, details ? { details } : undefined);
  },

  /**
   * Operation cancelled (e.g., via AbortSignal).
   */
  cancelled(): X402Error {
    return new X402Error('ECANCELLED', 'Operation cancelled');
  },

  /**
   * Internal error or unexpected failure.
   * @param msg - Brief description of what failed
   * @param cause - Original error (if wrapping)
   */
  internal(msg: string, cause?: unknown): X402Error {
    return new X402Error('EINTERNAL', msg, { cause });
  },

  /**
   * Network-related error (RPC, HTTP, etc.).
   * @param msg - Description of network failure
   * @param cause - Original error
   */
  network(
    msg: string,
    cause?: unknown,
    details?: Record<string, unknown>
  ): X402Error {
    const opts: { cause?: unknown; details?: Record<string, unknown> } = {};
    if (cause !== undefined) opts.cause = cause;
    if (details !== undefined) opts.details = details;
    return new X402Error(
      'ENETWORK',
      msg,
      Object.keys(opts).length > 0 ? opts : undefined
    );
  },

  /**
   * Paymaster-specific error.
   * @param msg - Description of paymaster failure
   * @param cause - Original error
   */
  paymaster(
    msg: string,
    cause?: unknown,
    details?: Record<string, unknown>
  ): X402Error {
    const opts: { cause?: unknown; details?: Record<string, unknown> } = {};
    if (cause !== undefined) opts.cause = cause;
    if (details !== undefined) opts.details = details;
    return new X402Error(
      'EPAYMASTER',
      msg,
      Object.keys(opts).length > 0 ? opts : undefined
    );
  },
};

/**
 * Wraps unknown errors into X402Error for consistent error handling.
 * If the error is already an X402Error, returns it unchanged.
 *
 * @param e - The error to wrap
 * @param code - Error code to use if wrapping (default: EINTERNAL)
 * @param note - Message for wrapped error
 */
export function wrapUnknown(
  e: unknown,
  code: ErrorCode = 'EINTERNAL',
  note = 'Unexpected failure'
): X402Error {
  if (e instanceof X402Error) return e;
  if (e instanceof Error) return new X402Error(code, note, { cause: e });
  return new X402Error(code, note, { cause: e });
}

/**
 * Result type for APIs that prefer explicit error handling over exceptions.
 * Use this for workflows where exceptions are undesirable.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: X402Error };

/**
 * Wraps a promise to return a Result instead of throwing.
 * @param p - Promise to wrap
 */
export async function safe<T>(p: Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    return { ok: false, error: wrapUnknown(e) };
  }
}

/**
 * Serializable error shape for wire transmission.
 * Never includes error.cause to avoid leaking internal details.
 */
export interface ErrorDTO {
  name: string;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Converts any error to a safe serializable DTO.
 * @param e - Error to convert
 */
export function toDTO(e: unknown): ErrorDTO {
  const x402Error = e instanceof X402Error ? e : wrapUnknown(e);
  const dto: ErrorDTO = {
    name: 'X402Error',
    code: x402Error.code,
    message: x402Error.message,
  };
  if (x402Error.details !== undefined) {
    dto.details = x402Error.details;
  }
  return dto;
}

/**
 * Type guard to check if an error is an X402Error.
 */
export function isX402Error(e: unknown): e is X402Error {
  return (
    !!e &&
    typeof e === 'object' &&
    'code' in e &&
    'message' in e &&
    e instanceof X402Error
  );
}

/**
 * Asserts unreachable code (for exhaustive switch checks).
 */
export function assertNever(_x: never): never {
  throw err.internal('Unreachable code executed');
}

// ============================================================================
// Public error classes with static factory methods
// ============================================================================

/**
 * Payment-related error class with convenient static factory methods.
 * All methods return X402Error with appropriate error codes.
 */
export class PaymentError extends X402Error {
  constructor(message: string, code: ErrorCode = 'EINVALID_INPUT') {
    super(code, message);
    this.name = 'PaymentError';
  }

  static invalidPayload(details?: string): X402Error {
    return err.invalid(
      `Invalid payment payload${details ? `: ${details}` : ''}`
    );
  }

  static insufficientFunds(required: string, available: string): X402Error {
    return err.conflict(
      `Insufficient funds: required ${required}, available ${available}`,
      { required, available }
    );
  }

  static verificationFailed(reason: string): X402Error {
    return err.invalid(`Payment verification failed: ${reason}`);
  }

  static settlementFailed(reason: string): X402Error {
    return err.internal(`Payment settlement failed: ${reason}`);
  }
}

/**
 * Network-related error class with convenient static factory methods.
 * All methods return X402Error with appropriate error codes.
 */
export class NetworkError extends X402Error {
  constructor(message: string, code: ErrorCode = 'ENETWORK') {
    super(code, message);
    this.name = 'NetworkError';
  }

  static unsupportedNetwork(network: string): X402Error {
    return err.invalid(`Unsupported network: ${network}`, { network });
  }

  static networkMismatch(expected: string, actual: string): X402Error {
    return err.conflict(
      `Network mismatch: expected ${expected}, got ${actual}`,
      {
        expected,
        actual,
      }
    );
  }

  static rpcFailed(details: string, cause?: unknown): X402Error {
    return err.network(`RPC call failed: ${details}`, cause);
  }
}

/**
 * Error code constants for programmatic error handling.
 * These codes are stable and part of the public API.
 */
export const ERROR_CODES = {
  EINVALID_INPUT: 'EINVALID_INPUT',
  ENOT_FOUND: 'ENOT_FOUND',
  ETIMEOUT: 'ETIMEOUT',
  ECONFLICT: 'ECONFLICT',
  ECANCELLED: 'ECANCELLED',
  EINTERNAL: 'EINTERNAL',
  ENETWORK: 'ENETWORK',
  EPAYMASTER: 'EPAYMASTER',
} as const;
