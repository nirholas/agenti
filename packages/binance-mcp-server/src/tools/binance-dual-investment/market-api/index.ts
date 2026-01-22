/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-dual-investment/market-api/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetDualInvestmentProductList } from "./getDualInvestmentProductList.js";

export function registerBinanceDualInvestmentMarketApiTools(server: McpServer) {
    registerBinanceGetDualInvestmentProductList(server);
}
