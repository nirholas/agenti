/**
 * Helper functions for paymaster integration
 */

import type { Call, TypedData } from 'starknet';
import { num, hash, CallData } from 'starknet';
import type {
  PaymasterFeeMode,
  PaymasterConfig,
  BuildTransactionResponse,
  ExecuteTransactionResponse,
  PaymasterCall,
} from '../types/paymaster.js';
import type { StarknetNetworkId } from '../types/network.js';
import type { PaymasterClient } from './client.js';
import { err } from '../errors.js';

/**
 * Format address - normalize by removing leading zeros
 * Starknet normalizes addresses by converting to BigInt and back
 */
function formatAddress(address: string): string {
  // Convert to BigInt and back to hex to normalize (removes leading zeros)
  const bigInt = num.toBigInt(address);
  return num.toHex(bigInt);
}

/**
 * Convert starknet.js Call to Paymaster RPC Call format
 *
 * Starknet.js uses:
 * - contractAddress / entrypoint / calldata
 *
 * AVNU Paymaster expects:
 * - to / selector / calldata (as hex strings)
 */
function convertCallToPaymasterFormat(call: Call): PaymasterCall {
  return {
    to: formatAddress(call.contractAddress),
    selector: hash.getSelectorFromName(call.entrypoint),
    calldata: CallData.toHex(call.calldata ?? []),
  };
}

/**
 * Build a transaction for user to sign
 *
 * This is a simplified wrapper around paymaster_buildTransaction
 * for the common case of invoking calls.
 *
 * @param client - Paymaster client
 * @param userAddress - User's account address
 * @param calls - Calls to execute
 * @param feeMode - Fee mode (sponsored or default with gas token)
 * @returns Build transaction response with typed data
 *
 * @example
 * ```typescript
 * const result = await buildTransaction(
 *   client,
 *   '0x1234...',
 *   [{ to: tokenAddress, selector: 'transfer', calldata: [...] }],
 *   { mode: 'sponsored' }
 * );
 *
 * // User signs the typed_data
 * const signature = await account.signMessage(result.typed_data);
 * ```
 */
export async function buildTransaction(
  client: PaymasterClient,
  userAddress: string,
  calls: Array<Call>,
  feeMode: PaymasterFeeMode
): Promise<BuildTransactionResponse> {
  // Ensure user address is properly formatted with 0x prefix and padding
  const userAddressFormatted = formatAddress(userAddress);

  // Convert calls to paymaster RPC format
  const paymasterCalls = calls.map(convertCallToPaymasterFormat);

  return client.buildTransaction({
    transaction: {
      type: 'invoke',
      invoke: {
        user_address: userAddressFormatted,
        calls: paymasterCalls,
      },
    },
    parameters: {
      version: '0x1',
      fee_mode: feeMode,
    },
  });
}

/**
 * Execute a pre-built transaction
 *
 * @param client - Paymaster client
 * @param userAddress - User's account address
 * @param calls - Calls to execute (same as in buildTransaction)
 * @param feeMode - Fee mode (same as in buildTransaction)
 * @param typedData - Typed data that was signed by the user
 * @param signature - User's signature over typed data
 * @returns Transaction hash
 *
 * @example
 * ```typescript
 * const result = await executeTransaction(
 *   client,
 *   '0x1234...',
 *   [{ to: tokenAddress, selector: 'transfer', calldata: [...] }],
 *   { mode: 'sponsored' },
 *   typedData,
 *   signature
 * );
 *
 * console.log('Transaction hash:', result.transaction_hash);
 * ```
 */
export async function executeTransaction(
  client: PaymasterClient,
  userAddress: string,
  _calls: Array<Call>, // Not used - transaction details are in typed_data
  feeMode: PaymasterFeeMode,
  typedData: TypedData,
  signature: Array<string>
): Promise<ExecuteTransactionResponse> {
  // Ensure user address is properly formatted with 0x prefix and padding
  const userAddressFormatted = formatAddress(userAddress);

  // Note: typed_data and signature go INSIDE the invoke object
  // NOT at the top level of the request
  return client.executeTransaction({
    transaction: {
      type: 'invoke',
      invoke: {
        user_address: userAddressFormatted,
        typed_data: typedData,
        signature,
      },
    },
    parameters: {
      version: '0x1',
      fee_mode: feeMode,
    },
  });
}

/**
 * Create transfer call for ERC20 token
 *
 * @param tokenAddress - Token contract address
 * @param recipient - Recipient address
 * @param amount - Amount to transfer (u256 low, high = 0 for most cases)
 * @returns Call object
 *
 * @example
 * ```typescript
 * const transferCall = createTransferCall(
 *   '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
 *   '0x1234...',
 *   '1000000' // 1 token with 6 decimals
 * );
 * ```
 */
export function createTransferCall(
  tokenAddress: string,
  recipient: string,
  amount: string
): Call {
  // Note: This returns a starknet.js Call object
  // The conversion to paymaster RPC format happens in buildTransaction
  return {
    contractAddress: tokenAddress,
    entrypoint: 'transfer',
    calldata: [
      recipient, // recipient
      amount, // amount low (u256)
      '0', // amount high (u256)
    ],
  };
}

/**
 * Extract typed data from build response
 *
 * @param response - Build transaction response
 * @returns Typed data for signing
 */
export function extractTypedData(
  response: BuildTransactionResponse
): TypedData {
  if (response.type === 'invoke') {
    return response.typed_data;
  }
  if (response.type === 'deploy_and_invoke') {
    return response.typed_data;
  }
  throw err.internal('No typed data in deploy-only transaction', {
    details: { type: response.type },
  });
}

/**
 * Default paymaster endpoints by network (CAIP-2 format)
 *
 * Note: The old endpoints (starknet.api.avnu.fi) are deprecated.
 * Use these SNIP-29 compatible endpoints instead.
 *
 * For local development, run your own paymaster instance:
 * - Clone: https://github.com/avnu-labs/paymaster
 * - Run: cargo run --bin paymaster-service --profile=profile.json
 * - Default port: 12777
 *
 * @see https://doc.avnu.fi/avnu-paymaster/cover-your-users-gas-fees
 */
export const DEFAULT_PAYMASTER_ENDPOINTS = {
  'starknet:mainnet': 'https://starknet.paymaster.avnu.fi',
  'starknet:sepolia': 'http://localhost:12777', // Local paymaster (run locally to avoid API key requirement)
  'starknet:devnet': 'http://localhost:12777', // Local paymaster for testing
} as const;

/**
 * Settlement options including paymaster configuration
 */
export interface SettlementOptions {
  /** Paymaster configuration for sponsored transactions */
  paymasterConfig?: PaymasterConfig;
}

/**
 * Options for creating paymaster configuration
 */
export interface PaymasterConfigOptions {
  /** Custom paymaster endpoint URL (uses default if not provided) */
  endpoint?: string;
  /** API key for authenticated/sponsored requests */
  apiKey?: string;
}

/**
 * Create paymaster configuration
 *
 * @param network - Target network (CAIP-2 format)
 * @param options - Optional configuration overrides
 * @returns PaymasterConfig object ready for use with settlePayment()
 *
 * @example
 * ```typescript
 * // Using default endpoint for mainnet
 * const config = createPaymasterConfig('starknet:mainnet');
 *
 * // Using custom endpoint with API key
 * const config = createPaymasterConfig('starknet:mainnet', {
 *   endpoint: 'https://custom-paymaster.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Use with settlePayment
 * const result = await settlePayment(provider, payload, requirements, {
 *   paymasterConfig: config,
 * });
 * ```
 */
export function createPaymasterConfig(
  network: StarknetNetworkId,
  options?: PaymasterConfigOptions
): PaymasterConfig {
  const endpoint = options?.endpoint ?? DEFAULT_PAYMASTER_ENDPOINTS[network];

  return {
    endpoint,
    network,
    ...(options?.apiKey && { apiKey: options.apiKey }),
  };
}

/**
 * Create settlement options with paymaster configuration
 *
 * Convenience wrapper that creates SettlementOptions with paymaster config.
 *
 * @param network - Target network (CAIP-2 format)
 * @param options - Optional paymaster configuration
 * @returns SettlementOptions object ready for settlePayment()
 *
 * @example
 * ```typescript
 * // Simple usage with defaults
 * const options = createSettlementOptions('starknet:mainnet');
 *
 * // With API key for sponsored transactions
 * const options = createSettlementOptions('starknet:mainnet', {
 *   apiKey: process.env.PAYMASTER_API_KEY,
 * });
 *
 * // Use with settlePayment
 * const result = await settlePayment(
 *   provider,
 *   payload,
 *   requirements,
 *   options
 * );
 * ```
 */
export function createSettlementOptions(
  network: StarknetNetworkId,
  options?: PaymasterConfigOptions
): SettlementOptions {
  return {
    paymasterConfig: createPaymasterConfig(network, options),
  };
}

/**
 * Check if a network has a known public paymaster endpoint
 *
 * @param network - Network to check (CAIP-2 format)
 * @returns True if the network has a default paymaster endpoint
 *
 * @example
 * ```typescript
 * if (hasPublicPaymaster('starknet:mainnet')) {
 *   // Can use default endpoint
 *   const config = createPaymasterConfig('starknet:mainnet');
 * } else {
 *   // Must provide custom endpoint
 *   const config = createPaymasterConfig(network, {
 *     endpoint: 'https://my-paymaster.com',
 *   });
 * }
 * ```
 */
export function hasPublicPaymaster(network: StarknetNetworkId): boolean {
  return network in DEFAULT_PAYMASTER_ENDPOINTS;
}
