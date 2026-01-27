/**
 * @file index.ts
 * @author nich
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 0.14.9.3
 */

/**
 * @module @x402/evm - x402 Payment Protocol EVM Implementation
 *
 * This module provides the EVM-specific implementation of the x402 payment protocol.
 */

// Export EVM implementation modules here
// The actual implementation logic will be added by copying from the core/src/schemes/evm folder

export { ExactEvmScheme } from "./exact";
export { toClientEvmSigner, toFacilitatorEvmSigner } from "./signer";
export type { ClientEvmSigner, FacilitatorEvmSigner } from "./signer";


/* EOF - nich | dW5pdmVyc2FsLWNyeXB0by1tY3A= */