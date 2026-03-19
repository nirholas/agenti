import crypto from "node:crypto";

/**
 * Base58 alphabet - excludes confusing characters (0, O, I, l)
 * Used for generating human-readable token strings
 */
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Generate a random base58 string of specified length
 */
function generateRandomString(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE58_ALPHABET[bytes[i] % BASE58_ALPHABET.length];
  }
  return result;
}

/**
 * Generate a Stripe-style API token with environment prefix
 *
 * @param environment - Either 'test' or 'live'
 * @returns Token string in format: fac_{environment}_{random24}
 *
 * @example
 * generateToken('test') => 'fac_test_4x7k2n9m3p1q8w5e6r2t9y4u'
 * generateToken('live') => 'fac_live_7k2n9m3p1q8w5e6r2t9y4u3i'
 */
export function generateToken(environment: "test" | "live"): string {
  const random = generateRandomString(24);
  return `fac_${environment}_${random}`;
}

/**
 * Hash a token using SHA256
 * Used for secure storage and lookup without storing plaintext tokens
 *
 * @param token - The token string to hash
 * @returns 64-character hex hash
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Validate token format
 * Checks if a string matches the expected token pattern
 *
 * @param token - The token string to validate
 * @returns true if valid format, false otherwise
 */
export function validateTokenFormat(token: string): boolean {
  return /^fac_(test|live)_[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{24}$/.test(
    token,
  );
}
