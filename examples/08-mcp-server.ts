/**
 * Example 8: Run the agenti MCP server programmatically
 *
 * Exposes wallet, pay, balance, and receive as MCP tools so any
 * MCP-compatible AI host (Claude Desktop, Zed, etc.) can use them.
 *
 * Run:
 *   npx tsx examples/08-mcp-server.ts
 *
 * Or add to claude_desktop_config.json:
 *   { "command": "npx", "args": ["tsx", "examples/08-mcp-server.ts"] }
 */

import { createServer } from '@agenti/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = createServer()
const transport = new StdioServerTransport()
await server.connect(transport)
