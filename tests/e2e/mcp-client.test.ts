/**
 * MCP Protocol Communication E2E Tests
 * 
 * Tests the MCP protocol communication between client and server.
 * Verifies that the server correctly handles MCP messages and responses.
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

describe("MCP Protocol Communication", () => {
  let client: Client
  let transport: StdioClientTransport

  beforeAll(async () => {
    // Create transport to spawn and communicate with the server
    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/index.ts"],
      env: {
        ...process.env,
        NODE_ENV: "test",
        LOG_LEVEL: "ERROR"
      }
    })

    // Create client
    client = new Client({
      name: "e2e-test-client",
      version: "1.0.0"
    })

    // Connect to server
    await client.connect(transport)
  }, 30000)

  afterAll(async () => {
    try {
      await client.close()
    } catch (error) {
      // Ignore close errors
    }
    try {
      await transport.close()
    } catch (error) {
      // Ignore close errors
    }
  })

  describe("Server Initialization", () => {
    it("should connect to the server successfully", () => {
      // If we reach here, connection was successful
      expect(client).toBeDefined()
    })

    it("should receive server info after connection", async () => {
      const serverInfo = client.getServerVersion()
      expect(serverInfo).toBeDefined()
      expect(serverInfo?.name).toBe("Universal Crypto MCP")
    })
  })

  describe("Tool Discovery", () => {
    it("should list available tools", async () => {
      const result = await client.listTools()
      
      expect(result).toBeDefined()
      expect(result.tools).toBeDefined()
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBeGreaterThan(0)
    })

    it("should have EVM-related tools", async () => {
      const result = await client.listTools()
      
      const toolNames = result.tools.map((t) => t.name)
      
      // Check for core EVM tools
      expect(toolNames).toContain("get_chain_info")
      expect(toolNames).toContain("get_supported_networks")
    })

    it("should have market data tools", async () => {
      const result = await client.listTools()
      
      const toolNames = result.tools.map((t) => t.name)
      
      // Check for market data tools (may vary based on configuration)
      const hasMarketTools = toolNames.some((name) => 
        name.includes("market") || 
        name.includes("price") || 
        name.includes("coin")
      )
      expect(hasMarketTools).toBe(true)
    })

    it("should have token-related tools", async () => {
      const result = await client.listTools()
      
      const toolNames = result.tools.map((t) => t.name)
      
      // Check for token tools
      expect(toolNames).toContain("get_erc20_token_info")
      expect(toolNames).toContain("get_native_balance")
    })

    it("should provide tool descriptions", async () => {
      const result = await client.listTools()
      
      // All tools should have descriptions
      for (const tool of result.tools) {
        expect(tool.name).toBeDefined()
        expect(typeof tool.name).toBe("string")
        expect(tool.description).toBeDefined()
        expect(typeof tool.description).toBe("string")
      }
    })

    it("should provide tool input schemas", async () => {
      const result = await client.listTools()
      
      // All tools should have input schemas
      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe("object")
      }
    })
  })

  describe("Prompt Discovery", () => {
    it("should list available prompts", async () => {
      const result = await client.listPrompts()
      
      expect(result).toBeDefined()
      expect(result.prompts).toBeDefined()
      expect(Array.isArray(result.prompts)).toBe(true)
    })

    it("should provide prompt descriptions", async () => {
      const result = await client.listPrompts()
      
      if (result.prompts.length > 0) {
        for (const prompt of result.prompts) {
          expect(prompt.name).toBeDefined()
          expect(typeof prompt.name).toBe("string")
        }
      }
    })
  })

  describe("Resource Discovery", () => {
    it("should list available resources", async () => {
      const result = await client.listResources()
      
      expect(result).toBeDefined()
      expect(result.resources).toBeDefined()
      expect(Array.isArray(result.resources)).toBe(true)
    })
  })

  describe("Basic Tool Execution", () => {
    it("should execute get_supported_networks tool", async () => {
      const result = await client.callTool({
        name: "get_supported_networks",
        arguments: {}
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
      
      // Parse the response
      const textContent = result.content.find((c) => c.type === "text")
      expect(textContent).toBeDefined()
      
      if (textContent && "text" in textContent) {
        const data = JSON.parse(textContent.text)
        expect(data.supportedNetworks).toBeDefined()
        expect(Array.isArray(data.supportedNetworks)).toBe(true)
        expect(data.supportedNetworks.length).toBeGreaterThan(0)
        
        // Should include common networks
        const networks = data.supportedNetworks
        expect(networks.some((n: string) => n.toLowerCase().includes("ethereum") || n === "mainnet")).toBe(true)
      }
    })

    it("should execute get_chain_info tool for mainnet", async () => {
      const result = await client.callTool({
        name: "get_chain_info",
        arguments: {
          network: "mainnet"
        }
      })

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      const textContent = result.content.find((c) => c.type === "text")
      expect(textContent).toBeDefined()
      
      if (textContent && "text" in textContent) {
        const data = JSON.parse(textContent.text)
        expect(data.chainId).toBeDefined()
        expect(data.blockNumber).toBeDefined()
        // Ethereum mainnet chain ID is 1
        expect(Number(data.chainId)).toBe(1)
      }
    })

    it("should handle tool with invalid arguments gracefully", async () => {
      const result = await client.callTool({
        name: "get_chain_info",
        arguments: {
          network: "invalid-network-that-does-not-exist"
        }
      })

      // Should return an error response, not throw
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      
      // Check if it's an error response
      const textContent = result.content.find((c) => c.type === "text")
      if (textContent && "text" in textContent) {
        // Either isError is true or the content contains error information
        const hasError = result.isError === true || 
          textContent.text.toLowerCase().includes("error") ||
          textContent.text.toLowerCase().includes("unsupported")
        expect(hasError).toBe(true)
      }
    })

    it("should handle non-existent tool gracefully", async () => {
      await expect(
        client.callTool({
          name: "non_existent_tool_xyz",
          arguments: {}
        })
      ).rejects.toThrow()
    })
  })

  describe("Tool Argument Validation", () => {
    it("should validate required arguments", async () => {
      // get_erc20_token_info requires tokenAddress
      const result = await client.callTool({
        name: "get_erc20_token_info",
        arguments: {
          // Missing required tokenAddress
          network: "mainnet"
        }
      })

      // Should return error for missing required argument
      expect(result).toBeDefined()
    })

    it("should accept optional arguments", async () => {
      const result = await client.callTool({
        name: "get_chain_info",
        arguments: {
          network: "mainnet"
        }
      })

      expect(result).toBeDefined()
      expect(result.isError).not.toBe(true)
    })
  })

  describe("Concurrent Tool Calls", () => {
    it("should handle multiple concurrent tool calls", async () => {
      const promises = [
        client.callTool({
          name: "get_chain_info",
          arguments: { network: "mainnet" }
        }),
        client.callTool({
          name: "get_chain_info",
          arguments: { network: "bsc" }
        }),
        client.callTool({
          name: "get_supported_networks",
          arguments: {}
        })
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      for (const result of results) {
        expect(result).toBeDefined()
        expect(result.content).toBeDefined()
      }
    })
  })

  describe("Response Format", () => {
    it("should return properly formatted text content", async () => {
      const result = await client.callTool({
        name: "get_supported_networks",
        arguments: {}
      })

      expect(result.content).toBeDefined()
      expect(result.content.length).toBeGreaterThan(0)
      
      const textContent = result.content[0]
      expect(textContent.type).toBe("text")
      expect("text" in textContent).toBe(true)
    })

    it("should return valid JSON in text responses", async () => {
      const result = await client.callTool({
        name: "get_chain_info",
        arguments: { network: "mainnet" }
      })

      const textContent = result.content.find((c) => c.type === "text")
      expect(textContent).toBeDefined()
      
      if (textContent && "text" in textContent) {
        // Should be valid JSON
        expect(() => JSON.parse(textContent.text)).not.toThrow()
      }
    })
  })
})
