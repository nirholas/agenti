import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ViemWalletProvider } from "@coinbase/agentkit";

export async function createAgentWallet(
  privateKey: Hex,
  chain: Chain,
  rpcUrl?: string,
) {
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new ViemWalletProvider(walletClient as any);

  return { walletClient, publicClient, provider, account };
}
