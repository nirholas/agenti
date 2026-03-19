/**
 * @daydreamsai/facilitator/upto/evm - EVM-specific Upto scheme components
 *
 * This module exports EVM-specific implementations of the upto scheme
 * for clients, facilitators, and resource servers.
 *
 * @example
 * ```typescript
 * // Client side
 * import { registerUptoEvmClientScheme } from "@daydreamsai/facilitator/upto/evm";
 * registerUptoEvmClientScheme(x402, { signer, publicClient, facilitatorUrl });
 *
 * // Facilitator side
 * import { registerUptoEvmScheme } from "@daydreamsai/facilitator/upto/evm";
 * registerUptoEvmScheme(facilitator, { signer, networks: "eip155:8453" });
 *
 * // Resource server side
 * import { UptoEvmServerScheme } from "@daydreamsai/facilitator/upto/evm";
 * resourceServer.register("eip155:*", new UptoEvmServerScheme());
 * ```
 */

// Client-side scheme (for signing permits)
export {
  UptoEvmClientScheme,
  registerUptoEvmClientScheme,
  type UptoEvmClientConfig,
  type UptoEvmClientSigner,
  type UptoEvmPublicClient,
} from "./client.js";

// Facilitator-side scheme registration
export { registerUptoEvmScheme } from "./register.js";

// Facilitator-side scheme implementation
export { UptoEvmScheme, type UptoEvmSchemeOptions } from "./facilitator.js";

// Verification and settlement functions (for advanced usage)
export {
  verifyUptoPayment,
  type VerificationContext,
} from "./verification.js";

export {
  settleUptoPayment,
  type SettlementContext,
} from "./settlement.js";

// Constants and helpers (for advanced usage)
export {
  type UptoEvmAuthorization,
  type UptoEvmPayload,
  permitAbi,
  erc20Abi,
  toBigInt,
  errorSummary,
} from "./constants.js";

// Resource server-side scheme
export { UptoEvmServerScheme } from "./serverScheme.js";
