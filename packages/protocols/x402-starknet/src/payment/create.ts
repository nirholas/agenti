/**
 * Payment creation functions
 */

import type {
  PaymentRequirements,
  PaymentPayload,
  PaymentRequirementsSelector,
  PaymentRequired,
  PaymasterConfig,
  StarknetNetworkId,
  SettleResponse,
} from '../types/index.js';
import { networksEqual } from '../types/index.js';

// ============================================================================
// HTTP Header Constants
// ============================================================================

/**
 * HTTP header names for x402 protocol
 * Spec compliance: x402 v2 - HTTP Transport
 */
export const HTTP_HEADERS = {
  /** Header for 402 response containing payment requirements */
  PAYMENT_REQUIRED: 'PAYMENT-REQUIRED',
  /** Header for client payment signature/payload */
  PAYMENT_SIGNATURE: 'PAYMENT-SIGNATURE',
  /** Header for settlement response after successful payment */
  PAYMENT_RESPONSE: 'PAYMENT-RESPONSE',
} as const;
import type { Account, RpcProvider } from 'starknet';
import { num } from 'starknet';
import {
  createPaymasterClient,
  buildTransaction,
  createTransferCall,
  DEFAULT_PAYMASTER_ENDPOINTS,
} from '../paymaster/index.js';
import { err, PaymentError, NetworkError } from '../errors.js';

/**
 * Select appropriate payment requirements from available options
 *
 * This function intelligently selects the best payment requirement based on:
 * - Network compatibility (matches account's network)
 * - Balance availability (user has sufficient funds)
 * - Cost optimization (prefers lower amounts)
 * - Timeout constraints (respects maxTimeoutSeconds)
 *
 * @param requirements - Array of payment requirement options
 * @param account - User's account
 * @param provider - RPC provider for balance checks
 * @returns Selected payment requirements
 * @throws Error if no requirements can be satisfied
 *
 * @example
 * ```typescript
 * const selected = await selectPaymentRequirements(
 *   requirements,
 *   account,
 *   provider
 * );
 * ```
 */
export async function selectPaymentRequirements(
  requirements: Array<PaymentRequirements>,
  account: Account,
  provider: RpcProvider
): Promise<PaymentRequirements> {
  if (requirements.length === 0) {
    throw err.invalid('No payment requirements provided');
  }

  // Get account network from provider (returns CAIP-2 format)
  const accountNetwork = await getAccountNetwork(provider);

  // Filter by network compatibility (use networksEqual for format-agnostic comparison)
  const compatibleRequirements = requirements.filter((req) =>
    networksEqual(req.network, accountNetwork)
  );

  if (compatibleRequirements.length === 0) {
    throw NetworkError.networkMismatch(
      accountNetwork,
      requirements.map((r) => r.network).join(', ')
    );
  }

  // Check balances for compatible requirements (v2: uses 'amount' instead of 'maxAmountRequired')
  const { getTokenBalance } = await import('../utils/token.js');
  const requirementsWithBalance = await Promise.all(
    compatibleRequirements.map(async (req) => {
      try {
        const balance = await getTokenBalance(
          provider,
          req.asset,
          account.address
        );
        const hasBalance = BigInt(balance) >= BigInt(req.amount);
        return { requirement: req, balance, hasBalance };
      } catch {
        // If balance check fails, assume insufficient balance
        return { requirement: req, balance: '0', hasBalance: false };
      }
    })
  );

  // Filter to only requirements with sufficient balance
  const affordableRequirements = requirementsWithBalance.filter(
    (r) => r.hasBalance
  );

  if (affordableRequirements.length === 0) {
    // No affordable options - use the first requirement for error message
    const first = requirementsWithBalance[0];
    if (first) {
      throw PaymentError.insufficientFunds(
        first.requirement.amount,
        first.balance
      );
    }
    throw err.internal('No requirements with balance info');
  }

  // Select the best option: lowest cost that meets timeout constraints
  // Sort by amount (lowest first)
  const sorted = affordableRequirements.sort((a, b) => {
    const amountA = BigInt(a.requirement.amount);
    const amountB = BigInt(b.requirement.amount);
    if (amountA < amountB) return -1;
    if (amountA > amountB) return 1;
    // If amounts are equal, prefer shorter timeout (faster settlement)
    return a.requirement.maxTimeoutSeconds - b.requirement.maxTimeoutSeconds;
  });

  // At this point sorted is guaranteed to have at least one element
  // because we checked affordableRequirements.length > 0 above
  const selected = sorted[0];
  if (!selected) {
    // This should never happen due to the length check above
    throw err.internal(
      'Unexpected: no affordable requirements after filtering'
    );
  }
  return selected.requirement;
}

/**
 * Get the network identifier from the provider (CAIP-2 format)
 *
 * @param provider - RPC provider
 * @returns Network identifier in CAIP-2 format (e.g., 'starknet:sepolia')
 */
async function getAccountNetwork(
  provider: RpcProvider
): Promise<StarknetNetworkId> {
  try {
    const chainId = await provider.getChainId();

    // Map chain IDs to CAIP-2 network identifiers
    // See: https://docs.starknet.io/documentation/architecture_and_concepts/Network_Architecture/network-architecture/
    switch (chainId) {
      case '0x534e5f4d41494e': // SN_MAIN
        return 'starknet:mainnet';
      case '0x534e5f5345504f4c4941': // SN_SEPOLIA
        return 'starknet:sepolia';
      default:
        // For devnet or unknown networks, assume devnet
        return 'starknet:devnet';
    }
  } catch {
    // If we can't determine the network, assume sepolia (most common testnet)
    return 'starknet:sepolia';
  }
}

/**
 * Custom selector type for payment requirements
 */
export type { PaymentRequirementsSelector };

/**
 * Create payment payload for x402 request
 *
 * This builds a gasless transaction via paymaster and returns
 * the signed payload ready to send to the server.
 *
 * @param account - User's Starknet account
 * @param x402Version - x402 protocol version (currently 2)
 * @param paymentRequirements - Payment requirements from server
 * @param paymasterConfig - Paymaster configuration (endpoint, API key)
 * @returns Payment payload to send to server
 *
 * @example
 * ```typescript
 * const payload = await createPaymentPayload(
 *   account,
 *   2,
 *   paymentRequirements,
 *   {
 *     endpoint: 'http://localhost:12777',
 *     network: 'starknet:sepolia'
 *   }
 * );
 * ```
 */
export async function createPaymentPayload(
  account: Account,
  _x402Version: number, // v2: Always creates v2 payloads, parameter kept for API compatibility
  paymentRequirements: PaymentRequirements,
  paymasterConfig: PaymasterConfig
): Promise<PaymentPayload> {
  // 1. Create transfer call (v2: uses 'amount' instead of 'maxAmountRequired')
  const transferCall = createTransferCall(
    paymentRequirements.asset,
    paymentRequirements.payTo,
    paymentRequirements.amount
  );

  // 2. Create paymaster client
  const client = createPaymasterClient(paymasterConfig);

  // 3. Build transaction with paymaster (sponsored mode - server pays gas)
  const buildResult = await buildTransaction(
    client,
    account.address,
    [transferCall],
    { mode: 'sponsored' } // Server pays gas
  );

  if (buildResult.type !== 'invoke') {
    throw err.internal('Expected invoke transaction from paymaster', {
      details: { receivedType: buildResult.type },
    });
  }

  // 4. Sign typed data
  const signature = await account.signMessage(buildResult.typed_data);

  // 5. Convert signature to array of hex strings
  // Signature can be either string[] or { r: bigint, s: bigint, recovery: number }
  let signatureArray: Array<string>;
  if (Array.isArray(signature)) {
    // Already an array, convert each element to hex
    signatureArray = signature.map((s) => num.toHex(s));
  } else {
    // Weierstrass signature object with r, s properties (BigInts)
    signatureArray = [num.toHex(signature.r), num.toHex(signature.s)];
  }

  // 6. Extract nonce and valid_until from typed data message
  const message = buildResult.typed_data.message as Record<string, unknown>;

  // Nonce should be hex format (0x...)
  const nonceValue = message.nonce ?? '0x0';
  const nonce =
    typeof nonceValue === 'string' ||
    typeof nonceValue === 'number' ||
    typeof nonceValue === 'bigint'
      ? String(nonceValue)
      : '0x0';

  // Valid until should be decimal string
  const validUntilValue = message.valid_until ?? message.validUntil ?? '0x0';
  const validUntil =
    typeof validUntilValue === 'string' && validUntilValue.startsWith('0x')
      ? BigInt(validUntilValue).toString()
      : typeof validUntilValue === 'string' ||
          typeof validUntilValue === 'number' ||
          typeof validUntilValue === 'bigint'
        ? String(validUntilValue)
        : '0x0';

  // 7. Create payment payload (v2 structure with 'accepted' field)
  const payload: PaymentPayload = {
    x402Version: 2,
    accepted: paymentRequirements,
    payload: {
      signature: {
        r: signatureArray[0] ?? '0x0',
        s: signatureArray[1] ?? '0x0',
      },
      authorization: {
        from: account.address,
        to: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
        token: paymentRequirements.asset,
        nonce,
        validUntil,
      },
    },
    typedData: buildResult.typed_data,
    paymasterEndpoint: paymasterConfig.endpoint,
  };

  return payload;
}

/**
 * Get default paymaster endpoint for network
 *
 * @param network - Network identifier (CAIP-2 format)
 * @returns Default paymaster endpoint URL
 *
 * @example
 * ```typescript
 * const endpoint = getDefaultPaymasterEndpoint('starknet:sepolia');
 * ```
 */
export function getDefaultPaymasterEndpoint(
  network: 'starknet:mainnet' | 'starknet:sepolia' | 'starknet:devnet'
): string {
  return DEFAULT_PAYMASTER_ENDPOINTS[network];
}

// ============================================================================
// Header Encoding/Decoding Functions
// ============================================================================

/**
 * Encode payment payload to base64 string for PAYMENT-SIGNATURE header
 *
 * This is the client's signed payment payload sent to the server.
 *
 * @param payload - Payment payload to encode
 * @returns Base64-encoded string
 *
 * @example
 * ```typescript
 * const header = encodePaymentSignature(payload);
 * // Use in HTTP request:
 * // headers: { [HTTP_HEADERS.PAYMENT_SIGNATURE]: header }
 * ```
 */
export function encodePaymentSignature(payload: PaymentPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode payment payload from base64 PAYMENT-SIGNATURE header
 *
 * @param encoded - Base64-encoded payment signature header
 * @returns Decoded payment payload
 * @throws Error if decoded value is not a valid object
 *
 * @example
 * ```typescript
 * const payload = decodePaymentSignature(req.headers['payment-signature']);
 * ```
 */
export function decodePaymentSignature(encoded: string): PaymentPayload {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const parsed: unknown = JSON.parse(json);

  // Validate that decoded value is an object (not null, array, string, number, etc.)
  // This prevents prototype pollution and ensures proper payload structure
  // See SECURITY.md:194-214 for details
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err.invalid('Invalid payment payload: must be an object');
  }

  return parsed as PaymentPayload;
}

/**
 * Encode PaymentRequired to base64 string for PAYMENT-REQUIRED header
 *
 * This is the server's 402 response containing payment requirements.
 *
 * @param response - Payment required response to encode (v2 format)
 * @returns Base64-encoded string
 *
 * @example
 * ```typescript
 * const response: PaymentRequired = {
 *   x402Version: 2,
 *   resource: { url: 'https://api.example.com/resource' },
 *   accepts: [paymentRequirement1, paymentRequirement2]
 * };
 * const header = encodePaymentRequired(response);
 * // Use in HTTP response:
 * // headers: { [HTTP_HEADERS.PAYMENT_REQUIRED]: header }
 * ```
 */
export function encodePaymentRequired(response: PaymentRequired): string {
  const json = JSON.stringify(response);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode PaymentRequired from base64 PAYMENT-REQUIRED header
 *
 * This is used by clients to decode the 402 response payment requirements.
 *
 * @param encoded - Base64-encoded payment required header
 * @returns Decoded payment required response (v2 format)
 * @throws Error if decoded value is not a valid object
 *
 * @example
 * ```typescript
 * const responseHeader = response.headers.get('payment-required');
 * if (responseHeader) {
 *   const paymentRequired = decodePaymentRequired(responseHeader);
 *   // Use paymentRequired.accepts to create payment
 * }
 * ```
 */
export function decodePaymentRequired(encoded: string): PaymentRequired {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const parsed: unknown = JSON.parse(json);

  // Validate that decoded value is an object (not null, array, string, number, etc.)
  // This prevents prototype pollution and ensures proper response structure
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err.invalid('Invalid payment required: must be an object');
  }

  return parsed as PaymentRequired;
}

/**
 * Encode SettleResponse to base64 string for PAYMENT-RESPONSE header
 *
 * This is the settlement response sent after successful payment execution.
 *
 * @param response - Settlement response to encode
 * @returns Base64-encoded string
 *
 * @example
 * ```typescript
 * const settleResult = await settlePayment(...);
 * const header = encodePaymentResponse(settleResult);
 * // Use in HTTP response:
 * // headers: { [HTTP_HEADERS.PAYMENT_RESPONSE]: header }
 * ```
 */
export function encodePaymentResponse(response: SettleResponse): string {
  const json = JSON.stringify(response);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode SettleResponse from base64 PAYMENT-RESPONSE header
 *
 * This is used by clients to decode the settlement response.
 *
 * @param encoded - Base64-encoded payment response header
 * @returns Decoded settlement response
 * @throws Error if decoded value is not a valid object
 *
 * @example
 * ```typescript
 * const responseHeader = response.headers.get('payment-response');
 * if (responseHeader) {
 *   const settleResponse = decodePaymentResponse(responseHeader);
 *   console.log('Transaction:', settleResponse.transaction);
 * }
 * ```
 */
export function decodePaymentResponse(encoded: string): SettleResponse {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const parsed: unknown = JSON.parse(json);

  // Validate that decoded value is an object (not null, array, string, number, etc.)
  // This prevents prototype pollution and ensures proper response structure
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err.invalid('Invalid payment response: must be an object');
  }

  return parsed as SettleResponse;
}
