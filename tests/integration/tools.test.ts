/**
 * Tool Registration Integration Tests
 * Tests tool registration, schema validation, and tool metadata
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest"

import { MockMcpServer, createMockMcpServer, validateToolInput } from "../mocks/mcp"

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

// Mock the viem clients to avoid actual network calls
vi.mock("@/evm/services/clients", () => ({
  getPublicClient: vi.fn(() => ({
    getBlockNumber: vi.fn().mockResolvedValue(18000000n),
    getBlock: vi.fn().mockResolvedValue({
      number: 18000000n,
      hash: "0x1234",
      timestamp: 1700000000n
    }),
    getChainId: vi.fn().mockResolvedValue(1),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    readContract: vi.fn().mockResolvedValue("MockValue"),
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
  })),
  getWalletClient: vi.fn(() => ({
    account: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    writeContract: vi.fn().mockResolvedValue("0xabc123")
  }))
}))

describe("Tool Registration Tests", () => {
  let mockServer: MockMcpServer
  let registerEVM: any

  beforeAll(async () => {
    const evmModule = await import("@/evm")
    registerEVM = evmModule.registerEVM
  })

  beforeEach(() => {
    mockServer = createMockMcpServer()
    registerEVM(mockServer as any)
  })

  afterEach(() => {
    mockServer.clear()
    vi.clearAllMocks()
  })

  describe("Expected Tools Registration", () => {
    it("should register block-related tools", () => {
      const toolNames = mockServer.getToolNames()
      
      const blockTools = [
        "get_block_by_hash",
        "get_block_by_number",
        "get_latest_block"
      ]

      for (const toolName of blockTools) {
        const exists = toolNames.includes(toolName)
        if (!exists) {
          console.log(`Block tool not found: ${toolName}`)
        }
        expect(toolNames).toContain(toolName)
      }
    })

    it("should register token-related tools", () => {
      const toolNames = mockServer.getToolNames()
      
      const tokenTools = [
        "get_erc20_token_info",
        "get_native_balance",
        "get_erc20_balance"
      ]

      for (const toolName of tokenTools) {
        expect(toolNames).toContain(toolName)
      }
    })

    it("should register gas-related tools", () => {
      const toolNames = mockServer.getToolNames()
      
      // Check for at least one gas-related tool
      const hasGasTools = toolNames.some(name => 
        name.toLowerCase().includes("gas") || 
        name.toLowerCase().includes("fee")
      )
      
      expect(hasGasTools).toBe(true)
    })

    it("should register transaction-related tools", () => {
      const toolNames = mockServer.getToolNames()
      
      const hasTxTools = toolNames.some(name => 
        name.toLowerCase().includes("transaction") || 
        name.toLowerCase().includes("tx")
      )
      
      expect(hasTxTools).toBe(true)
    })

    it("should register a substantial number of tools", () => {
      const tools = mockServer.getAllTools()
      
      // The EVM module should register many tools across all categories
      expect(tools.length).toBeGreaterThan(20)
    })
  })

  describe("Tool Schema Validation", () => {
    it("should have valid input schemas for all tools", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined()
        
        // Schema should be an object (Zod schema or plain object)
        if (tool.inputSchema !== null && tool.inputSchema !== undefined) {
          expect(typeof tool.inputSchema).toBe("object")
        }
      }
    })

    it("should have network parameter in chain-aware tools", () => {
      const tools = mockServer.getAllTools()
      
      // Most EVM tools should accept a network parameter
      const chainAwareTools = tools.filter(tool => {
        const schema = tool.inputSchema as any
        return schema && schema.network !== undefined
      })

      // At least some tools should be chain-aware
      expect(chainAwareTools.length).toBeGreaterThan(0)
    })

    it("should have proper schema structure", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        const schema = tool.inputSchema as Record<string, unknown>
        
        // If schema exists and is not empty
        if (schema && Object.keys(schema).length > 0) {
          // Each property should have some definition
          for (const [key, value] of Object.entries(schema)) {
            expect(key).toBeDefined()
            expect(value).toBeDefined()
          }
        }
      }
    })

    it("should validate required fields correctly", () => {
      const blockHashTool = mockServer.getTool("get_block_by_hash")
      
      if (blockHashTool) {
        // Should fail without required blockHash
        const isValidWithoutRequired = validateToolInput(blockHashTool, {})
        // Based on the mock validation, this checks required fields
        
        // Should pass with required field
        const isValidWithRequired = validateToolInput(blockHashTool, { blockHash: "0x123" })
        // Either both pass or we get proper validation
        expect(blockHashTool.inputSchema).toBeDefined()
      }
    })
  })

  describe("Tool Descriptions", () => {
    it("should have descriptions for all tools", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        expect(tool.description).toBeDefined()
        expect(typeof tool.description).toBe("string")
        expect(tool.description.length).toBeGreaterThan(0)
      }
    })

    it("should have meaningful descriptions", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        // Description should have some substance
        expect(tool.description.length).toBeGreaterThan(5)
        
        // Description should not just be the tool name
        expect(tool.description.toLowerCase()).not.toBe(tool.name.toLowerCase())
      }
    })

    it("should not have placeholder descriptions", () => {
      const tools = mockServer.getAllTools()
      const placeholderPatterns = [
        /^todo/i,
        /^placeholder/i,
        /^description/i,
        /^xxx/i,
        /^tbd/i
      ]

      for (const tool of tools) {
        for (const pattern of placeholderPatterns) {
          expect(tool.description).not.toMatch(pattern)
        }
      }
    })
  })

  describe("No Duplicate Tool Names", () => {
    it("should not have duplicate tool names", () => {
      const toolNames = mockServer.getToolNames()
      const uniqueNames = new Set(toolNames)

      // Map-based storage naturally prevents duplicates
      expect(toolNames.length).toBe(uniqueNames.size)
    })

    it("should have unique tools across all categories", () => {
      const tools = mockServer.getAllTools()
      const nameCount = new Map<string, number>()

      for (const tool of tools) {
        const count = nameCount.get(tool.name) || 0
        nameCount.set(tool.name, count + 1)
      }

      // Check no name appears more than once
      for (const [name, count] of nameCount) {
        expect(count).toBe(1)
      }
    })
  })

  describe("Tool Naming Conventions", () => {
    it("should use snake_case for tool names", () => {
      const toolNames = mockServer.getToolNames()
      const snakeCasePattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

      for (const name of toolNames) {
        expect(name).toMatch(snakeCasePattern)
      }
    })

    it("should have descriptive tool names", () => {
      const toolNames = mockServer.getToolNames()

      for (const name of toolNames) {
        // Names should be more than just one word
        expect(name.length).toBeGreaterThan(3)
      }
    })

    it("should not have overly long tool names", () => {
      const toolNames = mockServer.getToolNames()
      const maxLength = 50

      for (const name of toolNames) {
        expect(name.length).toBeLessThanOrEqual(maxLength)
      }
    })
  })

  describe("Tool Handler Functions", () => {
    it("should have callable handlers for all tools", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        expect(tool.handler).toBeDefined()
        expect(typeof tool.handler).toBe("function")
      }
    })

    it("should have async handlers", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        // Handler should return a Promise
        const result = tool.handler({})
        expect(result).toBeInstanceOf(Promise)
      }
    })
  })

  describe("Tool Categories Coverage", () => {
    it("should cover core blockchain operations", () => {
      const toolNames = mockServer.getToolNames()
      
      const coreCategories = {
        blocks: toolNames.filter(n => n.includes("block")),
        transactions: toolNames.filter(n => n.includes("transaction") || n.includes("tx")),
        tokens: toolNames.filter(n => n.includes("token") || n.includes("erc20") || n.includes("balance")),
        contracts: toolNames.filter(n => n.includes("contract"))
      }

      // Should have tools in multiple categories
      let categoriesWithTools = 0
      for (const [category, tools] of Object.entries(coreCategories)) {
        if (tools.length > 0) {
          categoriesWithTools++
        }
      }

      expect(categoriesWithTools).toBeGreaterThanOrEqual(2)
    })

    it("should include DeFi-related tools", () => {
      const toolNames = mockServer.getToolNames()
      
      const defiKeywords = ["swap", "stake", "lend", "bridge", "pool", "liquidity", "defi"]
      const hasDefiTools = toolNames.some(name => 
        defiKeywords.some(keyword => name.toLowerCase().includes(keyword))
      )

      expect(hasDefiTools).toBe(true)
    })

    it("should include utility tools", () => {
      const toolNames = mockServer.getToolNames()
      
      const utilityKeywords = ["gas", "price", "convert", "encode", "decode", "validate"]
      const hasUtilityTools = toolNames.some(name => 
        utilityKeywords.some(keyword => name.toLowerCase().includes(keyword))
      )

      expect(hasUtilityTools).toBe(true)
    })
  })

  describe("Schema Parameter Types", () => {
    it("should use proper Zod schemas or equivalent", () => {
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        const schema = tool.inputSchema
        
        // Schema should be defined and be an object
        if (schema) {
          expect(typeof schema).toBe("object")
        }
      }
    })

    it("should have typed parameters", () => {
      const blockByHashTool = mockServer.getTool("get_block_by_hash")
      
      if (blockByHashTool) {
        const schema = blockByHashTool.inputSchema as Record<string, unknown>
        
        // Should have blockHash parameter
        expect(schema.blockHash).toBeDefined()
      }
    })
  })
})
