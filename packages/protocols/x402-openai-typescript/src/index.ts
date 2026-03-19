/**
 * x402-openai — Drop-in OpenAI TypeScript client with transparent x402 payment.
 *
 * Quick start:
 *
 * ```ts
 * import { X402OpenAI, preferNetwork } from "x402-openai";
 * import { EvmWallet, SvmWallet } from "x402-openai/wallets";
 *
 * // EVM
 * const client = new X402OpenAI({ wallet: new EvmWallet({ privateKey: "0x…" }) });
 *
 * // SVM (Solana)
 * const client = new X402OpenAI({ wallet: new SvmWallet({ privateKey: "base58…" }) });
 *
 * // Multi-chain with policy
 * const client = new X402OpenAI({
 *   wallets: [
 *     new EvmWallet({ privateKey: "0x…" }),
 *     new SvmWallet({ privateKey: "base58…" }),
 *   ],
 *   policies: [preferNetwork("eip155:8453")],
 * });
 * ```
 *
 * Public API:
 *
 * - {@link X402OpenAI} — recommended client class.
 * - {@link preferNetwork} / {@link preferScheme} / {@link maxAmount} — payment policies.
 * - {@link EvmWallet} / {@link SvmWallet} — chain-specific wallet adapters.
 * - {@link Wallet} — interface for custom wallet implementations.
 */

export type { PaymentPolicy } from "@x402/fetch";
export type { X402OpenAIOptions } from "./client.ts";
export { X402OpenAI } from "./client.ts";
export { maxAmount, preferNetwork, preferScheme } from "./policies.ts";
export type {
	EvmWalletMnemonicOptions,
	EvmWalletOptions,
	EvmWalletPrivateKeyOptions,
	SvmWalletOptions,
	Wallet,
} from "./wallets/index.ts";
export { EvmWallet, SvmWallet } from "./wallets/index.ts";
