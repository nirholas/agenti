/**
 * Unit tests for wallet adapters and the Wallet interface.
 */

import { describe, expect, it } from "bun:test";
import type { EvmWalletOptions } from "../src/wallets/evm.ts";
import { EvmWallet } from "../src/wallets/evm.ts";
import { SvmWallet } from "../src/wallets/svm.ts";

describe("EvmWallet", () => {
	it("requires a credential", () => {
		// @ts-expect-error — intentionally missing required fields
		expect(() => new EvmWallet({})).toThrow("requires");
	});

	it("rejects both credentials", () => {
		expect(
			// @ts-expect-error — intentionally passing both fields
			() => new EvmWallet({ privateKey: "0xdead", mnemonic: "word1 word2" }),
		).toThrow("only one");
	});

	it("rejects derivationPath without mnemonic", () => {
		expect(
			() =>
				new EvmWallet({
					privateKey: "0xdead",
					derivationPath: "m/44'/60'/0'/0/0",
				} as unknown as EvmWalletOptions),
		).toThrow("derivationPath");
	});

	it("accepts a private key", () => {
		const w = new EvmWallet({ privateKey: "0xdead" });
		expect(w).toBeDefined();
		// @ts-expect-error — accessing private field for testing
		expect(w._privateKey).toBe("0xdead");
		// @ts-expect-error — accessing private field for testing
		expect(w._mnemonic).toBeUndefined();
	});

	it("accepts a mnemonic", () => {
		const w = new EvmWallet({ mnemonic: "word1 word2 word3" });
		// @ts-expect-error — accessing private field for testing
		expect(w._mnemonic).toBe("word1 word2 word3");
		// @ts-expect-error — accessing private field for testing
		expect(w._privateKey).toBeUndefined();
	});

	it("defaults accountIndex to 0", () => {
		const w = new EvmWallet({ mnemonic: "word1 word2 word3" });
		// @ts-expect-error — accessing private field for testing
		expect(w._accountIndex).toBe(0);
	});

	it("accepts custom accountIndex", () => {
		const w = new EvmWallet({ mnemonic: "word1 word2 word3", accountIndex: 5 });
		// @ts-expect-error — accessing private field for testing
		expect(w._accountIndex).toBe(5);
	});

	it("accepts custom derivationPath", () => {
		const w = new EvmWallet({
			mnemonic: "word1 word2 word3",
			derivationPath: "m/44'/60'/2'/0/0",
		});
		// @ts-expect-error — accessing private field for testing
		expect(w._derivationPath).toBe("m/44'/60'/2'/0/0");
	});
});

describe("SvmWallet", () => {
	it("requires a non-empty key", () => {
		expect(() => new SvmWallet({ privateKey: "" })).toThrow("non-empty");
	});

	it("accepts a private key", () => {
		const w = new SvmWallet({ privateKey: "base58key" });
		// @ts-expect-error — accessing private field for testing
		expect(w._privateKey).toBe("base58key");
	});
});
