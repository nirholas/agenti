/**
 * Encoding and serialization utilities
 */

/**
 * Encode string to base64
 *
 * @param str - String to encode
 * @returns Base64-encoded string
 */
export function encodeBase64(string_: string): string {
  return Buffer.from(string_, 'utf-8').toString('base64');
}

/**
 * Decode base64 string
 *
 * @param encoded - Base64-encoded string
 * @returns Decoded string
 */
export function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Convert hex string to felt252
 *
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Felt252 as string
 */
export function hexToFelt(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + cleanHex).toString();
}

/**
 * Convert felt252 to hex string
 *
 * @param felt - Felt252 as string or bigint
 * @returns Hex string with 0x prefix
 */
export function feltToHex(felt: string | bigint): string {
  const value = typeof felt === 'string' ? BigInt(felt) : felt;
  return '0x' + value.toString(16);
}

/**
 * Normalize Starknet address for comparison
 * Converts addresses to lowercase and removes leading zeros
 *
 * @param address - Address to normalize (with or without 0x prefix)
 * @returns Normalized address with 0x prefix
 *
 * @example
 * ```typescript
 * normalizeAddress('0x0001') // '0x1'
 * normalizeAddress('0x1') // '0x1'
 * normalizeAddress('0X1') // '0x1'
 * ```
 */
export function normalizeAddress(address: string): string {
  // Handle empty or invalid addresses
  if (!address || typeof address !== 'string') {
    return address;
  }

  // Convert to lowercase for case-insensitive comparison
  const lowerAddress = address.toLowerCase();

  // Remove 0x prefix if present
  const withoutPrefix = lowerAddress.startsWith('0x')
    ? lowerAddress.slice(2)
    : lowerAddress;

  // Convert to BigInt and back to remove leading zeros
  // This normalizes 0x0001 to 0x1
  try {
    const normalized = BigInt('0x' + withoutPrefix);
    return '0x' + normalized.toString(16);
  } catch {
    // If conversion fails, return original (might be malformed)
    return address;
  }
}
