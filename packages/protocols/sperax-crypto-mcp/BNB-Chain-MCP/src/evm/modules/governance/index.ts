/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerGovernanceTools } from "./tools.js"
import { registerGovernancePrompts } from "./prompts.js"

export function registerGovernance(server: McpServer) {
  registerGovernanceTools(server)
  registerGovernancePrompts(server)
}
