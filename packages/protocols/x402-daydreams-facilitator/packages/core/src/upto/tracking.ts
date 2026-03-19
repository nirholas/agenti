/**
 * Upto Session Tracking
 *
 * Helper functions for tracking upto payment sessions on the resource server side.
 * These helpers encapsulate the session management logic that would otherwise
 * be duplicated across different server implementations.
 */

import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import type { UptoSessionStore, UptoSession } from "./store.js";
import { generateSessionId, extractUptoAuthorization } from "./sessionId.js";

/**
 * Result of tracking an upto payment.
 */
export type TrackingResult =
  | { success: true; sessionId: string; session: UptoSession }
  | { success: false; sessionId: string; error: TrackingError; session?: UptoSession };

/**
 * Possible tracking errors.
 */
export type TrackingError =
  | "invalid_payload"
  | "settling_in_progress"
  | "session_closed"
  | "cap_exhausted";

/**
 * Human-readable error messages for tracking errors.
 */
export const TRACKING_ERROR_MESSAGES: Record<TrackingError, string> = {
  invalid_payload: "Invalid upto payment payload",
  settling_in_progress: "Session is settling a batch, retry shortly",
  session_closed: "Session closed. Reauthorize a new upto cap",
  cap_exhausted: "Upto cap exhausted, reauthorize with higher max",
};

/**
 * HTTP status codes for tracking errors.
 */
export const TRACKING_ERROR_STATUS: Record<TrackingError, number> = {
  invalid_payload: 400,
  settling_in_progress: 409,
  session_closed: 402,
  cap_exhausted: 402,
};

/**
 * Track an upto payment and update the session store.
 *
 * This function handles:
 * - Creating new sessions for first-time payments
 * - Validating session state (not settling, not closed)
 * - Checking cap availability
 * - Updating pending spend amount
 *
 * @example
 * ```typescript
 * const result = await trackUptoPayment(
 *   upto.store,
 *   paymentPayload,
 *   requirements
 * );
 *
 * if (!result.success) {
 *   return { error: result.error, message: TRACKING_ERROR_MESSAGES[result.error] };
 * }
 *
 * // Payment tracked successfully
 * console.log(`Session ${result.sessionId} updated`);
 * ```
 */
export async function trackUptoPayment(
  store: UptoSessionStore,
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<TrackingResult> {
  const sessionId = generateSessionId(paymentPayload);
  const auth = extractUptoAuthorization(paymentPayload);

  if (!auth) {
    return { success: false, sessionId, error: "invalid_payload" };
  }

  const cap = BigInt(auth.value);
  const deadline = BigInt(auth.deadline);
  const price = BigInt(requirements.amount);

  // Get existing session or create new one
  let session = await store.get(sessionId);

  if (!session) {
    session = {
      cap,
      deadline,
      pendingSpent: 0n,
      settledTotal: 0n,
      lastActivityMs: Date.now(),
      status: "open",
      paymentPayload,
      paymentRequirements: requirements,
    };
  }

  // Validate session state
  if (session.status === "settling") {
    return { success: false, sessionId, error: "settling_in_progress", session };
  }

  if (session.status === "closed") {
    return { success: false, sessionId, error: "session_closed", session };
  }

  // Check cap
  const nextTotal = session.settledTotal + session.pendingSpent + price;
  if (nextTotal > session.cap) {
    return { success: false, sessionId, error: "cap_exhausted", session };
  }

  // Update session
  session.pendingSpent += price;
  session.lastActivityMs = Date.now();
  session.paymentPayload = paymentPayload;
  session.paymentRequirements = requirements;
  await store.set(sessionId, session);

  return { success: true, sessionId, session };
}

/**
 * Format a session for API responses.
 * Converts BigInt values to strings for JSON serialization.
 */
export function formatSession(session: UptoSession) {
  return {
    status: session.status,
    network: session.paymentRequirements.network,
    asset: session.paymentRequirements.asset,
    cap: session.cap.toString(),
    pendingSpent: session.pendingSpent.toString(),
    settledTotal: session.settledTotal.toString(),
    remaining: (session.cap - session.pendingSpent - session.settledTotal).toString(),
    deadline: session.deadline.toString(),
    lastActivityMs: session.lastActivityMs,
    lastSettlement: session.lastSettlement
      ? {
          atMs: session.lastSettlement.atMs,
          reason: session.lastSettlement.reason,
          success: session.lastSettlement.receipt.success,
          transaction: session.lastSettlement.receipt.transaction,
          errorReason: session.lastSettlement.receipt.errorReason,
        }
      : undefined,
  };
}
