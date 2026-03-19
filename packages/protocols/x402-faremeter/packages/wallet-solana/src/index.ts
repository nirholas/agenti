/**
 * @title Solana Wallet Package
 * @sidebarTitle Wallet Solana
 * @description Local wallet creation for Solana using keypairs
 * @packageDocumentation
 */
import type { Keypair, VersionedTransaction } from "@solana/web3.js";

/**
 * Creates a local Solana wallet from a keypair for signing transactions.
 *
 * @param network - Network identifier (e.g., "mainnet-beta", "devnet").
 * @param keypair - Solana keypair containing the private key.
 * @returns A wallet object that can sign versioned transactions.
 */
export async function createLocalWallet(network: string, keypair: Keypair) {
  const signTransaction = async (tx: VersionedTransaction) => {
    tx.sign([keypair]);
    return tx;
  };

  return {
    network,
    publicKey: keypair.publicKey,
    partiallySignTransaction: signTransaction,
    updateTransaction: signTransaction,
  };
}

/**
 * Type representing a local Solana wallet created by {@link createLocalWallet}.
 */
export type LocalWallet = Awaited<ReturnType<typeof createLocalWallet>>;
