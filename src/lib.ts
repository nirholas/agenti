/**
 * Library entry point - exports for use as a dependency
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
// Library entry point - exports for use as a dependency
export { registerEVM } from "./evm/index.js"
export * from "./evm/chains.js"
export * from "./evm/services/index.js"

// Re-export types
export type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
