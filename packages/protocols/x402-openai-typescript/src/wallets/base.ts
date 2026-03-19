/**
 * Abstract wallet interface for chain-agnostic x402 payment registration.
 *
 * Any chain adapter must implement the {@link Wallet} interface so that the
 * client layer can register payment schemes without knowing chain details.
 *
 * To add support for a new blockchain:
 *
 * 1. Create a new module (e.g. `mychain.ts`) in this package.
 * 2. Implement the {@link Wallet} interface.
 * 3. Re-export from `wallets/index.ts`.
 */

import type { x402Client } from "@x402/fetch";

/**
 * Interface that all chain-specific wallet adapters must satisfy.
 *
 * Each wallet knows how to:
 * - Derive or hold a signing key for its chain.
 * - Register the appropriate x402 payment scheme on an {@link x402Client} instance.
 */
export interface Wallet {
	/**
	 * Register this wallet's payment scheme(s) with the given client.
	 *
	 * @param client - An `x402Client` instance from `@x402/fetch`.
	 */
	register(client: x402Client): Promise<void> | void;
}
