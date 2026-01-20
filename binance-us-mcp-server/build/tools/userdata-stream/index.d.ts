import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Register User Data Stream tools for Binance.US
 *
 * User Data Streams provide real-time updates for:
 * - Account balance updates
 * - Order updates (new, filled, canceled, etc.)
 * - Position updates
 *
 * Workflow:
 * 1. Create a listen key using binance_us_create_listen_key
 * 2. Connect to WebSocket: wss://stream.binance.us:9443/ws/<listenKey>
 * 3. Keep-alive every 30 minutes using binance_us_keepalive_listen_key
 * 4. Close when done using binance_us_close_listen_key
 *
 * Listen keys expire after 60 minutes without a keep-alive.
 */
export declare function registerUserDataStreamTools(server: McpServer): void;
//# sourceMappingURL=index.d.ts.map