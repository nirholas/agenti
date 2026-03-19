import type {
  PaymentPayload,
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirements,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
} from './types.js';

/**
 * Normalize facilitator URL (remove trailing slash)
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Build full endpoint URL
 */
export function buildUrl(baseUrl: string, path: string): string {
  return `${normalizeUrl(baseUrl)}${path}`;
}

/**
 * Type guard for checking if value is a valid payment payload
 */
export function isPaymentPayload(value: unknown): value is PaymentPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (obj.x402Version === 1) {
    return (
      typeof obj.scheme === 'string' &&
      typeof obj.network === 'string' &&
      obj.payload !== undefined
    );
  } else if (obj.x402Version === 2) {
    const accepted = obj.accepted as Record<string, unknown> | undefined;
    return (
      accepted !== undefined &&
      typeof accepted === 'object' &&
      typeof accepted.scheme === 'string' &&
      typeof accepted.network === 'string' &&
      obj.payload !== undefined
    );
  }
  return false;
}

// ============ Type Guards for Versioned Types ============

/**
 * Type guard for PaymentPayloadV1 (x402 version 1).
 * Narrows PaymentPayload to v1 format with flat structure.
 */
export function isPaymentPayloadV1(value: unknown): value is PaymentPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.x402Version === 1 &&
    typeof obj.scheme === 'string' &&
    typeof obj.network === 'string' &&
    obj.payload !== undefined &&
    typeof obj.payload === 'object'
  );
}

/**
 * Type guard for PaymentPayloadV2 (x402 version 2).
 * Narrows PaymentPayload to v2 format with nested `accepted` structure.
 */
export function isPaymentPayloadV2(value: unknown): value is PaymentPayloadV2 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (obj.x402Version !== 2) return false;
  const accepted = obj.accepted as Record<string, unknown> | undefined;
  return (
    accepted !== undefined &&
    typeof accepted === 'object' &&
    typeof accepted.scheme === 'string' &&
    typeof accepted.network === 'string' &&
    typeof accepted.asset === 'string' &&
    typeof accepted.amount === 'string' &&
    typeof accepted.payTo === 'string' &&
    typeof accepted.maxTimeoutSeconds === 'number' &&
    obj.payload !== undefined
  );
}

/**
 * Type guard for PaymentRequirementsV1.
 * V1 requirements have maxAmountRequired field.
 */
export function isPaymentRequirementsV1(
  value: unknown
): value is PaymentRequirementsV1 {
  if (!value || typeof value !== 'object') return false;
  return 'maxAmountRequired' in value;
}

/**
 * Type guard for PaymentRequirementsV2.
 * V2 requirements have amount but NOT maxAmountRequired.
 */
export function isPaymentRequirementsV2(
  value: unknown
): value is PaymentRequirementsV2 {
  if (!value || typeof value !== 'object') return false;
  return 'amount' in value && !('maxAmountRequired' in value);
}

// ============ Extraction Utilities ============

/**
 * Extract scheme and network from PaymentPayload (version-agnostic).
 * v1 has these at top level, v2 has them nested in `accepted`.
 */
export function getSchemeNetwork(payload: PaymentPayload): {
  scheme: string;
  network: string;
} {
  if (payload.x402Version === 1) {
    return {
      scheme: payload.scheme,
      network: payload.network,
    };
  } else {
    return {
      scheme: payload.accepted.scheme,
      network: payload.accepted.network,
    };
  }
}

/**
 * Get x402 version from PaymentPayload.
 * Returns literal type 1 | 2 for exhaustiveness checking in switch statements.
 */
export function getVersion(payload: PaymentPayload): 1 | 2 {
  return payload.x402Version;
}

/**
 * Safely extract x402 version from an unknown payment object.
 * Provides backward compatibility for pre-versioning payloads.
 *
 * - Returns 1 if x402Version is undefined/missing (backward compatibility)
 * - Returns 1 or 2 for valid versions
 * - Throws descriptive error for unsupported versions
 *
 * Use this at method entry points to validate version before processing.
 * For type-safe access after validation, use getVersion() instead.
 */
export function getVersionSafe(payment: unknown): 1 | 2 {
  if (!payment || typeof payment !== 'object') {
    return 1; // Backward compat: missing payload treated as v1
  }
  const obj = payment as Record<string, unknown>;
  const version = obj.x402Version;
  if (version === undefined) return 1; // Backward compat
  if (version === 1 || version === 2) return version;
  throw new Error(
    `Unsupported x402 version: ${version}. SDK supports versions 1 and 2.`
  );
}

// ============ Exhaustiveness Checking ============

/**
 * Exhaustiveness check for discriminated unions.
 * TypeScript will error at compile time if not all union members are handled.
 *
 * @example
 * function handlePayload(payload: PaymentPayload) {
 *   switch (payload.x402Version) {
 *     case 1: return handleV1(payload);
 *     case 2: return handleV2(payload);
 *     default: return assertNever(payload);
 *   }
 * }
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
}
