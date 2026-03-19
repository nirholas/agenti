import { type } from "arktype";
import { isValidationError } from "./validation";

/**
 * Validator for Solana base58-encoded addresses.
 */
export const Base58Address = type(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
export type Base58Address = typeof Base58Address.infer;

/**
 * Type guard that checks if a value is a valid Solana base58 address.
 *
 * @param maybe - The value to check
 * @returns True if the value matches the base58 address format
 */
export function isBaseAddress(maybe: unknown): maybe is Base58Address {
  return !isValidationError(Base58Address(maybe));
}

/**
 * Validator for Solana cluster names.
 */
export const SolanaCluster = type("'mainnet-beta' | 'devnet' | 'testnet'");
export type SolanaCluster = typeof SolanaCluster.infer;

/**
 * Type guard that checks if a value is a valid Solana cluster name.
 *
 * @param maybe - The value to check
 * @returns True if the value is a known cluster name
 */
export function isSolanaCluster(maybe: unknown): maybe is SolanaCluster {
  return !isValidationError(SolanaCluster(maybe));
}

/**
 * Validator for Solana CAIP-2 network identifier strings.
 *
 * Format: solana:<genesis-hash> where genesis-hash is base58-encoded.
 */
export const SolanaCAIP2NetworkString = type(/^solana:[1-9A-HJ-NP-Za-km-z]+$/);

/**
 * Type guard that checks if a value is a valid Solana CAIP-2 network string.
 *
 * @param maybe - The value to check
 * @returns True if the value matches the Solana CAIP-2 format
 */
export function isSolanaCAIP2NetworkString(maybe: unknown): maybe is string {
  return !isValidationError(SolanaCAIP2NetworkString(maybe));
}

/**
 * Solana network identifier with associated metadata.
 */
export type SolanaCAIP2Network = {
  readonly hash: string;
  readonly name?: string;
  readonly caip2: string;
};

/**
 * Type guard that checks if a value is a SolanaCAIP2Network object.
 *
 * @param maybe - The value to check
 * @returns True if the value is a SolanaCAIP2Network object
 */
export function isSolanaCAIP2Network(
  maybe: unknown,
): maybe is SolanaCAIP2Network {
  return (
    typeof maybe === "object" &&
    maybe !== null &&
    "hash" in maybe &&
    "caip2" in maybe
  );
}

/**
 * Creates a SolanaCAIP2Network object from a CAIP-2 string.
 *
 * @param caip2 - The CAIP-2 network identifier string (e.g., "solana:5eykt...")
 * @param name - Optional display name for the network
 * @returns A SolanaCAIP2Network object
 * @throws Error if the CAIP-2 string is invalid
 */
export function createSolanaNetwork(
  caip2: string,
  name?: string,
): SolanaCAIP2Network {
  if (!isSolanaCAIP2NetworkString(caip2)) {
    throw new Error(`Invalid Solana CAIP-2 network: ${caip2}`);
  }
  const hash = caip2.slice(7);
  return {
    hash,
    ...(name !== undefined && { name }),
    get caip2() {
      return `solana:${this.hash}`;
    },
  };
}
