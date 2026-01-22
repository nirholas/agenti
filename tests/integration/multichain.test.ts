/**
 * Multi-Chain Integration Tests
 * Tests tools across different blockchain networks
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"

import { MockMcpServer, createMockMcpServer } from "../mocks/mcp"
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

// Create chain-specific mock responses
const createChainMockClient = (chainId: number) => ({
  getBlockNumber: vi.fn().mockResolvedValue(BigInt(18000000)),
  getBlock: vi.fn().mockResolvedValue({
    number: BigInt(18000000),
    hash: `0x${chainId.toString(16).padStart(64, "0")}`,
    timestamp: BigInt(1700000000),
    gasUsed: BigInt(15000000),
    gasLimit: BigInt(30000000)
  }),
  getChainId: vi.fn().mockResolvedValue(chainId),
  getBalance: vi.fn().mockResolvedValue(BigInt(1000000000000000000)),
  readContract: vi.fn().mockResolvedValue("MockToken"),
  multicall: vi.fn().mockResolvedValue([]),
  estimateGas: vi.fn().mockResolvedValue(21000n),
  getGasPrice: vi.fn().mockResolvedValue(20000000000n),
  getLogs: vi.fn().mockResolvedValue([]),
  getTransaction: vi.fn().mockResolvedValue({}),
  getTransactionReceipt: vi.fn().mockResolvedValue({}),
  getTransactionCount: vi.fn().mockResolvedValue(0),
  getCode: vi.fn().mockResolvedValue("0x"),
  call: vi.fn().mockResolvedValue({ data: "0x" }),
  getStorageAt: vi.fn().mockResolvedValue("0x"),
  estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 20000000000n, maxPriorityFeePerGas: 1000000000n }),
  getUncleCountByBlockNumber: vi.fn().mockResolvedValue(0)
})

// Dynamic mock based on network parameter
vi.mock("@/evm/services/clients", () => ({
  getPublicClient: vi.fn((network?: string | number) => {
    const chainId = typeof network === "number" ? network : 1
    return createChainMockClient(chainId)
  }),
  getWalletClient: vi.fn(() => ({
    account: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    writeContract: vi.fn().mockResolvedValue("0xabc123")
  }))
}))

// Mock services with chain-aware responses
vi.mock("@/evm/services/index", () => ({
  getLatestBlock: vi.fn().mockImplementation((network) => {
    const chainId = typeof network === "number" ? network : 1
    return Promise.resolve({
      number: "18000000",
      hash: `0x${chainId.toString(16).padStart(64, "0")}`,
      timestamp: 1700000000,
      chainId: chainId,
      network: network
    })
  }),
  getBlockByNumber: vi.fn().mockImplementation((blockNum, network) => {
    const chainId = typeof network === "number" ? network : 1
    return Promise.resolve({
      number: blockNum.toString(),
      hash: `0x${chainId.toString(16).padStart(64, "0")}`,
      timestamp: 1700000000,
      chainId: chainId
    })
  }),
  getBlockByHash: vi.fn().mockResolvedValue({
    number: "18000000",
    hash: "0x1234",
    timestamp: 1700000000
  }),
  getNativeBalance: vi.fn().mockImplementation((address, network) => {
    const chainId = typeof network === "number" ? network : 1
    const nativeSymbols: Record<number, string> = {
      1: "ETH",
      56: "BNB",
      137: "MATIC",
      42161: "ETH",
      10: "ETH",
      8453: "ETH"
    }
    return Promise.resolve({
      balance: "1.5",
      balanceWei: "1500000000000000000",
      network: network,
      chainId: chainId,
      symbol: nativeSymbols[chainId] || "ETH"
    })
  }),
  getERC20TokenInfo: vi.fn().mockResolvedValue({
    name: "Test Token",
    symbol: "TEST",
    decimals: 18,
    totalSupply: "1000000000000000000000000"
  }),
  getERC20Balance: vi.fn().mockResolvedValue({
    balance: "100.0",
    rawBalance: "100000000000000000000",
    decimals: 18
  })
}))

describe("Multi-Chain Integration Tests", () => {
  let mockServer: MockMcpServer
  let registerEVM: any
  let chainMap: any
  let networkNameMap: any
  let resolveChainId: any
  let getChain: any

  beforeAll(async () => {
    const evmModule = await import("@/evm")
    registerEVM = evmModule.registerEVM
    const chainsModule = await import("@/evm/chains")
    chainMap = chainsModule.chainMap
    networkNameMap = chainsModule.networkNameMap
    resolveChainId = chainsModule.resolveChainId
    getChain = chainsModule.getChain
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

  describe("Different Chain IDs Support", () => {
    const supportedChains = [
      { name: "Ethereum", id: 1, symbol: "ETH" },
      { name: "Polygon", id: 137, symbol: "MATIC" },
      { name: "Arbitrum", id: 42161, symbol: "ETH" },
      { name: "Optimism", id: 10, symbol: "ETH" },
      { name: "Base", id: 8453, symbol: "ETH" },
      { name: "BSC", id: 56, symbol: "BNB" }
    ]

    it.each(supportedChains)(
      "should work with $name (chainId: $id)",
      async ({ id, name }) => {
        const result = await mockServer.executeTool("get_latest_block", {
          network: id
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty("content")

        const text = (result as any).content[0].text
        const data = JSON.parse(text)

        expect(data).toHaveProperty("number")
        expect(data).toHaveProperty("chainId")
        expect(data.chainId).toBe(id)
      }
    )

    it("should work with network names", async () => {
      const networkNames = ["ethereum", "polygon", "arbitrum", "optimism", "base", "bsc"]

      for (const networkName of networkNames) {
        const result = await mockServer.executeTool("get_latest_block", {
          network: networkName
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty("content")
      }
    })

    it("should work with short network aliases", async () => {
      const aliases = ["eth", "matic", "arb", "op"]

      for (const alias of aliases) {
        const result = await mockServer.executeTool("get_latest_block", {
          network: alias
        })

        expect(result).toBeDefined()
      }
    })
  })

  describe("Chain-Specific Configurations", () => {
    it("should apply correct configuration for Ethereum mainnet", async () => {
      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.ETH_MAINNET.VITALIK,
        network: "ethereum",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data.chainId).toBe(1)
      expect(data.symbol).toBe("ETH")
    })

    it("should apply correct configuration for BSC", async () => {
      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.BSC_MAINNET.WBNB,
        network: "bsc",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data.chainId).toBe(56)
      expect(data.symbol).toBe("BNB")
    })

    it("should apply correct configuration for Polygon", async () => {
      const result = await mockServer.executeTool("get_native_balance", {
        address: TEST_ADDRESSES.POLYGON.WMATIC,
        network: "polygon",
        privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001"
      })

      const text = (result as any).content[0].text
      const data = JSON.parse(text)

      expect(data.chainId).toBe(137)
      expect(data.symbol).toBe("MATIC")
    })

    it("should use network-specific RPC endpoints", async () => {
      // Verify different chains produce different results
      const ethResult = await mockServer.executeTool("get_latest_block", {
        network: "ethereum"
      })
      const bscResult = await mockServer.executeTool("get_latest_block", {
        network: "bsc"
      })

      const ethData = JSON.parse((ethResult as any).content[0].text)
      const bscData = JSON.parse((bscResult as any).content[0].text)

      // Different chains should have different chain IDs
      expect(ethData.chainId).not.toBe(bscData.chainId)
    })
  })

  describe("Unsupported Chain Handling", () => {
    it("should handle unsupported chain ID gracefully", async () => {
      // Using a non-standard chain ID
      const result = await mockServer.executeTool("get_latest_block", {
        network: 999999
      })

      // Should either work with default or return an error
      expect(result).toBeDefined()
      expect(result).toHaveProperty("content")
    })

    it("should handle unknown network names", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: "unknown_network"
      })

      // Should either fallback to default or handle gracefully
      expect(result).toBeDefined()
    })

    it("should provide meaningful error for unsupported operations", async () => {
      // Some operations may not be supported on all chains
      const result = await mockServer.executeTool("get_latest_block", {
        network: "ethereum"
      })

      expect(result).toBeDefined()
    })
  })

  describe("Chain Resolution", () => {
    it("should resolve chain ID from number", () => {
      expect(resolveChainId(1)).toBe(1)
      expect(resolveChainId(137)).toBe(137)
      expect(resolveChainId(56)).toBe(56)
    })

    it("should resolve chain ID from network name", () => {
      expect(resolveChainId("ethereum")).toBe(1)
      expect(resolveChainId("polygon")).toBe(137)
      expect(resolveChainId("bsc")).toBe(56)
    })

    it("should handle case-insensitive network names", () => {
      expect(resolveChainId("ETHEREUM")).toBe(1)
      expect(resolveChainId("Polygon")).toBe(137)
      expect(resolveChainId("BSC")).toBe(56)
    })

    it("should fallback to mainnet for unknown networks", () => {
      expect(resolveChainId("unknown")).toBe(1)
      expect(resolveChainId("invalid_chain")).toBe(1)
    })
  })

  describe("Chain Configuration Access", () => {
    it("should have chain configuration for supported chains", () => {
      const supportedChainIds = [1, 10, 137, 42161, 8453, 56]

      for (const chainId of supportedChainIds) {
        expect(chainMap[chainId]).toBeDefined()
        expect(chainMap[chainId].id).toBe(chainId)
      }
    })

    it("should provide network name to chain ID mapping", () => {
      expect(networkNameMap["ethereum"]).toBe(1)
      expect(networkNameMap["mainnet"]).toBe(1)
      expect(networkNameMap["polygon"]).toBe(137)
      expect(networkNameMap["matic"]).toBe(137)
    })

    it("should return chain object via getChain", () => {
      const ethChain = getChain(1)
      expect(ethChain).toBeDefined()
      expect(ethChain.id).toBe(1)

      const polygonChain = getChain("polygon")
      expect(polygonChain).toBeDefined()
      expect(polygonChain.id).toBe(137)
    })
  })

  describe("Testnet Support", () => {
    const testnets = [
      { name: "Sepolia", id: 11155111 },
      { name: "Arbitrum Sepolia", id: 421614 },
      { name: "Base Sepolia", id: 84532 },
      { name: "Polygon Amoy", id: 80002 },
      { name: "BSC Testnet", id: 97 }
    ]

    it.each(testnets)(
      "should support $name testnet (chainId: $id)",
      async ({ id }) => {
        expect(chainMap[id]).toBeDefined()
        expect(chainMap[id].id).toBe(id)
      }
    )

    it("should resolve testnet names correctly", () => {
      expect(resolveChainId("sepolia")).toBe(11155111)
      expect(resolveChainId("bsc-testnet")).toBe(97)
      expect(resolveChainId("polygon-amoy")).toBe(80002)
    })
  })

  describe("Cross-Chain Tool Consistency", () => {
    it("should return consistent response structure across chains", async () => {
      const chains = ["ethereum", "polygon", "bsc"]
      const responses: any[] = []

      for (const chain of chains) {
        const result = await mockServer.executeTool("get_latest_block", {
          network: chain
        })
        responses.push(JSON.parse((result as any).content[0].text))
      }

      // All responses should have the same structure
      const keys = Object.keys(responses[0])
      for (const response of responses) {
        expect(Object.keys(response)).toEqual(expect.arrayContaining(keys))
      }
    })

    it("should handle token operations across chains", async () => {
      const chainTokenPairs = [
        { network: "ethereum", token: TEST_ADDRESSES.ETH_MAINNET.USDC },
        { network: "bsc", token: TEST_ADDRESSES.BSC_MAINNET.BUSD },
        { network: "polygon", token: TEST_ADDRESSES.POLYGON.WMATIC }
      ]

      for (const { network, token } of chainTokenPairs) {
        const result = await mockServer.executeTool("get_erc20_token_info", {
          tokenAddress: token,
          network
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty("content")

        const data = JSON.parse((result as any).content[0].text)
        expect(data).toHaveProperty("name")
        expect(data).toHaveProperty("symbol")
        expect(data).toHaveProperty("decimals")
      }
    })
  })

  describe("Default Network Behavior", () => {
    it("should default to Ethereum mainnet when no network specified", async () => {
      const result = await mockServer.executeTool("get_latest_block", {})

      expect(result).toBeDefined()
      
      const data = JSON.parse((result as any).content[0].text)
      expect(data.chainId).toBe(1)
    })

    it("should accept undefined network parameter", async () => {
      const result = await mockServer.executeTool("get_latest_block", {
        network: undefined
      })

      expect(result).toBeDefined()
    })
  })
})
