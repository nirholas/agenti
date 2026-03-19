/**
 * @title EVM Wallet Package
 * @sidebarTitle Wallet EVM
 * @description Local wallet creation for EVM chains using private keys
 * @packageDocumentation
 */
import { isPrivateKey, type ChainInfo } from "@faremeter/types/evm";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * An EVM wallet instance with chain info and signing capabilities.
 */
export interface EvmWallet {
  /** Chain configuration for this wallet. */
  chain: ChainInfo;
  /** Wallet address as a hex string. */
  address: Hex;
  /** Viem account for signing operations. */
  account: ReturnType<typeof privateKeyToAccount>;
}

/**
 * Creates a local EVM wallet from a private key.
 *
 * @param chain - Chain configuration for the wallet.
 * @param privateKey - Hex-encoded private key with "0x" prefix.
 * @returns An EVM wallet object for signing transactions.
 * @throws If the private key format is invalid.
 */
export async function createLocalWallet(
  chain: ChainInfo,
  privateKey: string,
): Promise<EvmWallet> {
  if (!isPrivateKey(privateKey)) {
    throw new Error(
      `Invalid private key format. Expected 64-character hex string with '0x' prefix, got: ${privateKey.slice(0, 10)}...`,
    );
  }

  const account = privateKeyToAccount(privateKey);

  return {
    chain,
    address: account.address,
    account,
  };
}
