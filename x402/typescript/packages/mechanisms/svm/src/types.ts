/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | n1ch0las
 *  ID: bmljaHhidA==
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Exact SVM payload structure containing a base64 encoded Solana transaction
 */
export type ExactSvmPayloadV1 = {
  /**
   * Base64 encoded Solana transaction
   */
  transaction: string;
};

/**
 * Exact SVM payload V2 structure (currently same as V1, reserved for future extensions)
 */
export type ExactSvmPayloadV2 = ExactSvmPayloadV1;


/* ucm:n1ch2abfa956 */