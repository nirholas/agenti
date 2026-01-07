import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerNewsPrompts } from "./prompts.js"
import { registerNewsTools } from "./tools.js"

export function registerNews(server: McpServer) {
  registerNewsTools(server)
  registerNewsPrompts(server)
}
