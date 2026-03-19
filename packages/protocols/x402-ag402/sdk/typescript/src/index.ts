/**
 * @ag402/fetch — TypeScript SDK for x402 auto-payment
 *
 * Re-exports public API surface.
 */

export type { X402PaymentChallenge, X402PaymentProof, X402ServiceDescriptor } from "./protocol.js";
export {
  buildAuthorization,
  buildWwwAuthenticate,
  descriptorToChallenge,
  parseAmount,
  parseAuthorization,
  parseWwwAuthenticate,
} from "./protocol.js";

export type { Wallet, WalletTransaction } from "./wallet.js";
export { InMemoryWallet } from "./wallet.js";

export type { X402Config } from "./config.js";
export { DEFAULT_CONFIG } from "./config.js";

export type { CreateX402FetchOptions, PaymentProvider, X402FetchFunction, X402FetchMeta, X402Response } from "./fetch.js";
export { createX402Fetch, MockPaymentProvider } from "./fetch.js";
