/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerEVM } from "@/evm.js"
import Logger from "@/utils/logger.js"

// Create and start the MCP server
export const startServer = () => {
  try {
    // Create a new MCP server instance
    const server = new McpServer({
      name: "Universal Crypto MCP",
      version: "1.0.0",
      description: "Universal MCP server for all EVM-compatible networks"
    })

    // Register all resources, tools, and prompts
    registerEVM(server)
    return server
  } catch (error) {
    Logger.error("Failed to initialize server:", error)
    process.exit(1)
  }
}
