/**
 * Provider utilities
 */

import { RpcProvider, constants } from 'starknet';
import type { ProviderOptions } from '../types/index.js';
import { getNetworkConfig, validateNetwork } from '../networks/index.js';
import { err, wrapUnknown } from '../errors.js';

/**
 * Create RPC provider for a network
 *
 * @param networkOrOptions - Network identifier (CAIP-2 format) or ProviderOptions object
 * @param options - Optional provider options (only used if first argument is a network string)
 * @returns Configured RPC provider
 *
 * @example
 * ```typescript
 * // Simple usage with default RPC
 * const provider = createProvider('starknet:sepolia');
 *
 * // With custom RPC URL
 * const provider = createProvider('starknet:mainnet', {
 *   rpcUrl: 'https://your-rpc-endpoint.com',
 * });
 *
 * // Using ProviderOptions object
 * const provider = createProvider({
 *   network: 'starknet:sepolia',
 *   rpcUrl: 'https://custom-rpc.com',
 *   timeout: 60000,
 * });
 * ```
 */
export function createProvider(
  networkOrOptions: string | ProviderOptions,
  options?: Omit<ProviderOptions, 'network'>
): RpcProvider {
  // Handle ProviderOptions object
  if (typeof networkOrOptions === 'object') {
    const opts = networkOrOptions;
    const validatedNetwork = validateNetwork(opts.network);
    const config = getNetworkConfig(validatedNetwork);
    const nodeUrl = opts.rpcUrl ?? config.rpcUrl;

    return new RpcProvider({
      nodeUrl,
      ...(opts.timeout && { timeout: opts.timeout }),
    });
  }

  // Handle network string with optional options
  const validatedNetwork = validateNetwork(networkOrOptions);
  const config = getNetworkConfig(validatedNetwork);
  const nodeUrl = options?.rpcUrl ?? config.rpcUrl;

  return new RpcProvider({
    nodeUrl,
    ...(options?.timeout && { timeout: options.timeout }),
  });
}

/**
 * Get the Starknet.js chain ID constant for a network
 *
 * @param network - Network identifier (CAIP-2 format)
 * @returns Starknet.js StarknetChainId constant
 * @throws Error if network is not recognized
 *
 * @example
 * ```typescript
 * import { getChainId } from 'x402-starknet';
 * import { constants } from 'starknet';
 *
 * const chainId = getChainId('starknet:mainnet');
 * console.log(chainId === constants.StarknetChainId.SN_MAIN); // true
 * ```
 */
export function getChainId(network: string): constants.StarknetChainId {
  const validatedNetwork = validateNetwork(network);

  switch (validatedNetwork) {
    case 'starknet:mainnet':
      return constants.StarknetChainId.SN_MAIN;
    case 'starknet:sepolia':
      return constants.StarknetChainId.SN_SEPOLIA;
    case 'starknet:devnet':
      // Devnet typically uses Goerli chain ID or a custom one
      // Return sepolia as a fallback for local development
      return constants.StarknetChainId.SN_SEPOLIA;
  }
}

/**
 * Retry an RPC call with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export async function retryRpcCall<T>(
  function_: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < maxRetries; index++) {
    try {
      return await function_();
    } catch (error) {
      lastError = error;
      if (index < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, index);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError
    ? wrapUnknown(lastError, 'ENETWORK', 'RPC call failed after all retries')
    : err.network('RPC call failed after all retries');
}
