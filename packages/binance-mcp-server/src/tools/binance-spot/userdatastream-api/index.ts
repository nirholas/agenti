/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-spot/userdatastream-api/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceNewUserDataStream } from "./newUserDataStream.js";
import { registerBinanceDeleteUserDataStream } from "./deleteUserDataStream.js";
import { registerBinancePutUserDataStream } from "./putUserDataStream.js";

export function registerBinanceUserDataStreamApiTools(server: McpServer) {
    registerBinanceNewUserDataStream(server);
    registerBinanceDeleteUserDataStream(server);
    registerBinancePutUserDataStream(server);
    
}
