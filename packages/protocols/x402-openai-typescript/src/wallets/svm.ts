/**
 * SVM (Solana) wallet adapter for x402 payment.
 *
 * Supports a single credential source:
 *
 * - Base58-encoded private key (Solana keypair secret).
 *
 * All heavy dependencies (`@solana/kit`, `@x402/svm`) are imported lazily
 * so that users who only need EVM do not pay the import cost.
 */

import type { x402Client } from "@x402/fetch";

export interface SvmWalletOptions {
	/** Base58-encoded Solana keypair secret key. */
	privateKey: string;
}

/**
 * Wallet adapter for Solana (SVM) chains.
 *
 * @example
 * ```ts
 * const wallet = new SvmWallet({ privateKey: "base58…" });
 * ```
 */
export class SvmWallet {
	private readonly _privateKey: string;

	constructor(options: SvmWalletOptions) {
		if (!options.privateKey) {
			throw new Error("SvmWallet requires a non-empty 'privateKey'.");
		}
		this._privateKey = options.privateKey;
	}

	/** Register the SVM exact payment scheme on the given client. */
	async register(client: x402Client): Promise<void> {
		const { ExactSvmScheme } = await import("@x402/svm");
		const { createKeyPairSignerFromBytes } = await import("@solana/kit");
		const { base58 } = await import("@scure/base");

		const signer = await createKeyPairSignerFromBytes(
			base58.decode(this._privateKey),
		);
		client.register("solana:*", new ExactSvmScheme(signer));
	}
}
