// src/utils/redis.js

import { Redis } from '@upstash/redis';

// ============================================================
// Upstash Redis client for x402 payment gateway
//
// Used for:
//   1. Nonce tracking (replay attack prevention)
//   2. Payment-identifier idempotency (duplicate charge prevention)
//   3. Credit system (backend failure compensation)
//
// All keys are prefixed with "x402:" to avoid conflicts
// with other services sharing the same Upstash instance.
//
// NOTE: Client is lazy-initialized on first use so that
// process.env values are available after dotenv.config() runs.
// ============================================================

let _redis = null;

function getRedis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

// ─── Key Prefixes ──────────────────────────────────────────
const NONCE_PREFIX = 'x402:nonce:';
const IDEMPOTENCY_PREFIX = 'x402:idempotency:';
const CREDIT_PREFIX = 'x402:credit:';

// ─── TTLs (seconds) ────────────────────────────────────────
const NONCE_PENDING_TTL = 3600;        // 1 hour for pending settlements
const NONCE_CONFIRMED_TTL = 604800;    // 7 days for confirmed settlements
const IDEMPOTENCY_TTL = 3600;          // 1 hour for cached responses

// ============================================================
// Nonce Operations — Replay Attack Prevention
// ============================================================

/**
 * Check if a nonce has already been used.
 * Returns the stored data if used, null if available.
 */
export async function getNonce(nonce) {
  try {
    const data = await getRedis().get(`${NONCE_PREFIX}${nonce}`);
    return data || null;
  } catch (err) {
    console.error('[redis] getNonce error:', err.message);
    return null; // Fail open — settlement still checks on-chain
  }
}

/**
 * Mark a nonce as pending (before settlement attempt).
 * Short TTL so it auto-cleans if settlement never completes.
 * Returns true if set (nonce was available), false if already exists (replay).
 */
export async function setNoncePending(nonce, metadata = {}) {
  try {
    const result = await getRedis().set(
      `${NONCE_PREFIX}${nonce}`,
      { status: 'pending', timestamp: Date.now(), ...metadata },
      { nx: true, ex: NONCE_PENDING_TTL }
    );
    return result === 'OK';
  } catch (err) {
    console.error('[redis] setNoncePending error:', err.message);
    return false; // Fail closed — reject payment to be safe
  }
}

/**
 * Mark a nonce as confirmed after successful settlement.
 */
export async function setNonceConfirmed(nonce, settlementData = {}) {
  try {
    await getRedis().set(
      `${NONCE_PREFIX}${nonce}`,
      { status: 'confirmed', timestamp: Date.now(), ...settlementData },
      { ex: NONCE_CONFIRMED_TTL }
    );
  } catch (err) {
    console.error('[redis] setNonceConfirmed error:', err.message);
  }
}

/**
 * Delete a nonce (e.g., if settlement fails and we want to allow retry).
 */
export async function deleteNonce(nonce) {
  try {
    await getRedis().del(`${NONCE_PREFIX}${nonce}`);
  } catch (err) {
    console.error('[redis] deleteNonce error:', err.message);
  }
}

// ============================================================
// Idempotency Operations — Payment-Identifier Extension
// ============================================================

/**
 * Get a cached response for a payment identifier.
 */
export async function getIdempotencyCache(paymentId) {
  try {
    const data = await getRedis().get(`${IDEMPOTENCY_PREFIX}${paymentId}`);
    return data || null;
  } catch (err) {
    console.error('[redis] getIdempotencyCache error:', err.message);
    return null;
  }
}

/**
 * Cache a response for a payment identifier after successful settlement.
 */
export async function setIdempotencyCache(paymentId, responseData) {
  try {
    await getRedis().set(
      `${IDEMPOTENCY_PREFIX}${paymentId}`,
      { timestamp: Date.now(), response: responseData },
      { ex: IDEMPOTENCY_TTL }
    );
  } catch (err) {
    console.error('[redis] setIdempotencyCache error:', err.message);
  }
}

// ============================================================
// Credit Operations — Backend Failure Compensation
//
// Credits are issued when a paid request settles on-chain but
// the backend returns a creditworthy error (e.g. 5xx).
// The payer can redeem credits on subsequent requests by
// presenting a valid payment signature (proves wallet ownership)
// without needing to settle on-chain again.
//
// Key format: x402:credit:{payerAddress}:{routeKey}
// Value: integer count of available credits
//
// Security: Payer address is extracted from the cryptographically
// verified EIP-712/SVM signature — cannot be spoofed.
//
// Degradation: All credit operations fail gracefully.
//   - Read failures → skip credits, proceed with normal payment
//   - Write failures → log and move on, agent misses one credit
// ============================================================

/**
 * Get credit count for a payer on a specific route.
 * Returns integer count (0 if no credits or on error).
 * Fails open — returns 0 on error so normal payment proceeds.
 */
export async function getCreditCount(payerAddress, routeKey) {
  try {
    const key = `${CREDIT_PREFIX}${payerAddress.toLowerCase()}:${routeKey}`;
    const count = await getRedis().get(key);
    return typeof count === 'number' ? count : 0;
  } catch (err) {
    console.error('[redis] getCreditCount error:', err.message);
    return 0; // Fail open — no credits means normal payment flow
  }
}

/**
 * Atomically decrement a credit for a payer on a specific route.
 * Returns true if a credit was consumed, false if none available.
 *
 * Uses Lua script for atomicity — prevents race conditions where
 * two concurrent requests both read count=1 and both try to consume.
 */
export async function decrementCredit(payerAddress, routeKey) {
  try {
    const key = `${CREDIT_PREFIX}${payerAddress.toLowerCase()}:${routeKey}`;
    const result = await getRedis().eval(
      `local count = tonumber(redis.call('GET', KEYS[1]) or 0)
       if count > 0 then
         redis.call('DECR', KEYS[1])
         return 1
       end
       return 0`,
      [key],
      []
    );
    return result === 1;
  } catch (err) {
    console.error('[redis] decrementCredit error:', err.message);
    return false; // Fail closed — don't grant free access on error
  }
}

/**
 * Atomically increment a credit for a payer on a specific route,
 * capped at maxCredits. Resets TTL on every increment so credits
 * stay alive as long as failures keep occurring.
 *
 * @param {string} payerAddress - Wallet address of the payer
 * @param {string} routeKey - Route identifier (e.g. 'myapi')
 * @param {number} maxCredits - Maximum credits per payer per route
 * @param {number} ttlSeconds - TTL in seconds for the credit key
 * @returns {number} New credit count after increment, or -1 on error
 */
export async function incrementCredit(payerAddress, routeKey, maxCredits, ttlSeconds) {
  try {
    const key = `${CREDIT_PREFIX}${payerAddress.toLowerCase()}:${routeKey}`;
    const result = await getRedis().eval(
      `local count = tonumber(redis.call('GET', KEYS[1]) or 0)
       if count < tonumber(ARGV[1]) then
         count = redis.call('INCR', KEYS[1])
       end
       redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
       return count`,
      [key],
      [maxCredits, ttlSeconds]
    );
    return typeof result === 'number' ? result : -1;
  } catch (err) {
    console.error('[redis] incrementCredit error:', err.message);
    return -1; // Non-critical — agent misses one credit
  }
}

// ============================================================
// Health Check
// ============================================================

export async function pingRedis() {
  try {
    const result = await getRedis().ping();
    return result === 'PONG';
  } catch (err) {
    console.error('[redis] ping error:', err.message);
    return false;
  }
}

export default getRedis;