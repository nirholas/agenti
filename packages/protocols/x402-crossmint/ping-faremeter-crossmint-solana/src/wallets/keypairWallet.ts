import type { Keypair, VersionedTransaction } from "@solana/web3.js";

/**
 * Creates a wallet adapter from a Solana Keypair
 * This wallet can sign transactions locally using the provided keypair
 */
export async function createKeypairWallet(network: string, keypair: Keypair) {
  return {
    network,
    publicKey: keypair.publicKey,
    updateTransaction: async (tx: VersionedTransaction) => {
      // Sign the transaction with the keypair
      tx.sign([keypair]);
      return tx;
    },
  };
}

export type KeypairWallet = Awaited<ReturnType<typeof createKeypairWallet>>;
