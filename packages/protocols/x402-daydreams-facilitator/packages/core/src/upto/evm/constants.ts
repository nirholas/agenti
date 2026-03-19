/**
 * Upto EVM Constants
 *
 * Shared types, ABIs, and helper functions for the upto EVM scheme.
 */

/**
 * Authorization fields from an upto EVM payment payload.
 */
export type UptoEvmAuthorization = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter?: string;
  validBefore: string;
  nonce: string;
};

/**
 * Upto EVM payment payload structure.
 */
export type UptoEvmPayload = {
  authorization: UptoEvmAuthorization;
  signature: `0x${string}`;
};

/**
 * EIP-2612 Permit ABI for setting token allowance via signature.
 */
export const permitAbi = [
  {
    type: "function",
    name: "permit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

/**
 * ERC-20 ABI subset for allowance checking and transfers.
 */
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

/**
 * Safely convert a string value to BigInt, returning 0n on failure.
 */
export function toBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Extract a human-readable error message from an unknown error.
 */
export function errorSummary(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    const anyErr = error as { shortMessage?: unknown; message?: unknown };
    if (typeof anyErr.shortMessage === "string") return anyErr.shortMessage;
    if (typeof anyErr.message === "string") return anyErr.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
