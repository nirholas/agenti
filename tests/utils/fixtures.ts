/**
 * Reusable Test Fixtures for Universal Crypto MCP
 * 
 * Provides consistent test data across all test files including:
 * - Well-known addresses (mainnet and testnet)
 * - Transaction hashes
 * - Block data
 * - Token information
 * - DeFi protocol data
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

// ============================================================================
// EVM Addresses
// ============================================================================

/**
 * Well-known Ethereum mainnet addresses
 */
export const ETH_MAINNET_ADDRESSES = {
  // Famous addresses
  VITALIK: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  BINANCE_HOT_WALLET: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  COINBASE: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3",
  
  // Stablecoins
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EescdeCB5f3A99",
  FRAX: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
  
  // Wrapped tokens
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  
  // DeFi protocols
  UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  UNISWAP_V3_FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  SUSHISWAP_ROUTER: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  
  // Lending
  AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  AAVE_V3_ORACLE: "0x54586bE62E3c3580375aE3723C145253060Ca0C2",
  COMPOUND_V3_USDC: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
  
  // Liquid staking
  LIDO_STETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  RETH: "0xae78736Cd615f374D3085123A210448E74Fc6393",
  
  // ENS
  ENS_REGISTRY: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  ENS_RESOLVER: "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41",
  
  // Bridges
  STARGATE_ROUTER: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
  
  // Oracles
  CHAINLINK_ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
} as const

/**
 * Ethereum Sepolia testnet addresses
 */
export const ETH_SEPOLIA_ADDRESSES = {
  VITALIK: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  UNISWAP_V3_FACTORY: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c"
} as const

/**
 * BSC Mainnet addresses
 */
export const BSC_MAINNET_ADDRESSES = {
  BINANCE_HOT_WALLET: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  PANCAKESWAP_ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  PANCAKESWAP_FACTORY: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"
} as const

/**
 * BSC Testnet addresses
 */
export const BSC_TESTNET_ADDRESSES = {
  TEST_WALLET: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  PANCAKESWAP_ROUTER: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"
} as const

/**
 * Polygon Mainnet addresses
 */
export const POLYGON_MAINNET_ADDRESSES = {
  WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  QUICKSWAP_ROUTER: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  AAVE_V3_POOL: "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
} as const

/**
 * Arbitrum Mainnet addresses
 */
export const ARBITRUM_MAINNET_ADDRESSES = {
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  GMX_ROUTER: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
  UNISWAP_V3_FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984"
} as const

/**
 * Base Mainnet addresses
 */
export const BASE_MAINNET_ADDRESSES = {
  WETH: "0x4200000000000000000000000000000000000006",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  UNISWAP_V3_FACTORY: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD"
} as const

// ============================================================================
// Transaction Hashes
// ============================================================================

/**
 * Well-known transaction hashes for testing (historical, won't change)
 */
export const KNOWN_TX_HASHES = {
  // First ever ETH transaction
  ETH_FIRST_TX: "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060",
  // Large ETH transfer
  ETH_LARGE_TRANSFER: "0x2f1c5c2b44f771e942a8506148e256f94f1a464babc938ae0690c6e34cd79190",
  // Contract creation example
  ETH_CONTRACT_CREATION: "0x1a5c6d4e7b8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5"
} as const

// ============================================================================
// Block Data
// ============================================================================

/**
 * Well-known block numbers for testing
 */
export const KNOWN_BLOCKS = {
  ETH_MAINNET: {
    GENESIS: 0,
    DAO_FORK: 1920000,
    CONSTANTINOPLE: 7280000,
    LONDON: 12965000,
    MERGE: 15537394,
    RECENT: 18000000
  },
  BSC_MAINNET: {
    RECENT: 35000000
  },
  POLYGON_MAINNET: {
    RECENT: 50000000
  },
  ARBITRUM_MAINNET: {
    RECENT: 150000000
  }
} as const

// ============================================================================
// Token Fixtures
// ============================================================================

/**
 * Mock ERC20 token data for testing
 */
export const MOCK_TOKEN_DATA = {
  USDC: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    totalSupply: "1000000000000000" // 1B USDC
  },
  USDT: {
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    totalSupply: "1000000000000000"
  },
  DAI: {
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
    totalSupply: "5000000000000000000000000000"
  },
  WETH: {
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    totalSupply: "3000000000000000000000000"
  }
} as const

// ============================================================================
// DeFi Protocol Fixtures
// ============================================================================

/**
 * Mock DeFi protocol data
 */
export const MOCK_DEFI_PROTOCOLS = {
  AAVE: {
    id: "aave",
    name: "Aave",
    symbol: "AAVE",
    category: "Lending",
    chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche"],
    tvl: 10000000000
  },
  UNISWAP: {
    id: "uniswap",
    name: "Uniswap",
    symbol: "UNI",
    category: "Dexes",
    chains: ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Base"],
    tvl: 5000000000
  },
  LIDO: {
    id: "lido",
    name: "Lido",
    symbol: "LDO",
    category: "Liquid Staking",
    chains: ["Ethereum", "Polygon"],
    tvl: 15000000000
  },
  COMPOUND: {
    id: "compound",
    name: "Compound",
    symbol: "COMP",
    category: "Lending",
    chains: ["Ethereum", "Polygon", "Arbitrum"],
    tvl: 2000000000
  },
  CURVE: {
    id: "curve",
    name: "Curve Finance",
    symbol: "CRV",
    category: "Dexes",
    chains: ["Ethereum", "Polygon", "Arbitrum", "Avalanche"],
    tvl: 3000000000
  }
} as const

/**
 * Mock yield pool data
 */
export const MOCK_YIELD_POOLS = {
  AAVE_USDC_ETHEREUM: {
    pool: "USDC",
    chain: "Ethereum",
    project: "aave-v3",
    symbol: "aUSDC",
    tvlUsd: 500000000,
    apy: 3.5,
    apyBase: 2.5,
    apyReward: 1.0
  },
  COMPOUND_ETH_ETHEREUM: {
    pool: "ETH",
    chain: "Ethereum",
    project: "compound-v3",
    symbol: "cETH",
    tvlUsd: 800000000,
    apy: 2.1,
    apyBase: 2.1,
    apyReward: 0
  },
  CURVE_3POOL_ETHEREUM: {
    pool: "3pool",
    chain: "Ethereum",
    project: "curve-dex",
    symbol: "3CRV",
    tvlUsd: 200000000,
    apy: 1.8,
    apyBase: 0.5,
    apyReward: 1.3
  }
} as const

// ============================================================================
// Market Data Fixtures
// ============================================================================

/**
 * Mock cryptocurrency market data
 */
export const MOCK_MARKET_DATA = {
  BITCOIN: {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    current_price: 50000,
    market_cap: 1000000000000,
    market_cap_rank: 1,
    total_volume: 30000000000,
    price_change_percentage_24h: 2.5
  },
  ETHEREUM: {
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    current_price: 3000,
    market_cap: 360000000000,
    market_cap_rank: 2,
    total_volume: 15000000000,
    price_change_percentage_24h: 3.2
  },
  BNB: {
    id: "binancecoin",
    symbol: "bnb",
    name: "BNB",
    current_price: 400,
    market_cap: 60000000000,
    market_cap_rank: 4,
    total_volume: 1000000000,
    price_change_percentage_24h: 1.5
  }
} as const

/**
 * Mock Fear & Greed Index data
 */
export const MOCK_FEAR_GREED = {
  EXTREME_FEAR: {
    value: "15",
    value_classification: "Extreme Fear",
    timestamp: "1700000000"
  },
  FEAR: {
    value: "35",
    value_classification: "Fear",
    timestamp: "1700000000"
  },
  NEUTRAL: {
    value: "50",
    value_classification: "Neutral",
    timestamp: "1700000000"
  },
  GREED: {
    value: "65",
    value_classification: "Greed",
    timestamp: "1700000000"
  },
  EXTREME_GREED: {
    value: "85",
    value_classification: "Extreme Greed",
    timestamp: "1700000000"
  }
} as const

// ============================================================================
// Network Configuration Fixtures
// ============================================================================

/**
 * Network configurations for testing
 */
export const NETWORK_CONFIGS = {
  ETHEREUM_MAINNET: {
    name: "ethereum",
    chainId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://etherscan.io"
  },
  ETHEREUM_SEPOLIA: {
    name: "sepolia",
    chainId: 11155111,
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://sepolia.etherscan.io"
  },
  BSC_MAINNET: {
    name: "bsc",
    chainId: 56,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorer: "https://bscscan.com"
  },
  BSC_TESTNET: {
    name: "bsc-testnet",
    chainId: 97,
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    blockExplorer: "https://testnet.bscscan.com"
  },
  POLYGON_MAINNET: {
    name: "polygon",
    chainId: 137,
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorer: "https://polygonscan.com"
  },
  ARBITRUM_ONE: {
    name: "arbitrum",
    chainId: 42161,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://arbiscan.io"
  },
  OPTIMISM: {
    name: "optimism",
    chainId: 10,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://optimistic.etherscan.io"
  },
  BASE: {
    name: "base",
    chainId: 8453,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://basescan.org"
  }
} as const

// ============================================================================
// Error Fixtures
// ============================================================================

/**
 * Common error scenarios for testing
 */
export const ERROR_SCENARIOS = {
  INVALID_ADDRESS: {
    input: "0xinvalid",
    expectedError: "Invalid address"
  },
  ZERO_ADDRESS: {
    input: "0x0000000000000000000000000000000000000000",
    expectedError: "zero address"
  },
  UNSUPPORTED_NETWORK: {
    input: "unsupported-chain",
    expectedError: "Unsupported network"
  },
  RATE_LIMITED: {
    statusCode: 429,
    expectedError: "rate limit"
  },
  NOT_FOUND: {
    statusCode: 404,
    expectedError: "not found"
  },
  TIMEOUT: {
    expectedError: "timeout"
  }
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a random Ethereum address for testing
 */
export function generateRandomAddress(): `0x${string}` {
  const chars = "0123456789abcdef"
  let address = "0x"
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)]
  }
  return address as `0x${string}`
}

/**
 * Generate a random transaction hash for testing
 */
export function generateRandomTxHash(): `0x${string}` {
  const chars = "0123456789abcdef"
  let hash = "0x"
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)]
  }
  return hash as `0x${string}`
}

/**
 * Create mock balance response
 */
export function createMockBalanceResponse(balance: string, decimals: number = 18) {
  const balanceWei = BigInt(Math.floor(parseFloat(balance) * Math.pow(10, decimals))).toString()
  return {
    balance: balanceWei,
    formatted: balance,
    decimals
  }
}

/**
 * Create mock token info response
 */
export function createMockTokenInfo(overrides: Partial<typeof MOCK_TOKEN_DATA.USDC> = {}) {
  return {
    name: "Mock Token",
    symbol: "MOCK",
    decimals: 18,
    totalSupply: "1000000000000000000000000",
    ...overrides
  }
}

/**
 * Create mock block response
 */
export function createMockBlockResponse(blockNumber: number | bigint) {
  return {
    number: blockNumber.toString(),
    hash: generateRandomTxHash(),
    parentHash: generateRandomTxHash(),
    timestamp: Math.floor(Date.now() / 1000),
    gasUsed: "15000000",
    gasLimit: "30000000",
    baseFeePerGas: "20000000000",
    transactions: []
  }
}

/**
 * Create mock transaction response
 */
export function createMockTransactionResponse(overrides: Record<string, unknown> = {}) {
  return {
    hash: generateRandomTxHash(),
    from: generateRandomAddress(),
    to: generateRandomAddress(),
    value: "1000000000000000000",
    gasPrice: "20000000000",
    gas: "21000",
    nonce: 0,
    blockNumber: "18000000",
    blockHash: generateRandomTxHash(),
    transactionIndex: 0,
    ...overrides
  }
}

/**
 * Create mock DeFi protocol response
 */
export function createMockProtocolResponse(protocol: keyof typeof MOCK_DEFI_PROTOCOLS) {
  return {
    ...MOCK_DEFI_PROTOCOLS[protocol],
    change_1d: (Math.random() * 10 - 5).toFixed(2),
    change_7d: (Math.random() * 20 - 10).toFixed(2),
    change_1m: (Math.random() * 30 - 15).toFixed(2)
  }
}
