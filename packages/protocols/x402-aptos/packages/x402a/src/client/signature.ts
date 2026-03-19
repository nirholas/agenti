import { type AccountAuthenticator, Deserializer, SimpleTransaction } from "@aptos-labs/ts-sdk";
import type { WalletContextState } from "@aptos-labs/wallet-adapter-react";

interface WalletAccountWithKey {
  publicKey: string | { toString(): string };
  address?: { toString(): string };
}

function hasPublicKey(account: unknown): account is WalletAccountWithKey {
  return (
    typeof account === "object" &&
    account !== null &&
    "publicKey" in account &&
    (typeof (account as WalletAccountWithKey).publicKey === "string" ||
      typeof (account as WalletAccountWithKey).publicKey?.toString === "function")
  );
}

function ensureHexPrefix(hex: string): string {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
}

import type {
  AptosChainId,
  TransactionAuthenticatorResult,
  TransactionPayloadForSigning,
} from "../types/payment";

/**
 * Sign a transaction for fee payer (sponsored transaction) flow
 *
 * The facilitator builds the transaction and sends it to the client as hex.
 * The client signs the transaction bytes and returns the signature.
 * The facilitator then adds their fee payer signature and submits.
 *
 * @param wallet - Connected wallet from Aptos wallet adapter
 * @param transactionPayload - Transaction details from server (includes hex transaction)
 * @returns Transaction authenticator (signature) for server to use
 */
export async function signTransactionForFeePayer(
  wallet: WalletContextState,
  transactionPayload: TransactionPayloadForSigning
): Promise<TransactionAuthenticatorResult> {
  if (!wallet.connected || !wallet.account) {
    throw new Error("Wallet not connected");
  }

  // Validate the sender matches connected wallet
  const walletAddress = wallet.account.address.toString().toLowerCase();
  const senderAddress = transactionPayload.sender.toLowerCase();
  if (walletAddress !== senderAddress) {
    throw new Error("Transaction sender must match connected wallet address");
  }

  // Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (transactionPayload.validUntil <= now) {
    throw new Error("Transaction has expired");
  }

  try {
    // Check if wallet supports signing transactions
    if (!wallet.signTransaction) {
      throw new Error(
        "Wallet does not support signing transactions. Please use a compatible wallet."
      );
    }

    console.log("[Fee Payer] Signing transaction:", {
      function: transactionPayload.function,
      sender: transactionPayload.sender,
      validUntil: new Date(transactionPayload.validUntil * 1000).toISOString(),
      chainId: transactionPayload.chainId,
    });

    // The transaction hex from the server
    const transactionHex = transactionPayload.transaction;

    // Remove 0x prefix if present
    const cleanHex = transactionHex.startsWith("0x") ? transactionHex.slice(2) : transactionHex;

    // Deserialize the transaction from hex bytes
    const transactionBytes = Buffer.from(cleanHex, "hex");
    const deserializer = new Deserializer(new Uint8Array(transactionBytes));
    const transaction = SimpleTransaction.deserialize(deserializer);

    console.log("[Fee Payer] Transaction deserialized, requesting signature from wallet...");

    // Sign the transaction using wallet's signTransaction method
    // asFeePayer = false because the user is the sender, not the fee payer
    const accountAuthenticator: AccountAuthenticator = await wallet.signTransaction(
      transaction,
      false
    );

    // Serialize the authenticator to hex
    const authenticatorBytes = accountAuthenticator.bcsToBytes();
    const authenticatorHex = ensureHexPrefix(Buffer.from(authenticatorBytes).toString("hex"));

    console.log("[Fee Payer] Transaction signed successfully");

    // Get public key
    let publicKey: string;
    if (hasPublicKey(wallet.account)) {
      const pk = wallet.account.publicKey;
      publicKey = ensureHexPrefix(typeof pk === "string" ? pk : pk.toString());
    } else {
      throw new Error("Public key not available from wallet");
    }

    // Return the authenticator (signature) and metadata
    // The facilitator will use this authenticator when submitting
    return {
      authenticator: authenticatorHex,
      publicKey,
      address: walletAddress,
      transactionHash: "", // Will be set after facilitator submits
    };
  } catch (error) {
    console.error("[signTransactionForFeePayer] Error:", error);
    throw new Error(
      `Failed to sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Calculate expiration timestamp (current time + TTL)
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 * @returns Unix timestamp
 */
export function calculateExpiration(ttlSeconds: number = 3600): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Get current chain ID based on environment
 * @param network - Network name
 * @returns Chain ID
 */
export function getChainId(network: string): AptosChainId {
  const normalizedNetwork = network.toLowerCase();

  if (normalizedNetwork.includes("mainnet")) {
    return 1 as AptosChainId; // MAINNET
  }

  if (normalizedNetwork.includes("testnet")) {
    return 2 as AptosChainId; // TESTNET
  }

  if (normalizedNetwork.includes("devnet") || normalizedNetwork.includes("local")) {
    return 3 as AptosChainId; // DEVNET
  }

  // Default to testnet for safety
  return 2 as AptosChainId;
}
