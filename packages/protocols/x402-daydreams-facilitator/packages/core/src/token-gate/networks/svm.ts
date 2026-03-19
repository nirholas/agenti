import { createSolanaRpc, address } from "@solana/kit";

/**
 * CAIP-2 to internal network mapping for Solana
 */
const SOLANA_CAIP2_TO_NETWORK: Record<string, string> = {
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "solana-mainnet",
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "solana-devnet",
  "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": "solana-testnet",
};

export interface SvmBalanceCheckConfig {
  /** Internal network name (e.g., "solana-mainnet", "solana-devnet") */
  network: string;
  /** RPC URL */
  rpcUrl: string;
  /** SPL token mint address */
  tokenMint: string;
  /** Wallet address to check */
  walletAddress: string;
}

/**
 * Check SPL token balance for a wallet
 */
export async function checkSplTokenBalance(
  config: SvmBalanceCheckConfig
): Promise<bigint> {
  const rpc = createSolanaRpc(config.rpcUrl);

  // Get all token accounts for this wallet holding the specific mint
  const response = await rpc
    .getTokenAccountsByOwner(
      address(config.walletAddress),
      { mint: address(config.tokenMint) },
      { encoding: "jsonParsed" }
    )
    .send();

  // Sum up balance from all accounts (typically just one)
  let totalBalance = 0n;

  for (const account of response.value) {
    const data = account.account.data;
    // jsonParsed encoding returns parsed token account data
    if (
      typeof data === "object" &&
      "parsed" in data &&
      data.parsed?.type === "account"
    ) {
      const amount = data.parsed.info?.tokenAmount?.amount;
      if (amount) {
        totalBalance += BigInt(amount);
      }
    }
  }

  return totalBalance;
}

/**
 * Parse CAIP-2 network ID to internal network key
 * e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" -> "solana-mainnet"
 */
export function parseSvmCaip2(caip2: string): string | null {
  return SOLANA_CAIP2_TO_NETWORK[caip2] ?? null;
}

/**
 * Check if CAIP-2 is a Solana network
 */
export function isSvmNetwork(caip2: string): boolean {
  return caip2.startsWith("solana:");
}
