/**
 * Chain-agnostic wallet resolution and x402 client construction.
 *
 * Provides a single entry point — {@link createX402Client} — that accepts
 * wallet adapters and returns a ready-to-use x402 client for the fetch wrapper.
 *
 * Supported credential strategies:
 *
 * 1. **Wallet objects** — one or more {@link Wallet} instances (chain-agnostic).
 * 2. **Pre-built x402 client** — an already-configured `x402Client` (returned as-is).
 */

import type { PaymentPolicy } from "@x402/fetch";
import { x402Client } from "@x402/fetch";
import type { Wallet } from "./wallets/base.ts";

/**
 * Resolve credentials and return an x402 client.
 *
 * Credential sources (provide **exactly one**):
 *
 * - `wallet` — a single {@link Wallet} adapter instance.
 * - `wallets` — a list of {@link Wallet} adapters (multi-chain).
 * - `x402Client` — a pre-configured x402 client (returned as-is).
 */
export async function createX402Client(options: {
	wallet?: Wallet;
	wallets?: Wallet[];
	x402Client?: x402Client;
	policies?: PaymentPolicy[];
}): Promise<x402Client> {
	const { policies, ...credentialOptions } = options;
	const resolved = resolveWallets(credentialOptions);

	// Pre-built client — return as-is.
	if (!Array.isArray(resolved)) {
		if (policies && policies.length > 0) {
			console.warn(
				"x402: 'policies' ignored when 'x402Client' is provided — " +
					"register policies on the pre-built client directly.",
			);
		}
		return resolved;
	}

	return buildClient(resolved, policies);
}

/**
 * Return a list of {@link Wallet} instances or a pre-built x402 client.
 *
 * @throws {Error} On ambiguous or missing credentials.
 */
export function resolveWallets(options: {
	wallet?: Wallet;
	wallets?: Wallet[];
	x402Client?: x402Client;
}): Wallet[] | x402Client {
	const hasWallet = options.wallet != null;
	const hasWallets = options.wallets != null && options.wallets.length > 0;
	const hasPrebuilt = options.x402Client != null;

	const sources = [hasWallet, hasWallets, hasPrebuilt].filter(Boolean).length;

	if (sources === 0) {
		throw new Error(
			"Provide exactly one credential source: 'wallet', 'wallets', or 'x402Client'.",
		);
	}
	if (sources > 1) {
		throw new Error(
			"Provide only one credential source — 'wallet', 'wallets', or 'x402Client'.",
		);
	}

	if (hasPrebuilt && options.x402Client) {
		return options.x402Client;
	}

	if (hasWallet && options.wallet) {
		return [options.wallet];
	}

	return [...(options.wallets ?? [])];
}

/** Create an x402 client, register all wallets and policies. */
async function buildClient(
	walletList: Wallet[],
	policies?: PaymentPolicy[],
): Promise<x402Client> {
	const client = new x402Client();
	for (const w of walletList) {
		await w.register(client);
	}
	for (const p of policies ?? []) {
		client.registerPolicy(p);
	}
	return client;
}
