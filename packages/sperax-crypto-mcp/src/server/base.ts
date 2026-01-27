import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerEVM } from "@nirholas/universal-crypto-mcp"
import { registerSperax } from "@/sperax/index.js"
import Logger from "@/utils/logger.js"

// Create and start the MCP server
export const startServer = () => {
  try {
    // Create a new MCP server instance
    const server = new McpServer({
      name: "SperaxOS",
      version: "1.0.0",
      description: "Smart Agent Infrastructure for Decentralized Finance - USDs, SPA, Demeter on Arbitrum"
    })

    // Register all resources, tools, and prompts
    // EVM tools from Universal Crypto MCP (github.com/nirholas/universal-crypto-mcp)
    registerEVM(server)
    // Sperax-specific tools (USDs, SPA, Demeter, veSPA)
    registerSperax(server)
    return server
  } catch (error) {
    Logger.error("Failed to initialize server:", error)
    process.exit(1)
  }
}
