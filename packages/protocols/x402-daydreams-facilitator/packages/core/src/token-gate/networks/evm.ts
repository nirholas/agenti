import { createPublicClient, http, type Address, parseAbi } from "viem";
import {
  base,
  baseSepolia,
  mainnet,
  sepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  polygon,
  polygonAmoy,
  avalanche,
  avalancheFuji,
  abstract,
  abstractTestnet,
  type Chain,
} from "viem/chains";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

/**
 * Map internal network names to viem Chain objects
 */
const NETWORK_TO_CHAIN: Record<string, Chain> = {
  base,
  "base-sepolia": baseSepolia,
  ethereum: mainnet,
  sepolia,
  optimism,
  "optimism-sepolia": optimismSepolia,
  arbitrum,
  "arbitrum-sepolia": arbitrumSepolia,
  polygon,
  "polygon-amoy": polygonAmoy,
  avalanche,
  "avalanche-fuji": avalancheFuji,
  abstract,
  "abstract-testnet": abstractTestnet,
};

/**
 * Map CAIP-2 chain IDs to internal network names
 */
const CHAIN_ID_TO_NETWORK: Record<string, string> = {
  "1": "ethereum",
  "11155111": "sepolia",
  "8453": "base",
  "84532": "base-sepolia",
  "10": "optimism",
  "11155420": "optimism-sepolia",
  "42161": "arbitrum",
  "421614": "arbitrum-sepolia",
  "137": "polygon",
  "80002": "polygon-amoy",
  "43114": "avalanche",
  "43113": "avalanche-fuji",
  "2741": "abstract",
  "11124": "abstract-testnet",
};

export interface EvmBalanceCheckConfig {
  /** Internal network name (e.g., "base", "base-sepolia") */
  network: string;
  /** RPC URL */
  rpcUrl: string;
  /** ERC20 token contract address */
  tokenAddress: Address;
  /** Wallet address to check */
  walletAddress: Address;
}

/**
 * Check ERC20 token balance for a wallet
 */
export async function checkEvmTokenBalance(
  config: EvmBalanceCheckConfig
): Promise<bigint> {
  const chain = NETWORK_TO_CHAIN[config.network];
  if (!chain) {
    throw new Error(`Unknown EVM network: ${config.network}`);
  }

  const client = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const balance = await client.readContract({
    address: config.tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [config.walletAddress],
  });

  return balance;
}

/**
 * Parse CAIP-2 network ID to internal network key
 * e.g., "eip155:8453" -> "base"
 */
export function parseEvmCaip2(caip2: string): string | null {
  const match = caip2.match(/^eip155:(\d+)$/);
  if (!match) return null;

  return CHAIN_ID_TO_NETWORK[match[1]] ?? null;
}

/**
 * Check if CAIP-2 is an EVM network
 */
export function isEvmNetwork(caip2: string): boolean {
  return caip2.startsWith("eip155:");
}

/**
 * Get viem Chain for a network name
 */
export function getChainForNetwork(network: string): Chain | undefined {
  return NETWORK_TO_CHAIN[network];
}
