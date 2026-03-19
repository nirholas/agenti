/**
 * EVM (Ethereum) wallet adapter for x402 payment.
 *
 * Supports two credential sources:
 *
 * - Raw hex private key (`"0x…"`).
 * - BIP-39 mnemonic phrase with optional derivation parameters.
 *
 * All heavy dependencies (`viem`, `@x402/evm`) are imported lazily so that
 * users who only need SVM do not pay the import cost.
 */

import type { x402Client } from "@x402/fetch";

/** Options for constructing an {@link EvmWallet} from a raw private key. */
export interface EvmWalletPrivateKeyOptions {
	/** Raw EVM hex key (`"0x…"`). */
	privateKey: `0x${string}`;
	mnemonic?: never;
	accountIndex?: never;
	derivationPath?: never;
	passphrase?: never;
}

/** Options for constructing an {@link EvmWallet} from a BIP-39 mnemonic. */
export interface EvmWalletMnemonicOptions {
	privateKey?: never;
	/** BIP-39 phrase (12 or 24 words). */
	mnemonic: string;
	/** BIP-44 account index (default `0`). */
	accountIndex?: number;
	/** Custom BIP-44 derivation path. Overrides `accountIndex`. */
	derivationPath?: string;
	/** Optional BIP-39 passphrase. */
	passphrase?: string;
}

export type EvmWalletOptions =
	| EvmWalletPrivateKeyOptions
	| EvmWalletMnemonicOptions;

/**
 * Wallet adapter for EVM-compatible chains.
 *
 * Provide **exactly one** of `privateKey` or `mnemonic`.
 *
 * @example
 * ```ts
 * const wallet = new EvmWallet({ privateKey: "0x…" });
 * const wallet = new EvmWallet({ mnemonic: "word1 word2 … word12" });
 * const wallet = new EvmWallet({ mnemonic: "word1 …", accountIndex: 2 });
 * ```
 */
export class EvmWallet {
	private readonly _privateKey: `0x${string}` | undefined;
	private readonly _mnemonic: string | undefined;
	private readonly _accountIndex: number;
	private readonly _derivationPath: string | undefined;
	private readonly _passphrase: string;

	constructor(options: EvmWalletOptions) {
		const hasKey = options.privateKey != null;
		const hasMnemonic = options.mnemonic != null;

		if (!hasKey && !hasMnemonic) {
			throw new Error("EvmWallet requires 'privateKey' or 'mnemonic'.");
		}
		if (hasKey && hasMnemonic) {
			throw new Error(
				"EvmWallet accepts only one of 'privateKey' or 'mnemonic'.",
			);
		}
		if (options.derivationPath != null && !hasMnemonic) {
			throw new Error("'derivationPath' requires 'mnemonic'.");
		}

		this._privateKey = options.privateKey;
		this._mnemonic = options.mnemonic;
		this._accountIndex = options.accountIndex ?? 0;
		this._derivationPath = options.derivationPath;
		this._passphrase = options.passphrase ?? "";
	}

	/** Register the EVM exact payment scheme on the given client. */
	register(client: x402Client): void {
		const { ExactEvmScheme } =
			require("@x402/evm") as typeof import("@x402/evm");
		const account = this._resolveAccount();
		client.register("eip155:*", new ExactEvmScheme(account));
	}

	/** Lazily derive the viem account from stored credentials. */
	private _resolveAccount() {
		if (this._mnemonic != null) {
			return this._accountFromMnemonic();
		}
		return this._accountFromKey();
	}

	/** Derive a viem account from a raw hex private key. */
	private _accountFromKey() {
		const { privateKeyToAccount } =
			require("viem/accounts") as typeof import("viem/accounts");
		if (!this._privateKey) {
			throw new Error("Private key is not set.");
		}
		return privateKeyToAccount(this._privateKey);
	}

	/** Derive a viem account from a BIP-39 mnemonic phrase. */
	private _accountFromMnemonic() {
		const { mnemonicToAccount } =
			require("viem/accounts") as typeof import("viem/accounts");

		if (!this._mnemonic) {
			throw new Error("Mnemonic is not set.");
		}

		if (this._derivationPath) {
			return mnemonicToAccount(this._mnemonic, {
				path: this._derivationPath as `m/44'/60'/${string}`,
				passphrase: this._passphrase || undefined,
			});
		}

		return mnemonicToAccount(this._mnemonic, {
			addressIndex: this._accountIndex,
			passphrase: this._passphrase || undefined,
		});
	}
}
