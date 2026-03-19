/**
 * Token utilities for ERC20 interactions
 */

import type { RpcProvider } from 'starknet';

/**
 * Get ERC20 token balance
 *
 * @param provider - RPC provider
 * @param tokenAddress - Token contract address
 * @param accountAddress - Account to check balance for
 * @returns Balance as string (u256)
 *
 * @example
 * ```typescript
 * const balance = await getTokenBalance(
 *   provider,
 *   '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
 *   '0x1234...'
 * );
 * console.log('Balance:', balance);
 * ```
 */
export async function getTokenBalance(
  provider: RpcProvider,
  tokenAddress: string,
  accountAddress: string
): Promise<string> {
  // Call the contract
  const result = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: 'balanceOf',
    calldata: [accountAddress],
  });

  // Handle Uint256 response ([low, high])
  if (result.length >= 2) {
    const low = BigInt(result[0] ?? '0');
    const high = BigInt(result[1] ?? '0');
    return (low + (high << 128n)).toString();
  }

  return result[0]?.toString() ?? '0';
}

/**
 * Token metadata
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Get ERC20 token metadata
 *
 * @param provider - RPC provider
 * @param tokenAddress - Token contract address
 * @returns Token metadata
 *
 * @example
 * ```typescript
 * const metadata = await getTokenMetadata(provider, usdcAddress);
 * console.log(`${metadata.name} (${metadata.symbol})`);
 * ```
 */
export async function getTokenMetadata(
  provider: RpcProvider,
  tokenAddress: string
): Promise<TokenMetadata> {
  const [nameResult, symbolResult, decimalsResult] = await Promise.all([
    provider.callContract({
      contractAddress: tokenAddress,
      entrypoint: 'name',
      calldata: [],
    }),
    provider.callContract({
      contractAddress: tokenAddress,
      entrypoint: 'symbol',
      calldata: [],
    }),
    provider.callContract({
      contractAddress: tokenAddress,
      entrypoint: 'decimals',
      calldata: [],
    }),
  ]);

  // Convert felt252 to string (simplified - actual conversion may vary)
  const name = nameResult[0] ? BigInt(nameResult[0]).toString() : 'Unknown';
  const symbol = symbolResult[0] ? BigInt(symbolResult[0]).toString() : 'UNK';
  const decimals = decimalsResult[0] ? Number(decimalsResult[0]) : 18;

  return {
    name,
    symbol,
    decimals,
  };
}
