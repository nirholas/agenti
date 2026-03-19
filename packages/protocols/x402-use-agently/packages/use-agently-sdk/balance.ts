import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { getChainConfig } from "./utils/chain";

export interface BalanceResult {
  address: string;
  balance: string;
  currency: string;
  network: string;
}

/** Get the USDC balance of a wallet on a specified chain (defaults to Base) */
export async function getBalance(address: string, options?: { rpc?: string; chain?: string }): Promise<BalanceResult> {
  const chainConfig = getChainConfig(options?.chain);

  const client = createPublicClient({
    chain: chainConfig.chain,
    transport: http(options?.rpc),
  });

  const balance = await client.readContract({
    address: chainConfig.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  return {
    address,
    balance: formatUnits(balance, chainConfig.usdcDecimals),
    currency: "USDC",
    network: chainConfig.chain.name,
  };
}
