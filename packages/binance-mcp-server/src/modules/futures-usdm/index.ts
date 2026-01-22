/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/futures-usdm/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesUSDMTools } from "../../tools/binance-futures-usdm/index.js";

export function registerFuturesUSDM(server: McpServer) {
    registerBinanceFuturesUSDMTools(server);
}
