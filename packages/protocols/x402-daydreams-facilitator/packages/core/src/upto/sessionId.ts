/**
 * Upto Session ID Generation
 *
 * Standardized session ID generation for upto payment sessions.
 * The session ID is a deterministic hash of the permit authorization,
 * ensuring the same permit always maps to the same session.
 */

import { createHash } from "node:crypto";
import type { PaymentPayload } from "@x402/core/types";

/**
 * Authorization fields extracted from an upto payment payload.
 */
export interface UptoAuthorization {
  owner: string;
  spender: string;
  value: string;
  nonce: string;
  deadline: string;
  signature: string;
}

/**
 * Extract authorization fields from an upto payment payload.
 * Returns undefined if the payload doesn't contain valid upto authorization.
 */
export function extractUptoAuthorization(
  paymentPayload: PaymentPayload
): UptoAuthorization | undefined {
  const payload = paymentPayload.payload as Record<string, unknown> | undefined;
  if (!payload) return undefined;

  const auth = payload.authorization as Record<string, unknown> | undefined;
  if (!auth) return undefined;

  const signature = payload.signature as string | undefined;
  if (!signature) return undefined;

  const owner = auth.from as string | undefined;
  const spender = auth.to as string | undefined;
  const value = auth.value as string | undefined;
  const nonce = auth.nonce as string | undefined;
  const deadline = auth.validBefore as string | undefined;

  if (!owner || !spender || !value || !nonce || !deadline) {
    return undefined;
  }

  return { owner, spender, value, nonce, deadline, signature };
}

/**
 * Generate a deterministic session ID from an upto payment payload.
 *
 * The session ID is a SHA-256 hash of the key authorization fields,
 * ensuring that the same permit authorization always produces the same ID.
 *
 * @example
 * ```typescript
 * const sessionId = generateSessionId(paymentPayload);
 * const session = upto.store.get(sessionId);
 * ```
 */
export function generateSessionId(paymentPayload: PaymentPayload): string {
  const auth = extractUptoAuthorization(paymentPayload);

  const key = {
    network: paymentPayload.accepted.network,
    asset: paymentPayload.accepted.asset,
    owner: auth?.owner,
    spender: auth?.spender,
    cap: auth?.value,
    nonce: auth?.nonce,
    deadline: auth?.deadline,
    signature: auth?.signature,
  };

  return createHash("sha256").update(JSON.stringify(key)).digest("hex");
}
