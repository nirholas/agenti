/**
 * EVM Tool Integration Tests
 * Tests specific EVM tools for correct behavior and response formats
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"

import { MockMcpServer, createMockMcpServer } from "../mocks/mcp"
import { mockPublicClient, mockWalletClient, mockTokenData } from "../mocks/viem"
import { TEST_ADDRESSES } from "../setup"

// Mock viem/chains to avoid issues with chain imports
vi.mock("viem/chains", () => ({
  mainnet: { id: 1, name: "Ethereum" },
  sepolia: { id: 11155111, name: "Sepolia" },
  optimism: { id: 10, name: "Optimism" },
  optimismSepolia: { id: 11155420, name: "Optimism Sepolia" },
  arbitrum: { id: 42161, name: "Arbitrum" },
  arbitrumSepolia: { id: 421614, name: "Arbitrum Sepolia" },
  base: { id: 8453, name: "Base" },
  baseSepolia: { id: 84532, name: "Base Sepolia" },
  polygon: { id: 137, name: "Polygon" },
  polygonAmoy: { id: 80002, name: "Polygon Amoy" },
  bsc: { id: 56, name: "BSC" },
  bscTestnet: { id: 97, name: "BSC Testnet" },
  opBNB: { id: 204, name: "opBNB" },
  opBNBTestnet: { id: 5611, name: "opBNB Testnet" },
  iotex: { id: 4689, name: "IoTeX" },
  iotexTestnet: { id: 4690, name: "IoTeX Testnet" }
}))

// Mock the viem services
vi.mock("@/evm/services/clients", () => ({
  getPublicClient: vi.fn(() => mockPublicClient),
  getWalletClient: vi.fn(() => mockWalletClient)
}))

// Mock the services module
vi.mock("@/evm/services/index", () => ({
  getBlockByHash: vi.fn().mockResolvedValue({
    number: "18000000",
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    parentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    timestamp: 1700000000,
    gasUsed: "15000000",
    gasLimit: "30000000",
    baseFeePerGas: "20000000000",
    transactions: []
  }),
  getBlockByNumber: vi.fn().mockResolvedValue({
    number: "18000000",
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    timestamp: 1700000000,
    gasUsed: "15000000",
    transactions: []
  }),
  getLatestBlock: vi.fn().mockResolvedValue({
    number: "18000000",
    hash: "0x1234",
    timestamp: 1700000000
  }),
  getERC20TokenInfo: vi.fn().mockResolvedValue({
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    totalSupply: "1000000000000000"
  }),
  getNativeBalance: vi.fn().mockResolvedValue({
    balance: "1.5",
    balanceWei: "1500000000000000000",
    network: "ethereum"
  }),
  getERC20Balance: vi.fn().mockResolvedValue({
    balance: "1000.0",
    rawBalance: "1000000000",
    decimals: 6,
    symbol: "USDC"
  })
}))

describe("EVM Tool Integration Tests", () => {
  let mockServer: MockMcpServer
  let registerEVM: any

  beforeAll(async () => {
    const evmModule = await import("@/evm")
    registerEVM = evmModule.registerEVM
  })

  beforeEach(() => {
    mockServer = createMockMcpServer()
    registerEVM(mockServer as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockServer.clear()
    vi.restoreAllMocks()
  })

  describe("getBlock Tool", () => {
    it("should return block data in correct format", async () => {
      const tool = mockServer.getTool("get_block_by_number")
      expect(tool).toBeDefined()

      const result = await mockServer.executeTool("get_block_by_number", {
        blockNumber: "18000000",
        network: "ethereum"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")
      
      const content = (result as any).content
      expect(Array.isArray(content)).toBe(true)
      expect(content[0]).toHaveProperty("type", "text")
      expect(content[0]).toHaveProperty("text")
    })

    it("should return block by hash correctly", async () => {
      const result = await mockServer.executeTool("get_block_by_hash", {
        blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        network: "ethereum"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")
      
      const text = (result as any).content[0].text
      const data = JSON.parse(text)
      
      expect(data).toHaveProperty("hash")
      expect(data).toHaveProperty("number")
    })

    it("should return latest block", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: "ethereum"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")
      
      const text = (result as any).content[0].text
      const data = JSON.parse(text)
      
      expect(data).toHaveProperty("number")
      expect(data).toHaveProperty("timestamp")
    })

    it("should include block metadata", async () => {
      const result = await mockServer.executeTool("get_block_by_number", {
        blockNumber: "18000000",
        network: "ethereum"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      // Block should have standard properties
      expect(data).toHaveProperty("number")
      expect(data).toHaveProperty("timestamp")
    })
  })

  describe("getBalance Tool", () => {
    it("should return native balance in correct format", async () => {
      const tool = mockServer.getTool("get_native_balance")
      expect(tool).toBeDefined()

      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.ETH_MAINNET.VITALIK,
        network: "ethereum",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data).toHaveProperty("balance")
      expect(data).toHaveProperty("balanceWei")
    })

    it("should return ERC20 balance", async () => {
      const result = await mockServer.executeTool("get_erc20_balance", {
        tokenAddress: TEST_ADDRESSES.ETH_MAINNET.USDC,
        address: TEST_ADDRESSES.ETH_MAINNET.VITALIK,
        network: "ethereum",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data).toHaveProperty("balance")
      expect(data).toHaveProperty("decimals")
    })

    it("should handle balance response with network info", async () => {
      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.ETH_MAINNET.VITALIK,
        network: "ethereum",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data).toHaveProperty("network")
    })
  })

  describe("getTokenInfo Tool", () => {
    it("should return token details", async () => {
      const tool = mockServer.getTool("get_erc20_token_info")
      expect(tool).toBeDefined()

      const result = await mockServer.executeTool("get_erc20_token_info", {
        tokenAddress: TEST_ADDRESSES.ETH_MAINNET.USDC,
        network: "ethereum"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data).toHaveProperty("name")
      expect(data).toHaveProperty("symbol")
      expect(data).toHaveProperty("decimals")
      expect(data).toHaveProperty("totalSupply")
    })

    it("should return correct token metadata structure", async () => {
      const result = await mockServer.executeTool("get_erc20_token_info", {
        tokenAddress: TEST_ADDRESSES.ETH_MAINNET.USDC,
        network: "ethereum"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      // Validate data types
      expect(typeof data.name).toBe("string")
      expect(typeof data.symbol).toBe("string")
      expect(typeof data.decimals).toBe("number")
    })

    it("should handle different token addresses", async () => {
      const tokenAddresses = [
        TEST_ADDRESSES.ETH_MAINNET.USDC,
        TEST_ADDRESSES.ETH_MAINNET.USDT,
        TEST_ADDRESSES.ETH_MAINNET.WETH
      ]

      for (const tokenAddress of tokenAddresses) {
        const result = await mockServer.executeTool("get_erc20_token_info", {
          tokenAddress,
          network: "ethereum"
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty("content")
      }
    })
  })

  describe("Error Response Format", () => {
    it("should format errors correctly", async () => {
      // Mock an error
      const services = await import("@/evm/services/index")
      vi.mocked(services.getBlockByNumber).mockRejectedValueOnce(
        new Error("Block not found")
      )

      const result = await mockServer.executeTool("get_block_by_number", {
        blockNumber: "999999999999",
        network: "ethereum"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")

      const text = (result as any).content[0].text
      expect(text).toContain("Error")
    })

    it("should include error context when available", async () => {
      const services = await import("@/evm/services/index")
      vi.mocked(services.getERC20TokenInfo).mockRejectedValueOnce(
        new Error("Contract not found at address")
      )

      const result = await mockServer.executeTool("get_erc20_token_info", {
        tokenAddress: "0x0000000000000000000000000000000000000000",
        network: "ethereum"
      })

      const text = (result as any).content[0].text
      expect(text).toContain("Error")
    })

    it("should handle network errors gracefully", async () => {
      const services = await import("@/evm/services/index")
      vi.mocked(services.getLatestBlock).mockRejectedValueOnce(
        new Error("Network request failed")
      )

      const result = await mockServer.executeTool("get_latest_block", {
        network: "ethereum"
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")

      const text = (result as any).content[0].text
      expect(text).toContain("Error")
    })

    it("should not expose sensitive information in errors", async () => {
      const services = await import("@/evm/services/index")
      vi.mocked(services.getNativeBalance).mockRejectedValueOnce(
        new Error("Private key invalid")
      )

      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.ETH_MAINNET.VITALIK,
        network: "ethereum",
        privateKey: "0xsensitivekey123"
      })

      const text = (result as any).content[0].text
      
      // Should not include the actual private key in error
      expect(text).not.toContain("0xsensitivekey123")
    })
  })

  describe("Response Content Type", () => {
    it("should return text content type", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: "ethereum"
      })

      const content = (result as any).content[0]
      expect(content.type).toBe("text")
    })

    it("should return valid JSON in text content", async () => {
      const result = await mockServer.executeTool("get_erc20_token_info", {
        tokenAddress: TEST_ADDRESSES.ETH_MAINNET.USDC,
        network: "ethereum"
      })

      const text = (result as any).content[0].text
      
      // Should be valid JSON
      expect(() => JSON.parse(text)).not.toThrow()
    })

    it("should format JSON with indentation", async () => {
      const result = await mockServer.executeTool("get_erc20_token_info", {
        tokenAddress: TEST_ADDRESSES.ETH_MAINNET.USDC,
        network: "ethereum"
      })

      const text = (result as any).content[0].text
      
      // Formatted JSON should contain newlines
      expect(text).toContain("\n")
    })
  })

  describe("Tool Input Handling", () => {
    it("should handle optional parameters", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: "ethereum"
        // No optional parameters
      })

      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")
    })

    it("should handle default network parameter", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        // network defaults to ethereum/mainnet
      })

      expect(result).toBeDefined()
    })

    it("should accept string network names", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: "eth"
      })

      expect(result).toBeDefined()
    })

    it("should accept numeric chain IDs", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: 1
      })

      expect(result).toBeDefined()
    })
  })

  describe("BigInt Handling", () => {
    it("should serialize BigInt values correctly", async () => {
      const result = await mockServer.executeTool("get_block_by_number", {
        blockNumber: "18000000",
        network: "ethereum"
      })

      const text = (result as any).content[0].text
      
      // Should be valid JSON (BigInt must be serialized)
      expect(() => JSON.parse(text)).not.toThrow()
    })

    it("should handle large numbers in responses", async () => {
      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.ETH_MAINNET.VITALIK,
        network: "ethereum",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      // Balance in Wei should be a valid string representation
      expect(data.balanceWei).toBeDefined()
      expect(typeof data.balanceWei).toBe("string")
    })
  })
})
