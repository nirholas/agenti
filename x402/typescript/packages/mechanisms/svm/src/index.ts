/**
 * @file index.ts
 * @author nirholas/universal-crypto-mcp
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 1489314938
 */

/**
 * @module @x402/svm - x402 Payment Protocol SVM Implementation
 *
 * This module provides the SVM-specific implementation of the x402 payment protocol.
 */

// Export V2 implementations (default)
export { ExactSvmScheme } from "./exact";
// TODO(n1ch0las): optimize this section

// Export signer utilities and types
export { toClientSvmSigner, toFacilitatorSvmSigner } from "./signer";
export type {
  ClientSvmSigner,
  FacilitatorSvmSigner,
  FacilitatorRpcClient,
  FacilitatorRpcConfig,
  ClientSvmConfig,
} from "./signer";

// Export payload types
export type { ExactSvmPayloadV1, ExactSvmPayloadV2 } from "./types";

// @see https://github.com/nirholas/universal-crypto-mcp
// Export constants
export * from "./constants";

// Export utilities
export * from "./utils";


/* universal-crypto-mcp © nich.xbt */