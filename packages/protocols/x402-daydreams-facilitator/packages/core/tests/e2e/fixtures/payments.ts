/**
 * Payment Helpers for E2E Tests
 *
 * Provides utilities for creating payment payloads, signing, and encoding.
 */

import { E2E_CONFIG } from "../e2e.config.js";

export interface ExactEvmPaymentParams {
  amount: bigint;
  asset: `0x${string}`;
  network: string;
  payTo: `0x${string}`;
  from: `0x${string}`;
  validBefore?: bigint;
}

/**
 * Create an exact EVM payment payload (unsigned).
 */
export function createExactEvmPayment(params: ExactEvmPaymentParams) {
  const { amount, asset, network, payTo, from, validBefore } = params;
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as `0x${string}`;
  const validBeforeValue = validBefore ?? BigInt(Math.floor(Date.now() / 1000) + 3600);

  // Build EIP-712 typed data for exact payment (TransferWithAuthorization)
  const typedData = {
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: getChainId(network),
      verifyingContract: asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from,
      to: payTo,
      value: amount,
      validAfter: 0n,
      validBefore: validBeforeValue,
      nonce,
    },
  };

  return {
    x402Version: 2,
    scheme: "exact" as const,
    network,
    payload: {
      signature: "", // Will be filled after signing
      authorization: {
        from,
        to: payTo,
        value: amount.toString(),
        validAfter: "0",
        validBefore: validBeforeValue.toString(),
        nonce,
      },
    },
    resource: {
      url: "http://localhost/test",
      method: "GET",
    },
    typedData,
  };
}

export interface UptoAuthorizationParams {
  owner: `0x${string}`;
  spender: `0x${string}`;
  cap: bigint;
  deadline: number;
  nonce?: bigint;
}

/**
 * Create an upto authorization payload (ERC-2612 permit).
 */
export function createUptoAuthorization(params: UptoAuthorizationParams) {
  const { owner, spender, cap, deadline, nonce = 0n } = params;

  // Build EIP-2612 permit typed data
  const typedData = {
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: E2E_CONFIG.evm.chainId,
      verifyingContract: E2E_CONFIG.evm.usdc,
    },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit" as const,
    message: {
      owner,
      spender,
      value: cap,
      nonce,
      deadline: BigInt(deadline),
    },
  };

  return {
    typedData,
    cap,
    deadline,
    owner,
    spender,
    nonce,
  };
}

/**
 * Encode a payment payload as base64 for the x-payment header.
 * Handles BigInt serialization by converting to strings.
 */
export function encodePayment(payload: unknown): string {
  const serialized = JSON.stringify(payload, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
  return Buffer.from(serialized).toString("base64");
}

/**
 * Decode a base64 payment payload.
 */
export function decodePayment<T = unknown>(encoded: string): T {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as T;
}

/**
 * Create an upto payment payload with a specific amount.
 * Uses the field names expected by extractUptoAuthorization:
 * - from (not owner)
 * - to (not spender)
 * - validBefore (not deadline)
 */
export function createUptoPayment(
  auth: ReturnType<typeof createUptoAuthorization>,
  signature: `0x${string}`,
  amount: bigint
) {
  return {
    x402Version: 2,
    scheme: "upto" as const,
    network: E2E_CONFIG.evm.network,
    payload: {
      signature,
      authorization: {
        from: auth.owner,
        to: auth.spender,
        value: auth.cap.toString(),
        nonce: auth.nonce.toString(),
        validBefore: auth.deadline.toString(),
      },
    },
    resource: {
      url: "http://localhost/test",
      method: "GET",
    },
    accepted: {
      scheme: "upto",
      network: E2E_CONFIG.evm.network,
      asset: E2E_CONFIG.evm.usdc,
      amount: amount.toString(),
      payTo: auth.spender,
    },
  };
}

/**
 * Get chain ID from CAIP-2 network string.
 */
function getChainId(network: string): number {
  const match = network.match(/eip155:(\d+)/);
  return match ? parseInt(match[1]) : E2E_CONFIG.evm.chainId;
}
