/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerEVM } from "@/evm.js"
import { registerX402 } from "@/x402/index.js"
import Logger from "@/utils/logger.js"

// Create and start the MCP server
export const startServer = () => {
  try {
    // Create a new MCP server instance
    const server = new McpServer({
      name: "Universal Crypto MCP",
      version: "1.1.0",
      description: "Universal MCP server for all EVM-compatible networks with x402 payment protocol"
    })

    // Register all resources, tools, and prompts
    registerEVM(server)
    
    // Register x402 payment protocol tools
    // Enables AI agents to make/receive cryptocurrency payments
    registerX402(server)
    
    return server
  } catch (error) {
    Logger.error("Failed to initialize server:", error)
    process.exit(1)
  }
}
