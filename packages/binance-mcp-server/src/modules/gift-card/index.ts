/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/gift-card/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGiftCardTools } from "../../tools/binance-gift-card/index.js";

export function registerGiftCard(server: McpServer) {
    registerBinanceGiftCardTools(server);
}
