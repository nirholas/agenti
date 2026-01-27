/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerSwapTools } from "./tools.js"
import { registerSwapPrompts } from "./prompts.js"

export function registerSwap(server: McpServer) {
  registerSwapTools(server)
  registerSwapPrompts(server)
}
