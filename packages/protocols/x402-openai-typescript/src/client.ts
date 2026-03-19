/**
 * Drop-in OpenAI client with built-in x402 payment support.
 *
 * {@link X402OpenAI} replaces `openai.OpenAI` and transparently handles
 * HTTP 402 Payment Required responses via the x402 protocol.
 *
 * Supports multiple blockchain backends via wallet adapters:
 *
 * @example
 * ```ts
 * import { X402OpenAI } from "x402-openai";
 * import { EvmWallet, SvmWallet } from "x402-openai/wallets";
 *
 * // Single chain
 * const client = new X402OpenAI({ wallet: new EvmWallet({ privateKey: "0x…" }) });
 *
 * // Multi-chain
 * const client = new X402OpenAI({
 *   wallets: [
 *     new EvmWallet({ privateKey: "0x…" }),
 *     new SvmWallet({ privateKey: "base58…" }),
 *   ],
 * });
 * ```
 */

import {
	type PaymentPolicy,
	wrapFetchWithPayment,
	type x402Client,
} from "@x402/fetch";
import type { ClientOptions } from "openai";
import OpenAI from "openai";
import { createX402Client } from "./wallet.ts";
import type { Wallet } from "./wallets/base.ts";

/** Default x402 LLM gateway URL. */
const DEFAULT_BASE_URL = "https://llm.qntx.fun/v1";

/** x402-specific options on top of the standard OpenAI client options. */
export interface X402OpenAIOptions extends Omit<ClientOptions, "fetch"> {
	/** A single {@link Wallet} adapter (e.g. `EvmWallet`, `SvmWallet`). */
	wallet?: Wallet;
	/** List of {@link Wallet} adapters for multi-chain support. */
	wallets?: Wallet[];
	/**
	 * Payment policies to filter or prioritise payment requirements.
	 * Ignored when `x402Client` is provided.
	 *
	 * @example
	 * ```ts
	 * import { preferNetwork, preferScheme, maxAmount } from "x402-openai";
	 *
	 * policies: [
	 *   preferNetwork("eip155:8453"),
	 *   preferScheme("exact"),
	 *   maxAmount(1_000_000n),
	 * ]
	 * ```
	 */
	policies?: PaymentPolicy[];
	/** Pre-configured `x402Client` instance. */
	x402Client?: x402Client;
}

/**
 * Drop-in replacement for `openai.OpenAI` with transparent x402 payment.
 *
 * Provide **exactly one** credential source:
 *
 * | Parameter    | Description                                        |
 * | ------------ | -------------------------------------------------- |
 * | `wallet`     | A single `Wallet` adapter (e.g. `EvmWallet`)       |
 * | `wallets`    | List of `Wallet` adapters for multi-chain support   |
 * | `x402Client` | Pre-configured `x402Client`                         |
 *
 * Default `baseURL` is `https://llm.qntx.fun/v1`.
 * All standard OpenAI constructor options (`baseURL`, `timeout`, `maxRetries`, …)
 * are forwarded transparently.
 *
 * @example
 * ```ts
 * import { preferNetwork } from "x402-openai";
 *
 * const client = new X402OpenAI({
 *   wallet: new EvmWallet({ privateKey: "0x…" }),
 *   policies: [preferNetwork("eip155:8453")],
 * });
 *
 * const completion = await client.chat.completions.create({
 *   model: "gpt-4o-mini",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 * ```
 */
export class X402OpenAI extends OpenAI {
	constructor(options: X402OpenAIOptions) {
		const {
			wallet,
			wallets,
			policies,
			x402Client: prebuiltClient,
			...openaiOptions
		} = options;

		// Build a lazy-initialized x402-wrapped fetch function.
		// Initialization is deferred to the first request so the constructor
		// remains synchronous (SVM wallet registration is async).
		const x402Fetch = createLazyX402Fetch({
			wallet,
			wallets,
			policies,
			x402Client: prebuiltClient,
		});

		super({
			apiKey: "x402",
			baseURL: DEFAULT_BASE_URL,
			...openaiOptions,
			fetch: x402Fetch,
		});
	}
}

/**
 * Create a fetch function that lazily initializes the x402 client on first use.
 *
 * This allows the constructor to remain synchronous while supporting async
 * wallet registration (e.g. SVM wallets that use Web Crypto API).
 */
type FetchFn = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

function createLazyX402Fetch(options: {
	wallet?: Wallet;
	wallets?: Wallet[];
	policies?: PaymentPolicy[];
	x402Client?: x402Client;
}): FetchFn {
	let clientPromise: Promise<x402Client> | null = null;
	let wrappedFetch: FetchFn | null = null;

	return async (
		input: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> => {
		if (!wrappedFetch) {
			if (!clientPromise) {
				clientPromise = createX402Client(options);
			}
			const client = await clientPromise;
			wrappedFetch = wrapFetchWithPayment(globalThis.fetch, client) as FetchFn;
		}
		return wrappedFetch(input, init);
	};
}
