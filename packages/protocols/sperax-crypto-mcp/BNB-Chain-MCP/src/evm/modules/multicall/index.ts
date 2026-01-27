/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerMulticallTools } from "./tools.js"
import { registerMulticallPrompts } from "./prompts.js"

export function registerMulticall(server: McpServer) {
  registerMulticallTools(server)
  registerMulticallPrompts(server)
}
