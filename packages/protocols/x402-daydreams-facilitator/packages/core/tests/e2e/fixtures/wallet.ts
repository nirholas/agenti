/**
 * Shared Test Wallet Fixture
 *
 * Provides a singleton wallet for all e2e tests.
 * Uses environment variables for keys.
 */

import { createWalletClient, http, publicActions, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { Keypair, type PublicKey, type Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { E2E_CONFIG } from "../e2e.config.js";

export interface TestWallet {
  evm: {
    address: `0x${string}`;
    account: PrivateKeyAccount;
    client: WalletClient;
    signTypedData: (data: Parameters<WalletClient["signTypedData"]>[0]) => Promise<`0x${string}`>;
  };
  solana: {
    publicKey: PublicKey;
    keypair: Keypair;
    signTransaction: (tx: Transaction) => Transaction;
  };
}

let sharedWallet: TestWallet | null = null;

/**
 * Get the shared test wallet singleton.
 * Creates it on first call, returns cached instance after.
 */
export function getSharedWallet(): TestWallet {
  if (sharedWallet) return sharedWallet;

  const evmPrivateKey = process.env.E2E_EVM_PRIVATE_KEY;
  const solanaSecretKey = process.env.E2E_SOLANA_SECRET_KEY;

  if (!evmPrivateKey) {
    throw new Error("Missing E2E_EVM_PRIVATE_KEY environment variable");
  }
  if (!solanaSecretKey) {
    throw new Error("Missing E2E_SOLANA_SECRET_KEY environment variable");
  }

  // EVM wallet
  const evmAccount = privateKeyToAccount(evmPrivateKey as `0x${string}`);
  const evmClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(E2E_CONFIG.evm.rpcUrl),
  }).extend(publicActions);

  // Solana wallet
  const solanaKeypair = Keypair.fromSecretKey(bs58.decode(solanaSecretKey));

  sharedWallet = {
    evm: {
      address: evmAccount.address,
      account: evmAccount,
      client: evmClient as WalletClient,
      signTypedData: async (data) => {
        return evmClient.signTypedData(data as Parameters<typeof evmClient.signTypedData>[0]);
      },
    },
    solana: {
      publicKey: solanaKeypair.publicKey,
      keypair: solanaKeypair,
      signTransaction: (tx: Transaction) => {
        tx.sign(solanaKeypair);
        return tx;
      },
    },
  };

  return sharedWallet;
}

/**
 * Check if wallet environment variables are set.
 * Used to skip tests when credentials not available.
 */
export function hasWalletCredentials(): boolean {
  return !!(process.env.E2E_EVM_PRIVATE_KEY && process.env.E2E_SOLANA_SECRET_KEY);
}

/**
 * Reset the shared wallet (for testing the fixture itself).
 */
export function resetSharedWallet(): void {
  sharedWallet = null;
}
