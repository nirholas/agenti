/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
//src/tools/binance-wallet/others-api/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceWalletSystemStatus } from "./systemStatus.js";
import { registerBinanceWalletGetSymbolsDelistScheduleForSpot } from "./getSymbolsDelistScheduleForSpot.js";

export function registerBinanceWalletOthersApiTools(server: McpServer) {
    registerBinanceWalletSystemStatus(server);
    registerBinanceWalletGetSymbolsDelistScheduleForSpot(server);
    
}