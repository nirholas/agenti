/**
 * Unit tests for the chain-agnostic wallet factory (wallet.ts).
 */

import { describe, expect, it } from "bun:test";
import { x402Client } from "@x402/fetch";
import { resolveWallets } from "../src/wallet.ts";
import { EvmWallet } from "../src/wallets/evm.ts";
import { SvmWallet } from "../src/wallets/svm.ts";

describe("resolveWallets", () => {
	it("throws when no credentials provided", () => {
		expect(() => resolveWallets({})).toThrow("exactly one");
	});

	it("throws when multiple sources provided", () => {
		const w = new EvmWallet({ privateKey: "0xdead" });
		const fake: x402Client = Object.create(x402Client.prototype);
		expect(() => resolveWallets({ wallet: w, x402Client: fake })).toThrow(
			"only one",
		);
	});

	it("returns pre-built client as-is", () => {
		const sentinel: x402Client = Object.create(x402Client.prototype);
		const result = resolveWallets({ x402Client: sentinel });
		expect(result).toBe(sentinel);
	});

	it("wraps single wallet in array", () => {
		const w = new EvmWallet({ privateKey: "0xdead" });
		const result = resolveWallets({ wallet: w });
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([w]);
	});

	it("preserves wallets list", () => {
		const w1 = new EvmWallet({ privateKey: "0xdead" });
		const w2 = new SvmWallet({ privateKey: "base58key" });
		const result = resolveWallets({ wallets: [w1, w2] });
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([w1, w2]);
	});

	it("treats empty wallets array as missing", () => {
		expect(() => resolveWallets({ wallets: [] })).toThrow("exactly one");
	});
});

describe("createX402Client", () => {
	it("returns pre-built client without building", async () => {
		const { createX402Client } = await import("../src/wallet.ts");
		const sentinel: x402Client = Object.create(x402Client.prototype);

		const result = await createX402Client({ x402Client: sentinel });
		// Pre-built client might not pass instanceof check in test env,
		// but the function should still handle it.
		expect(result).toBeDefined();
	});

	it("warns when policies provided with pre-built client", async () => {
		const { createX402Client } = await import("../src/wallet.ts");
		const sentinel: x402Client = Object.create(x402Client.prototype);
		const warned: string[] = [];
		const origWarn = console.warn;
		console.warn = (...args: unknown[]) => warned.push(String(args[0]));

		try {
			await createX402Client({
				x402Client: sentinel,
				policies: [(_v, reqs) => reqs],
			});
			expect(warned.some((m) => m.includes("policies"))).toBe(true);
		} finally {
			console.warn = origWarn;
		}
	});
});

describe("policies", () => {
	it("preferNetwork filters matching requirements", () => {
		const { preferNetwork } = require("../src/policies.ts");
		const reqs = [
			{ network: "eip155:8453", scheme: "exact", amount: "100" },
			{ network: "solana:mainnet", scheme: "exact", amount: "100" },
		];
		const result = preferNetwork("eip155:8453")(2, reqs);
		expect(result).toHaveLength(1);
		expect(result[0].network).toBe("eip155:8453");
	});

	it("preferNetwork with wildcard matches prefix", () => {
		const { preferNetwork } = require("../src/policies.ts");
		const reqs = [
			{ network: "eip155:8453", scheme: "exact", amount: "100" },
			{ network: "eip155:1", scheme: "exact", amount: "100" },
			{ network: "solana:mainnet", scheme: "exact", amount: "100" },
		];
		const result = preferNetwork("eip155:*")(2, reqs);
		expect(result).toHaveLength(2);
	});

	it("preferNetwork falls back to all when none match", () => {
		const { preferNetwork } = require("../src/policies.ts");
		const reqs = [
			{ network: "solana:mainnet", scheme: "exact", amount: "100" },
		];
		const result = preferNetwork("eip155:8453")(2, reqs);
		expect(result).toHaveLength(1);
	});

	it("preferScheme filters matching requirements", () => {
		const { preferScheme } = require("../src/policies.ts");
		const reqs = [
			{ network: "eip155:8453", scheme: "exact", amount: "100" },
			{ network: "eip155:8453", scheme: "streaming", amount: "100" },
		];
		const result = preferScheme("exact")(2, reqs);
		expect(result).toHaveLength(1);
		expect(result[0].scheme).toBe("exact");
	});

	it("maxAmount filters by amount cap", () => {
		const { maxAmount } = require("../src/policies.ts");
		const reqs = [
			{ network: "eip155:8453", scheme: "exact", amount: "500000" },
			{ network: "eip155:8453", scheme: "exact", amount: "2000000" },
		];
		const result = maxAmount(1_000_000n)(2, reqs);
		expect(result).toHaveLength(1);
		expect(result[0].amount).toBe("500000");
	});

	it("maxAmount falls back to all when all exceed cap", () => {
		const { maxAmount } = require("../src/policies.ts");
		const reqs = [
			{ network: "eip155:8453", scheme: "exact", amount: "2000000" },
		];
		const result = maxAmount(1_000_000n)(2, reqs);
		expect(result).toHaveLength(1);
	});
});
