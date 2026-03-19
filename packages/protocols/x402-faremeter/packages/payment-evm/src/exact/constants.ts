import { type } from "arktype";
import { toHex, isHex } from "viem";

const prefixedHexString = type("string").pipe.try((x) => {
  if (isHex(x)) {
    return x;
  }
  return toHex(x);
});

export const X402_EXACT_SCHEME = "exact";

export const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: "transferWithAuthorization",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "authorizationState",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "version",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "DOMAIN_SEPARATOR",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Validator for the x402 exact payment payload containing
 * an EIP-3009 authorization and signature.
 */
export const x402ExactPayload = type({
  signature: prefixedHexString,
  authorization: {
    from: prefixedHexString,
    to: prefixedHexString,
    value: "string",
    validAfter: "string",
    validBefore: "string",
    nonce: prefixedHexString,
  },
});

export type x402ExactPayload = typeof x402ExactPayload.infer;
export type eip3009Authorization = x402ExactPayload["authorization"];

/**
 * Validator for EIP-712 domain parameters provided in payment requirements.
 */
export const eip712Domain = type({
  "name?": "string",
  "version?": "string",
  "chainId?": "number",
  "verifyingContract?": "string",
});

export type eip712Domain = typeof eip712Domain.infer;
