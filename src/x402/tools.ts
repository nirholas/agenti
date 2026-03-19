/**
 * x402 MCP Tools
 * @description MCP tools for x402 payment protocol - lets AI agents make and receive payments
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { loadX402Config, loadLegacyX402Config, isX402Configured, validateX402Config } from "./config.js"
import Logger from "@/utils/logger.js"
import {
  registerPaymentTools,
  registerWalletTools,
  registerYieldTools,
  registerNetworkTools,
  registerSecurityTools,
  registerServerTools,
} from "./tools/index.js"

/**
 * Register x402 payment tools with MCP server
 */
export function registerX402Tools(server: McpServer): void {
  const fullConfig = loadX402Config()
  const config = loadLegacyX402Config()
  const validation = validateX402Config(fullConfig)

  if (validation.errors.length > 0) {
    validation.errors.forEach(err => Logger.warn(`x402: ${err}`))
  }

  registerPaymentTools(server, config, fullConfig)
  registerWalletTools(server, config, fullConfig)
  registerYieldTools(server, config, fullConfig)
  registerNetworkTools(server, config, fullConfig)
  registerSecurityTools(server, config, fullConfig)
  registerServerTools(server, config, fullConfig)

  Logger.info(`x402: Registered 36 payment tools (chain: ${config.chain}, configured: ${isX402Configured()}) - USDs yield tools enabled!`)
}
