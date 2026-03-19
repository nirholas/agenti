import type { Hex, TransactionSerializable, TypedDataDefinition } from "viem";
import { evm } from "@faremeter/types";
import type { PublicKey, VersionedTransaction } from "@solana/web3.js";
import type Transport from "@ledgerhq/hw-transport";

/**
 * Ledger hardware wallet interface for EVM chains.
 */
export interface LedgerEvmWallet {
  chain: evm.ChainInfo;
  address: Hex;
  signTransaction: (tx: TransactionSerializable) => Promise<Hex>;
  signTypedData: (params: TypedDataDefinition) => Promise<Hex>;
  disconnect: () => Promise<void>;
}

/**
 * Ledger hardware wallet interface for Solana.
 */
export interface LedgerSolanaWallet {
  network: string;
  publicKey: PublicKey;
  partiallySignTransaction: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  updateTransaction: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  disconnect: () => Promise<void>;
}

export interface LedgerTransportWrapper {
  transport: Transport;
  close: () => Promise<void>;
}

/**
 * User interface abstraction for Ledger interactions.
 *
 * Used to display prompts and receive user input during
 * device selection and account enumeration.
 */
export interface UserInterface {
  /** Displays a message to the user. */
  message: (msg: string) => void;
  /** Prompts the user for input and returns their response. */
  question: (prompt: string) => Promise<string>;
  /** Closes the interface and releases resources. */
  close: () => Promise<void>;
}
