/**
 * @title Ledger Wallet Package
 * @sidebarTitle Wallet Ledger
 * @description Ledger hardware wallet integration for EVM and Solana
 * @packageDocumentation
 */
export { createLedgerEvmWallet } from "./evm";
export { createLedgerSolanaWallet } from "./solana";
export { selectLedgerAccount } from "./utils";
export type { LedgerEvmWallet, LedgerSolanaWallet } from "./types";
export * from "./interface";
