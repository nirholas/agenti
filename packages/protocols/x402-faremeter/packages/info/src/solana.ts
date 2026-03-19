import { type UnitInput, addX402PaymentRequirementDefaults } from "./common";
import {
  type SolanaCluster,
  type SolanaCAIP2Network,
  Base58Address,
  isSolanaCluster,
  isSolanaCAIP2Network,
  isSolanaCAIP2NetworkString,
  createSolanaNetwork,
} from "@faremeter/types/solana";

export type { SolanaCluster, SolanaCAIP2Network };

export type KnownCluster = SolanaCluster;

export {
  isSolanaCluster,
  isSolanaCAIP2Network,
  isSolanaCAIP2NetworkString,
  createSolanaNetwork,
};

export function isKnownCluster(c: string): c is KnownCluster {
  return isSolanaCluster(c);
}

export const SOLANA_MAINNET_BETA = createSolanaNetwork(
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "mainnet-beta",
);

export const SOLANA_DEVNET = createSolanaNetwork(
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "devnet",
);

export const SOLANA_TESTNET = createSolanaNetwork(
  "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
  "testnet",
);

type NamedSolanaNetwork = SolanaCAIP2Network & { readonly name: SolanaCluster };

type KnownSolanaNetworkInfo = {
  network: NamedSolanaNetwork;
  legacyNetworkIds: readonly string[];
};

const knownSolanaNetworks: Record<string, KnownSolanaNetworkInfo> = {
  [SOLANA_MAINNET_BETA.caip2]: {
    network: SOLANA_MAINNET_BETA as NamedSolanaNetwork,
    legacyNetworkIds: ["solana-mainnet-beta", "solana"],
  },
  [SOLANA_DEVNET.caip2]: {
    network: SOLANA_DEVNET as NamedSolanaNetwork,
    legacyNetworkIds: ["solana-devnet"],
  },
  [SOLANA_TESTNET.caip2]: {
    network: SOLANA_TESTNET as NamedSolanaNetwork,
    legacyNetworkIds: ["solana-testnet"],
  },
};

/**
 * Type guard that checks if a string is a known Solana CAIP-2 network.
 *
 * @param n - The string to check
 * @returns True if the string is a known Solana CAIP-2 network identifier
 */
export function isKnownSolanaCAIP2Network(n: string): boolean {
  return n in knownSolanaNetworks;
}

const clusterToNetworkMap = new Map<SolanaCluster, SolanaCAIP2Network>(
  Object.values(knownSolanaNetworks).map((info) => [
    info.network.name,
    info.network,
  ]),
);

const legacyNetworkIdToNetworkMap = new Map<string, SolanaCAIP2Network>();
for (const info of Object.values(knownSolanaNetworks)) {
  for (const legacyId of info.legacyNetworkIds) {
    legacyNetworkIdToNetworkMap.set(legacyId, info.network);
  }
}

/**
 * Converts a Solana cluster name to a SolanaCAIP2Network object.
 *
 * @param cluster - The Solana cluster name
 * @returns The corresponding SolanaCAIP2Network object
 * @throws Error if the cluster is unknown
 */
export function clusterToCAIP2(cluster: SolanaCluster): SolanaCAIP2Network {
  const network = clusterToNetworkMap.get(cluster);
  if (!network) {
    throw new Error(`Unknown Solana cluster: ${cluster}`);
  }
  return network;
}

/**
 * Converts a CAIP-2 network identifier to Solana cluster name.
 *
 * @param caip2 - The CAIP-2 network identifier string
 * @returns The cluster name, or null if not a known Solana network
 */
export function caip2ToCluster(caip2: string): SolanaCluster | null {
  const info = knownSolanaNetworks[caip2];
  if (!info) {
    return null;
  }
  return info.network.name;
}

/**
 * Converts a legacy Solana network ID to a SolanaCAIP2Network object.
 *
 * @param legacy - Legacy network identifier (e.g., "solana-mainnet-beta")
 * @returns The SolanaCAIP2Network object, or null if unknown
 */
export function legacyNetworkIdToCAIP2(
  legacy: string,
): SolanaCAIP2Network | null {
  return legacyNetworkIdToNetworkMap.get(legacy) ?? null;
}

/**
 * Converts a CAIP-2 network identifier to legacy Solana network IDs.
 *
 * @param caip2 - The CAIP-2 network identifier string
 * @returns Array of legacy network IDs, or null if unknown
 */
export function caip2ToLegacyNetworkIds(
  caip2: string,
): readonly string[] | null {
  const info = knownSolanaNetworks[caip2];
  if (!info) {
    return null;
  }
  return info.legacyNetworkIds;
}

/**
 * Normalizes a Solana network identifier to CAIP-2 format string.
 *
 * Accepts cluster names, legacy IDs, or CAIP-2 identifiers.
 * Returns the input unchanged if no mapping exists.
 *
 * @param network - The network identifier in any supported format
 * @returns The CAIP-2 network identifier string, or the original string if unrecognized
 */
export function normalizeNetworkId(network: string): string {
  if (isSolanaCAIP2NetworkString(network)) {
    return network;
  }

  if (isSolanaCluster(network)) {
    return clusterToCAIP2(network).caip2;
  }

  const networkObj = legacyNetworkIdToCAIP2(network);
  if (networkObj) {
    return networkObj.caip2;
  }

  return network;
}

/**
 * Looks up the x402 network identifier for a Solana cluster.
 *
 * Accepts a cluster name, CAIP-2 identifier string, legacy network ID,
 * or an existing SolanaCAIP2Network object.
 *
 * @param network - Cluster name, CAIP-2 ID, legacy network ID, or SolanaCAIP2Network object
 * @returns A SolanaCAIP2Network object
 * @throws Error if the network is unknown or invalid
 */
export function lookupX402Network(
  network: string | SolanaCAIP2Network,
): SolanaCAIP2Network {
  if (isSolanaCAIP2Network(network)) {
    return network;
  }

  if (isSolanaCluster(network)) {
    return clusterToCAIP2(network);
  }

  if (isSolanaCAIP2NetworkString(network)) {
    const known = knownSolanaNetworks[network];
    if (known) {
      return known.network;
    }
    return createSolanaNetwork(network);
  }

  const networkObj = legacyNetworkIdToCAIP2(network);
  if (networkObj) {
    return networkObj;
  }

  throw new Error(`Unknown Solana network: ${network}`);
}

/**
 * Gets the v1 legacy network IDs for a Solana cluster.
 *
 * @param cluster - The Solana cluster name
 * @returns Array of legacy network IDs for v1 compatibility
 */
export function getV1NetworkIds(cluster: KnownCluster): string[] {
  const network = clusterToCAIP2(cluster);
  const legacyIds = caip2ToLegacyNetworkIds(network.caip2) ?? [];
  return [...legacyIds];
}

type SPLTokenInfo = {
  cluster: Partial<Record<KnownCluster, { address: Base58Address }>>;
  toUnit: (v: UnitInput) => string;
};

const knownSPLTokens = {
  USDC: {
    cluster: {
      "mainnet-beta": {
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      },
      devnet: {
        address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      },
    },
    toUnit: (v: UnitInput) => v.toString(),
  },
} as const satisfies Record<string, SPLTokenInfo>;

export type KnownSPLToken = keyof typeof knownSPLTokens;

/**
 * Looks up SPL token information by cluster and token name.
 *
 * @param cluster - The Solana cluster
 * @param name - The known SPL token name (e.g., "USDC")
 * @returns Token information including address, or undefined if not found
 */
export function lookupKnownSPLToken(
  cluster: KnownCluster,
  name: KnownSPLToken,
) {
  const splTokenInfo: SPLTokenInfo = knownSPLTokens[name];

  if (!splTokenInfo) {
    return;
  }

  const networkInfo = splTokenInfo.cluster[cluster];

  if (!networkInfo) {
    return;
  }

  return {
    ...networkInfo,
    cluster,
    name,
    toUnit: splTokenInfo.toUnit,
  };
}

/**
 * Type guard that checks if a string is a known SPL token name.
 *
 * @param splToken - The string to check
 * @returns True if the string is a known SPL token
 */
export function isKnownSPLToken(splToken: string): splToken is KnownSPLToken {
  return splToken in knownSPLTokens;
}

export type x402ExactArgs = {
  network: KnownCluster;
  asset: KnownSPLToken;
  amount: UnitInput;
  payTo: Base58Address;
};

/**
 * Creates x402 exact payment requirements for Solana.
 *
 * Returns multiple requirements for v1 compatibility (one per legacy network ID).
 *
 * @param args - Payment configuration including network, asset, amount, and payTo
 * @returns Array of x402 payment requirements
 */
export function x402Exact(args: x402ExactArgs) {
  const tokenInfo = lookupKnownSPLToken(args.network, args.asset);

  if (!tokenInfo) {
    throw new Error(`couldn't look up token '${args.asset}' on Solana cluster`);
  }

  const networks = getV1NetworkIds(args.network);

  const req = networks.map((network) =>
    addX402PaymentRequirementDefaults({
      scheme: "exact",
      network,
      maxAmountRequired: tokenInfo.toUnit(args.amount),
      payTo: args.payTo,
      asset: tokenInfo.address,
      maxTimeoutSeconds: 60,
    }),
  );

  return req;
}

export type xSolanaSettlementArgs = {
  network: KnownCluster;
  asset: KnownSPLToken | "sol";
  amount: UnitInput;
  payTo: Base58Address;
};

/**
 * Creates x-solana-settlement payment requirements.
 *
 * Supports both SPL tokens and native SOL.
 *
 * @param args - Payment configuration including network, asset, amount, and payTo
 * @returns x402 payment requirement for the settlement scheme
 */
export function xSolanaSettlement(args: xSolanaSettlementArgs) {
  let tokenInfo;

  // Special-case SOL, because it is not an SPL Token.
  if (args.asset === "sol") {
    tokenInfo = {
      address: "sol",
      toUnit: (x: UnitInput) => x.toString(),
    };
  } else {
    tokenInfo = lookupKnownSPLToken(args.network, args.asset);
  }

  if (!tokenInfo) {
    throw new Error(`couldn't look up token '${args.asset}' on Solana cluster`);
  }

  const req = addX402PaymentRequirementDefaults({
    scheme: "@faremeter/x-solana-settlement",
    network: args.network,
    maxAmountRequired: tokenInfo.toUnit(args.amount),
    payTo: args.payTo,
    asset: tokenInfo.address,
    maxTimeoutSeconds: 60,
  });

  return req;
}
