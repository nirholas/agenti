/**
 * Secure ID Generation Utilities
 *
 * Use these instead of Math.random() for generating identifiers.
 * crypto.randomBytes is cryptographically secure.
 */

import { randomBytes } from 'crypto';

/**
 * Generate a secure random ID with optional prefix
 * @param prefix - Optional prefix for the ID (e.g., 'alert', 'task')
 * @param length - Number of random bytes (default 8, gives 16 hex chars)
 */
export function generateId(prefix?: string, length = 8): string {
  const random = randomBytes(length).toString('hex');
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Generate a short secure ID (no timestamp, just random)
 * @param length - Number of random bytes (default 8)
 */
export function generateShortId(length = 8): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a UUID v4 style ID
 */
export function generateUuid(): string {
  const bytes = randomBytes(16);
  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
