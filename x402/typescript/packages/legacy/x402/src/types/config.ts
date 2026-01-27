/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | n1ch0las
 *  ID: 1493814938
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Configuration options for Solana (SVM) RPC connections.
 */
export interface SvmConfig {
  /**
   * Custom RPC URL for Solana connections.
   * If not provided, defaults to public Solana RPC endpoints based on network.
   */
  rpcUrl?: string;
}

/**
 * Configuration options for X402 client and facilitator operations.
 */
export interface X402Config {
  /** Configuration for Solana (SVM) operations */
  svmConfig?: SvmConfig;
  // Future: evmConfig?: EvmConfig for EVM-specific configurations
}


/* universal-crypto-mcp © nich */