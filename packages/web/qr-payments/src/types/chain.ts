// Chain type definitions for QR Pay
// Supports 89+ chains via CrossFund Global Swap

export type ChainType = 'L1' | 'L2' | 'sidechain';

export interface ChainConfig {
  id: number;
  name: string;
  shortName: string;
  type: ChainType;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: string;
    fallback?: string[];
  };
  blockExplorerUrl: string;
  iconUrl?: string;
  isTestnet: boolean;
  bridgeSupported: boolean;
  gasEstimateMultiplier?: number; // For chains with variable gas
}

export interface ChainMetadata {
  averageBlockTime: number; // in seconds
  confirmationsRequired: number;
  maxGasLimit: string;
  supportsEIP1559: boolean;
  supportsEIP712: boolean;
}

// Extended chain IDs for 89+ chain support
export type SupportedChainId =
  // Mainnets
  | 1 // Ethereum
  | 10 // Optimism
  | 25 // Cronos
  | 56 // BSC
  | 100 // Gnosis
  | 137 // Polygon
  | 250 // Fantom
  | 324 // zkSync Era
  | 1101 // Polygon zkEVM
  | 1284 // Moonbeam
  | 1285 // Moonriver
  | 2222 // Kava
  | 5000 // Mantle
  | 7777777 // Zora
  | 8453 // Base
  | 34443 // Mode
  | 42161 // Arbitrum One
  | 42220 // Celo
  | 43114 // Avalanche C-Chain
  | 59144 // Linea
  | 81457 // Blast
  | 534352 // Scroll
  // Add more as needed
  | number; // Allow any chain ID for extensibility

export interface NetworkStatus {
  chainId: number;
  isHealthy: boolean;
  latency: number; // ms
  blockHeight: number;
  gasPrice: string;
  lastUpdated: Date;
}

// Chain categories for UI grouping
export type ChainCategory = 
  | 'popular'
  | 'ethereum-ecosystem'
  | 'layer2'
  | 'alt-l1'
  | 'testnet';

export interface ChainGroup {
  category: ChainCategory;
  label: string;
  chains: SupportedChainId[];
}

// RPC provider configuration
export interface RpcProvider {
  name: string;
  url: string;
  priority: number; // Lower is higher priority
  rateLimit?: number; // requests per second
  isPublic: boolean;
}

export interface ChainRpcConfig {
  chainId: number;
  providers: RpcProvider[];
  websocketUrl?: string;
}

// Bridge configuration
export interface BridgeConfig {
  fromChainId: number;
  toChainId: number;
  bridgeType: 'native' | 'canonical' | 'third-party';
  estimatedTime: number; // in minutes
  supportedTokens: string[]; // token addresses
}

// Chain-specific fee configuration
export interface ChainFeeConfig {
  chainId: number;
  baseFee?: string;
  priorityFee?: string;
  maxFeePerGas?: string;
  gasPrice?: string; // For non-EIP1559 chains
  l1DataFee?: string; // For L2 rollups
}
