/**
 * Chain-specific wallet adapters for x402 payment.
 *
 * Public API:
 *
 * - {@link Wallet} — interface that all adapters implement.
 * - {@link EvmWallet} — EVM / Ethereum adapter.
 * - {@link SvmWallet} — Solana adapter.
 */

export type { Wallet } from "./base.ts";
export type {
	EvmWalletMnemonicOptions,
	EvmWalletOptions,
	EvmWalletPrivateKeyOptions,
} from "./evm.ts";
export { EvmWallet } from "./evm.ts";
export type { SvmWalletOptions } from "./svm.ts";
export { SvmWallet } from "./svm.ts";
