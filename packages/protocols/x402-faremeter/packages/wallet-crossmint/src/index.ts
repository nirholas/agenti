/**
 * @title Crossmint Wallet Package
 * @sidebarTitle Wallet Crossmint
 * @description Crossmint custodial wallet integration for Solana
 * @packageDocumentation
 */
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  createCrossmint,
  CrossmintWallets,
  SolanaWallet,
} from "@crossmint/wallets-sdk";

/**
 * Creates a Crossmint custodial wallet for Solana.
 *
 * Uses the Crossmint Wallets SDK to sign and send transactions via
 * API key authentication.
 *
 * @param network - Solana network identifier.
 * @param crossmintApiKey - Crossmint API key for authentication.
 * @param crossmintWalletAddress - Address of the Crossmint-managed wallet.
 * @returns A wallet object that can send Solana transactions.
 */
export async function createCrossmintWallet(
  network: string,
  crossmintApiKey: string,
  crossmintWalletAddress: string,
) {
  const crossmint = createCrossmint({
    apiKey: crossmintApiKey,
  });
  const crossmintWallets = CrossmintWallets.from(crossmint);
  const wallet = await crossmintWallets.getWallet(crossmintWalletAddress, {
    chain: "solana",
    signer: {
      type: "api-key",
    },
  });

  const solanaWallet = SolanaWallet.from(wallet);
  const publicKey = new PublicKey(solanaWallet.address);

  return {
    network,
    publicKey,
    sendTransaction: async (tx: VersionedTransaction) => {
      const solTx = await solanaWallet.sendTransaction({
        transaction: tx as any, // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      });

      return solTx.hash;
    },
  };
}
