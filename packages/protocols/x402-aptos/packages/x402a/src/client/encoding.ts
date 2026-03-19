export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }

  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error("Invalid hex string: non-hex characters");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }

  return bytes;
}

export function bytesToHex(bytes: Uint8Array, prefix = true): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return prefix ? `0x${hex}` : hex;
}

export function generateSecureNonce(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToHex(bytes);
}

// ============================================================
// PROTOCOL HELPERS
// ============================================================

/**
 * Get the current chain ID from network string
 * @param network - Network identifier (e.g., "aptos-testnet", "testnet", etc.)
 * @returns Chain ID (1=mainnet, 2=testnet, 3=devnet)
 */
export function getChainIdFromNetwork(network: string): number {
  const normalized = network.toLowerCase();

  if (normalized.includes("mainnet")) {
    return 1;
  }
  if (normalized.includes("testnet")) {
    return 2;
  }
  if (normalized.includes("devnet") || normalized.includes("local")) {
    return 3;
  }

  // Default to testnet for safety
  return 2;
}

/**
 * Calculate expiration timestamp
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 * @returns Unix timestamp (seconds)
 */
export function calculateExpirationTimestamp(ttlSeconds: number = 3600): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Check if an authorization has expired
 * @param validUntil - Expiration timestamp
 * @returns true if expired
 */
export function isExpired(validUntil: number): boolean {
  return Math.floor(Date.now() / 1000) > validUntil;
}

/**
 * Get remaining time until expiration
 * @param validUntil - Expiration timestamp
 * @returns Seconds remaining (0 if expired)
 */
export function getRemainingTime(validUntil: number): number {
  const remaining = validUntil - Math.floor(Date.now() / 1000);
  return Math.max(0, remaining);
}

/**
 * Format expiration time for display
 * @param validUntil - Expiration timestamp
 * @returns Human-readable string
 */
export function formatExpirationTime(validUntil: number): string {
  const remaining = getRemainingTime(validUntil);

  if (remaining === 0) {
    return "Expired";
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
