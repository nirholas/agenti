import { type PublicClient } from "viem";
import { type Address } from "@faremeter/types/evm";

/**
 * Arguments for retrieving an ERC-20 token balance.
 */
export interface GetTokenBalanceArgs {
  /** The wallet address to check the balance for */
  account: Address;
  /** The ERC-20 token contract address */
  asset: Address;
  /** Viem public client for querying the chain */
  client: PublicClient;
}

/**
 * Retrieves the ERC-20 token balance and decimals for an account.
 *
 * Uses multicall to fetch both values in a single RPC request.
 *
 * @param args - The account, asset, and client configuration
 * @returns The balance amount and token decimals
 * @throws Error if the balance query fails
 */
export async function getTokenBalance(args: GetTokenBalanceArgs) {
  const { account, asset, client } = args;

  const [balance, decimals] = await client.multicall({
    contracts: [
      {
        address: asset,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ type: "address" }],
            outputs: [{ type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [account],
      },
      {
        address: asset,
        abi: [
          {
            name: "decimals",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint8" }],
          },
        ],
        functionName: "decimals",
        args: [],
      },
    ],
  });

  if (decimals.status !== "success" || balance.status !== "success") {
    throw new Error("failed to query balance");
  }

  return {
    amount: balance.result,
    decimals: decimals.result,
  };
}
