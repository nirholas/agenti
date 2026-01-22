/**
 * Global test setup for Universal Crypto MCP
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { vi, beforeAll, afterAll, afterEach } from "vitest"

// Mock environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = "test"
  process.env.LOG_LEVEL = "ERROR" // Suppress logs during tests
})

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks()
})

// Global cleanup
afterAll(() => {
  vi.restoreAllMocks()
})

// Global test utilities
export const TEST_ADDRESSES = {
  ETH_MAINNET: {
    VITALIK: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    ENS_REGISTRY: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
  },
  BSC_MAINNET: {
    PANCAKESWAP_ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
  },
  POLYGON: {
    QUICKSWAP_ROUTER: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
  },
  ARBITRUM: {
    GMX_ROUTER: "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
  }
}

export const TEST_TX_HASHES = {
  ETH_MAINNET: "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060",
  BSC_MAINNET: "0x7b1a89b7b7f4f6a9a6b4c3d2e1f0e9d8c7b6a5948372615049382716050493827"
}

export const TEST_BLOCK_NUMBERS = {
  ETH_MAINNET: 18000000,
  BSC_MAINNET: 35000000,
  POLYGON: 50000000,
  ARBITRUM: 150000000
}

// Mock fetch for API tests
export const createMockFetch = (response: unknown, status = 200) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response))
  })
}

// Mock viem client
export const createMockViemClient = () => ({
  getBlockNumber: vi.fn().mockResolvedValue(18000000n),
  getBlock: vi.fn().mockResolvedValue({
    number: 18000000n,
    hash: "0x1234567890abcdef",
    timestamp: 1700000000n,
    transactions: []
  }),
  getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
  getTransaction: vi.fn().mockResolvedValue({
    hash: "0xabc123",
    from: "0x1234",
    to: "0x5678",
    value: 1000000000000000000n
  }),
  getTransactionReceipt: vi.fn().mockResolvedValue({
    status: "success",
    gasUsed: 21000n
  }),
  readContract: vi.fn(),
  writeContract: vi.fn(),
  simulateContract: vi.fn(),
  estimateGas: vi.fn().mockResolvedValue(21000n),
  getGasPrice: vi.fn().mockResolvedValue(20000000000n),
  call: vi.fn()
})

// Utility to wait for async operations
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Type-safe mock creator
export function createTypedMock<T>(overrides: Partial<T> = {}): T {
  return overrides as T
}
