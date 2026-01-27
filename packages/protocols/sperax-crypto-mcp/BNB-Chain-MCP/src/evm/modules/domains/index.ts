/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerDomainsTools } from "./tools.js"
import { registerDomainsPrompts } from "./prompts.js"

export function registerDomains(server: McpServer) {
  registerDomainsTools(server)
  registerDomainsPrompts(server)
}
