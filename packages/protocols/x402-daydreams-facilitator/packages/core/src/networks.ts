/**
 * Network Registry - Centralized network configuration
 *
 * This module provides network definitions for EVM and SVM chains including:
 * - CAIP-2 identifiers
 * - Chain IDs
 * - RPC URL templates (Alchemy, Helius, public fallbacks)
 * - Starknet RPC URL templates (Alchemy, public fallbacks)
 * - V1 scheme support detection (from @x402/evm)
 */

import { NETWORKS as V1_NETWORKS } from "@x402/evm/v1";

// ============================================================================
// Types
// ============================================================================

export interface EvmNetworkConfig {
  /** Chain ID (e.g., 8453 for Base) */
  chainId: number;
  /** CAIP-2 identifier (e.g., "eip155:8453") */
  caip: `eip155:${number}`;
  /** Alchemy subdomain (e.g., "base-mainnet.g.alchemy.com/v2") */
  alchemy?: string;
  /** Infura subdomain (e.g., "base-mainnet.infura.io/v3") */
  infura?: string;
  /** Public RPC fallback URL */
  public?: string;
}

export interface SvmNetworkConfig {
  /** CAIP-2 identifier (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp") */
  caip: `solana:${string}`;
  /** Helius RPC path (e.g., "mainnet.helius-rpc.com") */
  helius?: string;
  /** Public RPC fallback URL */
  public?: string;
}

export interface StarknetNetworkConfig {
  /** CAIP-2 identifier (e.g., "starknet:SN_MAIN") */
  caip: StarknetCaipId;
  /** Alchemy subdomain (e.g., "starknet-mainnet.g.alchemy.com/v2") */
  alchemy?: string;
  /** Public RPC fallback URL */
  public?: string;
}

export type EvmNetworkName = keyof typeof EVM_NETWORKS;
export type SvmNetworkName = keyof typeof SVM_NETWORKS;
export type StarknetNetworkName = keyof typeof STARKNET_NETWORKS;

export const STARKNET_CAIP_IDS = {
  MAINNET: "starknet:SN_MAIN",
  SEPOLIA: "starknet:SN_SEPOLIA",
} as const;

export type StarknetCaipId =
  (typeof STARKNET_CAIP_IDS)[keyof typeof STARKNET_CAIP_IDS];
export type StarknetLegacyCaipId = "starknet:mainnet" | "starknet:sepolia";

const STARKNET_LEGACY_BY_CANONICAL: Record<
  StarknetCaipId,
  StarknetLegacyCaipId
> = {
  "starknet:SN_MAIN": "starknet:mainnet",
  "starknet:SN_SEPOLIA": "starknet:sepolia",
};

const STARKNET_CANONICAL_BY_LEGACY: Record<
  StarknetLegacyCaipId,
  StarknetCaipId
> = {
  "starknet:mainnet": "starknet:SN_MAIN",
  "starknet:sepolia": "starknet:SN_SEPOLIA",
};

/** @deprecated Use EvmNetworkConfig instead */
export type NetworkConfig = EvmNetworkConfig;
/** @deprecated Use EvmNetworkName instead */
export type NetworkName = EvmNetworkName;

// ============================================================================
// Network Registry
// ============================================================================

export const EVM_NETWORKS = {
  // Base
  base: {
    chainId: 8453,
    caip: "eip155:8453",
    alchemy: "base-mainnet.g.alchemy.com/v2",
    infura: "base-mainnet.infura.io/v3",
    public: "https://mainnet.base.org",
  },
  "base-sepolia": {
    chainId: 84532,
    caip: "eip155:84532",
    alchemy: "base-sepolia.g.alchemy.com/v2",
    infura: "base-sepolia.infura.io/v3",
    public: "https://sepolia.base.org",
  },

  // Ethereum
  ethereum: {
    chainId: 1,
    caip: "eip155:1",
    alchemy: "eth-mainnet.g.alchemy.com/v2",
    infura: "mainnet.infura.io/v3",
    public: "https://eth.drpc.org",
  },
  sepolia: {
    chainId: 11155111,
    caip: "eip155:11155111",
    alchemy: "eth-sepolia.g.alchemy.com/v2",
    infura: "sepolia.infura.io/v3",
    public: "https://rpc.sepolia.org",
  },

  // Polygon
  polygon: {
    chainId: 137,
    caip: "eip155:137",
    alchemy: "polygon-mainnet.g.alchemy.com/v2",
    infura: "polygon-mainnet.infura.io/v3",
    public: "https://polygon-rpc.com",
  },
  "polygon-amoy": {
    chainId: 80002,
    caip: "eip155:80002",
    alchemy: "polygon-amoy.g.alchemy.com/v2",
    public: "https://rpc-amoy.polygon.technology",
  },

  // Gnosis
  gnosis: {
    chainId: 100,
    caip: "eip155:100",
    alchemy: "gno-mainnet.g.alchemy.com/v2",
    public: "https://rpc.gnosischain.com",
  },

  // Arbitrum
  arbitrum: {
    chainId: 42161,
    caip: "eip155:42161",
    alchemy: "arb-mainnet.g.alchemy.com/v2",
    infura: "arbitrum-mainnet.infura.io/v3",
    public: "https://arb1.arbitrum.io/rpc",
  },
  "arbitrum-sepolia": {
    chainId: 421614,
    caip: "eip155:421614",
    alchemy: "arb-sepolia.g.alchemy.com/v2",
    public: "https://sepolia-rollup.arbitrum.io/rpc",
  },

  // Optimism
  optimism: {
    chainId: 10,
    caip: "eip155:10",
    alchemy: "opt-mainnet.g.alchemy.com/v2",
    infura: "optimism-mainnet.infura.io/v3",
    public: "https://mainnet.optimism.io",
  },
  "optimism-sepolia": {
    chainId: 11155420,
    caip: "eip155:11155420",
    alchemy: "opt-sepolia.g.alchemy.com/v2",
    public: "https://sepolia.optimism.io",
  },

  // Scroll
  scroll: {
    chainId: 534352,
    caip: "eip155:534352",
    alchemy: "scroll-mainnet.g.alchemy.com/v2",
    public: "https://rpc.scroll.io",
  },
  "scroll-sepolia": {
    chainId: 534351,
    caip: "eip155:534351",
    alchemy: "scroll-sepolia.g.alchemy.com/v2",
    public: "https://sepolia-rpc.scroll.io",
  },

  // Avalanche
  avalanche: {
    chainId: 43114,
    caip: "eip155:43114",
    alchemy: "avax-mainnet.g.alchemy.com/v2",
    public: "https://api.avax.network/ext/bc/C/rpc",
  },
  "avalanche-fuji": {
    chainId: 43113,
    caip: "eip155:43113",
    alchemy: "avax-fuji.g.alchemy.com/v2",
    public: "https://api.avax-test.network/ext/bc/C/rpc",
  },

  // BNB Smart Chain
  bsc: {
    chainId: 56,
    caip: "eip155:56",
    alchemy: "bnb-mainnet.g.alchemy.com/v2",
    public: "https://bsc-dataseed.binance.org",
  },
  "bsc-testnet": {
    chainId: 97,
    caip: "eip155:97",
    public: "https://data-seed-prebsc-1-s1.binance.org:8545",
  },

  // Abstract
  abstract: {
    chainId: 2741,
    caip: "eip155:2741",
    alchemy: "abstract-mainnet.g.alchemy.com/v2",
    public: "https://api.mainnet.abs.xyz",
  },
  "abstract-testnet": {
    chainId: 11124,
    caip: "eip155:11124",
    alchemy: "abstract-testnet.g.alchemy.com/v2",
    public: "https://api.testnet.abs.xyz",
  },

  // Monad
  monad: {
    chainId: 143,
    caip: "eip155:143",
    public: "https://rpc.monad.xyz",
  },
  "monad-testnet": {
    chainId: 10143,
    caip: "eip155:10143",
    public: "https://testnet-rpc.monad.xyz",
  },
} as const satisfies Record<string, EvmNetworkConfig>;

// ============================================================================
// Starknet Network Registry
// ============================================================================

export const STARKNET_NETWORKS = {
  "starknet-mainnet": {
    caip: STARKNET_CAIP_IDS.MAINNET,
    alchemy: "starknet-mainnet.g.alchemy.com/v2",
    public: "https://starknet-mainnet.public.blastapi.io",
  },
  "starknet-sepolia": {
    caip: STARKNET_CAIP_IDS.SEPOLIA,
    alchemy: "starknet-sepolia.g.alchemy.com/v2",
    public: "https://starknet-sepolia.public.blastapi.io",
  },
} as const satisfies Record<string, StarknetNetworkConfig>;

// ============================================================================
// SVM (Solana) Network Registry
// ============================================================================

export const SVM_NETWORKS = {
  "solana-mainnet": {
    caip: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    helius: "mainnet.helius-rpc.com",
    public: "https://api.mainnet-beta.solana.com",
  },
  "solana-devnet": {
    caip: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    helius: "devnet.helius-rpc.com",
    public: "https://api.devnet.solana.com",
  },
  "solana-testnet": {
    caip: "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
    helius: "testnet.helius-rpc.com",
    public: "https://api.testnet.solana.com",
  },
} as const satisfies Record<string, SvmNetworkConfig>;

/** Common shorthand aliases for SVM networks */
const SVM_ALIASES: Record<string, string> = {
  solana: "solana-mainnet",
};

// ============================================================================
// EVM Helpers
// ============================================================================

/**
 * Check if a network supports v1 scheme (from @x402/evm)
 */
export function supportsV1(network: string): boolean {
  if (V1_NETWORKS.includes(network)) return true;

  const direct = getNetwork(network);
  if (direct) {
    return (
      V1_NETWORKS.includes(direct.caip) ||
      V1_NETWORKS.includes(String(direct.chainId))
    );
  }

  // Handle CAIP or chainId input by mapping back to a known network name.
  const entries = Object.entries(EVM_NETWORKS) as Array<
    [string, EvmNetworkConfig]
  >;
  for (const [name, config] of entries) {
    if (config.caip === network || String(config.chainId) === network) {
      return (
        V1_NETWORKS.includes(name) ||
        V1_NETWORKS.includes(config.caip) ||
        V1_NETWORKS.includes(String(config.chainId))
      );
    }
  }

  return false;
}

/**
 * Get all network names that support v1
 */
export function getV1Networks(): string[] {
  return Object.keys(EVM_NETWORKS).filter((name) => supportsV1(name));
}

/**
 * Get network config by name
 */
export function getNetwork(name: string): NetworkConfig | undefined {
  return EVM_NETWORKS[name as NetworkName];
}

/**
 * Get CAIP-2 identifier for a network
 */
export function getNetworkCaip(name: string): string | undefined {
  return getNetwork(name)?.caip;
}

/**
 * Resolve RPC URL for a network
 *
 * Priority:
 * 1. Explicit override from env (EVM_RPC_URL_BASE, etc.)
 * 2. Alchemy URL (if ALCHEMY_API_KEY is set)
 * 3. Infura URL (if INFURA_API_KEY is set)
 * 4. Public RPC fallback
 *
 * @param network - Network name (e.g., "base", "base-sepolia")
 * @param options - Optional overrides for API keys
 */
export function resolveRpcUrl(
  network: string,
  options?: {
    alchemyApiKey?: string;
    infuraApiKey?: string;
    explicitUrl?: string;
  }
): string | undefined {
  const config = getNetwork(network);
  if (!config) return undefined;

  // 1. Explicit override
  if (options?.explicitUrl) {
    return options.explicitUrl;
  }

  // 2. Alchemy
  if (options?.alchemyApiKey && config.alchemy) {
    return `https://${config.alchemy}/${options.alchemyApiKey}`;
  }

  // 3. Infura
  if (options?.infuraApiKey && config.infura) {
    return `https://${config.infura}/${options.infuraApiKey}`;
  }

  // 4. Public fallback
  return config.public;
}

// ============================================================================
// Starknet Helpers
// ============================================================================

/**
 * Normalize a Starknet CAIP identifier to the canonical (SN_*) form.
 */
export function toStarknetCanonicalCaip(
  caip: string
): StarknetCaipId | undefined {
  if (caip in STARKNET_LEGACY_BY_CANONICAL) {
    return caip as StarknetCaipId;
  }
  if (caip in STARKNET_CANONICAL_BY_LEGACY) {
    return STARKNET_CANONICAL_BY_LEGACY[caip as StarknetLegacyCaipId];
  }
  return undefined;
}

/**
 * Normalize a Starknet CAIP identifier to the legacy (lowercase) form.
 */
export function toStarknetLegacyCaip(
  caip: string
): StarknetLegacyCaipId | undefined {
  if (caip in STARKNET_CANONICAL_BY_LEGACY) {
    return caip as StarknetLegacyCaipId;
  }
  if (caip in STARKNET_LEGACY_BY_CANONICAL) {
    return STARKNET_LEGACY_BY_CANONICAL[caip as StarknetCaipId];
  }
  return undefined;
}

/**
 * Get Starknet network config by name
 */
export function getStarknetNetwork(
  name: string
): StarknetNetworkConfig | undefined {
  return STARKNET_NETWORKS[name as StarknetNetworkName];
}

/**
 * Get CAIP-2 identifier for a Starknet network
 */
export function getStarknetNetworkCaip(
  name: string
): StarknetCaipId | undefined {
  return getStarknetNetwork(name)?.caip;
}

/**
 * Resolve RPC URL for a Starknet network
 *
 * Priority:
 * 1. Explicit override from env (STARKNET_RPC_URL_STARKNET_MAINNET, etc.)
 * 2. Alchemy URL (if ALCHEMY_API_KEY is set)
 * 3. Public RPC fallback
 *
 * @param network - Network name (e.g., "starknet-mainnet")
 * @param options - Optional overrides for API keys
 */
export function resolveStarknetRpcUrl(
  network: string,
  options?: {
    alchemyApiKey?: string;
    explicitUrl?: string;
  }
): string | undefined {
  const config = getStarknetNetwork(network);
  if (!config) return undefined;

  // 1. Explicit override
  if (options?.explicitUrl) {
    return options.explicitUrl;
  }

  // 2. Alchemy
  if (options?.alchemyApiKey && config.alchemy) {
    return `https://${config.alchemy}/${options.alchemyApiKey}`;
  }

  // 3. Public fallback
  return config.public;
}

/**
 * Validate Starknet network names and return valid ones
 */
export function validateStarknetNetworks(networks: string[]): string[] {
  const valid: string[] = [];
  for (const name of networks) {
    if (getStarknetNetwork(name)) {
      valid.push(name);
    } else {
      console.warn(`⚠️  Unknown Starknet network "${name}" - skipping`);
    }
  }
  return valid;
}

// ============================================================================
// SVM Helpers
// ============================================================================

/**
 * Get SVM network config by name
 */
export function getSvmNetwork(name: string): SvmNetworkConfig | undefined {
  return SVM_NETWORKS[name as SvmNetworkName];
}

/**
 * Get CAIP-2 identifier for a Solana network
 */
export function getSvmNetworkCaip(name: string): string | undefined {
  return getSvmNetwork(name)?.caip;
}

/**
 * Resolve RPC URL for a Solana network
 *
 * Priority:
 * 1. Explicit override from env (SVM_RPC_URL_SOLANA_MAINNET, etc.)
 * 2. Helius URL (if HELIUS_API_KEY is set)
 * 3. Public RPC fallback
 *
 * @param network - Network name (e.g., "solana-mainnet", "solana-devnet")
 * @param options - Optional overrides for API keys
 */
export function resolveSvmRpcUrl(
  network: string,
  options?: {
    heliusApiKey?: string;
    explicitUrl?: string;
  }
): string | undefined {
  const config = getSvmNetwork(network);
  if (!config) return undefined;

  // 1. Explicit override
  if (options?.explicitUrl) {
    return options.explicitUrl;
  }

  // 2. Helius
  if (options?.heliusApiKey && config.helius) {
    return `https://${config.helius}/?api-key=${options.heliusApiKey}`;
  }

  // 3. Public fallback
  return config.public;
}

/**
 * Validate SVM network names and return valid ones
 */
export function validateSvmNetworks(networks: string[]): string[] {
  const valid: string[] = [];
  for (const name of networks) {
    const resolved = SVM_ALIASES[name] ?? name;
    if (getSvmNetwork(resolved)) {
      valid.push(resolved);
    } else {
      console.warn(`⚠️  Unknown SVM network "${name}" - skipping`);
    }
  }
  return valid;
}

// ============================================================================
// Common Helpers
// ============================================================================

/**
 * Parse network list from comma-separated string
 * @example parseNetworkList("base,base-sepolia") => ["base", "base-sepolia"]
 */
export function parseNetworkList(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * Validate network names and return valid ones
 * Logs warnings for unknown networks
 */
export function validateNetworks(networks: string[]): string[] {
  const valid: string[] = [];
  for (const name of networks) {
    if (getNetwork(name)) {
      valid.push(name);
    } else {
      console.warn(`⚠️  Unknown network "${name}" - skipping`);
    }
  }
  return valid;
}
