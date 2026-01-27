// src/tools/binance-fiat/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetFiatDepositWithdrawHistory } from "./fiat-api/getFiatDepositWithdrawHistory.js";
import { registerBinanceGetFiatPaymentsHistory } from "./fiat-api/getFiatPaymentsHistory.js";

export function registerBinanceFiatDepositWithdrawHistoryTools(server: McpServer) {
    registerBinanceGetFiatDepositWithdrawHistory(server);
    registerBinanceGetFiatPaymentsHistory(server);
}
