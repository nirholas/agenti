import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Register all Binance.US trading tools
 *
 * Standard Order Tools (8 tools):
 * - binance_us_new_order: Place new order
 * - binance_us_test_order: Test order (no execution)
 * - binance_us_get_order: Query order status
 * - binance_us_cancel_order: Cancel active order
 * - binance_us_cancel_replace: Cancel and replace order
 * - binance_us_cancel_all_open_orders: Cancel all open orders for a symbol
 * - binance_us_open_orders: Get all open orders
 * - binance_us_all_orders: Get all orders (history)
 *
 * OCO Order Tools (5 tools):
 * - binance_us_new_oco: Place OCO order
 * - binance_us_get_oco: Query OCO order
 * - binance_us_cancel_oco: Cancel OCO order
 * - binance_us_open_oco: Get open OCO orders
 * - binance_us_all_oco_orders: Get OCO order history
 */
export declare function registerBinanceUsTradeTools(server: McpServer): void;
export { registerBinanceUsOrderTools } from "./orders.js";
export { registerBinanceUsOcoTools } from "./oco.js";
export { registerBinanceUsNewOrder, registerBinanceUsTestOrder, registerBinanceUsGetOrder, registerBinanceUsCancelOrder, registerBinanceUsCancelReplace, registerBinanceUsCancelAllOpenOrders, registerBinanceUsOpenOrders, registerBinanceUsAllOrders } from "./orders.js";
export { registerBinanceUsNewOco, registerBinanceUsGetOco, registerBinanceUsCancelOco, registerBinanceUsOpenOco, registerBinanceUsAllOcoOrders } from "./oco.js";
//# sourceMappingURL=index.d.ts.map