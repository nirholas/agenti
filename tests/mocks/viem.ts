/**
 * Viem mock utilities for testing
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { vi } from "vitest"

// Mock public client
export const mockPublicClient = {
  getBlockNumber: vi.fn().mockResolvedValue(18000000n),
  getBlock: vi.fn().mockResolvedValue({
    number: 18000000n,
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    parentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    timestamp: 1700000000n,
    nonce: "0x0000000000000000",
    difficulty: 0n,
    gasLimit: 30000000n,
    gasUsed: 15000000n,
    miner: "0x0000000000000000000000000000000000000000",
    extraData: "0x",
    baseFeePerGas: 20000000000n,
    transactions: [],
    size: 1000n
  }),
  getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
  getTransaction: vi.fn().mockResolvedValue({
    hash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc1",
    from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    value: 1000000000000000000n,
    gas: 21000n,
    gasPrice: 20000000000n,
    input: "0x",
    nonce: 100,
    blockNumber: 18000000n,
    blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    transactionIndex: 0
  }),
  getTransactionReceipt: vi.fn().mockResolvedValue({
    status: "success",
    gasUsed: 21000n,
    effectiveGasPrice: 20000000000n,
    blockNumber: 18000000n,
    blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    transactionHash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc1",
    logs: [],
    logsBloom: "0x",
    contractAddress: null,
    from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    cumulativeGasUsed: 21000n,
    type: "eip1559"
  }),
  getTransactionCount: vi.fn().mockResolvedValue(100),
  getCode: vi.fn().mockResolvedValue("0x608060405234801561001057600080fd5b50"),
  getStorageAt: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000000000000000000000000000000"),
  readContract: vi.fn(),
  call: vi.fn(),
  estimateGas: vi.fn().mockResolvedValue(21000n),
  getGasPrice: vi.fn().mockResolvedValue(20000000000n),
  estimateFeesPerGas: vi.fn().mockResolvedValue({
    maxFeePerGas: 30000000000n,
    maxPriorityFeePerGas: 1000000000n
  }),
  getLogs: vi.fn().mockResolvedValue([]),
  getChainId: vi.fn().mockResolvedValue(1),
  multicall: vi.fn()
}

// Mock wallet client
export const mockWalletClient = {
  account: {
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  },
  sendTransaction: vi.fn().mockResolvedValue("0xabc123def456789abc123def456789abc123def456789abc123def456789abc1"),
  signMessage: vi.fn().mockResolvedValue("0x1234567890abcdef"),
  signTypedData: vi.fn().mockResolvedValue("0xabcdef1234567890"),
  writeContract: vi.fn().mockResolvedValue("0xabc123def456789abc123def456789abc123def456789abc123def456789abc1"),
  getAddresses: vi.fn().mockResolvedValue(["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]),
  chain: {
    id: 1,
    name: "Ethereum"
  }
}

// Mock common token data
export const mockTokenData = {
  ERC20: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    totalSupply: 1000000000000000n
  },
  ERC721: {
    name: "Bored Ape Yacht Club",
    symbol: "BAYC",
    tokenURI: "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1"
  }
}

// Mock ENS data
export const mockENSData = {
  "vitalik.eth": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "nick.eth": "0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5"
}

// Create a mock client factory
export const createMockClient = (chainId = 1) => ({
  ...mockPublicClient,
  chain: {
    id: chainId,
    name: chainId === 1 ? "Ethereum" : chainId === 56 ? "BNB Chain" : "Unknown"
  }
})

// Reset all mocks
export const resetViemMocks = () => {
  Object.values(mockPublicClient).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      mock.mockReset()
    }
  })
  Object.values(mockWalletClient).forEach((mock) => {
    if (typeof mock === "function" && "mockReset" in mock) {
      mock.mockReset()
    }
  })
}
