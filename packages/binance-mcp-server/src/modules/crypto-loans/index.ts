/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/crypto-loans/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCryptoLoansTools } from "../../tools/binance-crypto-loans/index.js";

export function registerCryptoLoans(server: McpServer) {
    registerBinanceCryptoLoansTools(server);
}
