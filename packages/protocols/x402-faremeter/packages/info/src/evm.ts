import { type UnitInput, addX402PaymentRequirementDefaults } from "./common";
import { Address } from "@faremeter/types/evm";

const knownX402Networks = {
  "eip155:8453": { legacyName: "base", chainId: 8453 },
  "eip155:84532": { legacyName: "base-sepolia", chainId: 84532 },
  "eip155:1444673419": {
    legacyName: "skale-europa-testnet",
    chainId: 1444673419,
  },
  "eip155:137": { legacyName: "polygon", chainId: 137 },
  "eip155:80002": { legacyName: "polygon-amoy", chainId: 80002 },
  "eip155:143": { legacyName: "monad", chainId: 143 },
  "eip155:10143": { legacyName: "monad-testnet", chainId: 10143 },
  "eip155:324705682": { legacyName: "skale-base-sepolia", chainId: 324705682 },
  "eip155:1187947933": { legacyName: "skale-base", chainId: 1187947933 },
} as const;

type KnownX402Networks = typeof knownX402Networks;
export type CAIP2Network = keyof KnownX402Networks;
export type LegacyNetworkName = KnownX402Networks[CAIP2Network]["legacyName"];

const legacyNameToCAIP2Map = new Map<string, CAIP2Network>(
  Object.entries(knownX402Networks).map(([caip2, info]) => [
    info.legacyName,
    caip2 as CAIP2Network,
  ]),
);

/**
 * Converts an EVM chain ID to CAIP-2 network identifier.
 *
 * @param chainId - The EVM chain ID
 * @returns The CAIP-2 network identifier (eip155:chainId)
 */
export function chainIdToCAIP2(chainId: number): string {
  return `eip155:${chainId}`;
}

/**
 * Extracts the EVM chain ID from a CAIP-2 network identifier.
 *
 * @param caip2 - The CAIP-2 network identifier
 * @returns The chain ID, or null if not a valid eip155 identifier
 */
export function caip2ToChainId(caip2: string): number | null {
  const match = /^eip155:(\d+)$/.exec(caip2);
  if (!match?.[1]) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Converts a legacy EVM network name to CAIP-2 format.
 *
 * @param legacy - Legacy network name (e.g., "base", "polygon")
 * @returns The CAIP-2 network identifier, or null if unknown
 */
export function legacyNameToCAIP2(legacy: string): string | null {
  return legacyNameToCAIP2Map.get(legacy) ?? null;
}

/**
 * Converts a CAIP-2 network identifier to legacy EVM network name.
 *
 * @param caip2 - The CAIP-2 network identifier
 * @returns The legacy network name, or null if unknown
 */
export function caip2ToLegacyName(caip2: string): string | null {
  const network = knownX402Networks[caip2 as CAIP2Network];
  return network?.legacyName ?? null;
}

/**
 * Normalizes an EVM network identifier to CAIP-2 format.
 *
 * Accepts chain IDs (number or string), legacy names, or CAIP-2 identifiers.
 * Returns the input unchanged if no mapping exists.
 *
 * @param network - The network identifier in any supported format
 * @returns The CAIP-2 network identifier
 */
export function normalizeNetworkId(network: string | number): string {
  if (typeof network === "number") {
    return chainIdToCAIP2(network);
  }

  if (network.startsWith("eip155:")) {
    return network;
  }

  const caip2 = legacyNameToCAIP2(network);
  if (caip2) {
    return caip2;
  }

  const chainId = parseInt(network, 10);
  if (!isNaN(chainId)) {
    return chainIdToCAIP2(chainId);
  }

  return network;
}

/**
 * Type guard that checks if a string is a known EVM CAIP-2 network.
 *
 * @param n - The string to check
 * @returns True if the string is a known EVM CAIP-2 network identifier
 */
export function isKnownCAIP2Network(n: string): n is CAIP2Network {
  return n in knownX402Networks;
}

/**
 * Looks up network information by CAIP-2 identifier.
 *
 * @param n - The CAIP-2 network identifier
 * @returns Network information including legacy name and chain ID
 */
export function lookupKnownCAIP2Network(n: CAIP2Network) {
  return {
    ...knownX402Networks[n],
    caip2: n,
  };
}

/**
 * Looks up the x402 network identifier for an EVM chain ID.
 *
 * @param chainId - The EVM chain ID
 * @returns The CAIP-2 network identifier
 */
export function lookupX402Network(chainId: number): string {
  return chainIdToCAIP2(chainId);
}

export type ContractInfo = {
  address: Address;
  contractName: string;
  forwarder?: Address;
  forwarderName?: string;
  forwarderVersion?: string;
};

type AssetInfo = {
  network: Partial<Record<string, ContractInfo>>;
  toUnit: (v: UnitInput) => string;
};

const knownAssets = {
  USDC: {
    network: {
      "eip155:84532": {
        address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
        contractName: "USDC",
      },
      "eip155:8453": {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        contractName: "USD Coin",
      },
      "eip155:1444673419": {
        address: "0x9eAb55199f4481eCD7659540A17Af618766b07C4",
        contractName: "USDC",
        forwarder: "0x7779B0d1766e6305E5f8081E3C0CDF58FcA24330",
        forwarderName: "USDC Forwarder",
        forwarderVersion: "1",
      },
      // Polygon PoS
      "eip155:137": {
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        contractName: "USD Coin",
      },
      // Polygon PoS Amoy
      "eip155:80002": {
        address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
        contractName: "USDC",
      },
      // Monad Mainnet
      "eip155:143": {
        address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
        contractName: "USDC",
      },
      // Monad Testnet
      "eip155:10143": {
        address: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
        contractName: "USDC",
      },
      "eip155:324705682": {
        address: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
        contractName: "Bridged USDC (SKALE Bridge)",
      },
      "eip155:1187947933": {
        address: "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20",
        contractName: "Bridged USDC (SKALE Bridge)",
      },
    },
    toUnit: (v: UnitInput) => v.toString(),
  },
} as const satisfies Record<string, AssetInfo>;

export type KnownAsset = keyof typeof knownAssets;

/**
 * Looks up asset information by network and asset name.
 *
 * @param network - The network identifier (chain ID, CAIP-2, or legacy name)
 * @param name - The known asset name (e.g., "USDC")
 * @returns Asset information including contract address, or undefined if not found
 */
export function lookupKnownAsset(network: string | number, name: KnownAsset) {
  const assetInfo: AssetInfo = knownAssets[name];

  if (!assetInfo) {
    return;
  }

  const caip2Network = normalizeNetworkId(network);
  const contractInfo = assetInfo.network[caip2Network];

  if (!contractInfo) {
    return;
  }

  return {
    ...contractInfo,
    name,
    network: caip2Network,
    toUnit: assetInfo.toUnit,
  };
}

/**
 * Type guard that checks if a string is a known EVM asset name.
 *
 * @param asset - The string to check
 * @returns True if the string is a known asset name
 */
export function isKnownAsset(asset: string): asset is KnownAsset {
  return asset in knownAssets;
}

export type AssetNameOrContractInfo = string | ContractInfo;

/**
 * Finds asset information by network and asset name or contract info.
 *
 * @param network - The network identifier
 * @param assetNameOrInfo - Asset name (e.g., "USDC") or direct ContractInfo
 * @returns Contract information for the asset
 * @throws Error if the asset is unknown or not found on the network
 */
export function findAssetInfo(
  network: string | number,
  assetNameOrInfo: AssetNameOrContractInfo,
) {
  let assetInfo: ContractInfo;
  const caip2Network = normalizeNetworkId(network);

  if (typeof assetNameOrInfo == "string") {
    if (!isKnownAsset(assetNameOrInfo)) {
      throw new Error(`Unknown asset: ${assetNameOrInfo}`);
    }

    const t = lookupKnownAsset(caip2Network, assetNameOrInfo);

    if (!t) {
      throw new Error(
        `Couldn't look up asset ${assetNameOrInfo} on ${caip2Network}`,
      );
    }

    assetInfo = t;
  } else {
    assetInfo = assetNameOrInfo;
  }

  return assetInfo;
}

export type x402ExactArgs = {
  network: string | number;
  asset: KnownAsset;
  amount: UnitInput;
  payTo: Address;
};

/**
 * Creates x402 exact payment requirements for EVM.
 *
 * @param args - Payment configuration including network, asset, amount, and payTo
 * @returns x402 payment requirement for the exact scheme
 */
export function x402Exact(args: x402ExactArgs) {
  const tokenInfo = lookupKnownAsset(args.network, args.asset);

  if (!tokenInfo) {
    throw new Error(`couldn't look up token '${args.asset}' on EVM chain`);
  }

  const req = addX402PaymentRequirementDefaults({
    scheme: "exact",
    network: tokenInfo.network,
    maxAmountRequired: tokenInfo.toUnit(args.amount),
    payTo: args.payTo,
    asset: tokenInfo.address,
    maxTimeoutSeconds: 300,
  });

  return req;
}
