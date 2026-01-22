/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCryptoLoansFlexibleTools } from "./flexible-api/index.js";
import { registerBinanceCryptoLoansFixedTools } from "./fixed-api/index.js";

export function registerBinanceCryptoLoansTools(server: McpServer) {
    // Flexible loan tools
    registerBinanceCryptoLoansFlexibleTools(server);
    
    // Fixed-term loan tools
    registerBinanceCryptoLoansFixedTools(server);
}
