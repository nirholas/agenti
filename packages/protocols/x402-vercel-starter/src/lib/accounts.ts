import { Account, toAccount } from "viem/accounts";
import { CdpClient } from "@coinbase/cdp-sdk";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { env } from "./env";

let cdp: CdpClient | null = null;

function getCdpClient() {
  if (!cdp) {
    cdp = new CdpClient();
  }
  return cdp;
}

const chainMap = {
  "base-sepolia": baseSepolia,
  base: base,
} as const;

export function getChain() {
  return chainMap[env.NETWORK];
}

function getPublicClient() {
  return createPublicClient({
    chain: getChain(),
    transport: http(),
  });
}

export async function getOrCreatePurchaserAccount(): Promise<Account> {
  const cdpClient = getCdpClient();
  const account = await cdpClient.evm.getOrCreateAccount({
    name: "Purchaser",
  });
  const balances = await account.listTokenBalances({
    network: env.NETWORK,
  });

  const usdcBalance = balances.balances.find(
    (balance) => balance.token.symbol === "USDC"
  );

  // if under $0.50 while on testnet, request more
  if (
    env.NETWORK === "base-sepolia" &&
    (!usdcBalance || Number(usdcBalance.amount) < 500000)
  ) {
    const { transactionHash } = await cdpClient.evm.requestFaucet({
      address: account.address,
      network: env.NETWORK,
      token: "usdc",
    });
    const publicClient = getPublicClient();
    const tx = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });
    if (tx.status !== "success") {
      throw new Error("Failed to recieve funds from faucet");
    }
  }

  return toAccount(account);
}

export async function getOrCreateSellerAccount(): Promise<Account> {
  const cdpClient = getCdpClient();
  const account = await cdpClient.evm.getOrCreateAccount({
    name: "Seller",
  });
  return toAccount(account);
}
