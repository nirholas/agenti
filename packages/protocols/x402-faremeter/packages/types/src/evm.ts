import { type } from "arktype";
import { isValidationError } from "./validation";

/**
 * Validator for EVM hex addresses (40 hex characters, optional 0x prefix).
 */
export const Address = type(
  /^(0x)?[0-9a-fA-F]{40}$/ as type.cast<`0x${string}`>,
);
export type Address = typeof Address.infer;

/**
 * Type guard that checks if a value is a valid EVM address.
 *
 * @param maybe - The value to check
 * @returns True if the value matches the EVM address format
 */
export function isAddress(maybe: unknown): maybe is Address {
  return !isValidationError(Address(maybe));
}

/**
 * Validator for EVM private keys (64 hex characters with 0x prefix).
 */
export const PrivateKey = type(
  /^0x[0-9a-fA-F]{64}$/ as type.cast<`0x${string}`>,
);
export type PrivateKey = typeof Address.infer;

/**
 * Type guard that checks if a value is a valid EVM private key.
 *
 * @param maybe - The value to check
 * @returns True if the value matches the private key format
 */
export function isPrivateKey(maybe: unknown): maybe is PrivateKey {
  return !isValidationError(PrivateKey(maybe));
}

// Intentionally not tightly coupled to any viem Chain implementation.
export type ChainInfo = {
  id: number;
  name: string;
};

export type ChainInfoWithRPC = ChainInfo & {
  rpcUrls: {
    default: {
      http: readonly [string];
    };
  };
};
