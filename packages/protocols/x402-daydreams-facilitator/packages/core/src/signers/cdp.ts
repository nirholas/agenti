/**
 * CDP (Coinbase Developer Platform) Signer Adapter
 *
 * This module provides an adapter to use CDP SDK accounts as x402 facilitator signers.
 */

import type { CdpClient, EvmServerAccount } from "@coinbase/cdp-sdk";
import { toFacilitatorEvmSigner, type FacilitatorEvmSigner } from "@x402/evm";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
} from "viem";
import {
  abstract,
  abstractTestnet,
  arbitrum,
  arbitrumSepolia,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  gnosis,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  scroll,
  scrollSepolia,
  sepolia,
} from "viem/chains";

// ============================================================================
// Custom Chain Definitions
// ============================================================================

const monad = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://explorer.monad.xyz' },
  },
});

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Testnet Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
});

// ============================================================================
// Types
// ============================================================================

/** CDP network identifiers - CDP supports all EVM networks */
export type CdpNetwork =
  | "abstract"
  | "abstract-testnet"
  | "arbitrum"
  | "arbitrum-sepolia"
  | "avalanche"
  | "avalanche-fuji"
  | "base"
  | "base-sepolia"
  | "bsc"
  | "bsc-testnet"
  | "ethereum"
  | "ethereum-sepolia"
  | "gnosis"
  | "monad"
  | "monad-testnet"
  | "optimism"
  | "optimism-sepolia"
  | "polygon"
  | "polygon-amoy"
  | "scroll"
  | "scroll-sepolia"
  | (string & {}); // Allow any string for forward compatibility

/** Configuration for creating a CDP signer */
export interface CdpSignerConfig {
  /** The CDP client instance */
  cdpClient: CdpClient;
  /** The CDP EVM account (from cdp.evm.getOrCreateAccount) */
  account: EvmServerAccount;
  /** The CDP network name (e.g., "base", "base-sepolia") */
  network: CdpNetwork;
  /** Optional custom RPC URL for the public client */
  rpcUrl?: string;
}

// ============================================================================
// Network Mapping
// ============================================================================

/** Map CAIP-2 chain IDs to CDP network names */
const CAIP2_TO_CDP_NETWORK: Record<number, CdpNetwork> = {
  1: "ethereum",
  10: "optimism",
  56: "bsc",
  97: "bsc-testnet",
  100: "gnosis",
  137: "polygon",
  143: "monad",
  2741: "abstract",
  8453: "base",
  10143: "monad-testnet",
  11124: "abstract-testnet",
  11155111: "ethereum-sepolia",
  11155420: "optimism-sepolia",
  42161: "arbitrum",
  43113: "avalanche-fuji",
  43114: "avalanche",
  80002: "polygon-amoy",
  84532: "base-sepolia",
  421614: "arbitrum-sepolia",
  534351: "scroll-sepolia",
  534352: "scroll",
};

/** Map CDP network names to viem Chain configs */
const CDP_NETWORK_TO_CHAIN: Record<string, Chain> = {
  abstract: abstract,
  "abstract-testnet": abstractTestnet,
  arbitrum: arbitrum,
  "arbitrum-sepolia": arbitrumSepolia,
  avalanche: avalanche,
  "avalanche-fuji": avalancheFuji,
  base: base,
  "base-sepolia": baseSepolia,
  bsc: bsc,
  "bsc-testnet": bscTestnet,
  ethereum: mainnet,
  "ethereum-sepolia": sepolia,
  gnosis: gnosis,
  monad: monad,
  "monad-testnet": monadTestnet,
  optimism: optimism,
  "optimism-sepolia": optimismSepolia,
  polygon: polygon,
  "polygon-amoy": polygonAmoy,
  scroll: scroll,
  "scroll-sepolia": scrollSepolia,
};

/**
 * Convert CAIP-2 network string to CDP network name
 * @example caip2ToCdpNetwork("eip155:8453") // => "base"
 */
export function caip2ToCdpNetwork(caip2: string): CdpNetwork | null {
  const match = caip2.match(/^eip155:(\d+)$/);
  if (!match) return null;
  const chainId = parseInt(match[1], 10);
  return CAIP2_TO_CDP_NETWORK[chainId] ?? null;
}

/**
 * Get the chain ID from a CAIP-2 network string
 * @example getChainIdFromCaip2("eip155:8453") // => 8453
 */
export function getChainIdFromCaip2(caip2: string): number | null {
  const match = caip2.match(/^eip155:(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// ============================================================================
// CDP Signer Factory
// ============================================================================

/**
 * Creates a FacilitatorEvmSigner from a CDP SDK account.
 *
 * This adapter bridges the CDP SDK's transaction signing with the
 * x402 facilitator's expected signer interface.
 *
 * @example
 * ```typescript
 * import { CdpClient } from "@coinbase/cdp-sdk";
 * import { createCdpEvmSigner } from "./signers/cdp.js";
 * import { createFacilitator } from "./setup.js";
 *
 * const cdp = new CdpClient();
 * const account = await cdp.evm.getOrCreateAccount({ name: "facilitator" });
 *
 * const cdpSigner = createCdpEvmSigner({
 *   cdpClient: cdp,
 *   account,
 *   network: "base",
 *   rpcUrl: process.env.EVM_RPC_URL_BASE,
 * });
 *
 * const facilitator = createFacilitator({
 *   evmSigners: [{ signer: cdpSigner, networks: "eip155:8453" }],
 * });
 * ```
 */
export function createCdpEvmSigner(config: CdpSignerConfig): FacilitatorEvmSigner {
  const { cdpClient, account, network, rpcUrl } = config;

  const chain = CDP_NETWORK_TO_CHAIN[network];
  if (!chain) {
    throw new Error(`Unsupported CDP network: ${network}`);
  }

  // Create a public client for read operations
  const publicClient: PublicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Use toFacilitatorEvmSigner to wrap with getAddresses() support
  return toFacilitatorEvmSigner({
    address: account.address as Address,

    /**
     * Get bytecode at an address (for contract detection)
     */
    getCode: async (args: { address: Address }) => {
      return publicClient.getCode({ address: args.address });
    },

    /**
     * Read from a contract (view/pure functions)
     */
    readContract: async (args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) => {
      return publicClient.readContract({
        address: args.address,
        abi: args.abi as readonly unknown[],
        functionName: args.functionName,
        args: args.args ?? [],
      });
    },

    /**
     * Verify an EIP-712 typed data signature
     */
    verifyTypedData: async (args: {
      address: Address;
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
      signature: Hex;
    }) => {
      return publicClient.verifyTypedData({
        address: args.address,
        domain: args.domain as Parameters<typeof publicClient.verifyTypedData>[0]["domain"],
        types: args.types as Parameters<typeof publicClient.verifyTypedData>[0]["types"],
        primaryType: args.primaryType,
        message: args.message,
        signature: args.signature,
      });
    },

    /**
     * Write to a contract (state-changing functions)
     * Uses CDP SDK to sign and broadcast the transaction
     */
    writeContract: async (args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }) => {
      // Encode the function call data
      const data = encodeFunctionData({
        abi: args.abi as readonly unknown[],
        functionName: args.functionName,
        args: args.args,
      });

      // Send via CDP SDK (cast network to any for SDK compatibility)
      const result = await cdpClient.evm.sendTransaction({
        address: account.address as Address,
        network: network as any,
        transaction: {
          to: args.address,
          data,
          value: 0n,
        },
      });

      return result.transactionHash as Hex;
    },

    /**
     * Send a raw transaction
     * Uses CDP SDK to sign and broadcast
     */
    sendTransaction: async (args: { to: Address; data: Hex }) => {
      // Cast network to any for SDK compatibility
      const result = await cdpClient.evm.sendTransaction({
        address: account.address as Address,
        network: network as any,
        transaction: {
          to: args.to,
          data: args.data,
          value: 0n,
        },
      });

      return result.transactionHash as Hex;
    },

    /**
     * Wait for a transaction to be mined
     */
    waitForTransactionReceipt: async (args: { hash: Hex }) => {
      return publicClient.waitForTransactionReceipt({
        hash: args.hash,
        retryCount: 3,
        retryDelay: 5000,
      });
    },
  });
}

// ============================================================================
// Multi-Network CDP Signer Factory
// ============================================================================

export interface MultiNetworkCdpSignerConfig {
  /** The CDP client instance */
  cdpClient: CdpClient;
  /** The CDP EVM account */
  account: EvmServerAccount;
  /** Network configurations: CDP network name -> RPC URL */
  networks: Partial<Record<CdpNetwork, string | undefined>>;
}

/**
 * Creates multiple CDP signers for different networks.
 *
 * @example
 * ```typescript
 * const signers = createMultiNetworkCdpSigners({
 *   cdpClient: cdp,
 *   account,
 *   networks: {
 *     "base": process.env.EVM_RPC_URL_BASE,
 *     "base-sepolia": process.env.BASE_SEPOLIA_RPC_URL,
 *     "optimism": process.env.OPTIMISM_RPC_URL,
 *   },
 * });
 *
 * const facilitator = createFacilitator({
 *   evmSigners: [
 *     { signer: signers.base!, networks: "eip155:8453" },
 *     { signer: signers["base-sepolia"]!, networks: "eip155:84532" },
 *     { signer: signers.optimism!, networks: "eip155:10" },
 *   ],
 * });
 * ```
 */
export function createMultiNetworkCdpSigners(
  config: MultiNetworkCdpSignerConfig
): Partial<Record<CdpNetwork, FacilitatorEvmSigner>> {
  const { cdpClient, account, networks } = config;
  const signers: Partial<Record<CdpNetwork, FacilitatorEvmSigner>> = {};

  for (const [network, rpcUrl] of Object.entries(networks)) {
    if (rpcUrl) {
      signers[network as CdpNetwork] = createCdpEvmSigner({
        cdpClient,
        account,
        network: network as CdpNetwork,
        rpcUrl,
      });
    }
  }

  return signers;
}
