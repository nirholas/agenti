/**
 * @daydreamsai/facilitator - x402 Payment Facilitator Library
 *
 * This module exports the core facilitator setup and types for building
 * x402 payment facilitators with custom signers.
 *
 * @example
 * ```typescript
 * import { createFacilitator } from "@daydreamsai/facilitator";
 * import { createCdpEvmSigner } from "@daydreamsai/facilitator/signers/cdp";
 *
 * const signer = createCdpEvmSigner({ ... });
 * const facilitator = createFacilitator({
 *   evmSigners: [{ signer, networks: "eip155:8453" }],
 * });
 * ```
 */

// Core facilitator factory and types
export {
  createFacilitator,
  type FacilitatorConfig,
  type EvmSignerConfig,
  type SvmSignerConfig,
  type EvmSchemeType,
  type SvmSchemeType,
  type StarknetConfig,
  type NetworkId,
  type FacilitatorHooks,
} from "./factory.js";
