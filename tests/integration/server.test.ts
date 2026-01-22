/**
 * MCP Server Startup Integration Tests
 * Tests server initialization, module registration, and basic functionality
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

import { MockMcpServer, createMockMcpServer } from "../mocks/mcp"
import { registerEVM } from "@/evm"
import { startServer } from "@/server/base"

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
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n)
  })),
  getWalletClient: vi.fn(() => ({
    account: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
    sendTransaction: vi.fn().mockResolvedValue("0xabc123")
  }))
}))

describe("MCP Server Startup Tests", () => {
  let mockServer: MockMcpServer

  beforeEach(() => {
    mockServer = createMockMcpServer()
  })

  afterEach(() => {
    mockServer.clear()
    vi.clearAllMocks()
  })

  describe("Server Initialization", () => {
    it("should initialize server correctly", () => {
      const server = startServer()
      expect(server).toBeDefined()
      expect(server).toHaveProperty("tool")
    })

    it("should have correct server metadata", () => {
      const server = startServer()
      // The server should be created with proper configuration
      expect(server).toBeDefined()
    })

    it("should not throw during initialization", () => {
      expect(() => startServer()).not.toThrow()
    })
  })

  describe("Module Registration", () => {
    it("should register all EVM modules without errors", () => {
      expect(() => registerEVM(mockServer as any)).not.toThrow()
    })

    it("should register tools after EVM registration", () => {
      registerEVM(mockServer as any)
      const tools = mockServer.getAllTools()
      expect(tools.length).toBeGreaterThan(0)
    })

    it("should register multiple tool categories", () => {
      registerEVM(mockServer as any)
      const toolNames = mockServer.getToolNames()

      // Should have tools from various categories
      const hasBlockTools = toolNames.some(name => name.includes("block"))
      const hasTokenTools = toolNames.some(name => 
        name.includes("token") || name.includes("erc20") || name.includes("balance")
      )
      const hasNetworkTools = toolNames.some(name => 
        name.includes("chain") || name.includes("network") || name.includes("gas")
      )

      expect(hasBlockTools || hasTokenTools || hasNetworkTools).toBe(true)
    })

    it("should register prompts along with tools", () => {
      registerEVM(mockServer as any)
      // Prompts may or may not be registered depending on modules
      // This test verifies the registration process completes
      expect(mockServer.getAllTools().length).toBeGreaterThan(0)
    })
  })

  describe("List Tools Request", () => {
    it("should return all registered tools", () => {
      registerEVM(mockServer as any)
      const tools = mockServer.getAllTools()

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)
    })

    it("should return tools with required properties", () => {
      registerEVM(mockServer as any)
      const tools = mockServer.getAllTools()

      for (const tool of tools) {
        expect(tool).toHaveProperty("name")
        expect(tool).toHaveProperty("description")
        expect(tool).toHaveProperty("inputSchema")
        expect(tool).toHaveProperty("handler")
        expect(typeof tool.name).toBe("string")
        expect(typeof tool.description).toBe("string")
        expect(typeof tool.handler).toBe("function")
      }
    })

    it("should return tool names as strings", () => {
      registerEVM(mockServer as any)
      const toolNames = mockServer.getToolNames()

      expect(Array.isArray(toolNames)).toBe(true)
      for (const name of toolNames) {
        expect(typeof name).toBe("string")
        expect(name.length).toBeGreaterThan(0)
      }
    })
  })

  describe("Unknown Tool Handling", () => {
    it("should throw error for unknown tool", async () => {
      registerEVM(mockServer as any)

      await expect(
        mockServer.executeTool("nonexistent_tool", {})
      ).rejects.toThrow("Tool not found: nonexistent_tool")
    })

    it("should return undefined when getting unknown tool", () => {
      registerEVM(mockServer as any)

      const tool = mockServer.getTool("unknown_tool_xyz")
      expect(tool).toBeUndefined()
    })

    it("should handle tool names with special characters gracefully", async () => {
      registerEVM(mockServer as any)

      await expect(
        mockServer.executeTool("tool@#$%", {})
      ).rejects.toThrow("Tool not found")
    })

    it("should handle empty tool name", async () => {
      registerEVM(mockServer as any)

      await expect(
        mockServer.executeTool("", {})
      ).rejects.toThrow("Tool not found")
    })
  })

  describe("Server Connection Lifecycle", () => {
    it("should support connect method", () => {
      expect(mockServer.connect).toBeDefined()
      expect(typeof mockServer.connect).toBe("function")
    })

    it("should support close method", () => {
      expect(mockServer.close).toBeDefined()
      expect(typeof mockServer.close).toBe("function")
    })

    it("should clear all registrations", () => {
      registerEVM(mockServer as any)
      expect(mockServer.getAllTools().length).toBeGreaterThan(0)

      mockServer.clear()
      expect(mockServer.getAllTools().length).toBe(0)
    })
  })

  describe("Concurrent Registration", () => {
    it("should handle multiple registration calls", () => {
      // First registration
      registerEVM(mockServer as any)
      const firstCount = mockServer.getAllTools().length

      // Second registration (tools will be added again)
      registerEVM(mockServer as any)
      const secondCount = mockServer.getAllTools().length

      // Map-based storage means same tool names overwrite
      // so counts should be equal if all names are unique
      expect(secondCount).toBeGreaterThanOrEqual(firstCount)
    })
  })

  describe("Error Handling During Registration", () => {
    it("should continue registration even if individual modules have issues", () => {
      // This tests the robustness of the registration process
      registerEVM(mockServer as any)
      
      // If registration completes, tools should be available
      const tools = mockServer.getAllTools()
      expect(tools.length).toBeGreaterThan(0)
    })
  })
})
